"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getCurrentWeek, getMonthWeeksForWeek } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Sparkles, Trash2, CheckCircle2, ClipboardList, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function OpsReportReview() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const currentWeek = getCurrentWeek();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const opsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'opsReports'),
      where('week', '==', selectedWeek)
    );
  }, [db, selectedWeek]);

  const { data: reports, loading } = useCollection(opsQuery);

  const handleUpdateStatus = async (id: string, newStatus: 'ESCALATED' | 'DISMISSED') => {
    try {
      if (!db) throw new Error("Not connected");
      await updateDoc(doc(db, 'opsReports', id), { status: newStatus });
      toast({ title: 'Success', description: `Report status updated to ${newStatus}.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update report status.' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!db) throw new Error("Not connected");
      await deleteDoc(doc(db, 'opsReports', id));
      toast({ title: 'Deleted', description: 'Report deleted successfully.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete report.' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-accent" />
            Ops Report Review
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Review, escalate, or delete weekly operational reports
          </p>
        </div>
        <select 
          value={selectedWeek} 
          onChange={e => setSelectedWeek(e.target.value)} 
          className="rounded-lg border bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest"
        >
          {getMonthWeeksForWeek(currentWeek).reverse().map((w: string) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-accent" /></div>
        ) : reports && reports.length > 0 ? (
          <div className="grid gap-4">
            {reports.map((report: any) => (
              <Card key={report.id} className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-primary font-black text-xs uppercase shrink-0">
                        {(report.userName || '?').charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-primary">{report.userName}</span>
                      <Badge className={report.type === 'PROBLEM' ? 'bg-orange-100 text-orange-800 border-none' : 'bg-emerald-100 text-emerald-800 border-none'}>
                        {report.type === 'PROBLEM' ? 'PROBLEM' : 'POSITIVE EVENT'}
                      </Badge>
                      <Badge variant="outline" className={report.status === 'ESCALATED' ? 'border-primary text-primary' : 'border-slate-300 text-slate-500'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{report.description}</p>
                    {report.createdAt && (
                      <div className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                        Submitted: {report.createdAt.toDate?.().toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto">
                    {report.status === 'ESCALATED' ? (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(report.id, 'DISMISSED')} className="flex-1 md:flex-none text-slate-600 hover:text-slate-900 text-xs font-bold uppercase">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Dismiss
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(report.id, 'ESCALATED')} className="flex-1 md:flex-none text-primary hover:text-primary text-xs font-bold uppercase border-primary/20 bg-primary/5">
                        <Shield className="w-4 h-4 mr-2" /> Escalate
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(report.id)} className="flex-1 md:flex-none text-xs font-bold uppercase bg-red-600 hover:bg-red-700">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No ops reports found for Week {selectedWeek.split('-')[1]}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
