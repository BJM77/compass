"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { History, Phone, CalendarCheck, Clock, FileText, ClipboardList } from 'lucide-react';
import { format, subWeeks, startOfWeek } from 'date-fns';
import { getCurrentWeek, getWeekForDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePipelineData } from '@/contexts/pipeline-context';
import { cn } from '@/lib/utils';

interface HistoricalActivityProps {
  userId?: string; // If provided, shows just for this user. If omitted, shows for all users.
}

export function HistoricalActivity({ userId }: HistoricalActivityProps) {
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const { setSimulationUid } = usePipelineData();
  const [selectedCell, setSelectedCell] = useState<{ userId: string; userName: string; week: string } | null>(null);

  // Generate the last 4 weeks keys
  const pastWeeks = useMemo(() => {
    const weeks = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 0 }); // Sunday
      weeks.push(getWeekForDate(weekStart));
    }
    return weeks; // e.g. ['2026-22', '2026-21', '2026-20', '2026-19']
  }, []);

  // Fetch users if we need to show everyone
  const usersQuery = useMemoFirebase(() => {
    if (!db || userId) return null;
    return collection(db, 'users');
  }, [db, userId]);
  const { data: allUsers } = useCollection(usersQuery);

  // Fetch activity for the past 4 weeks
  const progressQuery = useMemoFirebase(() => {
    if (!db) return null;
    let q = query(collection(db, 'weeklyProgress'), where('week', 'in', pastWeeks));
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    return q;
  }, [db, pastWeeks, userId]);
  const { data: progressData, isLoading } = useCollection(progressQuery);

  // Fetch callOutcomes for the past 4 weeks
  const outcomesQuery = useMemoFirebase(() => {
    if (!db) return null;
    let q = query(collection(db, 'callOutcomes'), where('week', 'in', pastWeeks));
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    return q;
  }, [db, pastWeeks, userId]);
  const { data: outcomesData } = useCollection(outcomesQuery);

  // Fetch activityLogs for the past 4 weeks
  const logsQuery = useMemoFirebase(() => {
    if (!db) return null;
    let q = query(collection(db, 'activityLogs'), where('week', 'in', pastWeeks));
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    return q;
  }, [db, pastWeeks, userId]);
  const { data: logsData } = useCollection(logsQuery);

  // Filter outcomes and logs for the active popup
  const activeOutcomes = useMemo(() => {
    if (!selectedCell || !outcomesData) return [];
    return outcomesData.filter(o => o.userId === selectedCell.userId && o.week === selectedCell.week);
  }, [selectedCell, outcomesData]);

  const activeLogs = useMemo(() => {
    if (!selectedCell || !logsData) return [];
    return logsData.filter(l => l.userId === selectedCell.userId && l.week === selectedCell.week);
  }, [selectedCell, logsData]);

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-4 text-xs font-bold text-slate-400 uppercase">Loading history...</div>;

    if (userId) {
      // Individual View: 4 cards or rows for the past 4 weeks
      return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {pastWeeks.map((week, idx) => {
            const data = progressData?.find(d => d.week === week);
            const calls = Number(data?.calls || 0);
            const apps = Number(data?.apps || 0);
            const crmCalls = Number(data?.crmCalls || 0);
            const crmApps = Number(data?.crmApps || 0);
            return (
              <div 
                key={week} 
                onClick={() => {
                  const myUser = allUsers?.find(u => u.id === userId);
                  setSelectedCell({ userId, userName: myUser?.name || 'BDM', week });
                }}
                className={cn(
                  "min-w-[120px] bg-slate-50 border border-slate-100 rounded-xl p-3 shrink-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/80 transition-all hover:scale-[1.02]",
                  idx >= 2 && "hidden sm:flex"
                )}
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                  Wk {week.split('-')[1]}
                  {week === currentWeek && <Badge className="text-[7px] px-1 py-0 h-4 bg-accent/10 text-accent border-none ml-1">LIVE</Badge>}
                </div>
                <div className="flex items-center gap-4 w-full justify-around">
                  <div className="text-center">
                    <Phone className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-slate-800">{crmCalls > 0 ? crmCalls : calls}</p>
                    {crmCalls > 0 && <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">M: {calls}</p>}
                  </div>
                  <div className="text-center">
                    <CalendarCheck className="w-3.5 h-3.5 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-slate-800">{crmApps > 0 ? crmApps : apps}</p>
                    {crmApps > 0 && <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">M: {apps}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Leader View: Table showing Users x Past 4 Weeks
    const targetUsers = allUsers?.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER') || [];
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 uppercase text-[9px] font-black tracking-widest border-b text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">BDM</th>
              {pastWeeks.map((week, idx) => (
                <th key={week} className={cn("px-4 py-3 text-center", idx >= 2 && "hidden sm:table-cell")}>
                  Wk {week.split('-')[1]}
                  {week === currentWeek && <span className="text-accent ml-1">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y text-[11px] font-bold">
            {targetUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td 
                  onClick={() => {
                    setSimulationUid(u.id);
                    window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'DASHBOARD' } }));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 py-3 uppercase text-primary cursor-pointer hover:underline font-black hover:text-primary/80"
                >
                  {u.name}
                </td>
                {pastWeeks.map((week, idx) => {
                  const data = progressData?.find(d => d.userId === u.id && d.week === week);
                  const crmCalls = Number(data?.crmCalls || 0);
                  const crmApps = Number(data?.crmApps || 0);
                  const calls = Number(data?.calls || 0);
                  const apps = Number(data?.apps || 0);
                  return (
                    <td 
                      key={week} 
                      onClick={() => {
                        setSelectedCell({ userId: u.id, userName: u.name, week });
                      }}
                      className={cn(
                        "px-4 py-3 text-center text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors",
                        idx >= 2 && "hidden sm:table-cell"
                      )}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="flex items-center gap-1 flex-col" title="Calls">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-blue-400" /> {crmCalls > 0 ? crmCalls : calls}</span>
                          {crmCalls > 0 && <span className="text-[7px] text-slate-400">M: {calls}</span>}
                        </span>
                        <span className="flex items-center gap-1 flex-col" title="Apps">
                          <span className="flex items-center gap-1"><CalendarCheck className="w-3 h-3 text-green-400" /> {crmApps > 0 ? crmApps : apps}</span>
                          {crmApps > 0 && <span className="text-[7px] text-slate-400">M: {apps}</span>}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {targetUsers.length === 0 && (
              <tr>
                <td colSpan={pastWeeks.length + 1} className="text-center py-4 text-slate-400">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className={`pb-2 ${userId ? 'pt-4 px-4' : 'bg-slate-900 text-white'}`}>
          <CardTitle className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${userId ? 'text-primary' : 'text-white'}`}>
            <History className={`w-3.5 h-3.5 ${userId ? 'text-accent' : 'text-accent'}`} /> 
            Historical Activity Tracker (4 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent className={`${userId ? 'px-4 pb-4' : 'p-0'}`}>
          {renderContent()}
        </CardContent>
      </Card>

      <Dialog open={selectedCell !== null} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-primary">
              Activity History
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase text-slate-400">
              {selectedCell?.userName} · Week {selectedCell?.week.split('-')[1]}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6 max-h-[350px] overflow-y-auto pr-2">
            {/* Call Planning Outcomes */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-500" /> Logged Call Outcomes
              </h4>
              <div className="space-y-2">
                {activeOutcomes.map((o) => (
                  <div key={o.id} className="p-3 bg-slate-50 border rounded-xl flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between items-start gap-4">
                      <p className="font-black text-slate-800 uppercase">{o.accountName}</p>
                      <Badge className={cn(
                        "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                        o.outcome === 'APPOINTMENT_BOOKED' 
                          ? "bg-green-100 text-green-700" 
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {o.outcome?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {o.notes && <p className="text-slate-600 font-medium">{o.notes}</p>}
                    <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase mt-1">
                      <Clock className="w-2.5 h-2.5" />
                      {o.createdAt?.toDate ? format(o.createdAt.toDate(), 'PPP p') : 'Recent'}
                    </div>
                  </div>
                ))}
                {activeOutcomes.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic pl-1">No call outcomes logged via planner</p>
                )}
              </div>
            </div>

            {/* Field Dictations / Visits */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-emerald-500" /> Field Dictation & Site Visits
              </h4>
              <div className="space-y-2">
                {activeLogs.map((l) => (
                  <div key={l.id} className="p-3 bg-slate-50 border rounded-xl flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <p className="font-black text-emerald-700 uppercase tracking-wider text-[10px]">{l.type}</p>
                      <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase">
                        <Clock className="w-2.5 h-2.5" />
                        {l.createdAt?.toDate ? format(l.createdAt.toDate(), 'PPP p') : 'Recent'}
                      </div>
                    </div>
                    <p className="text-slate-600 font-medium italic">"{l.description}"</p>
                  </div>
                ))}
                {activeLogs.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic pl-1">No field dictation logs found</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
