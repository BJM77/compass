
"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Trash2, Calendar, LayoutGrid, FileText, ChevronRight, Loader2, Info, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';
import { User as UserIcon } from 'lucide-react';

interface WhitespaceHistoryProps {
  userId: string;
}

export function WhitespaceHistory({ userId }: WhitespaceHistoryProps) {
  const db = useFirestore();
  const { isLeader } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const plansQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    const now = new Date();
    // Only show plans that haven't expired (TTL Logic)
    return query(
      collection(db, 'whitespacePlans'),
      where('expiresAt', '>', Timestamp.fromDate(now)),
      orderBy('expiresAt', 'desc')
    );
  }, [db, userId]);

  const { data: plans, isLoading } = useCollection(plansQuery);

  // Filter client-side to handle specific user access if not leader
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (isLeader) return plans;
    return plans.filter(p => p.userId === userId);
  }, [plans, isLeader, userId]);

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  
  const { data: allUsers } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    const map: Record<string, string> = { 'TEAM_NODE': 'TEAM BLUEPRINT' };
    allUsers?.forEach((u: any) => {
      map[u.id] = u.name;
    });
    return map;
  }, [allUsers]);

  const selectedPlan = filteredPlans.find(p => p.id === selectedPlanId);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm("Permanently archive this diagnostic from the governance node?")) {
      await deleteDoc(doc(db, 'whitespacePlans', id));
      if (selectedPlanId === id) setSelectedPlanId(null);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-accent animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Accessing Expansion Archive...</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
      {/* Sidebar: Archive List */}
      <div className="lg:col-span-4 space-y-4">
        <header className="px-1">
          <h2 className="text-sm font-black uppercase tracking-tighter text-primary flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            Strategic Archive
          </h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">90-Day Ephemeral Storage</p>
        </header>

        <ScrollArea className="h-[700px] pr-4">
          <div className="grid gap-3">
            {filteredPlans.map((plan) => {
              const daysLeft = plan.expiresAt?.toDate ? differenceInDays(plan.expiresAt.toDate(), new Date()) : 0;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left cursor-pointer p-4 rounded-2xl border-2 transition-all group relative ${
                    selectedPlanId === plan.id 
                      ? 'border-accent bg-accent/5 shadow-lg' 
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                       <Calendar className="w-3 h-3 text-muted-foreground" />
                       <span className="text-[9px] font-bold text-muted-foreground uppercase">
                         {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'MMM d, p') : 'Just now'}
                       </span>
                    </div>
                    <Badge variant="outline" className={`text-[8px] font-black uppercase border-none h-4 ${daysLeft < 3 ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
                       {daysLeft}D REMAINING
                    </Badge>
                  </div>
                  <p className="text-sm font-black text-primary uppercase leading-tight truncate pr-6">{plan.accountName}</p>
                  {isLeader && plan.userId && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <UserIcon className="w-3 h-3 text-accent" />
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{userMap[plan.userId] || 'Unknown User'}</span>
                    </div>
                  )}
                  <div className="mt-3 flex justify-between items-center">
                     <div className="flex gap-1">
                        {Object.keys(plan.configs || {}).slice(0, 3).map(s => (
                          <div key={s} className="w-2 h-2 rounded-full bg-accent/20" />
                        ))}
                     </div>
                     <ChevronRight className={`w-4 h-4 transition-transform ${selectedPlanId === plan.id ? 'translate-x-1 text-accent' : 'text-slate-300'}`} />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {filteredPlans.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed">
                <FileText className="w-10 h-10 text-slate-100 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  No expansion plans found in the active 90-day window.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main View: Plan Detail */}
      <div className="lg:col-span-8">
        {selectedPlan ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <Card className="border-none shadow-2xl bg-white overflow-hidden">
               <CardHeader className="bg-slate-900 text-white pb-8">
                  <div className="flex justify-between items-start mb-4">
                     <Badge className="bg-accent text-white border-none font-black text-[9px] uppercase tracking-widest">Diagnostic Record</Badge>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Auto-Delete Target</p>
                        <p className="text-xs font-black text-accent">{selectedPlan.expiresAt?.toDate ? format(selectedPlan.expiresAt.toDate(), 'PPPP') : 'N/A'}</p>
                     </div>
                  </div>
                  <CardTitle className="text-3xl font-black tracking-tight uppercase">{selectedPlan.accountName}</CardTitle>
                  <CardDescription className="text-slate-400 font-medium flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> 
                    {isLeader && selectedPlan.userId && (
                      <span className="font-bold text-accent mr-1">[{userMap[selectedPlan.userId] || 'Unknown User'}]</span>
                    )}
                    Synchronised from session on {selectedPlan.createdAt?.toDate ? format(selectedPlan.createdAt.toDate(), 'PPP') : 'today'}.
                  </CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="divide-y border-b">
                    {Object.entries(selectedPlan.configs || {}).map(([service, config]: [string, any]) => (
                      <div key={service} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 hover:bg-slate-50/50 transition-colors">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{service}</p>
                           <Badge variant="outline" className="text-[9px] font-black border-accent/30 text-accent uppercase">{config.state.replace('_', ' ')}</Badge>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">Priority</p>
                           <p className={`text-xs font-black uppercase ${config.priority === 'HIGH' ? 'text-orange-600' : 'text-slate-700'}`}>{config.priority}</p>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">Strategic Rationale</p>
                           <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                             "{config.rationale || 'No documentation provided.'}"
                           </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-8 bg-slate-50 border-t flex items-center gap-4">
                     <AlertTriangle className="w-5 h-5 text-orange-500" />
                     <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed tracking-tight max-w-xl">
                       GOVERNANCE PROTOCOL: This strategic diagnostic is ephemeral and will be irreversibly purged from the BDM Compass data node in {selectedPlan.expiresAt?.toDate ? differenceInDays(selectedPlan.expiresAt.toDate(), new Date()) : 0} days to maintain territory data hygiene.
                     </p>
                  </div>
               </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
             <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <LayoutGrid className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a saved diagnostic</h3>
             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 text-center max-w-xs">
                Review historical whitespace diagnostics synced during your PDF export sessions.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
