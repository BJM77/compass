"use client";

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, orderBy, deleteDoc, doc, setDoc, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea as UITextarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  PhoneCall, Printer, Save, Trash2, Plus, Target, Users, Zap, 
  ShieldCheck, ClipboardList, Loader2, Sparkles, Box, ExternalLink, 
  CheckCircle2, Clock, Map 
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { openSalesforceSearch, getCurrentWeek } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FreightSpinGuide from './freight-spin-guide';

import { useEffect, useMemo } from 'react';

const Textarea = (props: any) => (
  <div className="w-full">
    <UITextarea {...props} className={`print:hidden ${props.className || ''}`} />
    <div className="hidden print:block whitespace-pre-wrap break-words text-sm p-2 w-full">
      {props.value || " "}
    </div>
  </div>
);


interface CallPlanningProps {
  userId: string;
  initialParams?: any;
}

const AVAILABLE_SERVICES = ["Road", "Priority", "Same-day", "TAE", "International", "Custom Plan", "DG's"];

export function CallPlanning({ userId, initialParams }: CallPlanningProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { isLeader } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPlanId, setSelectedBPlanId] = useState<string | null>(null);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [spinGuideOpen, setSpinGuideOpen] = useState(false);
  const [outcomeData, setOutcomeData] = useState({ outcome: '', notes: '' });

  const [formData, setFormData] = useState({
    accountName: '',
    objective: '',
    introduction: '',
    buildRapport: '',
    aboutThem: '',
    aboutUs: '',
    services: [] as string[],
    situation: '',
    problem: '',
    implication: '',
    needPayoff: '',
    objections: ''
  });

  useEffect(() => {
    if (initialParams && initialParams.type === 'fact-finding' && initialParams.data) {
      const docData = initialParams.data;
      const mappedServices: string[] = [];
      const selected = docData.selectedServices || [];
      if (selected.includes('na-time-sensitive') || selected.includes('tom-priority-air-express') || selected.includes('road-express-1-8')) {
        mappedServices.push('Priority');
      }
      if (selected.includes('na-same-day')) {
        mappedServices.push('Same-day');
      }
      if (selected.includes('na-tae')) {
        mappedServices.push('TAE');
      }
      if (selected.includes('tom-intl-air-sea') || docData.internationalFreight) {
        mappedServices.push('International');
      }
      if (docData.dangerousGoods) {
        mappedServices.push("DG's");
      }
      if (selected.includes('tom-road-express') || selected.includes('road-express-1-8')) {
        mappedServices.push('Road');
      }

      setFormData({
        accountName: docData.companyName || '',
        objective: docData.perfectWorld ? `Target perfect world scenario: ${docData.perfectWorld}` : 'Secure commitment for next steps',
        introduction: '',
        buildRapport: '',
        aboutThem: '',
        aboutUs: '',
        services: mappedServices,
        situation: `Discovery Notes:\nBusiness Details: ${docData.businessDetails || 'None'}\nCurrently Using: ${docData.currentlyUsing || 'None'}\nKey Decision Maker: ${docData.keyDecisionMaker || 'None'}\nIncumbent Competitor: ${docData.incumbentCompetitor || 'None'}\nLocations: ${docData.locations || 'None'}`,
        problem: `Pain Points identified: ${docData.painPoints || 'None'}`,
        implication: `What happens if pain points aren't resolved?`,
        needPayoff: `Guaranteed delivery expectation: ${docData.deliveryExpectation || 'None'}`,
        objections: `Contract End Date: ${docData.contractEndDate || 'None'}. ${docData.dangerousGoods ? 'Objections: DG safety compliance certifications' : ''}`
      });
      setSelectedBPlanId(null);
    } else if (initialParams && initialParams.type === 'top8' && initialParams.data) {
      const deal = initialParams.data;
      setFormData({
        accountName: deal.pipeline || '',
        objective: deal.actionsForBen ? `Action Plan: ${deal.actionsForBen}` : 'Advance opportunity to next stage',
        introduction: '',
        buildRapport: '',
        aboutThem: '',
        aboutUs: '',
        services: [],
        situation: `Opportunity Name: ${deal.opportunityName || 'None'}\nCurrent Stage: ${deal.stage || 'None'}`,
        problem: `Barriers identified: ${deal.barriers || 'None'}`,
        implication: '',
        needPayoff: '',
        objections: deal.lastBarrierText || ''
      });
      setSelectedBPlanId(null);
    }
  }, [initialParams]);

  const teamPlansQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'callPlans'),
      where('userId', '==', 'TEAM_NODE'),
      orderBy('createdAt', 'desc')
    );
  }, [db, userId]);
  
  const { data: teamPlans } = useCollection(teamPlansQuery);

  const handleSelectPlan = (plan: any) => {
    setSelectedBPlanId(plan.id);
    setFormData({
      accountName: plan.accountName || '',
      objective: plan.objective || '',
      introduction: plan.introduction || '',
      buildRapport: plan.buildRapport || '',
      aboutThem: plan.aboutThem || '',
      aboutUs: plan.aboutUs || '',
      services: plan.services || [],
      situation: plan.situation || '',
      problem: plan.problem || '',
      implication: plan.implication || '',
      needPayoff: plan.needPayoff || '',
      objections: plan.objections || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewPlan = () => {
    setSelectedBPlanId(null);
    setFormData({
      accountName: '',
      objective: '',
      introduction: '',
        buildRapport: '',
        aboutThem: '',
        aboutUs: '',
        services: [],
        situation: '',
      problem: '',
      implication: '',
      needPayoff: '',
      objections: ''
    });
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleSave = async () => {
    if (!db || !userId || !formData.accountName) {
      toast({ variant: "destructive", title: "Missing Information", description: "Account Name is required." });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'callPlans'), {
        ...formData,
        userId,
        createdAt: serverTimestamp()
      });

      toast({ title: "Plan Archived", description: "SPIN preparation successfully pushed to governance node." });
      handleNewPlan();
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogOutcome = async () => {
    if (!db || !selectedPlanId || !outcomeData.outcome) return;
    try {
      const week = getCurrentWeek();
      
      await addDoc(collection(db, 'callOutcomes'), {
        userId,
        callPlanId: selectedPlanId,
        accountName: formData.accountName,
        outcome: outcomeData.outcome,
        notes: outcomeData.notes,
        week,
        createdAt: serverTimestamp()
      });

      const progressRef = doc(db, 'weeklyProgress', `${userId}_${week}`);
      const updates: Record<string, any> = {
        userId,
        week,
        updatedAt: serverTimestamp()
      };

      if (outcomeData.outcome === 'APPOINTMENT_BOOKED') {
        updates.apps = increment(1);
        updates.calls = increment(1);
      } else {
        updates.calls = increment(1);
      }

      await setDoc(progressRef, updates, { merge: true });

      toast({ title: "Outcome Logged", description: "Closing the loop on professional preparation." });
      setOutcomeDialogOpen(false);
      handleNewPlan();
    } catch (e) {
      toast({ variant: "destructive", title: "Logging Failed" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm("Permanently archive this call plan?")) {
      await deleteDoc(doc(db, 'callPlans', id));
      if (selectedPlanId === id) handleNewPlan();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold font-headline text-primary tracking-tight flex items-center gap-3 uppercase">
          <PhoneCall className="w-6 h-6 md:w-8 md:h-8 text-accent" />
          Call Planning Center
        </h1>
        <div className="flex items-center gap-4">
          <Button onClick={() => setSpinGuideOpen(true)} className="bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 font-black h-11 px-6 uppercase text-xs shadow-lg gap-2">
            <Sparkles className="w-4 h-4" /> SPIN GUIDE
          </Button>
          <Button onClick={handleNewPlan} className="bg-primary hover:bg-primary/90 text-white font-black h-11 px-6 uppercase text-xs shadow-lg gap-2">
            <Plus className="w-4 h-4" /> NEW PREP
          </Button>
        </div>
      </header>

      <Card className="border-none shadow-2xl bg-white overflow-hidden print:shadow-none print:border-2">
        <CardHeader className="bg-slate-900 text-white pb-8 print:bg-white print:text-black print:border-b-4 print:border-black">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <Badge className="bg-accent text-white border-none font-black text-[9px] uppercase tracking-widest mb-2 print:hidden">Elite Prep Mode</Badge>
              <CardTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
                <PhoneCall className="w-8 h-8 text-accent print:hidden" />
                SPIN Strategy Planner
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium print:text-slate-600">
                Situation • Problem • Implication • Need-Payoff
              </CardDescription>
            </div>
            <div className="flex gap-2 print:hidden">
              {selectedPlanId && (
                <Button variant="outline" onClick={() => setOutcomeDialogOpen(true)} className="bg-green-600 border-none text-white hover:bg-green-700 font-black h-10 px-4 text-xs">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> LOG OUTCOME
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-black h-10 px-4 text-xs">
                <Printer className="w-4 h-4 mr-2" /> PRINT PLAN
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-accent hover:bg-accent/90 text-white font-black h-10 px-6 text-xs shadow-xl">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                ARCHIVE PREP
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                 <Target className="w-3.5 h-3.5 text-primary" /> Target Account / Opportunity
              </Label>
              <Input 
                placeholder="e.g. Rio Tinto - Kwinana Logistics" 
                value={formData.accountName}
                onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                className="font-black text-lg h-12 uppercase tracking-tight bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                 <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Primary Call Objective
              </Label>
              <Input 
                placeholder="e.g. Secure commitment for 30-day pilot" 
                value={formData.objective}
                onChange={(e) => setFormData({...formData, objective: e.target.value})}
                className="font-bold text-sm h-12 bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
          </div>

          
          {/* New Target Account Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                Introduction
              </Label>
              <Textarea 
                placeholder="e.g. Briefly introduce yourself..." 
                value={formData.introduction}
                onChange={(e: any) => setFormData({...formData, introduction: e.target.value})}
                className="min-h-[80px] bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                Build R (Rapport)
              </Label>
              <Textarea 
                placeholder="e.g. Mention their recent company news..." 
                value={formData.buildRapport}
                onChange={(e: any) => setFormData({...formData, buildRapport: e.target.value})}
                className="min-h-[80px] bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                About Them
              </Label>
              <Textarea 
                placeholder="e.g. Focus on their specific needs..." 
                value={formData.aboutThem}
                onChange={(e: any) => setFormData({...formData, aboutThem: e.target.value})}
                className="min-h-[80px] bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                About Us
              </Label>
              <Textarea 
                placeholder="e.g. High-level pitch connecting to their needs..." 
                value={formData.aboutUs}
                onChange={(e: any) => setFormData({...formData, aboutUs: e.target.value})}
                className="min-h-[80px] bg-slate-50 focus:bg-white transition-all border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-accent" /> Proposed Services
            </Label>
            <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-2">
              {AVAILABLE_SERVICES.map(service => (
                <div key={service} className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm group hover:border-accent transition-colors">
                  <Checkbox 
                    id={`service-${service}`} 
                    checked={formData.services.includes(service)}
                    onCheckedChange={() => toggleService(service)}
                    className="border-slate-300 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  <label htmlFor={`service-${service}`} className="text-xs font-black uppercase tracking-tight text-primary cursor-pointer select-none">
                    {service}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 group">
               <h4 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">S</div>
                  Situation Questions
               </h4>
               <Textarea 
                  placeholder="What are the current volumes? Which carriers are used today?"
                  value={formData.situation}
                  onChange={(e) => setFormData({...formData, situation: e.target.value})}
                  className="min-h-[140px] bg-slate-50/50 text-sm font-medium border-slate-200 focus:border-blue-400 focus:bg-white transition-all resize-none leading-relaxed"
               />
            </div>
            <div className="space-y-4 group">
               <h4 className="text-xs font-black uppercase text-orange-600 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">P</div>
                  Problem Questions
               </h4>
               <Textarea 
                  placeholder="Where are the delays happening? Is the current provider failing?"
                  value={formData.problem}
                  onChange={(e) => setFormData({...formData, problem: e.target.value})}
                  className="min-h-[140px] bg-slate-50/50 text-sm font-medium border-slate-200 focus:border-orange-400 focus:bg-white transition-all resize-none leading-relaxed"
               />
            </div>
            <div className="space-y-4 group">
               <h4 className="text-xs font-black uppercase text-red-600 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">I</div>
                  Implication Questions
               </h4>
               <Textarea 
                  placeholder="What happens to your project timeline if freight is late?"
                  value={formData.implication}
                  onChange={(e) => setFormData({...formData, implication: e.target.value})}
                  className="min-h-[140px] bg-slate-50/50 text-sm font-medium border-slate-200 focus:border-red-400 focus:bg-white transition-all resize-none leading-relaxed"
               />
            </div>
            <div className="space-y-4 group">
               <h4 className="text-xs font-black uppercase text-green-600 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center">N</div>
                  Need-Payoff Questions
               </h4>
               <Textarea 
                  placeholder="If we could guarantee reduction in transit time, how would that help?"
                  value={formData.needPayoff}
                  onChange={(e) => setFormData({...formData, needPayoff: e.target.value})}
                  className="min-h-[140px] bg-slate-50/50 text-sm font-medium border-slate-200 focus:border-green-400 focus:bg-white transition-all resize-none leading-relaxed"
               />
            </div>
          </div>
        </CardContent>
      </Card>

      {teamPlans && teamPlans.length > 0 && (
        <div className="space-y-4 print:hidden pt-8 animate-in slide-in-from-left duration-700">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-black uppercase tracking-tight text-accent flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Blueprints (Admin Shared)
            </h3>
            <Badge className="bg-accent text-white font-black text-[9px] uppercase">Corporate Strategy</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamPlans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer group ${
                  selectedPlanId === plan.id 
                    ? 'border-accent bg-accent/5 shadow-lg' 
                    : 'border-white bg-white hover:border-accent shadow-sm'
                }`}
              >
                <p className="text-[9px] font-black text-accent uppercase mb-2 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Shared Blueprint
                </p>
                <p className="text-xs font-black text-primary uppercase mt-2 mb-1">{plan.accountName}</p>
                <p className="text-[10px] text-muted-foreground font-medium italic line-clamp-1">"{plan.objective}"</p>
                {isLeader && plan.userId && plan.userId !== 'TEAM_NODE' && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <UserIcon className="w-3 h-3 text-accent" />
                    <span className="text-[9px] font-bold text-accent uppercase tracking-wider">{'Unknown User'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}



      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
               <CheckCircle2 className="w-6 h-6 text-green-600" /> Log Outcome
            </DialogTitle>
            <DialogDescription className="font-bold text-[10px] uppercase tracking-widest">
              Close the loop on the {formData.accountName} call.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Strategic Result</Label>
                <Select onValueChange={(val) => setOutcomeData({...outcomeData, outcome: val})}>
                   <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="SELECT OUTCOME..." /></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="APPOINTMENT_BOOKED" className="font-bold">APPOINTMENT BOOKED</SelectItem>
                      <SelectItem value="FOLLOW_UP" className="font-bold">FOLLOW UP REQUIRED</SelectItem>
                      <SelectItem value="NO_ANSWER" className="font-bold">NO ANSWER / GATEKEEPER</SelectItem>
                      <SelectItem value="LOST" className="font-bold text-red-600">NOT A FIT / LOST</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Debrief Notes</Label>
                <Textarea 
                   placeholder="Quick summary of the conversation..."
                   value={outcomeData.notes}
                   onChange={(e) => setOutcomeData({...outcomeData, notes: e.target.value})}
                   className="min-h-[100px] rounded-xl"
                />
             </div>
          </div>
          <DialogFooter>
             <Button onClick={handleLogOutcome} className="w-full bg-primary font-black h-12 rounded-xl">SAVE PERFORMANCE DATA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={spinGuideOpen} onOpenChange={setSpinGuideOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-[#0f0f13] border-slate-800">
          <DialogTitle className="sr-only">Freight SPIN Guide</DialogTitle>
          <FreightSpinGuide />
        </DialogContent>
      </Dialog>
    </div>
  );
}