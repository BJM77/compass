"use client";

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Loader2, Target, CheckCircle2, AlertTriangle, ArrowRight, ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format, startOfWeek } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { SmartGoalsView } from './smart-goals-view';

export function SmartGoalsAudit() {
  const db = useFirestore();
  const { isLeader } = useAuth();
  const [selectedBdmId, setSelectedBdmId] = useState<string | null>(null);
  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww');

  // 1. Fetch All Users for the selector
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const teamMembers = allUsers?.filter(u => u.role !== 'LEADER') || [];
  const activeBdmId = selectedBdmId || teamMembers[0]?.id || '';
  const selectedUser = teamMembers.find(u => u.id === activeBdmId);

  if (isUsersLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Territory SMART Nodes...</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700 pb-20">
      {/* Team Sidebar */}
      <div className="lg:col-span-3 space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
          <Users className="w-3 h-3" /> Team Registry
        </h3>
        <ScrollArea className="h-[700px] pr-2">
          <div className="grid gap-2">
            {teamMembers.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedBdmId(u.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                  activeBdmId === u.id 
                    ? 'border-yellow-500 bg-yellow-50/50 shadow-md' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${activeBdmId === u.id ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-slate-100 text-slate-400'}`}>
                   {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-primary uppercase truncate">{u.name}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{u.role} · {u.territory?.replace('_', ' ')}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Goal Workspace */}
      <div className="lg:col-span-9 space-y-8">
        {selectedUser ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Star className="w-32 h-32 text-yellow-500" /></div>
               <CardHeader>
                  <div className="flex justify-between items-start relative z-10">
                     <div className="space-y-1">
                        <Badge className="bg-yellow-500 text-white border-none font-black text-[9px] uppercase tracking-widest mb-2">Executive Audit Node</Badge>
                        <CardTitle className="text-3xl font-black tracking-tighter uppercase">{selectedUser.name}</CardTitle>
                        <CardDescription className="text-slate-400 font-medium">Reviewing Weekly SMART Commitments</CardDescription>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reporting Period</p>
                        <p className="text-xs font-black text-yellow-500">Week {currentWeek.split('-')[1]}</p>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="relative z-10 pt-4">
                  <div className="flex gap-4">
                     <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Role Objective</p>
                        <p className="text-xs font-bold">{selectedUser.role} - Territory Strategy Lock</p>
                     </div>
                     <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Achievement</p>
                        <p className="text-xs font-bold">${(selectedUser.target / 1000000).toFixed(2)}M Strategic Plan</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Reusing the SmartGoalsView for detailed editing/viewing */}
            <div className="border-t pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-4 px-1">
                <ClipboardList className="w-3.5 h-3.5 text-yellow-500" /> Active SMART Commitments
              </h3>
              <SmartGoalsView userId={activeBdmId} />
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
             <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <Star className="w-10 h-10 text-yellow-200" />
             </div>
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a team member</h3>
             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 text-center max-w-xs leading-relaxed">
                Audit historical and current SMART goals to ensure territory execution remains at the professional standard.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
