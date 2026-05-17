"use client";

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle2, AlertTriangle, Loader2, Database, FileUp, Info, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Stage Classification ────────────────────────────────────────────────────
const ACTIVE_STAGES = new Set(['develop', 'propose', 'negotiating', 'finalise', 'pending trade']);
const CLOSED_WON_STAGES = new Set(['closed won']);
// 'closed lost' → ignored entirely (not counted anywhere)

function classifyStage(stage: string): 'ACTIVE' | 'CLOSED_WON' | 'IGNORE' {
  const s = (stage || '').trim().toLowerCase();
  if (ACTIVE_STAGES.has(s)) return 'ACTIVE';
  if (CLOSED_WON_STAGES.has(s)) return 'CLOSED_WON';
  return 'IGNORE';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseMoney(val?: string | number): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

function getField(row: any, ...candidates: string[]): string {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

function matchUser(users: any[], ownerName: string): any | null {
  if (!ownerName) return null;
  const lower = ownerName.trim().toLowerCase();
  // Exact match first
  let found = users.find(u => (u.name || '').trim().toLowerCase() === lower);
  if (found) return found;
  // Partial match (first+last name subset)
  found = users.find(u => {
    const uname = (u.name || '').trim().toLowerCase();
    return uname.includes(lower) || lower.includes(uname);
  });
  return found || null;
}

function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as any[]),
      error: reject,
    });
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ProcessedRecord {
  docId: string;
  accountMasterCode: string;
  salesforceId: string;
  pipeline: string;
  opportunityName: string;
  stage: string;
  value: number;
  probability: number;
  expectedDate: string;
  businessUnit: string;
  userId: string;
  userName: string;
  currentRevenue: number;
  lastYearRevenue: number;
  lastInvoiceDate: string;
  lastActivity: string;
  creditHold: boolean;
  closedWonValue: number;
  isBareAccount: boolean;
}

interface ImportStats {
  totalRows: number;
  activeOpportunities: number;
  bareAccounts: number;
  closedWonHidden: number;
  closedLostIgnored: number;
  unmatchedOwners: string[];
  matchedBDMs: string[];
}

const STAGE_COLORS: Record<string, string> = {
  'Develop':       'bg-blue-100 text-blue-800',
  'Propose':       'bg-indigo-100 text-indigo-800',
  'Negotiating':   'bg-purple-100 text-purple-800',
  'Finalise':      'bg-orange-100 text-orange-800',
  'Pending Trade': 'bg-amber-100 text-amber-800',
  'Existing Customer': 'bg-slate-100 text-slate-600',
};

// ─── Component ───────────────────────────────────────────────────────────────
export function CRMImporter() {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = getCurrentWeek();

  const [customersFile, setCustomersFile] = useState<File | null>(null);
  const [opportunitiesFile, setOpportunitiesFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ProcessedRecord[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

  // ── Process both files ───────────────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!customersFile && !opportunitiesFile) {
      toast({ variant: 'destructive', title: 'Upload at least one file' });
      return;
    }
    if (!users || users.length === 0) {
      toast({ variant: 'destructive', title: 'No team users loaded from Firestore' });
      return;
    }
    setIsProcessing(true);
    setPreviewRecords([]);
    setStats(null);

    try {
      const [customerRows, opportunityRows] = await Promise.all([
        customersFile ? parseCSV(customersFile) : Promise.resolve([]),
        opportunitiesFile ? parseCSV(opportunitiesFile) : Promise.resolve([]),
      ]);

      // Build customer map: customerId → row data
      const customerMap = new Map<string, any>();
      customerRows.forEach(row => {
        const id = getField(row, 'Customer ID', 'customer id');
        if (id) customerMap.set(id, row);
      });

      // Build per-customer opportunity lists
      const oppsByCustomer = new Map<string, any[]>();
      opportunityRows.forEach(row => {
        const cid = getField(row, 'Customer ID', 'customer id');
        if (!cid) return;
        if (!oppsByCustomer.has(cid)) oppsByCustomer.set(cid, []);
        oppsByCustomer.get(cid)!.push(row);
      });

      // Pre-calculate closed-won totals per customer
      const closedWonMap = new Map<string, number>();
      let closedWonHidden = 0;
      let closedLostIgnored = 0;
      const unmatchedOwners = new Set<string>();
      const matchedBDMSet = new Set<string>();

      opportunityRows.forEach(row => {
        const cid = getField(row, 'Customer ID', 'customer id');
        const stage = getField(row, 'Sales Stage', 'sales stage');
        const cls = classifyStage(stage);
        if (cls === 'CLOSED_WON') {
          closedWonMap.set(cid, (closedWonMap.get(cid) || 0) + parseMoney(getField(row, 'Amount', 'amount')));
          closedWonHidden++;
        }
        if (cls === 'IGNORE') closedLostIgnored++;
      });

      const records: ProcessedRecord[] = [];
      const processedOpportunityCustomers = new Set<string>(); // track which customers got opp rows

      // PASS 1: Active opportunity rows
      opportunityRows.forEach(row => {
        const stage = getField(row, 'Sales Stage', 'sales stage');
        if (classifyStage(stage) !== 'ACTIVE') return;

        const customerId   = getField(row, 'Customer ID', 'customer id');
        const opportunityId = getField(row, 'Opportunity ID', 'opportunity id');
        const ownerName    = getField(row, 'Opportunity Owner', 'opportunity owner');
        const matchedUser  = matchUser(users, ownerName);

        if (!matchedUser) {
          if (ownerName) unmatchedOwners.add(ownerName);
          return;
        }
        matchedBDMSet.add(matchedUser.name);

        const customer = customerMap.get(customerId);
        const closedWonValue = closedWonMap.get(customerId) || 0;

        records.push({
          docId:            opportunityId || `opp_${crypto.randomUUID()}`,
          accountMasterCode: customerId,
          salesforceId:     opportunityId,
          pipeline:         getField(row, 'Account Name', 'account name') || getField(customer || {}, 'Account Name', 'account name'),
          opportunityName:  getField(row, 'Opportunity Name', 'opportunity name'),
          stage:            stage,
          value:            parseMoney(getField(row, 'Amount', 'amount')),
          probability:      parseMoney(getField(row, 'Probability (%)', 'probability (%)', 'probability')),
          expectedDate:     getField(row, 'Expected Trading Date', 'expected trading date'),
          businessUnit:     getField(row, 'Business Unit', 'business unit') || getField(customer || {}, 'Business Unit', 'business unit'),
          userId:           matchedUser.id,
          userName:         matchedUser.name,
          currentRevenue:   parseMoney(getField(customer || {}, 'YTD Revenue This FY', 'ytd revenue this fy', 'Actual YTD Revenue')),
          lastYearRevenue:  parseMoney(getField(customer || {}, 'YTD Revenue Last FY', 'ytd revenue last fy')),
          lastInvoiceDate:  getField(customer || {}, 'Last Invoice Date', 'last invoice date'),
          lastActivity:     getField(customer || {}, 'Last Activity', 'last activity'),
          creditHold:       getField(customer || {}, 'Credit Hold', 'credit hold').toLowerCase() === 'yes',
          closedWonValue,
          isBareAccount:    false,
        });

        processedOpportunityCustomers.add(`${customerId}_${matchedUser.id}`);
      });

      // PASS 2: Bare accounts (customers with no active opportunities)
      customerRows.forEach(row => {
        const customerId = getField(row, 'Customer ID', 'customer id');
        const ownerName  = getField(row, 'Account Owner', 'account owner');
        const matchedUser = matchUser(users, ownerName);

        if (!matchedUser) {
          if (ownerName) unmatchedOwners.add(ownerName);
          return;
        }
        matchedBDMSet.add(matchedUser.name);

        // Skip if this customer already has active opportunity rows for this user
        if (processedOpportunityCustomers.has(`${customerId}_${matchedUser.id}`)) return;

        const closedWonValue = closedWonMap.get(customerId) || 0;

        records.push({
          docId:            `cust_${customerId}`,
          accountMasterCode: customerId,
          salesforceId:     '',
          pipeline:         getField(row, 'Account Name', 'account name'),
          opportunityName:  '',
          stage:            'Existing Customer',
          value:            0,
          probability:      0,
          expectedDate:     '',
          businessUnit:     getField(row, 'Business Unit', 'business unit'),
          userId:           matchedUser.id,
          userName:         matchedUser.name,
          currentRevenue:   parseMoney(getField(row, 'YTD Revenue This FY', 'ytd revenue this fy', 'Actual YTD Revenue')),
          lastYearRevenue:  parseMoney(getField(row, 'YTD Revenue Last FY', 'ytd revenue last fy')),
          lastInvoiceDate:  getField(row, 'Last Invoice Date', 'last invoice date'),
          lastActivity:     getField(row, 'Last Activity', 'last activity'),
          creditHold:       getField(row, 'Credit Hold', 'credit hold').toLowerCase() === 'yes',
          closedWonValue,
          isBareAccount:    true,
        });
      });

      setPreviewRecords(records);
      setStats({
        totalRows:           customerRows.length + opportunityRows.length,
        activeOpportunities: records.filter(r => !r.isBareAccount).length,
        bareAccounts:        records.filter(r => r.isBareAccount).length,
        closedWonHidden,
        closedLostIgnored,
        unmatchedOwners:     Array.from(unmatchedOwners),
        matchedBDMs:         Array.from(matchedBDMSet),
      });

      toast({ title: `Preview Ready`, description: `${records.length} records to import.` });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Processing Failed', description: e?.message });
    } finally {
      setIsProcessing(false);
    }
  }, [customersFile, opportunitiesFile, users, toast]);

  // ── Write to Firestore ───────────────────────────────────────────────────
  const handleImport = async () => {
    if (!db || previewRecords.length === 0) return;
    setIsImporting(true);
    try {
      // Firestore batch limit is 500 operations
      const BATCH_SIZE = 400;
      let count = 0;
      for (let i = 0; i < previewRecords.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = previewRecords.slice(i, i + BATCH_SIZE);
        chunk.forEach(record => {
          const docRef = doc(db, 'pipelineReviews', record.docId);
          batch.set(docRef, {
            accountMasterCode: record.accountMasterCode,
            salesforceId:      record.salesforceId,
            pipeline:          record.pipeline,
            opportunityName:   record.opportunityName,
            stage:             record.stage,
            value:             record.value,
            probability:       record.probability,
            expectedDate:      record.expectedDate,
            businessUnit:      record.businessUnit,
            userId:            record.userId,
            userName:          record.userName,
            currentRevenue:    record.currentRevenue,
            lastYearRevenue:   record.lastYearRevenue,
            lastInvoiceDate:   record.lastInvoiceDate,
            lastActivity:      record.lastActivity,
            creditHold:        record.creditHold,
            closedWonValue:    record.closedWonValue,
            isBareAccount:     record.isBareAccount,
            week:              currentWeek,
            importedFromSF:    true,
            updatedAt:         serverTimestamp(),
            // Preserved fields (only set on first create, merge keeps existing values):
            // barriers, actionsForBen, notes, isReviewSelected, daysInStage, rolloverCount
          }, { merge: true });
          count++;
        });
        await batch.commit();
      }

      toast({ title: '✅ Import Complete', description: `${count} records synced to Firestore.` });
      setPreviewRecords([]);
      setStats(null);
      setCustomersFile(null);
      setOpportunitiesFile(null);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Import Failed', description: e?.message });
    } finally {
      setIsImporting(false);
    }
  };

  // ── File Drop Zone ───────────────────────────────────────────────────────
  const FileZone = ({
    label, hint, file, onFile, accept = '.csv'
  }: {
    label: string; hint: string; file: File | null;
    onFile: (f: File | null) => void; accept?: string;
  }) => (
    <div className={`relative rounded-2xl border-2 border-dashed p-6 transition-all cursor-pointer
      ${file ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-accent/50 bg-white'}`}
      onClick={() => document.getElementById(`file-${label.replace(/\s/g, '')}`)?.click()}
    >
      <input
        id={`file-${label.replace(/\s/g, '')}`}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] || null)}
      />
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${file ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400'}`}>
          {file ? <CheckCircle2 className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase text-primary">{label}</p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{hint}</p>
          {file && (
            <p className="text-[10px] text-accent font-bold mt-1 truncate">{file.name}</p>
          )}
        </div>
        {file && (
          <button
            onClick={e => { e.stopPropagation(); onFile(null); }}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-900 text-white pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-xl">
              <Database className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-xl font-black tracking-tight">Salesforce CRM Sync</CardTitle>
              <CardDescription className="text-slate-400 font-medium mt-0.5">
                Two-file import: Customers + Opportunities — merged by Customer ID
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Stage Rules Legend */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Info className="w-3 h-3" /> Stage Import Rules
            </p>
            <div className="flex flex-wrap gap-2">
              {['Develop', 'Propose', 'Negotiating', 'Finalise', 'Pending Trade'].map(s => (
                <Badge key={s} className="bg-green-100 text-green-800 font-bold text-[9px] border-none">
                  ✓ {s}
                </Badge>
              ))}
              <Badge className="bg-amber-100 text-amber-800 font-bold text-[9px] border-none">
                $ Closed Won (value summed, row hidden)
              </Badge>
              <Badge className="bg-red-100 text-red-800 font-bold text-[9px] border-none">
                ✕ Closed Lost (ignored)
              </Badge>
            </div>
          </div>

          {/* File Upload Zones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileZone
              label="Customers Export"
              hint="Customer ID · Account Owner · YTD Revenue · Credit Hold"
              file={customersFile}
              onFile={setCustomersFile}
            />
            <FileZone
              label="Opportunities Export"
              hint="Opportunity ID · Customer ID · Sales Stage · Amount"
              file={opportunitiesFile}
              onFile={setOpportunitiesFile}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleProcess}
              disabled={isProcessing || isImporting || (!customersFile && !opportunitiesFile)}
              className="bg-slate-900 text-white font-black uppercase text-xs h-12 px-8 rounded-xl"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Preview Import
            </Button>
            {previewRecords.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={isImporting || isProcessing}
                className="bg-accent text-white font-black uppercase text-xs h-12 px-8 rounded-xl shadow-lg"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Commit {previewRecords.length} Records to Week {currentWeek.split('-')[1]}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Panel */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Opps', value: stats.activeOpportunities, color: 'text-green-700 bg-green-50 border-green-100' },
            { label: 'Bare Accounts', value: stats.bareAccounts, color: 'text-blue-700 bg-blue-50 border-blue-100' },
            { label: 'Closed Won (hidden)', value: stats.closedWonHidden, color: 'text-amber-700 bg-amber-50 border-amber-100' },
            { label: 'Closed Lost (ignored)', value: stats.closedLostIgnored, color: 'text-red-700 bg-red-50 border-red-100' },
            { label: 'Total Pipeline Rows', value: previewRecords.length, color: 'text-primary bg-slate-50 border-slate-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 border ${s.color} text-center`}>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Unmatched Owners Warning */}
      {stats && stats.unmatchedOwners.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-orange-800 uppercase">Unmatched Opportunity Owners</p>
            <p className="text-[11px] text-orange-700 mt-1">
              These names in the CSV don't match any Compass user — their records were skipped:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {stats.unmatchedOwners.map(n => (
                <Badge key={n} className="bg-orange-100 text-orange-800 font-bold text-[10px] border-none">{n}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Matched BDMs */}
      {stats && stats.matchedBDMs.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-green-800 uppercase">Matched BDMs</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {stats.matchedBDMs.map(n => (
                <Badge key={n} className="bg-green-100 text-green-800 font-bold text-[10px] border-none">{n}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {previewRecords.length > 0 && (
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6">
            <CardTitle className="text-sm font-black uppercase tracking-tight">
              Preview — {previewRecords.length} Records for Week {currentWeek.split('-')[1]}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow className="text-[9px] font-black uppercase tracking-widest">
                  <TableHead className="pl-6">BDM</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Won $</TableHead>
                  <TableHead>Credit Hold</TableHead>
                  <TableHead>Customer ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRecords.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell className="pl-6 py-3">
                      <p className="text-[10px] font-black uppercase text-primary">{r.userName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-bold uppercase">{r.pipeline}</p>
                      <p className="text-[9px] text-muted-foreground font-mono">{r.accountMasterCode}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] text-slate-600">{r.opportunityName || '—'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[8px] font-black border-none ${STAGE_COLORS[r.stage] || 'bg-slate-100 text-slate-600'}`}>
                        {r.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-black">{r.value > 0 ? `$${r.value.toLocaleString()}` : '—'}</p>
                    </TableCell>
                    <TableCell>
                      {r.closedWonValue > 0 ? (
                        <p className="text-[10px] font-black text-green-700">${r.closedWonValue.toLocaleString()}</p>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.creditHold ? (
                        <Badge className="bg-red-100 text-red-700 text-[8px] font-black border-none">HOLD</Badge>
                      ) : <span className="text-slate-300 text-[9px]">—</span>}
                    </TableCell>
                    <TableCell>
                      <p className="text-[9px] font-mono text-slate-400">{r.accountMasterCode}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
