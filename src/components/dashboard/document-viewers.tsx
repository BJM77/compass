'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { PhoneCall, Target, Info, Sparkles, BookOpen, ShieldCheck, TrendingUp, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallPlanViewerProps {
  callPlan: any;
}

export function CallPlanViewer({ callPlan }: CallPlanViewerProps) {
  const spinStates = [
    { label: 'Situation', text: callPlan.situation, color: 'border-info/15 bg-info-soft/50 text-info' },
    { label: 'Problem', text: callPlan.problem, color: 'border-warning/15 bg-warning-soft/50 text-warning-ink' },
    { label: 'Implication', text: callPlan.implication, color: 'border-destructive/15 bg-danger-soft/50 text-destructive' },
    { label: 'Need Payoff', text: callPlan.needPayoff, color: 'border-success/15 bg-success-soft/50 text-success-ink' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
      {/* Overview Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-secondary/30 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase text-foreground flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-accent" />
                {callPlan.accountName || 'Unnamed Account'}
              </CardTitle>
              <CardDescription className="font-bold text-xs uppercase text-muted-foreground mt-1">
                Sales Call Plan
              </CardDescription>
            </div>
            {callPlan.createdAt && (
              <Badge variant="outline" className="font-bold text-[10px] uppercase">
                {callPlan.createdAt.toDate ? callPlan.createdAt.toDate().toLocaleDateString() : 'N/A'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4 text-sm">
          <div>
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Objective</Label>
            <p className="mt-1 font-bold text-foreground bg-secondary/60 p-3 rounded-lg border border-border/60">
              {callPlan.objective || 'No objective specified.'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Introduction Strategy</Label>
              <p className="mt-1 font-medium text-foreground/85 bg-secondary/30 p-3 rounded-lg border border-border/30 whitespace-pre-wrap">
                {callPlan.introduction || '-'}
              </p>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Build Rapport / Credibility</Label>
              <p className="mt-1 font-medium text-foreground/85 bg-secondary/30 p-3 rounded-lg border border-border/30 whitespace-pre-wrap">
                {callPlan.buildRapport || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SPIN Section */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-warning" />
            SPIN Questions Framework
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          {spinStates.map((spin, idx) => (
            <div key={idx} className={cn("border p-4 rounded-xl space-y-2", spin.color)}>
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">
                {spin.label} Questions
              </span>
              <p className="text-xs font-semibold whitespace-pre-wrap leading-relaxed">
                {spin.text || 'No questions documented.'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Services and Objections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase text-foreground">Target Carrier Services</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {callPlan.services && callPlan.services.length > 0 ? (
              callPlan.services.map((s: string) => (
                <Badge key={s} className="bg-accent/90 text-accent-foreground font-bold px-3 py-1 text-xs border border-accent">
                  {s}
                </Badge>
              ))
            ) : (
              <p className="text-xs italic text-muted-foreground">No services targeted.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase text-foreground">Objections Handling</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-medium text-foreground/85 bg-secondary/60 p-3 rounded-lg border border-border/60 whitespace-pre-wrap">
              {callPlan.objections || 'No anticipated objections listed.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Section */}
      {callPlan.outcome && (
        <Card className="border border-success/25 bg-success-soft/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase text-success-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" />
              Call Outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="font-bold text-muted-foreground uppercase tracking-widest text-[8px]">Status:</span>
              <span className="ml-2 font-black uppercase text-success-ink bg-success-soft px-2 py-0.5 rounded border border-success/15">
                {callPlan.outcome}
              </span>
            </div>
            {callPlan.outcomeNotes && (
              <div>
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-[8px] block mb-1">Notes:</span>
                <p className="p-3 bg-card border border-border/60 rounded-lg text-foreground font-medium whitespace-pre-wrap">
                  {callPlan.outcomeNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface WhitespaceViewerProps {
  whitespaceDoc: any;
}

export function WhitespaceViewer({ whitespaceDoc }: WhitespaceViewerProps) {
  const services = ['Road', 'Air', 'B2C', 'International', 'Courier'];
  
  const stateColors: Record<string, string> = {
    EXPAND: 'bg-info border-info text-info-foreground',
    MAINTAIN: 'bg-success-fill border-success-fill text-success-foreground',
    TARGET: 'bg-warning border-warning text-warning-foreground',
    WHITE_SPACE: 'bg-secondary border-border text-muted-foreground'
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-2">
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-secondary/30 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" />
                {whitespaceDoc.accountName || 'Unnamed Account'}
              </CardTitle>
              <CardDescription className="font-bold text-xs uppercase text-muted-foreground mt-1">
                Whitespace Intelligence Analysis
              </CardDescription>
            </div>
            {whitespaceDoc.createdAt && (
              <Badge variant="outline" className="font-bold text-[10px] uppercase">
                {whitespaceDoc.createdAt.toDate ? whitespaceDoc.createdAt.toDate().toLocaleDateString() : 'N/A'}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {services.map(service => {
          const config = (whitespaceDoc.configs || {})[service] || {
            state: 'WHITE_SPACE',
            currentSpend: 0,
            totalWallet: 0,
            priority: 'LOW',
            rationale: ''
          };
          const spend = Number(config.currentSpend) || 0;
          const wallet = Number(config.totalWallet) || 0;
          const sharePct = wallet > 0 ? (spend / wallet) * 100 : 0;
          
          return (
            <Card key={service} className="border shadow-sm p-4 space-y-4 bg-card flex flex-col justify-between">
              <div className="text-center space-y-2">
                <p className="text-xs font-black uppercase text-muted-foreground">{service}</p>
                <div className={cn("mx-auto w-10 h-10 rounded-xl flex items-center justify-center shadow-md text-xs font-black uppercase", stateColors[config.state])}>
                  {service === 'Road' && <TrendingUp className="w-4 h-4" />}
                  {service === 'Air' && <Zap className="w-4 h-4" />}
                  {service === 'B2C' && <Target className="w-4 h-4" />}
                  {service === 'International' && <ShieldCheck className="w-4 h-4" />}
                  {service === 'Courier' && <Activity className="w-4 h-4" />}
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Spend:</span>
                  <span className="font-black text-foreground">${spend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Wallet:</span>
                  <span className="font-black text-foreground">${wallet.toLocaleString()}</span>
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-[8px] font-black uppercase mb-0.5">
                    <span>Share</span>
                    <span className="text-accent">{sharePct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                    <div className="bg-accent h-full" style={{ width: `${Math.min(100, sharePct)}%` }} />
                  </div>
                </div>
                <div className="pt-1 flex justify-between items-center">
                  <span className="text-muted-foreground font-bold uppercase tracking-wider text-[8px]">Priority:</span>
                  <Badge variant="secondary" className="text-[8px] font-black px-1.5 py-0">
                    {config.priority || 'LOW'}
                  </Badge>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rationale and Barriers */}
      <Card className="border border-border shadow-sm p-6 bg-card">
        <div className="flex items-center gap-2 mb-6 text-foreground">
           <Info className="w-4 h-4 text-accent" />
           <CardTitle className="text-sm font-black uppercase">Strategic Rationale & Barriers</CardTitle>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {services.map(service => {
            const config = (whitespaceDoc.configs || {})[service] || {};
            return (
              <div key={service} className="space-y-2">
                <div className="bg-secondary/60 px-2 py-1 rounded border text-[10px] font-black uppercase text-foreground/85">
                  {service}
                </div>
                <p className="text-xs font-medium text-foreground/85 whitespace-pre-wrap leading-relaxed bg-secondary/10 p-2 rounded border border-border/60 min-h-[100px]">
                  {config.rationale || 'No rationale documented.'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
