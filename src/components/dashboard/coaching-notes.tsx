"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from 'date-fns';
import { MessageSquarePlus, Clock, Lock, Globe, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  text: string;
  isPrivate: boolean;
  status?: 'OPEN' | 'RESOLVED';
  createdAt: any;
  createdBy?: string;
}

interface CoachingNotesProps {
  notes: Note[];
  canAdd?: boolean;
  onAddNote?: (text: string, isPrivate: boolean) => Promise<void>;
  currentUserId?: string;
  parentUserId?: string;
}

export function CoachingNotes({ notes, canAdd, onAddNote, currentUserId, parentUserId }: CoachingNotesProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newNote.trim() || !onAddNote) return;
    setIsSubmitting(true);
    try {
      await onAddNote(newNote, isPrivate);
      setNewNote('');
      toast({ title: "Entry Logged", description: "Governance node updated." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (noteId: string, currentStatus: string) => {
    if (!db || !parentUserId) return;
    const newStatus = currentStatus === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
    try {
      await updateDoc(doc(db, 'coachingNotes', parentUserId, 'entries', noteId), {
        status: newStatus
      });
      toast({ title: `Coaching ${newStatus}` });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card className="flex flex-col h-full border-none shadow-2xl bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-primary">
              <MessageSquarePlus className="w-5 h-5 text-accent" />
              Strategic Coaching Log
            </CardTitle>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Compounding Professional Mastery</p>
          </div>
          <Badge className="bg-slate-900 text-white border-none font-black text-[9px] uppercase tracking-widest px-3">
            {notes.filter(n => n.status !== 'RESOLVED').length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden pt-6">
        {canAdd && (
          <div className="space-y-4 bg-primary/5 p-5 rounded-3xl border border-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPrivate ? <Lock className="w-3.5 h-3.5 text-red-500" /> : <Globe className="w-3.5 h-3.5 text-green-500" />}
                <Label htmlFor="privacy-toggle" className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {isPrivate ? 'Confidential Audit Entry' : 'Public Achievement'}
                </Label>
              </div>
              <Switch
                id="privacy-toggle"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
            <Textarea
              placeholder={isPrivate ? "Log behavioral risk or 1:1 outcome..." : "Log a public recognition or win..."}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="resize-none min-h-[100px] bg-white border-primary/10 rounded-2xl text-sm font-medium"
            />
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !newNote.trim()}
              className="w-full bg-primary font-black uppercase text-xs h-12 rounded-xl shadow-lg"
            >
              {isSubmitting ? 'PUNCHING NODE...' : 'SUBMIT PERFORMANCE ENTRY'}
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 h-[500px] pr-4">
          <div className="space-y-4">
            {notes.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed">
                <ShieldAlert className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No historical coaching nodes found.</p>
              </div>
            ) : (
              notes.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
              }).map((note) => (
                <div 
                  key={note.id} 
                  className={`p-5 rounded-3xl border-2 transition-all group relative overflow-hidden ${
                    note.status === 'RESOLVED' ? 'bg-slate-50 border-slate-100 opacity-60' :
                    note.isPrivate ? 'bg-white border-red-50 shadow-sm' : 'bg-white border-green-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className={`text-[8px] font-black uppercase border-none ${
                        note.isPrivate ? 'text-red-600 bg-red-100/50' : 'text-green-600 bg-green-100/50'
                      }`}>
                        {note.isPrivate ? 'Audited' : 'Public'}
                      </Badge>
                      {note.status === 'OPEN' && (
                        <div className="flex items-center gap-1.5 text-[8px] font-black text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-full uppercase">
                           <AlertCircle className="w-2.5 h-2.5" /> Action Required
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt), { addSuffix: true })}
                      </div>
                      {canAdd && (
                        <button 
                          onClick={() => toggleStatus(note.id, note.status || 'OPEN')}
                          className={`p-1 rounded-full transition-colors ${note.status === 'RESOLVED' ? 'text-green-600' : 'text-slate-300 hover:text-green-500'}`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed font-bold text-slate-800 ${note.status === 'RESOLVED' ? 'line-through' : ''}`}>
                    {note.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
