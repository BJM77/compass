"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Trash2, AlertTriangle, CheckCircle2, Loader2, Database, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function DuplicateManager() {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = getCurrentWeek();
  const [isPurging, setIsPurging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const allReviewsQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Scoped to current week to avoid expensive full-collection reads.
    return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek), orderBy('createdAt', 'desc'));
  }, [db, currentWeek]);

  const { data: allReviews, isLoading } = useCollection(allReviewsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: users } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach(u => {
      map[u.id] = u.name;
    });
    return map;
  }, [users]);

  const duplicates = useMemo(() => {
    if (!allReviews) return [];
    const map = new Map<string, any[]>();
    allReviews.forEach(review => {
      let key = review.accountMasterCode ? `code_${review.accountMasterCode.trim().toLowerCase()}` : `name_${review.pipeline?.trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(review);
    });
    const duplicateGroups: any[] = [];
    map.forEach((items, key) => {
      if (items.length > 1) {
        duplicateGroups.push({ key, items: items.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)) });
      }
    });
    return duplicateGroups;
  }, [allReviews]);

  const handlePurgeDuplicates = async () => {
    if (!db || duplicates.length === 0) return;
    setIsPurging(true);
    let count = 0;
    try {
      for (const group of duplicates) {
        const toDelete = group.items.slice(1);
        for (const item of toDelete) {
          await deleteDoc(doc(db, 'pipelineReviews', item.id));
          count++;
        }
      }
      toast({ title: "Database Integrity Restored", description: `Successfully purged ${count} redundant records.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Purge Failed" });
    } finally {
      setIsPurging(false);
      setShowConfirm(false);
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center py-12 gap-3"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-xs font-black uppercase text-muted-foreground">Scanning Nodes...</p></div>;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-900 text-white pb-6">
          <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><Database className="w-5 h-5" /> Duplicate Manager</CardTitle>
          <CardDescription className="text-slate-400 font-medium">Cross-referencing {allReviews?.length || 0} records.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          {duplicates.length === 0 ? (
            <div className="text-center py-20 bg-green-50 rounded-2xl border-2 border-dashed border-green-100">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-sm font-black text-green-700 uppercase tracking-widest">Data Integrity: Verified</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-orange-50 p-4 rounded-xl border border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-500 p-2 rounded-lg text-white shadow-lg"><AlertTriangle className="w-5 h-5" /></div>
                  <div><p className="text-sm font-black text-orange-800 uppercase">Redundancy Detected</p><p className="text-[11px] text-orange-700 font-bold">{duplicates.length} clusters found.</p></div>
                </div>
                <Button onClick={() => setShowConfirm(true)} disabled={isPurging} className="bg-orange-600 text-white font-black text-xs uppercase shadow-lg">
                  {isPurging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} SMART PURGE
                </Button>
              </div>
              <ScrollArea className="h-[500px] border rounded-2xl bg-white shadow-inner">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black tracking-widest"><TableHead className="pl-6">Account Identification</TableHead><TableHead>Audit Reason</TableHead><TableHead>Owners</TableHead><TableHead className="text-right pr-6">Status</TableHead></TableRow></TableHeader>
                  <TableBody>{duplicates.map((group, idx) => (
                    <TableRow key={idx} className="group hover:bg-slate-50">
                      <TableCell className="pl-6 py-4"><p className="text-xs font-black text-primary uppercase">{group.items[0].pipeline}</p><p className="text-[9px] text-muted-foreground font-mono">Code: {group.items[0].accountMasterCode || 'MISSING'}</p></TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px] font-black border-accent/20 text-accent uppercase">{group.key.startsWith('code_') ? 'Code Collision' : 'Name Collision'}</Badge></TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{Array.from(new Set(group.items.map((i: any) => userMap[i.userId] || 'Unknown'))).map((name, i) => (<Badge key={i} variant="secondary" className="text-[7px] font-bold h-4"><User className="w-2 h-2 mr-1" /> {String(name)}</Badge>))}</div></TableCell>
                      <TableCell className="text-right pr-6"><span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase">{group.items.length} Redundant</span></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-3xl p-8">
          <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black uppercase">Execute Smart Purge?</AlertDialogTitle><AlertDialogDescription className="text-sm font-bold leading-relaxed">This will delete redundant records across the territory and preserve the most recent updates for each account.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="font-black h-12 rounded-xl">CANCEL</AlertDialogCancel><AlertDialogAction onClick={handlePurgeDuplicates} className="bg-orange-600 font-black h-12 rounded-xl">EXECUTE PURGE</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}