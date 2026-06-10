"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, PlusCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function OpsReportForm() {
  const { user, profile } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [type, setType] = useState<'PROBLEM' | 'POSITIVE'>('PROBLEM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentWeek = getCurrentWeek();

  const opsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'opsReports'),
      where('userId', '==', user.uid),
      where('week', '==', currentWeek)
    );
  }, [db, user, currentWeek]);

  const { data: myReports, loading } = useCollection(opsQuery);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a description.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (!db || !user) throw new Error("Not connected");
      
      await addDoc(collection(db, 'opsReports'), {
        userId: user.uid,
        userName: profile?.name || user.email,
        week: currentWeek,
        type,
        description,
        status: 'ESCALATED',
        createdAt: serverTimestamp()
      });
      
      toast({ title: 'Success', description: 'Ops Report submitted successfully.' });
      setDescription('');
      setType('PROBLEM');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit report.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-accent" />
          Weekly Ops Report
        </h2>
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
          Log operational problems or positive events for GM escalation
        </p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-sm font-black uppercase text-primary flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> New Entry - Week {currentWeek.split('-')[1]}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Event Type</label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger className="h-12 border-slate-200">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROBLEM"><span className="font-bold text-orange-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Operational Problem</span></SelectItem>
                  <SelectItem value="POSITIVE"><span className="font-bold text-emerald-600 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Positive Event</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
            <Textarea 
              className="min-h-[120px] bg-slate-50 resize-none"
              placeholder="Describe what happened, the impact, and any actions taken..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !description.trim()} 
            className="w-full md:w-auto font-black uppercase h-12 px-8"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Submit Report
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 mt-8">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b pb-2">Your Submissions This Week</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : myReports && myReports.length > 0 ? (
          <div className="grid gap-4">
            {myReports.map((report: any) => (
              <Card key={report.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={report.type === 'PROBLEM' ? 'bg-orange-100 text-orange-800 border-none' : 'bg-emerald-100 text-emerald-800 border-none'}>
                        {report.type === 'PROBLEM' ? 'PROBLEM' : 'POSITIVE EVENT'}
                      </Badge>
                      <Badge variant="outline" className={report.status === 'ESCALATED' ? 'border-primary text-primary' : 'border-slate-300 text-slate-500'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{report.description}</p>
                  </div>
                  {report.createdAt && (
                    <div className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                      {report.createdAt.toDate?.().toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No reports submitted this week.</p>
          </div>
        )}
      </div>
    </div>
  );
}
