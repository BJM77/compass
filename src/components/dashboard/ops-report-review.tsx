"use client";

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getCurrentWeek, getMonthWeeksForWeek, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Sparkles, Trash2, CheckCircle2, ClipboardList, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function OpsReportReview() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const currentWeek = getCurrentWeek();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [filterTime, setFilterTime] = useState<'WEEK' | 'MONTH' | 'ALL'>('WEEK');
  const [filterType, setFilterType] = useState<'ALL' | 'PROBLEM' | 'POSITIVE'>('ALL');

  const opsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'opsReports');
  }, [db]);

  const { data: allReports, isLoading: loading } = useCollection(opsQuery);

  const filteredReports = useMemo(() => {
    if (!allReports) return [];
    let list = [...allReports];

    // 1. Time Filter
    if (filterTime === 'WEEK') {
      list = list.filter(r => r.week === selectedWeek);
    } else if (filterTime === 'MONTH') {
      const monthWeeks = getMonthWeeksForWeek(selectedWeek);
      list = list.filter(r => monthWeeks.includes(r.week));
    }

    // 2. Type/Review Filter
    if (filterType !== 'ALL') {
      list = list.filter(r => r.type === filterType);
    }

    // Sort by creation time desc
    list.sort((a, b) => {
      const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
      const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [allReports, filterTime, filterType, selectedWeek]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-accent" />
            Ops Review Ledger
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Review, escalate, or archive weekly negative & positive feedback reports
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter Selection */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-[10px] font-black uppercase tracking-wider">
            <button
              onClick={() => setFilterTime('WEEK')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors", filterTime === 'WEEK' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              By Week
            </button>
            <button
              onClick={() => setFilterTime('MONTH')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors", filterTime === 'MONTH' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              By Month
            </button>
            <button
              onClick={() => setFilterTime('ALL')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors", filterTime === 'ALL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              All Time
            </button>
          </div>

          {/* Type Filter Selection */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-[10px] font-black uppercase tracking-wider">
            <button
              onClick={() => setFilterType('ALL')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors", filterType === 'ALL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('PROBLEM')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors text-orange-850", filterType === 'PROBLEM' ? 'bg-orange-100 shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              Negative
            </button>
            <button
              onClick={() => setFilterType('POSITIVE')}
              className={cn("px-3 py-1.5 rounded-lg transition-colors text-emerald-850", filterType === 'POSITIVE' ? 'bg-emerald-100 shadow-sm' : 'text-slate-500 hover:text-primary')}
            >
              Positive
            </button>
          </div>

          {filterTime !== 'ALL' && (
            <select 
              value={selectedWeek} 
              onChange={e => setSelectedWeek(e.target.value)} 
              className="rounded-lg border bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest h-9"
            >
              {getMonthWeeksForWeek(currentWeek).reverse().map((w: string) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-accent" /></div>
        ) : filteredReports.length > 0 ? (
          <div className="grid gap-4">
            {filteredReports.map((report: any) => (
              <Card key={report.id} className="border-none shadow-md bg-white hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-primary font-black text-xs uppercase shrink-0">
                        {(report.userName || '?').charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-primary">{report.userName}</span>
                      <Badge className={report.type === 'PROBLEM' ? 'bg-orange-100 text-orange-850 border-none' : 'bg-emerald-100 text-emerald-850 border-none'}>
                        {report.type === 'PROBLEM' ? 'PROBLEM (NEGATIVE)' : 'POSITIVE EVENT'}
                      </Badge>
                      <Badge variant="outline" className={report.status === 'ESCALATED' ? 'border-primary text-primary' : 'border-slate-300 text-slate-500'}>
                        {report.status}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Week {report.week?.split('-')[1]}</span>
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
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
              No reports matching search filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
