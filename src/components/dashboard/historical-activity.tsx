"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { History, Phone, CalendarCheck } from 'lucide-react';
import { format, subWeeks, startOfWeek } from 'date-fns';
import { getCurrentWeek, getWeekForDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface HistoricalActivityProps {
  userId?: string; // If provided, shows just for this user. If omitted, shows for all users.
}

export function HistoricalActivity({ userId }: HistoricalActivityProps) {
  const db = useFirestore();
  const currentWeek = getCurrentWeek();

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

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-4 text-xs font-bold text-slate-400 uppercase">Loading history...</div>;

    if (userId) {
      // Individual View: 4 cards or rows for the past 4 weeks
      return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {pastWeeks.map(week => {
            const data = progressData?.find(d => d.week === week);
            const calls = Number(data?.calls || 0);
            const apps = Number(data?.apps || 0);
            const crmCalls = Number(data?.crmCalls || 0);
            const crmApps = Number(data?.crmApps || 0);
            const totalCalls = crmCalls > 0 ? crmCalls : calls;
            const totalApps = crmApps > 0 ? crmApps : apps;

            return (
              <div key={week} className="min-w-[120px] bg-slate-50 border border-slate-100 rounded-xl p-3 shrink-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
                  Wk {week.split('-')[1]}
                  {week === currentWeek && <Badge className="text-[7px] px-1 py-0 h-4 bg-accent/10 text-accent border-none ml-1">LIVE</Badge>}
                </p>
                <div className="flex items-center gap-4 w-full justify-around">
                  <div className="text-center">
                    <Phone className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-slate-800">{totalCalls}</p>
                  </div>
                  <div className="text-center">
                    <CalendarCheck className="w-3.5 h-3.5 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-slate-800">{totalApps}</p>
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
              {pastWeeks.map(week => (
                <th key={week} className="px-4 py-3 text-center">
                  Wk {week.split('-')[1]}
                  {week === currentWeek && <span className="text-accent ml-1">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y text-[11px] font-bold">
            {targetUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 uppercase text-primary">{u.name}</td>
                {pastWeeks.map(week => {
                  const data = progressData?.find(d => d.userId === u.id && d.week === week);
                  const crmCalls = Number(data?.crmCalls || 0);
                  const crmApps = Number(data?.crmApps || 0);
                  const calls = crmCalls > 0 ? crmCalls : Number(data?.calls || 0);
                  const apps = crmApps > 0 ? crmApps : Number(data?.apps || 0);
                  return (
                    <td key={week} className="px-4 py-3 text-center text-slate-600">
                      <div className="flex items-center justify-center gap-2">
                        <span className="flex items-center gap-1" title="Calls"><Phone className="w-3 h-3 text-blue-400" /> {calls}</span>
                        <span className="flex items-center gap-1" title="Apps"><CalendarCheck className="w-3 h-3 text-green-400" /> {apps}</span>
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
  );
}
