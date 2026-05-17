"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Star, User, Calendar, Loader2, ClipboardList, Target, AlertTriangle, ChevronRight, Users, ExternalLink, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LostCustomersView } from './lost-customers-view';
import { openSalesforceSearch, getCurrentWeek } from '@/lib/utils';

export function FridayReviewHub() {
  const { profile, isLeader, user } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const [selectedBdmId, setSelectedBdmId] = useState<string | null>(null);

  const reviewsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'pipelineReviews'),
      where('week', '==', currentWeek),
      where('isReviewSelected', '==', true)
    );
  }, [db, currentWeek]);

  const { data: allSelectedReviews, isLoading: isReviewsLoading } = useCollection(reviewsQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  const { data: teamUsers } = useCollection(usersQuery);

  const activeBdmId = isLeader ? selectedBdmId || (teamUsers?.[0]?.id || '') : user?.uid;
  
  const bdmReviews = useMemo(() => {
    if (!allSelectedReviews) return [];
    return allSelectedReviews.filter(r => r.userId === activeBdmId);
  }, [allSelectedReviews, activeBdmId]);

  const teamSelectionSummary = useMemo(() => {
    if (!allSelectedReviews || !teamUsers) return [];
    return teamUsers.filter(u => u.role !== 'LEADER').map(u => ({
      userId: u.id,
      userName: u.name,
      territory: u.territory,
      count: allSelectedReviews.filter(r => r.userId === u.id).length
    }));
  }, [allSelectedReviews, teamUsers]);

  if (isReviewsLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading Meeting Selection...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Tabs defaultValue="selection" className="w-full">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm mb-6">
          <TabsTrigger value="selection" className="font-black uppercase text-[10px] tracking-widest">Active Selection</TabsTrigger>
          <TabsTrigger value="lost" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Trash2 className="w-3 h-3" /> Win-Back Archive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="selection" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {isLeader && (
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-none shadow-xl bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b pb-4">
                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Team Lineup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="space-y-1">
                      {teamSelectionSummary.map((summary) => (
                        <button
                          key={summary.userId}
                          onClick={() => setSelectedBdmId(summary.userId)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                            activeBdmId === summary.userId 
                              ? 'bg-primary text-white shadow-lg' 
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <div className="text-left">
                            <p className="text-sm font-black uppercase tracking-tight">{summary.userName}</p>
                            <p className={`text-[9px] font-bold uppercase opacity-70 ${activeBdmId === summary.userId ? 'text-white' : 'text-muted-foreground'}`}>
                              {summary.territory?.replace('_', ' ')}
                            </p>
                          </div>
                          <Badge className={activeBdmId === summary.userId ? 'bg-white text-primary border-none' : 'bg-primary/10 text-primary border-none'}>
                            {summary.count} / 8
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className={isLeader ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bdmReviews.map((review) => (
                  <Card key={review.id} className="border-none shadow-lg bg-white group hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <button 
                            onClick={() => openSalesforceSearch(review.pipeline, review.salesforceId)}
                            className="text-xs font-black text-primary uppercase tracking-tight line-clamp-1 hover:text-accent transition-colors flex items-center gap-1.5"
                          >
                            {review.pipeline || 'Untitled Deal'}
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100" />
                          </button>
                          <Badge variant="outline" className="text-[8px] h-4 uppercase font-bold border-accent/20 text-accent">
                            {review.stage || 'Discovery'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-primary tracking-tighter">${(Number(review.value || 0) / 1000000).toFixed(2)}M</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3">
                        <div>
                          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-1 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> Target Commitment
                          </p>
                          <p className="text-[11px] font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {review.actionsForBen || 'TBC'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase text-red-500 tracking-widest mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Barriers & Gaps
                          </p>
                          <p className="text-[11px] font-medium text-slate-600 line-clamp-2 italic">
                            "{review.barriers || 'No critical barriers logged.'}"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {bdmReviews.length === 0 && (
                <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <Star className="w-10 h-10 text-slate-200 mx-auto mb-6" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No meeting selection found.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lost" className="mt-0">
          <LostCustomersView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
