"use client";

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, Lightbulb, MessageSquare, Target, Calendar, Users, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { AISummaryView } from './ai-summary-view';

export function AIBriefsHub() {
  const db = useFirestore();
  const { isLeader } = useAuth();
  const [selectedBdmId, setSelectedBdmId] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const currentWeek = getCurrentWeek();

  // DEFENSIVE: Block all data-fetching if Firestore or Leader state is not ready
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const teamMembers = useMemo(() => allUsers?.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER') || [], [allUsers]);
  
  // DEFENSIVE: Ensure we have a valid ID before building query paths
  const activeBdmId = selectedBdmId || teamMembers[0]?.id || null;

  const briefsQuery = useMemoFirebase(() => {
    if (!db || !activeBdmId) return null;
    return query(
      collection(db, 'aiBriefs'),
      where('userId', '==', activeBdmId),
      orderBy('createdAt', 'desc')
    );
  }, [db, activeBdmId]);

  const { data: briefs, isLoading: isBriefsLoading } = useCollection(briefsQuery);
  const selectedBrief = briefs?.find(b => b.id === selectedBriefId) || briefs?.[0];

  const statsDocRef = useMemoFirebase(() => {
    if (!db || !activeBdmId) return null;
    return doc(db, 'bdmStats', activeBdmId);
  }, [db, activeBdmId]);
  const { data: stats } = useDoc(statsDocRef);

  const dealsQuery = useMemoFirebase(() => {
    if (!db || !activeBdmId) return null;
    return query(collection(db, 'pipelineReviews'), where('userId', '==', activeBdmId), where('week', '==', currentWeek));
  }, [db, activeBdmId, currentWeek]);
  const { data: allDeals } = useCollection(dealsQuery);

  const selectedUser = allUsers?.find(u => u.id === activeBdmId);

  if (isUsersLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Intelligence Registry...</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700 pb-20">
      <div className="lg:col-span-3 space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
          <Users className="w-3 h-3" /> Territory Registry
        </h3>
        <ScrollArea className="h-[700px] pr-2">
          <div className="grid gap-2">
            {teamMembers.map((u) => (
              <button
                key={u.id}
                onClick={() => { setSelectedBdmId(u.id); setSelectedBriefId(null); }}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                  activeBdmId === u.id 
                    ? 'border-accent bg-accent/5 shadow-md' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${activeBdmId === u.id ? 'bg-accent text-white border-accent' : 'bg-slate-100 text-slate-400'}`}>
                   {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-primary uppercase truncate">{u.name}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="lg:col-span-9 space-y-8">
        {selectedUser && activeBdmId ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2 px-1">
                <Sparkles className="w-3.5 h-3.5" /> Live Strategic Synthesis
              </h3>
              <AISummaryView 
                userId={activeBdmId} 
                input={{ 
                  bdmName: selectedUser.name, 
                  bdmStats: { 
                    revenueYTD: stats?.revenueYTD || 0, 
                    target: stats?.target || 0, 
                    activityScore: stats?.activityScore || 0, 
                    behaviourScore: stats?.behaviourScore || 0, 
                    overallScore: stats?.overallScore || 0, 
                    recoveryStatus: (stats?.recoveryStatus as any) || 'ON_TRACK' 
                  }, 
                  pipelineDeals: allDeals?.map(d => ({ 
                    account: d.pipeline, 
                    stage: d.stage || 'Discovery', 
                    value: Number(d.value) || 0, 
                    daysInStage: d.daysInStage || 14, 
                    lastUpdate: d.updatedAt?.toDate()?.toISOString() || new Date().toISOString() 
                  })) || [], 
                  weeklyTrends: [], 
                  coachingNotes: [] 
                }} 
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Performance Archive
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4">
                  <ScrollArea className="h-[400px] pr-2">
                    <div className="grid gap-2">
                      {briefs?.map((brief) => (
                        <button
                          key={brief.id}
                          onClick={() => setSelectedBriefId(brief.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            selectedBrief?.id === brief.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <Badge variant="outline" className="text-[7px] h-4 uppercase font-black tracking-widest">Wk {brief.week?.split('-')[1]}</Badge>
                            <span className="text-[8px] font-bold text-muted-foreground">{brief.createdAt?.toDate ? format(brief.createdAt.toDate(), 'MMM d') : '...'}</span>
                          </div>
                          <p className="text-[10px] font-bold text-primary line-clamp-1 opacity-80">{brief.summary}</p>
                        </button>
                      ))}
                      {(!briefs || briefs.length === 0) && !isBriefsLoading && (
                        <div className="text-center py-10 opacity-30">
                           <Clock className="w-6 h-6 mx-auto mb-2" />
                           <p className="text-[9px] font-black uppercase">No Archived Data</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <div className="md:col-span-8">
                   {selectedBrief ? (
                     <Card className="border-none shadow-xl bg-slate-50 overflow-hidden">
                        <CardHeader className="bg-white border-b py-4">
                           <div className="flex justify-between items-center">
                              <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Synthesis · Week {selectedBrief.week}</CardTitle>
                              <Badge variant="secondary" className="text-[8px] font-black">{selectedBrief.createdAt?.toDate ? format(selectedBrief.createdAt.toDate(), 'PPP') : ''}</Badge>
                           </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                           <div className="bg-white p-4 rounded-xl border text-[11px] font-medium leading-relaxed italic text-slate-700">
                             "{selectedBrief.summary}"
                           </div>
                        </CardContent>
                     </Card>
                   ) : (
                     <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed">
                        <Target className="w-8 h-8 text-slate-200 mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select an archived node.</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
             <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a Professional</h3>
             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 text-center max-w-xs leading-relaxed">
                Access archived intelligence and trigger new coaching snapshots for your team nodes.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}