"use client";

import { useMemo } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, LayoutGrid, Loader2, Calendar, FileSpreadsheet, Sparkles, PlusCircle, CheckCircle2, Activity } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { getCurrentWeek, normalizeBdmName, isUserSubmissionMatch } from '@/lib/utils';

export function PlanMetrics() {
  const db = useFirestore();
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const currentWeek = useMemo(() => getCurrentWeek(), []);
  
  // Fetch users to display names instead of IDs
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection(usersQuery);
  const getUserName = (id: string) => {
    const user = activeUsers.find(u => isUserSubmissionMatch(u, { userId: id }));
    return user ? user.name : (allUsers?.find(u => u.id === id)?.name || id.substring(0, 8));
  };

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

  const factFindingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'factFindingDocs'),
      where('createdAt', '>=', Timestamp.fromDate(weekStart))
    );
  }, [db, weekStart]);
  const { data: factFindings, isLoading: isFactLoading } = useCollection(factFindingQuery);

  const pipelineQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'pipelineReviews'),
      where('week', '==', currentWeek)
    );
  }, [db, currentWeek]);
  const { data: pipelineReviews, isLoading: isPipelineLoading } = useCollection(pipelineQuery);

  const progressQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'weeklyProgress'),
      where('week', '==', currentWeek)
    );
  }, [db, currentWeek]);
  const { data: weeklyProgress, isLoading: isProgressLoading } = useCollection(progressQuery);

  const activeUsers = useMemo(() => {
    if (!allUsers) return [];
    const filtered = allUsers.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER');
    const userMap = new Map<string, any>();
    filtered.forEach(u => {
      const norm = normalizeBdmName(u.name, u.id);
      if (!userMap.has(norm)) {
        userMap.set(norm, { ...u });
      } else {
        const existing = userMap.get(norm);
        if (!existing.aliasIds) existing.aliasIds = [];
        existing.aliasIds.push(u.id);
      }
    });
    return Array.from(userMap.values());
  }, [allUsers]);

  const userMetrics = useMemo(() => {
    return activeUsers.map(user => {
      // 1. Appointments: crmApps (from weeklyProgress) + manual apps (from weeklyProgress)
      const progressDocs = weeklyProgress?.filter(p => isUserSubmissionMatch(user, { id: p.id, ...p })) || [];
      const crmApps = progressDocs.reduce((sum, p) => sum + (Number(p.crmApps) || 0), 0);
      const manualApps = progressDocs.reduce((sum, p) => sum + (Number(p.apps) || 0), 0);
      const totalAppointments = crmApps + manualApps;

      // 2. Fact Findings: count of factFindingDocs created by this user
      const userFactFindings = factFindings?.filter(f => isUserSubmissionMatch(user, { id: f.id, ...f })) || [];
      const totalFactFindings = userFactFindings.length;

      // 3. Opportunities Created: Count of pipelineReviews where createdWeek === currentWeek (or fallback to active pipeline if no createdDate)
      const userDeals = pipelineReviews?.filter(r => isUserSubmissionMatch(user, { id: r.id, ...r })) || [];
      const oppsCreated = userDeals.filter(d => {
        if (d.isBareAccount) return false;
        if (d.createdWeek) return d.createdWeek === currentWeek;
        // Fallback for older imports before Created Date was available
        return d.stage !== 'Closed Won' && d.stage !== 'Closed Lost';
      }).length;

      // 4. Opportunities Closed Won
      const oppsWon = userDeals.filter(d => d.stage === 'Closed Won').length;

      // 5. Call plans logged this week
      const userCallPlans = callPlans?.filter(p => isUserSubmissionMatch(user, { id: p.id, ...p })) || [];
      const totalCallPlans = userCallPlans.length;

      // 6. Whitespace plans logged this week
      const userWhitespace = whitespacePlans?.filter(p => isUserSubmissionMatch(user, { id: p.id, ...p })) || [];
      const totalWhitespace = userWhitespace.length;

      // 7. Calls (CRM + Manual) from weeklyProgress
      const crmCalls = progressDocs.reduce((sum, p) => sum + (Number(p.crmCalls) || 0), 0);
      const manualCalls = progressDocs.reduce((sum, p) => sum + (Number(p.calls) || 0), 0);
      const totalCalls = crmCalls + manualCalls;

      // Total Weekly Activities (sum of all activities)
      const totalActivities = totalCalls + totalAppointments + totalFactFindings + totalCallPlans + totalWhitespace;

      return {
        user,
        crmApps,
        manualApps,
        totalAppointments,
        totalFactFindings,
        oppsCreated,
        oppsWon,
        totalCallPlans,
        totalWhitespace,
        totalCalls,
        totalActivities,
      };
    }).sort((a, b) => b.totalActivities - a.totalActivities);
  }, [activeUsers, weeklyProgress, factFindings, pipelineReviews, callPlans, whitespacePlans]);

  if (isCallLoading || isWhiteLoading || isFactLoading || isPipelineLoading || isProgressLoading) {
    return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-accent" /></div>;
  }

  const sortedCallPlans = [...(callPlans || [])].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  const sortedWhitespacePlans = [...(whitespacePlans || [])].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">Execution Metrics</h2>
          <p className="text-xs font-bold text-muted-foreground mt-1">Live Planning & Performance Summary for Week {currentWeek.split('-')[1]}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="bg-card px-4 py-2 rounded-xl border flex flex-col items-end shadow-sm">
             <span className="text-xs font-semibold text-muted-foreground">Total Call Plans</span>
             <span className="text-lg font-bold text-primary">{callPlans?.length || 0}</span>
          </div>
          <div className="bg-card px-4 py-2 rounded-xl border flex flex-col items-end shadow-sm">
             <span className="text-xs font-semibold text-muted-foreground">Total White Space</span>
             <span className="text-lg font-bold text-primary">{whitespacePlans?.length || 0}</span>
          </div>
          <div className="bg-card px-4 py-2 rounded-xl border flex flex-col items-end shadow-sm">
             <span className="text-xs font-semibold text-muted-foreground">Total Fact Findings</span>
             <span className="text-lg font-bold text-primary">{factFindings?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Team Activity & Execution Scorecard */}
      <Card className="border-none shadow-xl bg-card overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 tracking-tight">
                <Activity className="w-4 h-4 text-accent animate-pulse" /> Team Activity & Execution Scorecard
              </CardTitle>
              <CardDescription className="text-muted-foreground font-bold text-xs">
                Activity, Fact Finding, and Opportunities count by BDM & AM
              </CardDescription>
            </div>
            <Badge className="bg-accent/20 text-accent font-semibold text-xs border-accent/30 px-3 py-1">
              Sales Week {currentWeek.split('-')[1]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className=" text-xs font-semibold border-b">
                  <TableHead className="px-6 py-4">BDM/AM Identity</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="text-center">Weekly Appointments</TableHead>
                  <TableHead className="text-center">Weekly Fact Finding</TableHead>
                  <TableHead className="text-center">Opps Created</TableHead>
                  <TableHead className="text-center">Opps Won</TableHead>
                  <TableHead className="text-right px-6">Total Weekly Activities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {userMetrics.map(({ user, totalAppointments, crmApps, manualApps, totalFactFindings, oppsCreated, oppsWon, totalActivities }) => (
                  <TableRow key={user.id} className="hover:bg-secondary/60 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="font-semibold text-sm text-primary">{user.name}</div>
                      <div className="text-xs font-bold text-muted-foreground">{user.email || 'No email'}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`font-semibold text-xs ${
                        user.role === 'BDM' ? 'border-info/30 text-primary bg-info-soft' : 'border-success/25 text-success-ink bg-success-soft'
                      }`}>
                        {user.role === 'BDM' ? 'BDM' : 'AM'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-bold text-sm text-foreground">{totalAppointments}</span>
                        <span className="text-xs text-muted-foreground font-bold">
                          CRM: {crmApps} • Man: {manualApps}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-foreground">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
                        {totalFactFindings}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-foreground">
                        <PlusCircle className="w-3.5 h-3.5 text-warning" />
                        {oppsCreated}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        {oppsWon}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Badge className="bg-primary text-primary-foreground font-semibold text-xs px-3 py-1 shadow-sm">
                        {totalActivities}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {userMetrics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs font-semibold text-muted-foreground bg-secondary/60">
                      No active BDMs or Account Managers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Call Plans Card */}
         <Card className="border-none shadow-xl bg-card overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground pb-6">
               <CardTitle className="text-sm font-semibold flex items-center gap-2 tracking-tight">
                 <PhoneCall className="w-4 h-4 text-accent" /> Completed Call Plans
               </CardTitle>
               <CardDescription className="text-muted-foreground font-bold text-xs">
                 Latest SPIN Strategies logged this week
               </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-secondary/60">
                     <TableRow className=" text-xs font-semibold">
                       <TableHead className="px-6 py-3">BDM</TableHead>
                       <TableHead>Target Account</TableHead>
                       <TableHead className="text-right px-6">Timestamp</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody className="divide-y">
                     {sortedCallPlans.map(plan => (
                       <TableRow key={plan.id} className="hover:bg-secondary/60 transition-colors">
                         <TableCell className="px-6 py-4 font-semibold text-xs text-primary">{getUserName(plan.userId)}</TableCell>
                         <TableCell className="text-xs font-bold">{plan.accountName}</TableCell>
                         <TableCell className="text-right px-6 text-xs font-bold text-muted-foreground">
                           {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'EEE h:mm a') : 'Just now'}
                         </TableCell>
                       </TableRow>
                     ))}
                     {sortedCallPlans.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={3} className="text-center py-12 text-xs font-semibold text-muted-foreground bg-secondary/60">
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
         <Card className="border-none shadow-xl bg-card overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground pb-6">
               <CardTitle className="text-sm font-semibold flex items-center gap-2 tracking-tight">
                 <LayoutGrid className="w-4 h-4 text-accent" /> White Space Expansion
               </CardTitle>
               <CardDescription className="text-muted-foreground font-bold text-xs">
                 Latest cross-sell diagnostics logged this week
               </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-secondary/60">
                     <TableRow className=" text-xs font-semibold">
                       <TableHead className="px-6 py-3">BDM</TableHead>
                       <TableHead>Target Account</TableHead>
                       <TableHead className="text-right px-6">Timestamp</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody className="divide-y">
                     {sortedWhitespacePlans.map(plan => (
                       <TableRow key={plan.id} className="hover:bg-secondary/60 transition-colors">
                         <TableCell className="px-6 py-4 font-semibold text-xs text-primary">{getUserName(plan.userId)}</TableCell>
                         <TableCell className="text-xs font-bold">{plan.accountName}</TableCell>
                         <TableCell className="text-right px-6 text-xs font-bold text-muted-foreground">
                           {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'EEE h:mm a') : 'Just now'}
                         </TableCell>
                       </TableRow>
                     ))}
                     {sortedWhitespacePlans.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={3} className="text-center py-12 text-xs font-semibold text-muted-foreground bg-secondary/60">
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
