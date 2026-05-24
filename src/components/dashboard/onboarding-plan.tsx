"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Calendar, CheckCircle2, Loader2, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

interface OnboardingPlanProps {
  userId: string;
  userName: string;
  planType?: string;
}

const defaultTasks: Record<string, any> = {
  GROUP_90: {
    30: { focus: "Group Alignment", tasks: ["Initial team integration", "Review shared territory goals", "Establish cadence"], markers: ["Culture fit verified", "Cadence locked"] },
    60: { focus: "Group Momentum", tasks: ["Run cross-territory campaigns", "Share best practices"], markers: ["Internal collaboration active"] },
    90: { focus: "Standardised Scale", tasks: ["Finalise group performance audit", "Lock quarterly objectives"], markers: ["Elite standard achieved"] }
  },
  BDM_NORTH_90: {
    30: { focus: "Establish & Focus", tasks: ["Finalise territory map and top 50 targets", "2 site visits per precinct (Osborne Park to Neerabup)", "Establish daily conversation & pipeline rhythm", "Master North-zone playbook (SME focus)"], markers: ["Target list approved", "Activity rhythm established", "Quick wins identified"] },
    60: { focus: "Build Momentum", tasks: ["Run precinct-specific prospecting campaigns", "Convert pilots to repeat freight", "Identify top 10 expansion accounts", "Weekly coaching on discovery quality"], markers: ["3-5 new accounts billing", "Pipeline quality lifted", "Cross-sell opportunities logged"] },
    90: { focus: "Scale & Optimise", tasks: ["Lock in service agreements with top 5 accounts", "Improve frequency and retention metrics", "Peer-share wins with Metro South team"], markers: ["Forecast reliability improved", "Frequency growth measurable", "Territory rhythm embedded"] }
  },
  BDM_SOUTH_90: {
    30: { focus: "Establish & Focus", tasks: ["Map airport accounts and DCs", "Stakeholder mapping for top 30 logistics leads", "Master South-zone playbook (Air/Sea adjacency)", "Set baseline pipeline hygiene standards"], markers: ["Decision-makers identified", "Value hypotheses per account", "Joint calls completed"] },
    60: { focus: "Build Momentum", tasks: ["Progress contract trials (Linehaul/Palletised)", "Introduce bundled solutions (vendor reduction)", "Fortnightly deal plans on top 5 opportunities"], markers: ["Trials converting to contracts", "Margin discipline improved", "Sales cycles shortening"] },
    90: { focus: "Scale & Optimise", tasks: ["Annualise contracts with major DC accounts", "Strengthen cross-sell into Air/Courier", "Tighten forecast accuracy for the patch"], markers: ["Contract wins booked", "Predictable monthly run-rate", "Strong account penetration"] }
  },
  AM_90: {
    30: { focus: "Handovers & Mapping", tasks: ["Complete account handovers from BDMs", "Validate SLAs and historical volumes", "Relationship mapping for key stakeholders"], markers: ["Portfolio understood", "Immediate risks identified", "Introduction calls completed"] },
    60: { focus: "Retention & Risks", tasks: ["Identify expansion and churn risks", "Introduce first service improvement plans", "Establish regular account cadence"], markers: ["Retention plans documented", "Service metrics baselined", "Expansion pipeline created"] },
    90: { focus: "Growth & Planning", tasks: ["Lock in 12-month growth plans", "Improve service delivery metrics", "Joint planning sessions with territory BDMs"], markers: ["Wallet share increasing", "High satisfaction scores", "Growth targets aligned"] }
  }
};

export function OnboardingPlan({ userId, userName, planType = "BDM_NORTH_90" }: OnboardingPlanProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const configRef = useMemoFirebase(() => (db && user) ? doc(db, 'strategyConfig', 'onboardingPlans') : null, [db, user]);
  const { data: config, isLoading: isConfigLoading } = useDoc(configRef);

  const progressRef = useMemoFirebase(() => (db && user && userId && userId !== 'undefined' && userId !== 'null') ? doc(db, 'onboardingProgress', `${userId}_${planType}`) : null, [db, user, userId, planType]);
  const { data: savedProgress, isLoading: isProgressLoading } = useDoc(progressRef);

  const [activePlan, setActivePlan] = useState<any>(null);
  const [tasks, setTasks] = useState<Record<number, Task[]>>({});

  useEffect(() => {
    const plans = config?.data || defaultTasks;
    const plan = plans[planType] || plans.GROUP_90 || plans.BDM_NORTH_90;
    setActivePlan(plan);

    const initialTasks: Record<number, Task[]> = {};
    const savedState = savedProgress?.tasks || {};

    [30, 60, 90].forEach(phase => {
      initialTasks[phase] = (plan[phase]?.tasks || []).map((t: string, i: number) => {
        const id = `${phase}-${i}`;
        return {
          id,
          title: t,
          completed: savedState[id] === true
        };
      });
    });
    setTasks(initialTasks);
  }, [config, planType, savedProgress]);

  const toggleTask = async (phase: number, id: string) => {
    const newTasks = {
      ...tasks,
      [phase]: tasks[phase].map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    };
    setTasks(newTasks);

    if (db && userId) {
      // Build a flat object of checked states to save
      const checkedState: Record<string, boolean> = {};
      Object.values(newTasks).flat().forEach(t => {
        if (t.completed) checkedState[t.id] = true;
      });
      
      await setDoc(doc(db, 'onboardingProgress', `${userId}_${planType}`), {
        tasks: checkedState,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  if (isConfigLoading || isProgressLoading || !activePlan) return (
    <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-dashed">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const totalTasks = Object.values(tasks).flat().length;
  const completedTasks = Object.values(tasks).flat().filter(t => t.completed).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Card className="border-none shadow-md bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            {planType === 'GROUP_90' ? <Users className="w-5 h-5 text-accent" /> : <Calendar className="w-5 h-5 text-accent" />}
            30-60-90 Day Success Plan
          </CardTitle>
          <p className="text-sm text-muted-foreground">{userName}'s Strategic Roadmap {planType === 'GROUP_90' && '(Group Shared)'}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-accent">{Math.round(progress)}%</div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Complete</div>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="h-2 mb-6" />
        
        <Tabs defaultValue="30">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/20">
            <TabsTrigger value="30" className="font-bold">First 30</TabsTrigger>
            <TabsTrigger value="60" className="font-bold">Day 31-60</TabsTrigger>
            <TabsTrigger value="90" className="font-bold">Day 61-90</TabsTrigger>
          </TabsList>
          
          {[30, 60, 90].map(phase => (
            <TabsContent key={phase} value={phase.toString()} className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 bg-muted/30 rounded-xl p-6 border border-border/50">
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-primary">
                    <ClipboardList className="w-4 h-4 text-accent" />
                    Focus: {activePlan[phase]?.focus}
                  </h4>
                  <div className="space-y-3">
                    {tasks[phase]?.map(task => (
                      <div key={task.id} className="flex items-start gap-3 p-3 hover:bg-white/50 rounded-lg transition-colors group">
                        <Checkbox 
                          id={task.id} 
                          checked={task.completed} 
                          onCheckedChange={() => toggleTask(phase, task.id)}
                          className="mt-0.5 border-accent data-[state=checked]:bg-accent"
                        />
                        <label 
                          htmlFor={task.id} 
                          className={`text-sm leading-tight cursor-pointer transition-all font-medium ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                        >
                          {task.title}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-4 bg-primary/5 rounded-xl p-6 border border-primary/10">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Success Markers
                  </h4>
                  <ul className="space-y-3">
                    {activePlan[phase]?.markers?.map((marker: string, i: number) => (
                      <li key={i} className="text-[11px] font-bold text-muted-foreground flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        {marker}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
