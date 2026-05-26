"use client";

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp, getDocs, query, where, updateDoc, getDoc } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';
import { differenceInCalendarWeeks, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle2, AlertTriangle, Loader2, Database, FileUp, Info, X, Trash2, RefreshCw, Phone, CalendarCheck, FileText, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

function parseAustralianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  const [datePart] = cleanStr.split(' ');
  const parts = datePart.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);
    if (parts[2].length === 2) {
      year += 2000;
    }
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function getWeekForDate(date: Date): string {
  let currentYear = date.getFullYear();
  let firstMondayOfApril = new Date(currentYear, 3, 1);
  while (firstMondayOfApril.getDay() !== 1) {
    firstMondayOfApril.setDate(firstMondayOfApril.getDate() + 1);
  }
  if (isBefore(date, firstMondayOfApril)) {
    currentYear -= 1;
    firstMondayOfApril = new Date(currentYear, 3, 1);
    while (firstMondayOfApril.getDay() !== 1) {
      firstMondayOfApril.setDate(firstMondayOfApril.getDate() + 1);
    }
  }
  const weekNumber = differenceInCalendarWeeks(date, firstMondayOfApril, { weekStartsOn: 1 }) + 1;
  const paddedWeek = weekNumber.toString().padStart(2, '0');
  return `${currentYear}-${paddedWeek}`;
}

function classifyActivity(row: any): 'CALL' | 'APP' {
  const activityType = getField(row, 'Activity Type', 'activity type').toLowerCase();
  const subject = getField(row, 'Subject', 'subject').toLowerCase();
  const recordType = getField(row, 'Task/Event Record Type', 'task/event record type').toLowerCase();

  const isMeeting = 
    activityType.includes('meeting') || activityType.includes('appointment') || activityType.includes('app') || activityType.includes('visit') || activityType.includes('f2f') ||
    subject.includes('meeting') || subject.includes('appointment') || subject.includes('app') || subject.includes('visit') || subject.includes('f2f') || subject.includes('? m') ||
    recordType.includes('event') || recordType.includes('meeting');

  if (isMeeting) return 'APP';
  return 'CALL';
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
  totalActivityRows?: number;
  completedCalls?: number;
  completedApps?: number;
  unmatchedActivityOwners?: string[];
  matchedActivityBDMs?: string[];
}

interface ProcessedActivityRecord {
  userId: string;
  userName: string;
  week: string;
  calls: number;
  apps: number;
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
  const [activityFile, setActivityFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ProcessedRecord[]>([]);
  const [previewActivityRecords, setPreviewActivityRecords] = useState<ProcessedActivityRecord[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Detect if today is Saturday — show a reminder banner
  const isSaturday = new Date().getDay() === 6;

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

  // ── Purge Data ───────────────────────────────────────────────────────────
  const handlePurge = async (scope: 'WEEK' | 'ALL') => {
    if (!db) return;
    setIsPurging(true);
    try {
      const colRef = collection(db, 'pipelineReviews');
      const q = scope === 'WEEK' ? query(colRef, where('week', '==', currentWeek)) : colRef;
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast({ title: 'No Data to Purge', description: scope === 'WEEK' ? `No pipeline records found for week ${currentWeek}.` : 'Pipeline is already empty.' });
        return;
      }

      const BATCH_SIZE = 400;
      let deletedCount = 0;
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedCount += chunk.length;
      }

      toast({ title: '✅ Data Purged', description: `Successfully deleted ${deletedCount} pipeline records (${scope === 'WEEK' ? `Week ${currentWeek}` : 'All History'}).` });
    } catch (e: any) {
      console.error('Purge error:', e);
      toast({ variant: 'destructive', title: 'Purge Failed', description: e?.message });
    } finally {
      setIsPurging(false);
    }
  };

  // ── Reset Weekly Activity (CALL / APP / OPP / WIN) ────────────────────────
  const handleActivityReset = async (week: string) => {
    if (!db) return;
    setIsResetting(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'weeklyProgress'), where('week', '==', week))
      );

      if (snap.empty) {
        toast({ title: 'Nothing to Reset', description: `No activity records found for week ${week}.` });
        return;
      }

      const BATCH_SIZE = 400;
      let count = 0;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.update(d.ref, {
          calls: 0,
          apps: 0,
          proposals: 0,
          deals: 0,
          resetAt: serverTimestamp(),
        }));
        await batch.commit();
        count += chunk.length;
      }

      toast({ title: '✅ Activity Reset', description: `Zeroed CALL/APP/OPP/WIN for ${count} users on week ${week}.` });
    } catch (e: any) {
      console.error('Activity reset error:', e);
      toast({ variant: 'destructive', title: 'Reset Failed', description: e?.message });
    } finally {
      setIsResetting(false);
    }
  };

  // ── Process all files ───────────────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!customersFile && !opportunitiesFile && !activityFile) {
      toast({ variant: 'destructive', title: 'Upload at least one file' });
      return;
    }
    if (!users || users.length === 0) {
      toast({ variant: 'destructive', title: 'No team users loaded from Firestore' });
      return;
    }
    setIsProcessing(true);
    setPreviewRecords([]);
    setPreviewActivityRecords([]);
    setStats(null);

    try {
      const [customerRows, opportunityRows, activityRows] = await Promise.all([
        customersFile ? parseCSV(customersFile) : Promise.resolve([]),
        opportunitiesFile ? parseCSV(opportunitiesFile) : Promise.resolve([]),
        activityFile ? parseCSV(activityFile) : Promise.resolve([]),
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

      // PASS 3: Activity CSV Rows
      const activityMap = new Map<string, { calls: number; apps: number }>();
      const unmatchedActivityOwners = new Set<string>();
      const matchedActivityBDMSet = new Set<string>();

      activityRows.forEach(row => {
        const status = getField(row, 'Status', 'status').toLowerCase();
        const completedDateStr = getField(row, 'Completed Date/Time', 'completed date/time') || getField(row, 'Date', 'date');
        const assignedName = getField(row, 'Assigned', 'assigned');

        // Check if completed: either status is 'completed' or completed date/time is provided
        const isCompleted = status === 'completed' || !!getField(row, 'Completed Date/Time', 'completed date/time');
        if (!isCompleted || !assignedName || !completedDateStr) return;

        const matchedUser = matchUser(users, assignedName);
        if (!matchedUser) {
          unmatchedActivityOwners.add(assignedName);
          return;
        }
        matchedActivityBDMSet.add(matchedUser.name);

        const date = parseAustralianDate(completedDateStr);
        if (!date) return;

        const week = getWeekForDate(date);
        const key = `${matchedUser.id}_${week}`;

        const type = classifyActivity(row);
        if (!activityMap.has(key)) {
          activityMap.set(key, { calls: 0, apps: 0 });
        }

        const counts = activityMap.get(key)!;
        if (type === 'CALL') {
          counts.calls += 1;
        } else if (type === 'APP') {
          counts.apps += 1;
        }
      });

      const actRecords: ProcessedActivityRecord[] = [];
      let completedCalls = 0;
      let completedApps = 0;
      activityMap.forEach((counts, key) => {
        const [uid, w] = key.split('_');
        const u = users.find(x => x.id === uid);
        actRecords.push({
          userId: uid,
          userName: u ? u.name : 'Unknown',
          week: w,
          calls: counts.calls,
          apps: counts.apps
        });
        completedCalls += counts.calls;
        completedApps += counts.apps;
      });

      // Sort activity preview records by week desc, then user name
      actRecords.sort((a, b) => b.week.localeCompare(a.week) || a.userName.localeCompare(b.userName));

      setPreviewRecords(records);
      setPreviewActivityRecords(actRecords);
      setStats({
        totalRows:           customerRows.length + opportunityRows.length + activityRows.length,
        activeOpportunities: records.filter(r => !r.isBareAccount).length,
        bareAccounts:        records.filter(r => r.isBareAccount).length,
        closedWonHidden,
        closedLostIgnored,
        unmatchedOwners:     Array.from(unmatchedOwners),
        matchedBDMs:         Array.from(matchedBDMSet),
        totalActivityRows:   activityRows.length,
        completedCalls,
        completedApps,
        unmatchedActivityOwners: Array.from(unmatchedActivityOwners),
        matchedActivityBDMs: Array.from(matchedActivityBDMSet),
      });

      const pipelineMsg = records.length > 0 ? `${records.length} pipeline records` : '';
      const activityMsg = actRecords.length > 0 ? `${actRecords.length} activity entries` : '';
      const and = records.length > 0 && actRecords.length > 0 ? ' & ' : '';
      toast({ title: `Preview Ready`, description: `Processed ${pipelineMsg}${and}${activityMsg}.` });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Processing Failed', description: e?.message });
    } finally {
      setIsProcessing(false);
    }
  }, [customersFile, opportunitiesFile, activityFile, users, toast]);

  // ── Write to Firestore ───────────────────────────────────────────────────
  const handleImport = async () => {
    if (!db || !users) return;
    if (previewRecords.length === 0 && previewActivityRecords.length === 0) {
      toast({ variant: 'destructive', title: 'No records to import' });
      return;
    }
    setIsImporting(true);
    try {
      let count = 0;
      
      // 1. Process pipeline imports if available
      if (previewRecords.length > 0) {
        // Calculate per-user YTD revenue deduplicating by accountMasterCode
        const userRevMap = new Map<string, Map<string, number>>();
        previewRecords.forEach(r => {
          if (!r.userId) return;
          if (!userRevMap.has(r.userId)) userRevMap.set(r.userId, new Map());
          const code = r.accountMasterCode || r.docId;
          if (!userRevMap.get(r.userId)!.has(code)) {
            userRevMap.get(r.userId)!.set(code, Number(r.currentRevenue) || 0);
          }
        });

        // Calculate total YTD revenue sum per user
        const userRevenueTotals = new Map<string, number>();
        userRevMap.forEach((acctMap, uid) => {
          let sum = 0;
          acctMap.forEach(v => sum += v);
          userRevenueTotals.set(uid, sum);
        });

        // Batch commit pipeline records
        const BATCH_SIZE = 400;
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
            }, { merge: true });
            count++;
          });
          await batch.commit();
        }

        // Batch commit bdmStats updates so Governance Command and Matrices are populated
        const statsBatch = writeBatch(db);
        users.forEach(u => {
          if (u.role === 'LEADER') return;
          const rev = userRevenueTotals.get(u.id) || 0;
          const statRef = doc(db, 'bdmStats', u.id);
          statsBatch.set(statRef, {
            id: u.id,
            name: u.name,
            role: u.role,
            territory: u.territory || 'FLEX',
            target: Number(u.target) || 2500000,
            revenueYTD: rev,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
        await statsBatch.commit();
      }

      // 2. Process activity imports if available
      let activityImportCount = 0;
      if (previewActivityRecords.length > 0) {
        const BATCH_SIZE = 400;
        for (let i = 0; i < previewActivityRecords.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = previewActivityRecords.slice(i, i + BATCH_SIZE);
          
          chunk.forEach(record => {
            const docId = `${record.userId}_${record.week}`;
            const progressRef = doc(db, 'weeklyProgress', docId);
            batch.set(progressRef, {
              userId: record.userId,
              week: record.week,
              calls: record.calls,
              apps: record.apps,
              updatedAt: serverTimestamp(),
            }, { merge: true });
            activityImportCount++;
          });
          await batch.commit();
        }

        // Fetch and merge into existing weeklyReports summaries in bulk for unique weeks
        const uniqueWeeks = Array.from(new Set(previewActivityRecords.map(r => r.week)));
        if (uniqueWeeks.length > 0) {
          const reportsSnap = await getDocs(
            query(collection(db, 'weeklyReports'), where('week', 'in', uniqueWeeks))
          );
          
          if (!reportsSnap.empty) {
            const reportsBatch = writeBatch(db);
            let reportsUpdatedCount = 0;
            
            reportsSnap.docs.forEach(docSnap => {
              const data = docSnap.data();
              const userId = data.userId;
              const week = data.week;
              
              const actRecord = previewActivityRecords.find(r => r.userId === userId && r.week === week);
              if (actRecord) {
                const summary = data.summary || {};
                reportsBatch.set(docSnap.ref, {
                  summary: {
                    ...summary,
                    callsMade: actRecord.calls,
                    meetingsHeld: actRecord.apps
                  }
                }, { merge: true });
                reportsUpdatedCount++;
              }
            });
            
            if (reportsUpdatedCount > 0) {
              await reportsBatch.commit();
            }
          }
        }
      }

      const pipelineMsg = count > 0 ? `${count} pipeline records` : '';
      const activityMsg = activityImportCount > 0 ? `${activityImportCount} activity aggregates` : '';
      const and = count > 0 && activityImportCount > 0 ? ' & ' : '';
      toast({ title: '✅ Import Complete', description: `Successfully synced ${pipelineMsg}${and}${activityMsg} to Firestore.` });

      setPreviewRecords([]);
      setPreviewActivityRecords([]);
      setStats(null);
      setCustomersFile(null);
      setOpportunitiesFile(null);
      setActivityFile(null);
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-xl">
                <Database className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-xl font-black tracking-tight">Salesforce CRM Sync</CardTitle>
                <CardDescription className="text-slate-400 font-medium mt-0.5">
                  Three-file import: Customers, Opportunities, and Activities — merged and aggregated
                </CardDescription>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isPurging || isProcessing || isImporting} className="font-black uppercase text-xs h-10 px-5 rounded-xl shadow-lg bg-red-600 hover:bg-red-700 transition-all">
                  {isPurging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {isPurging ? 'Purging...' : 'Purge Data'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white border-slate-200 shadow-2xl rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black uppercase text-red-600 flex items-center gap-2 tracking-tight">
                    <AlertTriangle className="w-6 h-6 text-red-600" /> Purge Pipeline Data
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600 font-medium text-xs mt-1">
                    Select whether to reset and delete accounts/opportunities for the current week or across the entire database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3 py-4">
                  <Button variant="outline" onClick={() => handlePurge('WEEK')} className="justify-start h-12 text-xs font-black uppercase text-slate-800 border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all rounded-xl shadow-sm">
                    <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Purge Current Week ({currentWeek}) Only
                  </Button>
                  <Button variant="outline" onClick={() => handlePurge('ALL')} className="justify-start h-12 text-xs font-black uppercase text-red-600 border-red-200 hover:bg-red-600 hover:text-white transition-all rounded-xl shadow-sm">
                    <AlertTriangle className="w-4 h-4 mr-2" /> Purge Entire Pipeline History (All Weeks)
                  </Button>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-black uppercase text-xs rounded-xl h-10 px-6">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <FileZone
              label="Activity Export"
              hint="Assigned · Completed Date · Subject · Status"
              file={activityFile}
              onFile={setActivityFile}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleProcess}
              disabled={isProcessing || isImporting || (!customersFile && !opportunitiesFile && !activityFile)}
              className="bg-slate-900 text-white font-black uppercase text-xs h-12 px-8 rounded-xl"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Preview Import
            </Button>
            {(previewRecords.length > 0 || previewActivityRecords.length > 0) && (
              <Button
                onClick={handleImport}
                disabled={isImporting || isProcessing}
                className="bg-accent text-white font-black uppercase text-xs h-12 px-8 rounded-xl shadow-lg"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Commit {previewRecords.length + previewActivityRecords.length} Records to Week {currentWeek.split('-')[1]}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats Panel */}
      {stats && previewRecords.length > 0 && (
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

      {/* Activity Stats Panel */}
      {stats && previewActivityRecords.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Activity Rows', value: stats.totalActivityRows, color: 'text-slate-700 bg-slate-50 border-slate-200' },
            { label: 'Completed Calls', value: stats.completedCalls, color: 'text-blue-700 bg-blue-50 border-blue-100' },
            { label: 'Completed Meetings', value: stats.completedApps, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
            { label: 'Unique BDM-Weeks', value: previewActivityRecords.length, color: 'text-purple-700 bg-purple-50 border-purple-100' },
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

      {/* Unmatched Activity Owners Warning */}
      {stats && stats.unmatchedActivityOwners && stats.unmatchedActivityOwners.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-orange-800 uppercase">Unmatched Activity Owners</p>
            <p className="text-[11px] text-orange-700 mt-1">
              These names in the Activity CSV don't match any Compass user — their activity counts were skipped:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {stats.unmatchedActivityOwners.map(n => (
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

      {/* Activity Preview Table */}
      {previewActivityRecords.length > 0 && (
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6">
            <CardTitle className="text-sm font-black uppercase tracking-tight">
              Preview — {previewActivityRecords.length} Activity Aggregations by Week
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow className="text-[9px] font-black uppercase tracking-widest">
                  <TableHead className="pl-6">BDM</TableHead>
                  <TableHead>Financial Week</TableHead>
                  <TableHead>Completed Calls</TableHead>
                  <TableHead>Completed Apps (Meetings)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewActivityRecords.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell className="pl-6 py-3">
                      <p className="text-[10px] font-black uppercase text-primary">{r.userName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-bold">Week {r.week.split('-')[1]} ({r.week})</p>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px] font-black bg-blue-100 text-blue-800 border-none px-3 py-1">
                        {r.calls} Calls
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px] font-black bg-emerald-100 text-emerald-800 border-none px-3 py-1">
                        {r.apps} Meetings
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}

      {/* ─── Activity Reset Card ──────────────────────────────────────── */}
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-800 text-white pb-5 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-400/20 rounded-xl">
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base font-black tracking-tight">Activity Counter Reset</CardTitle>
                <CardDescription className="text-slate-400 font-medium mt-0.5 text-xs">
                  Zero out CALL · APP · OPP · WIN for all team members
                </CardDescription>
              </div>
            </div>
            {isSaturday && (
              <Badge className="bg-amber-400/20 text-amber-400 border-none font-black text-[9px] uppercase animate-pulse">
                ⚡ Saturday — Reset Recommended
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* What gets reset info */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Phone,         label: 'Calls',   color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { icon: CalendarCheck, label: 'Apps',    color: 'bg-green-50 text-green-600 border-green-100' },
              { icon: FileText,      label: 'Opps',    color: 'bg-purple-50 text-purple-600 border-purple-100' },
              { icon: Target,        label: 'Wins',    color: 'bg-orange-50 text-orange-600 border-orange-100' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`rounded-2xl border p-3 text-center ${color}`}>
                <Icon className="w-5 h-5 mx-auto mb-1 opacity-70" />
                <p className="text-[9px] font-black uppercase tracking-widest">{label}</p>
                <p className="text-lg font-black mt-0.5">→ 0</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            This zeroes all activity counters for the current week <strong className="text-slate-700">(Week {currentWeek.split('-')[1]})</strong> for every team member.
            Use this every Saturday to ensure a clean slate before the new week begins on Monday.
            The system automatically starts a new week document on Monday, but running this on Saturday ensures the leaderboard shows clean data over the weekend.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isResetting || isPurging || isImporting}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs rounded-xl shadow-lg transition-all"
              >
                {isResetting
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Resetting...</>
                  : <><RefreshCw className="w-4 h-4 mr-2" /> Reset Current Week Activity (Week {currentWeek.split('-')[1]})</>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border-slate-200 shadow-2xl rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black uppercase text-blue-700 flex items-center gap-2 tracking-tight">
                  <RefreshCw className="w-6 h-6 text-blue-600" /> Reset Team Activity
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600 font-medium text-xs mt-1">
                  This will set <strong>Calls, Apps, Opps and Wins to 0</strong> for all team members for Week {currentWeek.split('-')[1]}.
                  Their historical records from prior weeks are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Button
                  onClick={() => handleActivityReset(currentWeek)}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Confirm Reset — Week {currentWeek.split('-')[1]}
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-black uppercase text-xs rounded-xl h-10 px-6">Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
