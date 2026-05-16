
"use client";

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Upload, CheckCircle2, Loader2, Database, RefreshCw, Trash2, Info, AlertTriangle, Users, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type ImportType = 'BDM' | 'AM' | null;

export function CRMImporter() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [pasteData, setPasteData] = useState('');
  const [importType, setImportType] = useState<ImportType>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentWeek = getCurrentWeek();

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

  const processResults = (results: any) => {
    setIsParsing(false);
    
    if (results.errors && results.errors.length > 0) {
      toast({ variant: "destructive", title: "Parse Error", description: results.errors[0].message });
      return;
    }

    const normalizedData = results.data.map((row: any) => {
      const normalized: any = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.trim().replace(/^\ufeff/, "");
        const value = row[key];
        normalized[cleanKey] = typeof value === 'string' ? value.trim() : value;
      });
      return normalized;
    });

    const cleanData = normalizedData.filter((row: any) => 
      row["Account Owner"] || row["Account Name"] || row["Master Customer / Billing Account"] || row["Actual YTD Revenue"]
    );

    if (cleanData.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "Mapping Failed", 
        description: "Corporate headers not detected. Please verify CSV format." 
      });
      return;
    }

    setParsedData(cleanData);
    toast({ title: "Data Staged", description: `${cleanData.length} records verified for alignment.` });
  };

  const parseCurrency = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/[$, ]/g, '').replace(/[^0-9.-]+/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const runImport = async () => {
    if (!db || parsedData.length === 0 || !users || !importType) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Select Data Type (AM or BDM) to proceed." });
      return;
    }
    
    setIsImporting(true);
    setImportProgress(10);

    try {
      // 1. Fetch Existing Reviews for this week to preserve stages/manual data
      const existingSnap = await getDocs(query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek)));
      const existingDataMap = new Map();
      existingSnap.docs.forEach(d => existingDataMap.set(d.id, d.data()));

      const aggregatedDeals: Record<string, any> = {};
      const statsByUser: Record<string, { rev: number; target: number; name: string; role: string; territory: string }> = {};
      
      parsedData.forEach(row => {
        const ownerName = String(row["Account Owner"] || "").trim();
        const owner = users.find(u => u.name.toLowerCase() === ownerName.toLowerCase());
        if (!owner) return;
        
        if (importType === 'AM' && owner.role !== 'ACCOUNT_MANAGER') return;
        if (importType === 'BDM' && owner.role !== 'BDM') return;

        const rev = parseCurrency(row["Actual YTD Revenue"]);
        const accountName = row["Account Name"] || 'Unknown Account';
        const code = String(row["Master Customer / Billing Account"] || "").trim() || `ID_${accountName.replace(/\W/g, '')}`;
        
        const docId = `${owner.id}_${code.replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (!aggregatedDeals[docId]) {
          const existing = existingDataMap.get(docId);
          aggregatedDeals[docId] = {
            userId: owner.id,
            week: currentWeek,
            accountMasterCode: code,
            pipeline: accountName,
            value: 0,
            // PRESERVE STAGE: Only set default if it's a brand new record
            stage: existing?.stage || (importType === 'AM' ? 'Portfolio' : 'Discovery'),
            barriers: existing?.barriers || '',
            actionsForBen: existing?.actionsForBen || '',
            isReviewSelected: existing?.isReviewSelected || false
          };
        }
        aggregatedDeals[docId].value += rev;

        if (!statsByUser[owner.id]) {
          statsByUser[owner.id] = { 
            rev: 0, 
            target: owner.target || 2500000,
            name: owner.name,
            role: owner.role,
            territory: owner.territory || 'FLEX'
          };
        }
        statsByUser[owner.id].rev += rev;
      });

      const uniqueDocIds = Object.keys(aggregatedDeals);
      const totalDocs = uniqueDocIds.length;

      if (totalDocs === 0) {
        toast({ variant: "destructive", title: "Zero Matches", description: "No CSV owners matched provisioned users." });
        setIsImporting(false);
        return;
      }

      const CHUNK_SIZE = 400;
      for (let i = 0; i < totalDocs; i += CHUNK_SIZE) {
        const chunkIds = uniqueDocIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunkIds.forEach(id => {
          const deal = aggregatedDeals[id];
          const docRef = doc(db, 'pipelineReviews', id);
          batch.set(docRef, {
            ...deal,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });

        await batch.commit();
        setImportProgress(Math.min(95, 30 + Math.round(((i + chunkIds.length) / totalDocs) * 60)));
      }

      const statsBatch = writeBatch(db);
      Object.entries(statsByUser).forEach(([uid, s]) => {
        statsBatch.set(doc(db, 'bdmStats', uid), { 
          id: uid,
          revenueYTD: s.rev, 
          target: s.target, 
          name: s.name,
          role: s.role,
          territory: s.territory,
          updatedAt: serverTimestamp() 
        }, { merge: true });
      });
      await statsBatch.commit();

      setImportProgress(100);
      toast({ title: "Territory Synchronised", description: `Updated ${totalDocs} unique ${importType} nodes.` });
      setIsOpen(false);
      setParsedData([]);
      setPasteData('');
      setImportType(null);
    } catch (e: any) {
      console.error("Sync Failure:", e);
      toast({ variant: "destructive", title: "Sync Exception", description: e.message || 'Batch commit failed.' });
    } finally { 
      setIsImporting(false); 
      setImportProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-10 text-[10px] md:text-xs font-black"><RefreshCw className="w-4 h-4 mr-2" /> MASTER SYNC</Button></DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-6 rounded-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase font-black text-2xl tracking-tighter text-primary">
            <Database className="w-6 h-6 text-accent" /> Master Territory Sync
          </DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
            Governance Node: Manual updates to Stage and Barriers are preserved during CRM synchronisation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-6 py-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
             <Button 
               variant={importType === 'AM' ? 'default' : 'outline'}
               onClick={() => setImportType('AM')}
               className={`h-20 rounded-2xl flex flex-col gap-1 transition-all ${importType === 'AM' ? 'bg-primary shadow-xl scale-[1.02]' : 'hover:border-primary'}`}
             >
                <Users className="w-5 h-5" />
                <span className="font-black text-xs uppercase">Account Management Data</span>
                <span className="text-[8px] opacity-70 uppercase tracking-widest">Portfolio Revenue</span>
             </Button>
             <Button 
               variant={importType === 'BDM' ? 'default' : 'outline'}
               onClick={() => setImportType('BDM')}
               className={`h-20 rounded-2xl flex flex-col gap-1 transition-all ${importType === 'BDM' ? 'bg-accent text-white shadow-xl scale-[1.02]' : 'hover:border-accent'}`}
             >
                <Target className="w-5 h-5" />
                <span className="font-black text-xs uppercase">BDM Acquisition Data</span>
                <span className="text-[8px] opacity-70 uppercase tracking-widest">Pipeline Revenue</span>
             </Button>
          </div>

          <Alert className="bg-slate-50 border-slate-200 rounded-2xl">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-[10px] font-black uppercase tracking-tight">Preservation Protocol</AlertTitle>
            <AlertDescription className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed mt-1">
              Existing doc stages and barriers will <span className="text-primary">NOT</span> be overwritten. Required Headers: <span className="text-primary">Account Owner</span> • <span className="text-primary">Account Name</span> • <span className="text-primary">Actual YTD Revenue</span> • <span className="text-primary">Master Customer / Billing Account</span>
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="upload" className="flex-1 flex flex-col gap-4">
            <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl h-10">
              <TabsTrigger value="upload" className="font-black text-[10px] uppercase">UPLOAD FILE</TabsTrigger>
              <TabsTrigger value="paste" className="font-black text-[10px] uppercase">PASTE DATA</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="flex-1 mt-0">
              <div 
                className="h-full min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl cursor-pointer hover:bg-slate-50 transition-colors border-slate-200 group"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-300 mb-2 group-hover:text-accent transition-colors" />
                <p className="font-black text-xs uppercase tracking-tight text-slate-500">Drop {importType || 'Corporate'} CSV Here</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv"
                  onChange={e => { 
                    const f = e.target.files?.[0]; 
                    if (f) {
                      setIsParsing(true);
                      Papa.parse(f, { 
                        header: true, 
                        skipEmptyLines: true,
                        complete: processResults,
                        error: (err) => { setIsParsing(false); toast({ variant: "destructive", title: "Load Error", description: err.message }); }
                      }); 
                      e.target.value = '';
                    }
                  }} 
                />
              </div>
            </TabsContent>

            <TabsContent value="paste" className="flex-1 flex flex-col gap-2 mt-0">
              <Textarea 
                placeholder="Paste account owner data here..."
                className="flex-1 font-mono text-[9px] bg-slate-50 border-slate-200 rounded-2xl resize-none p-3 min-h-[120px]" 
                value={pasteData} 
                onChange={e => setPasteData(e.target.value)} 
              />
              <Button 
                onClick={() => { 
                  setIsParsing(true); 
                  Papa.parse(pasteData, { 
                    header: true, 
                    skipEmptyLines: true,
                    complete: processResults,
                    error: (err: any) => { setIsParsing(false); toast({ variant: "destructive", title: "Parse Error", description: err.message }); }
                  }); 
                }} 
                className="bg-accent font-black h-10 uppercase rounded-xl text-[10px]"
                disabled={!pasteData.trim() || isParsing}
              >
                {isParsing ? <Loader2 className="animate-spin" /> : "PARSE SELECTION"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {isImporting && (
          <div className="space-y-2 py-4">
            <div className="flex justify-between text-[10px] font-black uppercase">
              <span>Synchronising {importType} Stream...</span>
              <span>{importProgress}%</span>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 border-t mt-4">
          <Button 
            onClick={runImport} 
            disabled={parsedData.length === 0 || isImporting || !importType} 
            className="w-full bg-primary font-black h-14 uppercase text-sm rounded-xl shadow-xl shadow-primary/20"
          >
            {isImporting ? <Loader2 className="animate-spin mr-2 w-5 h-5" /> : <CheckCircle2 className="mr-2 w-5 h-5" />} 
            COMMIT {importType} SYNCHRONISATION
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
