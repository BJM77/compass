"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users, ShieldCheck, Zap, Info, ArrowRight, BookOpen, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface CallPrepModeProps {
  deal?: any;
  playbook?: any;
}

export function CallPrepMode({ deal, playbook }: CallPrepModeProps) {
  if (!deal) return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed">
      <Phone className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Select a deal to enter Prep Mode</p>
    </div>
  );

  return (
    <Card className="border-none shadow-2xl bg-white overflow-hidden animate-in zoom-in duration-300">
      <CardHeader className="bg-slate-900 text-white pb-6">
        <div className="flex justify-between items-start mb-2">
          <Badge className="bg-accent text-white border-none font-black text-[9px] uppercase tracking-widest">Active Prep Mode</Badge>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-white border-white/20 text-[9px]">Last Contact: 4d ago</Badge>
          </div>
        </div>
        <CardTitle className="text-2xl font-black tracking-tight">{deal.pipeline}</CardTitle>
        <CardDescription className="text-slate-400 font-medium">{deal.account || 'Strategic Prospecting'}</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="strategy">
          <TabsList className="w-full grid grid-cols-3 bg-slate-100 rounded-none h-12">
            <TabsTrigger value="strategy" className="text-[10px] font-black uppercase tracking-widest">Strategy</TabsTrigger>
            <TabsTrigger value="stakeholders" className="text-[10px] font-black uppercase tracking-widest">Stakeholders</TabsTrigger>
            <TabsTrigger value="tracks" className="text-[10px] font-black uppercase tracking-widest">Talk Tracks</TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="strategy" className="space-y-6 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> Core Goal
                  </h4>
                  <p className="text-sm font-bold text-slate-800 leading-tight">Move from Discovery to Trial Pilot phase.</p>
                </div>
                <div className="bg-accent/5 p-4 rounded-xl border border-accent/10">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Winning Message
                  </h4>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{playbook?.wins?.[0] || 'Focus on Same-Day Reliability'}</p>
                </div>
              </div>

              <div className="space-y-3">
                 <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Info className="w-3 h-3 text-blue-500" /> Pre-Call Checklist
                  </h4>
                  <div className="grid gap-2">
                    {['Verify historical pricing', 'Review barriers from last meeting', 'Validate fleet capacity'].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border text-xs font-bold text-slate-600">
                        <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white" />
                        {item}
                      </div>
                    ))}
                  </div>
              </div>
            </TabsContent>

            <TabsContent value="stakeholders" className="space-y-4 mt-0">
              <div className="grid gap-3">
                 {[
                   { name: 'David Smith', role: 'Logistics Manager', stance: 'CHAMPION', priority: 'HIGH' },
                   { name: 'Sarah Wilson', role: 'Ops Director', stance: 'SKEPTICAL', priority: 'CRITICAL' }
                 ].map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:border-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">{s.name.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-black text-primary uppercase tracking-tight">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">{s.role}</p>
                        </div>
                      </div>
                      <Badge className={s.stance === 'CHAMPION' ? 'bg-green-100 text-green-700 border-none' : 'bg-orange-100 text-orange-700 border-none'}>
                        {s.stance}
                      </Badge>
                   </div>
                 ))}
              </div>
            </TabsContent>

            <TabsContent value="tracks" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 text-white rounded-2xl relative">
                  <MessageCircle className="absolute top-4 right-4 w-4 h-4 text-accent opacity-50" />
                  <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2">Opener: Value Hypothesis</p>
                  <p className="text-sm leading-relaxed italic">"I've been reviewing your freight flows through Kewdale. We're seeing a 15% improvement in turnaround times for similar heavy engineering clients by consolidating their air/sea adjacency..."</p>
                </div>
                <div className="p-4 bg-primary text-white rounded-2xl relative">
                  <BookOpen className="absolute top-4 right-4 w-4 h-4 text-white opacity-50" />
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-2">Handling Skepticism: Stance Mitigation</p>
                  <p className="text-sm leading-relaxed italic">"I understand the concern around transition downtime. That's why we're proposing a 30-day pilot on the Regional Flex corridor before we touch the metro patch..."</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
