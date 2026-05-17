"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trash2, PhoneCall, User, Calendar, Loader2, Search, 
  Target, ShieldCheck, ExternalLink, Plus, Users, Save, X 
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { openSalesforceSearch } from '@/lib/utils';

export function AdminCallPlanning() {
  const db = useFirestore();
  const { isLeader, loading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchSearchTerm] = useState('');
  const [isCreatingTeamPlan, setIsCreatingTeamPlan] = useState(false);
  
  const [teamFormData, setTeamFormData] = useState({
    accountName: 'TEAM CAMPAIGN',
    objective: '',
    situation: '',
    problem: '',
    implication: '',
    needPayoff: '',
    services: [] as string[]
  });

  const plansQuery = useMemoFirebase(() => {
    // SECURITY GATE: Prevents index-heavy queries before leader status is confirmed
    if (!db || !isLeader || isAuthLoading) return null;
    // SIMPLIFIED QUERY: Removed complex orderBy to prevent 400 Missing Index errors during verified access
    return collection(db, 'callPlans');
  }, [db, isLeader, isAuthLoading]);
  
  const { data: allPlans, isLoading: isPlansLoading } = useCollection(plansQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader || isAuthLoading) return null;
    return collection(db, 'users');
  }, [db, isLeader, isAuthLoading]);
  const { data: allUsers } = useCollection(usersQuery);

  const userMap = useMemo(() => {
    const map: Record<string, string> = { 'TEAM_NODE': 'TEAM BLUEPRINT' };
    allUsers?.forEach(u => {
      map[u.id] = u.name;
    });
    return map;
  }, [allUsers]);

  const filteredPlans = useMemo(() => {
    if (!allPlans) return [];
    const sorted = [...allPlans].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    return sorted.filter(p => 
      p.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userMap[p.userId]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allPlans, searchTerm, userMap]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm("Permanently archive this call plan from the governance node?")) {
      try {
        await deleteDoc(doc(db, 'callPlans', id));
        toast({ title: "Plan Deleted", description: "Record removed from master ledger." });
      } catch (e) {
        toast({ variant: "destructive", title: "Delete Failed" });
      }
    }
  };

  const handleSaveTeamPlan = async () => {
    if (!db) return;
    try {
      await addDoc(collection(db, 'callPlans'), {
        ...teamFormData,
        userId: 'TEAM_NODE',
        createdAt: serverTimestamp(),
        isTeamPlan: true
      });
      toast({ title: "Team Blueprint Published", description: "This plan is now visible to the entire sales team." });
      setIsCreatingTeamPlan(false);
      setTeamFormData({
        accountName: 'TEAM CAMPAIGN',
        objective: '',
        situation: '',
        problem: '',
        implication: '',
        needPayoff: '',
        services: []
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Publication Failed" });
    }
  };

  if (isPlansLoading || isAuthLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Call Archive...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isCreatingTeamPlan} onOpenChange={setIsCreatingTeamPlan}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-white font-black uppercase text-xs h-11 px-6 shadow-lg shadow-accent/20 gap-2">
              <Users className="w-4 h-4" /> CREATE TEAM BLUEPRINT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-accent" />
                Team Strategy Blueprint
              </DialogTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                Deploy a standardized SPIN plan to all BDMs and AMs.
              </CardDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Campaign/Vertical Name</label>
                  <Input value={teamFormData.accountName} onChange={e => setTeamFormData({...teamFormData, accountName: e.target.value.toUpperCase()})} className="h-11 font-black" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Core Objective</label>
                  <Input value={teamFormData.objective} onChange={e => setTeamFormData({...teamFormData, objective: e.target.value})} className="h-11 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Situation Questions</label>
                  <Textarea value={teamFormData.situation} onChange={e => setTeamFormData({...teamFormData, situation: e.target.value})} className="min-h-[100px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Problem Questions</label>
                  <Textarea value={teamFormData.problem} onChange={e => setTeamFormData({...teamFormData, problem: e.target.value})} className="min-h-[100px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Implication Questions</label>
                  <Textarea value={teamFormData.implication} onChange={e => setTeamFormData({...teamFormData, implication: e.target.value})} className="min-h-[100px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Need-Payoff Questions</label>
                  <Textarea value={teamFormData.needPayoff} onChange={e => setTeamFormData({...teamFormData, needPayoff: e.target.value})} className="min-h-[100px]" />
                </div>
              </div>
              <Button onClick={handleSaveTeamPlan} className="w-full bg-primary font-black h-14 rounded-2xl shadow-xl shadow-primary/20 uppercase">
                PUBLISH TO TEAM NODES
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b pb-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-accent" />
                  Master Preparation Ledger
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Auditing {filteredPlans.length} active strategy documents.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <Input 
                   placeholder="Search accounts or BDMs..." 
                   className="pl-9 h-10 text-xs border-primary/20 rounded-xl"
                   value={searchTerm}
                   onChange={(e) => setSearchSearchTerm(e.target.value)}
                 />
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white">
                <TableRow className="uppercase text-[9px] font-black tracking-widest border-b-2">
                  <TableHead className="pl-6">Corporate Identity</TableHead>
                  <TableHead>Target Account</TableHead>
                  <TableHead>Call Objective</TableHead>
                  <TableHead>Proposed Services</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => (
                  <TableRow key={plan.id} className="group hover:bg-slate-50 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${plan.userId === 'TEAM_NODE' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                            {plan.userId === 'TEAM_NODE' ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                         </div>
                         <p className={`text-xs font-black uppercase ${plan.userId === 'TEAM_NODE' ? 'text-accent' : 'text-primary'}`}>
                           {userMap[plan.userId] || 'Unknown'}
                         </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => openSalesforceSearch(plan.accountName, plan.salesforceId)}
                        className="flex items-center gap-2 hover:text-accent transition-colors group/link"
                      >
                        <Target className="w-3 h-3 text-accent" />
                        <p className="text-xs font-bold text-slate-800 uppercase leading-tight max-w-[150px] truncate">{plan.accountName}</p>
                        {plan.accountName !== 'TEAM CAMPAIGN' && <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-medium text-muted-foreground italic line-clamp-1 max-w-[200px]">"{plan.objective}"</p>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-wrap gap-1">
                          {plan.services?.slice(0, 2).map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[7px] font-black uppercase border-accent/20 text-accent h-4">{s}</Badge>
                          ))}
                          {plan.services?.length > 2 && <span className="text-[7px] font-bold">+{plan.services.length - 2}</span>}
                       </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                        <Calendar className="w-3 h-3" />
                        {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        {plan.userId !== 'TEAM_NODE' && (
                          <button 
                            onClick={() => openSalesforceSearch(plan.accountName, plan.salesforceId)}
                            className="text-slate-300 hover:text-accent p-2"
                            title="Search in Salesforce"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(plan.id)}
                          className="text-red-300 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPlans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 bg-slate-50/30">
                       <PhoneCall className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                       <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No preparation documents found matching your search.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
        <div className="bg-primary p-2 rounded-xl text-white">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-primary uppercase">Audit Protocol</h4>
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            "Governance oversight of call preparation ensures that territory solution mapping remains at the 'Sales Professional' standard. Team Blueprints are shared resources maintained by leadership to drive campaign uniformity."
          </p>
        </div>
      </div>
    </div>
  );
}