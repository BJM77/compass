"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, Map, ClipboardList, Target, ShieldCheck, Zap, Truck, Anchor, Hammer, Loader2, Users } from 'lucide-react';
import { playbooks as defaultPlaybooks } from './territory-playbook';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const defaultPlans = {
  GROUP_90: {
    30: { focus: "Group Alignment", tasks: ["Initial team integration", "Review shared territory goals", "Establish cadence"], markers: ["Culture fit verified", "Cadence locked"] },
    60: { focus: "Group Momentum", tasks: ["Run cross-territory campaigns", "Share best practices"], markers: ["Internal collaboration active"] },
    90: { focus: "Standardised Scale", tasks: ["Finalise group performance audit", "Lock quarterly objectives"], markers: ["Elite standard achieved"] }
  },
  BDM_NORTH_90: {
    30: { focus: "Establish & Focus", tasks: ["Finalise territory map and top 50 targets", "2 site visits per precinct"], markers: ["Target list approved"] },
    60: { focus: "Build Momentum", tasks: ["Run precinct campaigns"], markers: ["3-5 accounts billing"] },
    90: { focus: "Scale & Optimise", tasks: ["Lock agreements"], markers: ["Forecast reliability"] }
  },
  BDM_SOUTH_90: {
    30: { focus: "Establish & Focus", tasks: ["Map airport accounts"], markers: ["Decision makers identified"] },
    60: { focus: "Build Momentum", tasks: ["Progress trials"], markers: ["Trials to contracts"] },
    90: { focus: "Scale & Optimise", tasks: ["Annualise contracts"], markers: ["Wins booked"] }
  },
  AM_90: {
    30: { focus: "Handovers", tasks: ["Complete account handovers"], markers: ["Portfolio understood"] },
    60: { focus: "Retention", tasks: ["Identify churn risks"], markers: ["Retention plans documented"] },
    90: { focus: "Growth", tasks: ["Lock 12m plans"], markers: ["Wallet share increasing"] }
  }
};

export function StrategyManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const playbookRef = useMemoFirebase(() => db ? doc(db, 'strategyConfig', 'territoryPlaybooks') : null, [db]);
  const onboardingRef = useMemoFirebase(() => db ? doc(db, 'strategyConfig', 'onboardingPlans') : null, [db]);

  const { data: remotePlaybooks } = useDoc(playbookRef);
  const { data: remoteOnboarding } = useDoc(onboardingRef);

  const [playbooks, setPlaybooks] = useState<any>(defaultPlaybooks);
  const [onboarding, setOnboarding] = useState<any>(defaultPlans);

  useEffect(() => { if (remotePlaybooks?.data) setPlaybooks(remotePlaybooks.data); }, [remotePlaybooks]);
  useEffect(() => { if (remoteOnboarding?.data) setOnboarding(remoteOnboarding.data); }, [remoteOnboarding]);

  const sanitizeArray = (arr: any[]) => Array.isArray(arr) ? arr.filter(item => typeof item === 'string' && item.trim() !== '') : [];

  const savePlaybooks = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      // Sanitize playbooks before saving to remove empty entries from multi-line textareas
      const sanitizedPlaybooks = { ...playbooks };
      Object.keys(sanitizedPlaybooks).forEach(k => {
        sanitizedPlaybooks[k].wins = sanitizeArray(sanitizedPlaybooks[k].wins);
        sanitizedPlaybooks[k].precincts = sanitizeArray(sanitizedPlaybooks[k].precincts);
      });

      await setDoc(doc(db, 'strategyConfig', 'territoryPlaybooks'), { data: sanitizedPlaybooks, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Playbooks Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally { setIsSaving(false); }
  };

  const saveOnboarding = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      // Sanitize onboarding plans
      const sanitizedOnboarding = { ...onboarding };
      Object.keys(sanitizedOnboarding).forEach(planKey => {
        [30, 60, 90].forEach(phase => {
          sanitizedOnboarding[planKey][phase].tasks = sanitizeArray(sanitizedOnboarding[planKey][phase].tasks);
          sanitizedOnboarding[planKey][phase].markers = sanitizeArray(sanitizedOnboarding[planKey][phase].markers);
        });
      });

      await setDoc(doc(db, 'strategyConfig', 'onboardingPlans'), { data: sanitizedOnboarding, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Onboarding Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally { setIsSaving(false); }
  };

  const updatePlaybookField = (terr: string, field: string, value: any) => {
    setPlaybooks((prev: any) => ({ ...prev, [terr]: { ...prev[terr], [field]: value } }));
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      <Tabs defaultValue="playbooks" className="w-full space-y-6">
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-white border p-1 rounded-xl h-auto inline-flex min-w-full md:min-w-0">
            <TabsTrigger value="playbooks" className="px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm">
              <Map className="w-4 h-4 mr-2" /> Playbooks
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm">
              <ClipboardList className="w-4 h-4 mr-2" /> 90-Day Plans
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="playbooks" className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-primary/5 p-4 rounded-2xl border border-primary/10 gap-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-primary">Territory Definitions</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">Manage Precincts, Winning Messages, and Specialisations.</p>
            </div>
            <Button onClick={savePlaybooks} disabled={isSaving} className="w-full md:w-auto bg-primary font-bold h-10 text-xs">
              {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save Playbooks
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(playbooks).map(([key, p]: [string, any]) => (
              <Card key={key} className="border shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs md:text-sm font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" /> {p.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-[8px] uppercase font-bold">{key}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Precincts</Label>
                    <Input 
                      className="text-xs h-8"
                      value={p.precincts?.join(', ')} 
                      onChange={(e) => updatePlaybookField(key, 'precincts', e.target.value.split(',').map(s => s.trim()))} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Specialisation</Label>
                    <Input className="text-xs h-8" value={p.specialisation} onChange={(e) => updatePlaybookField(key, 'specialisation', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Core Target</Label>
                    <Input className="text-xs h-8" value={p.target} onChange={(e) => updatePlaybookField(key, 'target', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Winning Messages</Label>
                    <Textarea 
                      className="min-h-[80px] text-xs" 
                      value={p.wins?.join('\n')} 
                      onChange={(e) => updatePlaybookField(key, 'wins', e.target.value.split('\n'))}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6 space-y-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between bg-primary/5 p-4 rounded-2xl border border-primary/10 gap-4">
            <div>
              <h3 className="text-base md:text-lg font-bold text-primary">Onboarding Pathways</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">Define tasks and success markers for the first 90 days. Includes Group Plan.</p>
            </div>
            <Button onClick={saveOnboarding} disabled={isSaving} className="w-full md:w-auto bg-primary font-bold h-10 text-xs">
              {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save Plans
            </Button>
          </div>

          <div className="space-y-8">
            {Object.entries(onboarding).map(([planKey, phases]: [string, any]) => (
              <Card key={planKey} className="border shadow-md">
                <CardHeader className="border-b p-4">
                  <CardTitle className="text-sm md:text-lg font-bold text-primary flex items-center gap-2">
                    {planKey === 'GROUP_90' ? <Users className="w-5 h-5 text-accent" /> : <ShieldCheck className="w-5 h-5 text-accent" />}
                    {planKey.replace(/_/g, ' ')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-x md:divide-y-0">
                    {[30, 60, 90].map(phase => (
                      <div key={phase} className="p-4 md:p-6 space-y-4">
                        <Badge className="bg-accent text-white font-bold uppercase text-[8px] md:text-[9px] mb-2">Day {phase}</Badge>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Focus</Label>
                          <Input 
                            className="text-xs h-8"
                            value={phases[phase]?.focus} 
                            onChange={(e) => {
                              const newPlans = { ...onboarding };
                              newPlans[planKey][phase].focus = e.target.value;
                              setOnboarding(newPlans);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tasks</Label>
                          <Textarea 
                            className="text-xs min-h-[100px]"
                            value={phases[phase]?.tasks?.join('\n')}
                            onChange={(e) => {
                              const newPlans = { ...onboarding };
                              newPlans[planKey][phase].tasks = e.target.value.split('\n');
                              setOnboarding(newPlans);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Success Markers</Label>
                          <Textarea 
                            className="text-xs min-h-[80px] bg-primary/5"
                            value={phases[phase]?.markers?.join('\n')}
                            onChange={(e) => {
                              const newPlans = { ...onboarding };
                              newPlans[planKey][phase].markers = e.target.value.split('\n');
                              setOnboarding(newPlans);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
