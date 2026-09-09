"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { History, Phone, CalendarCheck, Clock, FileText, ClipboardList, Target, Sparkles } from 'lucide-react';
import { format, subWeeks, startOfWeek } from 'date-fns';
import { deduplicateUsers, getCurrentWeek, getWeekForDate, isUserSubmissionMatch, normalizeBdmName, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePipelineData } from '@/contexts/pipeline-context';

interface HistoricalActivityProps {
  userId?: string; // If provided, shows just for this user. If omitted, shows for all users.
}

export function HistoricalActivity({ userId }: HistoricalActivityProps) {
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const { setSimulationUid } = usePipelineData();
  const [selectedCell, setSelectedCell] = useState<{ userId: string; userName: string; week: string; userObj?: any } | null>(null);

  // Generate the last 4 weeks keys
  const pastWeeks = useMemo(() => {
    const weeks = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }); // Monday
      weeks.push(getWeekForDate(weekStart));
    }
    return weeks; // e.g. ['2026-22', '2026-21', '2026-20', '2026-19']
  }, []);

  // Fetch users if we need to show everyone or resolve profile
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: allUsers } = useCollection(usersQuery);

  // Fetch activity for the past 4 weeks
  const progressQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (userId) {
      return query(collection(db, 'weeklyProgress'), where('userId', '==', userId));
    }
    return query(collection(db, 'weeklyProgress'), where('week', 'in', pastWeeks));
  }, [db, pastWeeks, userId]);
  const { data: progressDataRaw, isLoading } = useCollection(progressQuery);
  const progressData = useMemo(() => progressDataRaw?.filter(d => pastWeeks.includes(d.week)), [progressDataRaw, pastWeeks]);

  // Fetch callOutcomes for the past 4 weeks
  const outcomesQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (userId) {
      return query(collection(db, 'callOutcomes'), where('userId', '==', userId));
    }
    return collection(db, 'callOutcomes');
  }, [db, userId]);
  const { data: outcomesDataRaw } = useCollection(outcomesQuery);

  // Fetch callPlans
  const callPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (userId) {
      return query(collection(db, 'callPlans'), where('userId', '==', userId));
    }
    return collection(db, 'callPlans');
  }, [db, userId]);
  const { data: callPlansRaw } = useCollection(callPlansQuery);

  // Fetch activityLogs
  const logsQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (userId) {
      return query(collection(db, 'activityLogs'), where('userId', '==', userId));
    }
    return collection(db, 'activityLogs');
  }, [db, userId]);
  const { data: logsDataRaw } = useCollection(logsQuery);

  // Helper to check if a date matches the selected week
  const isDocInWeek = (docDate: any, targetWeek: string) => {
    if (!docDate) return false;
    let d: Date;
    if (typeof docDate.toDate === 'function') {
      d = docDate.toDate();
    } else if (docDate instanceof Date) {
      d = docDate;
    } else {
      d = new Date(docDate);
    }
    return !isNaN(d.getTime()) && getWeekForDate(d) === targetWeek;
  };

  // Resolve the active user object for alias matching
  const activeUserObj = useMemo(() => {
    if (!selectedCell) return null;
    if (selectedCell.userObj) return selectedCell.userObj;
    return allUsers?.find(u => u.id === selectedCell.userId || normalizeBdmName(u.name) === normalizeBdmName(selectedCell.userName)) || { id: selectedCell.userId, name: selectedCell.userName };
  }, [selectedCell, allUsers]);

  // Filter outcomes, plans, logs, and progress for the active popup
  const activeSummary = useMemo(() => {
    if (!selectedCell || !progressData || !activeUserObj) return { crmCalls: 0, crmApps: 0, calls: 0, apps: 0 };
    const entries = progressData.filter(d => d.week === selectedCell.week && isUserSubmissionMatch(activeUserObj, d));
    return {
      crmCalls: entries.reduce((sum, d) => sum + Number(d.crmCalls || 0), 0),
      crmApps: entries.reduce((sum, d) => sum + Number(d.crmApps || 0), 0),
      calls: entries.reduce((sum, d) => sum + Number(d.calls || 0), 0),
      apps: entries.reduce((sum, d) => sum + Number(d.apps || 0), 0)
    };
  }, [selectedCell, progressData, activeUserObj]);

  const activeOutcomes = useMemo(() => {
    if (!selectedCell || !outcomesDataRaw || !activeUserObj) return [];
    return outcomesDataRaw.filter(o => {
      const matchUser = isUserSubmissionMatch(activeUserObj, o) || o.userId === selectedCell.userId;
      const matchWeek = o.week === selectedCell.week || isDocInWeek(o.createdAt, selectedCell.week);
      return matchUser && matchWeek;
    });
  }, [selectedCell, outcomesDataRaw, activeUserObj]);

  const activeCallPlans = useMemo(() => {
    if (!selectedCell || !callPlansRaw || !activeUserObj) return [];
    return callPlansRaw.filter(cp => {
      const matchUser = isUserSubmissionMatch(activeUserObj, cp) || cp.userId === selectedCell.userId;
      const matchWeek = cp.week === selectedCell.week || isDocInWeek(cp.createdAt, selectedCell.week);
      return matchUser && matchWeek;
    });
  }, [selectedCell, callPlansRaw, activeUserObj]);

  const activeLogs = useMemo(() => {
    if (!selectedCell || !logsDataRaw || !activeUserObj) return [];
    return logsDataRaw.filter(l => {
      const matchUser = isUserSubmissionMatch(activeUserObj, l) || l.userId === selectedCell.userId;
      const matchWeek = l.week === selectedCell.week || isDocInWeek(l.createdAt, selectedCell.week);
      return matchUser && matchWeek;
    });
  }, [selectedCell, logsDataRaw, activeUserObj]);

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-4 text-xs font-bold text-slate-400 uppercase">Loading history...</div>;

    if (userId) {
      // Individual View: 4 cards or rows for the past 4 weeks
      const myUser = allUsers?.find(u => u.id === userId);
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
                  setSelectedCell({ userId, userName: myUser?.name || 'BDM', week, userObj: myUser });
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
    const targetUsersRaw = allUsers?.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER') || [];
    
    // De-duplicate by lowercased name. If duplicates exist, prefer the one with a real Auth UID over string IDs
    const targetUsersMap = new Map<string, any>();
    targetUsersRaw.forEach(u => {
      const norm = normalizeBdmName(u.name, u.id);
      if (!targetUsersMap.has(norm)) {
        targetUsersMap.set(norm, { ...u, aliasIds: [u.id] });
      } else {
        const existing = targetUsersMap.get(norm);
        if (!existing.aliasIds) existing.aliasIds = [existing.id];
        if (!existing.aliasIds.includes(u.id)) {
          existing.aliasIds.push(u.id);
        }
      }
    });
    const targetUsers = Array.from(targetUsersMap.values());
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 uppercase text-[9px] font-black tracking-widest border-b text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">BDM / Account Manager</th>
              {pastWeeks.map((week, idx) => (
                <th key={week} className={cn("px-4 py-3 text-center", idx >= 2 && "hidden sm:table-cell")}>
                  Wk {week.split('-')[1]}
                  {week === currentWeek && <span className="text-accent ml-1">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y text-[11px] font-bold">
            {deduplicateUsers(targetUsers || []).map((u: any) => (
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
                  const dataEntries = progressData?.filter(d => d.week === week && isUserSubmissionMatch(u, d)) || [];
                  const crmCalls = dataEntries.reduce((sum, d) => sum + Number(d.crmCalls || 0), 0);
                  const crmApps = dataEntries.reduce((sum, d) => sum + Number(d.crmApps || 0), 0);
                  const calls = dataEntries.reduce((sum, d) => sum + Number(d.calls || 0), 0);
                  const apps = dataEntries.reduce((sum, d) => sum + Number(d.apps || 0), 0);
                  return (
                    <td 
                      key={week} 
                      onClick={() => {
                        setSelectedCell({ userId: u.id, userName: u.name, week, userObj: u });
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
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-primary flex items-center gap-2">
              <History className="w-5 h-5 text-accent" /> Activity History
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase text-slate-400">
              {selectedCell?.userName} · Week {selectedCell?.week.split('-')[1]}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6 max-h-[480px] overflow-y-auto pr-2">
            {/* KPI Activity Summary Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="text-center p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-center gap-1">
                  <Phone className="w-3 h-3 text-blue-500" /> CRM Calls
                </div>
                <div className="text-lg font-black text-slate-800 mt-0.5">{activeSummary.crmCalls}</div>
              </div>
              <div className="text-center p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-center gap-1">
                  <CalendarCheck className="w-3 h-3 text-green-500" /> CRM Apps
                </div>
                <div className="text-lg font-black text-slate-800 mt-0.5">{activeSummary.crmApps}</div>
              </div>
              <div className="text-center p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-center gap-1">
                  <FileText className="w-3 h-3 text-indigo-500" /> Call Plans
                </div>
                <div className="text-lg font-black text-slate-800 mt-0.5">{activeCallPlans.length}</div>
              </div>
              <div className="text-center p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-center gap-1">
                  <ClipboardList className="w-3 h-3 text-emerald-500" /> Outcomes/Logs
                </div>
                <div className="text-lg font-black text-slate-800 mt-0.5">{activeOutcomes.length + activeLogs.length}</div>
              </div>
            </div>

            {/* Call Plans Created */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" /> Call Plans Created ({activeCallPlans.length})
              </h4>
              <div className="space-y-2">
                {activeCallPlans.map((cp) => {
                  const dt = cp.createdAt?.toDate ? cp.createdAt.toDate() : (cp.createdAt ? new Date(cp.createdAt) : null);
                  return (
                    <div key={cp.id} className="p-3 bg-slate-50 border rounded-xl flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-black text-slate-800 uppercase">{cp.accountName || cp.dealName || 'Call Plan'}</p>
                        {cp.services && cp.services.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cp.services.map((s: string) => (
                              <Badge key={s} variant="outline" className="text-[7px] font-bold uppercase px-1.5 py-0 bg-white">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {cp.objective && <p className="text-slate-600 font-medium text-[11px]"><span className="font-bold text-slate-700">Objective:</span> {cp.objective}</p>}
                      {cp.situation && <p className="text-slate-500 text-[10px] italic line-clamp-2"><span className="font-bold not-italic">Situation:</span> "{cp.situation}"</p>}
                      <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase mt-1">
                        <Clock className="w-2.5 h-2.5" />
                        {dt ? format(dt, 'PPP p') : 'Recent'}
                      </div>
                    </div>
                  );
                })}
                {activeCallPlans.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic pl-1">No call plans created for this week</p>
                )}
              </div>
            </div>

            {/* Call Planning Outcomes */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-500" /> Logged Call Outcomes ({activeOutcomes.length})
              </h4>
              <div className="space-y-2">
                {activeOutcomes.map((o) => {
                  const dt = o.createdAt?.toDate ? o.createdAt.toDate() : (o.createdAt ? new Date(o.createdAt) : null);
                  return (
                    <div key={o.id} className="p-3 bg-slate-50 border rounded-xl flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-black text-slate-800 uppercase">{o.accountName || 'Call'}</p>
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
                        {dt ? format(dt, 'PPP p') : 'Recent'}
                      </div>
                    </div>
                  );
                })}
                {activeOutcomes.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase italic pl-1">No call outcomes logged via planner</p>
                )}
              </div>
            </div>

            {/* Field Dictations / Visits */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-emerald-500" /> Field Dictation & Site Visits ({activeLogs.length})
              </h4>
              <div className="space-y-2">
                {activeLogs.map((l) => {
                  const dt = l.createdAt?.toDate ? l.createdAt.toDate() : (l.createdAt ? new Date(l.createdAt) : null);
                  return (
                    <div key={l.id} className="p-3 bg-slate-50 border rounded-xl flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <p className="font-black text-emerald-700 uppercase tracking-wider text-[10px]">{l.type || 'Field Log'}</p>
                        <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase">
                          <Clock className="w-2.5 h-2.5" />
                          {dt ? format(dt, 'PPP p') : 'Recent'}
                        </div>
                      </div>
                      <p className="text-slate-600 font-medium italic">"{l.description}"</p>
                    </div>
                  );
                })}
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
