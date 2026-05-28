"use client";

import { useMemo } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, LayoutGrid, Loader2, ArrowRight } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';

export function PlanMetrics() {
  const db = useFirestore();
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 0 }), []);
  
  // Fetch users to display names instead of IDs
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection(usersQuery);
  const getUserName = (id: string) => allUsers?.find(u => u.id === id)?.name || id.substring(0, 8);

  const callPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'callPlans'), 
      where('createdAt', '>=', Timestamp.fromDate(weekStart))
    );
  }, [db, weekStart]);
  const { data: callPlans, isLoading: isCallLoading } = useCollection(callPlansQuery);

  const whitespaceQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'whitespacePlans'), 
      where('createdAt', '>=', Timestamp.fromDate(weekStart))
    );
  }, [db, weekStart]);
  const { data: whitespacePlans, isLoading: isWhiteLoading } = useCollection(whitespaceQuery);

  if (isCallLoading || isWhiteLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-accent" /></div>;

  const sortedCallPlans = [...(callPlans || [])].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  const sortedWhitespacePlans = [...(whitespacePlans || [])].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-primary">Execution Metrics</h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Live Planning Activity for the current week</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border flex flex-col items-end shadow-sm">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Call Plans</span>
             <span className="text-lg font-black text-primary">{callPlans?.length || 0}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border flex flex-col items-end shadow-sm">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total White Space</span>
             <span className="text-lg font-black text-primary">{whitespacePlans?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Call Plans Card */}
         <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white pb-6">
               <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                 <PhoneCall className="w-4 h-4 text-accent" /> Completed Call Plans
               </CardTitle>
               <CardDescription className="text-slate-400 font-bold text-[10px] tracking-widest uppercase">
                 Latest SPIN Strategies logged this week
               </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-slate-50">
                     <TableRow className="uppercase text-[9px] font-black tracking-widest">
                       <TableHead className="px-6 py-3">BDM</TableHead>
                       <TableHead>Target Account</TableHead>
                       <TableHead className="text-right px-6">Timestamp</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody className="divide-y">
                     {sortedCallPlans.map(plan => (
                       <TableRow key={plan.id} className="hover:bg-slate-50 transition-colors">
                         <TableCell className="px-6 py-4 font-black text-xs text-primary">{getUserName(plan.userId)}</TableCell>
                         <TableCell className="text-xs font-bold">{plan.accountName}</TableCell>
                         <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">
                           {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'EEE h:mm a') : 'Just now'}
                         </TableCell>
                       </TableRow>
                     ))}
                     {sortedCallPlans.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={3} className="text-center py-12 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                           No call plans logged this week.
                         </TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </div>
            </CardContent>
         </Card>

         {/* White Space Plans Card */}
         <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white pb-6">
               <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                 <LayoutGrid className="w-4 h-4 text-accent" /> White Space Expansion
               </CardTitle>
               <CardDescription className="text-slate-400 font-bold text-[10px] tracking-widest uppercase">
                 Latest cross-sell diagnostics logged this week
               </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-slate-50">
                     <TableRow className="uppercase text-[9px] font-black tracking-widest">
                       <TableHead className="px-6 py-3">BDM</TableHead>
                       <TableHead>Target Account</TableHead>
                       <TableHead className="text-right px-6">Timestamp</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody className="divide-y">
                     {sortedWhitespacePlans.map(plan => (
                       <TableRow key={plan.id} className="hover:bg-slate-50 transition-colors">
                         <TableCell className="px-6 py-4 font-black text-xs text-primary">{getUserName(plan.userId)}</TableCell>
                         <TableCell className="text-xs font-bold">{plan.accountName}</TableCell>
                         <TableCell className="text-right px-6 text-[10px] font-bold text-muted-foreground uppercase">
                           {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'EEE h:mm a') : 'Just now'}
                         </TableCell>
                       </TableRow>
                     ))}
                     {sortedWhitespacePlans.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={3} className="text-center py-12 text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-50/50">
                           No white space diagnostics logged this week.
                         </TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
