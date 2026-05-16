"use client";

import { useMemo } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, ShieldCheck, Loader2, Minus } from 'lucide-react';

export function TeamComparison() {
  const db = useFirestore();
  const bdmStatsQuery = useMemoFirebase(() => db ? collection(db, 'bdmStats') : null, [db]);
  const { data: teamStats, isLoading } = useCollection(bdmStatsQuery);

  // Composite Leaderboard logic: 50% achievement, 30% activity, 20% behavior
  const calculateComposite = (m: any) => {
    const target = m.target || 2000000;
    const achievement = (m.revenueYTD / target) * 100;
    const activity = m.activityScore || 0;
    const behavior = m.behaviourScore || 0;
    return (achievement * 0.5) + (activity * 0.3) + (behavior * 0.2);
  };

  const sorted = useMemo(() => {
    if (!teamStats) return [];
    return [...teamStats].sort((a, b) => calculateComposite(b) - calculateComposite(a));
  }, [teamStats]);

  const renderTable = (members: any[], title: string, icon: any) => (
    <Card className="border-none shadow-2xl bg-white mb-8 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
        <CardTitle className="text-xl font-black flex items-center gap-2 text-primary uppercase">
          {icon} {title}
        </CardTitle>
        <Badge variant="outline" className="border-accent text-accent font-black text-[9px]">ELITE INDEX</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="uppercase text-[10px] font-black border-b">
                <TableHead className="pl-6">Rank / BDM</TableHead>
                <TableHead>Achievement</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-right">Yield</TableHead>
                <TableHead className="text-center">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m, idx) => {
                const achievement = (m.revenueYTD / (m.target || 1)) * 100;
                const score = calculateComposite(m);
                return (
                  <TableRow key={m.id} className="hover:bg-slate-50 transition-colors cursor-default">
                    <TableCell className="pl-6 py-5 font-black">
                      <div className="flex items-center gap-3">
                        <span>{idx + 1}. {m.name}</span>
                        <Badge variant="secondary" className="bg-slate-100 text-[8px] h-4"><Minus className="w-2 h-2" /></Badge>
                      </div>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <Progress value={achievement} className="h-2 mb-1" />
                      <span className="text-[10px] font-bold">{achievement.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-center font-black text-accent">{score.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-black">${((m.revenueYTD / (m.activityScore || 1))/1000).toFixed(1)}k</TableCell>
                    <TableCell className="text-center text-green-600 font-black">{m.behaviourScore || 0}%</TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground uppercase text-[10px] font-black tracking-widest bg-slate-50/30">
                    No active nodes found for this category.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {renderTable(sorted.filter(s => s.role === 'BDM'), "Mastery Velocity Matrix", <Gauge className="w-6 h-6 text-accent" />)}
      {renderTable(sorted.filter(s => s.role === 'ACCOUNT_MANAGER'), "Strategic Retention Matrix", <ShieldCheck className="w-6 h-6 text-green-500" />)}
    </div>
  );
}