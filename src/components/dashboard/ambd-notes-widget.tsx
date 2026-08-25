"use client";

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, History, MessageSquare, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';

interface AMBDNote {
  id: string;
  userId: string;
  userName: string;
  title: string;
  content: string;
  status: 'UNREAD' | 'READ';
  createdAt: any;
  readAt?: any;
  createdBy: string;
  createdByName: string;
}

export function AMBDNotesWidget({ userId }: { userId: string }) {
  const db = useFirestore();
  const { toast } = useToast();

  const notesQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(
      collection(db, 'ambdNotes'),
      where('userId', '==', userId),
      limit(100) // generous limit to avoid composite index ordering issues
    );
  }, [db, userId]);

  const { data: rawNotes, isLoading } = useCollection(notesQuery);

  const { unreadNotes, readNotes } = useMemo(() => {
    if (!rawNotes) return { unreadNotes: [], readNotes: [] };
    const list = [...rawNotes] as AMBDNote[];
    
    // Sort client-side to bypass composite index constraints
    list.sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });

    const unread = list.filter(n => n.status === 'UNREAD');
    const read = list.filter(n => n.status === 'READ');
    return { unreadNotes: unread, readNotes: read };
  }, [rawNotes]);

  const handleConfirm = async (noteId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'ambdNotes', noteId), {
        status: 'READ',
        readAt: serverTimestamp()
      });
      toast({ title: 'Confirmation Logged', description: 'You have confirmed receipt of this instruction.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not log confirmation.' });
    }
  };

  if (isLoading) {
    return <div className="text-center p-4 text-xs text-slate-400 font-semibold">Loading critical updates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* UNREAD INSTRUCTIONS SECTION */}
      {unreadNotes.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="w-5 h-5 animate-bounce" />
            <h4 className="text-xs font-black uppercase tracking-widest">Awaiting Your Action & Confirmation ({unreadNotes.length})</h4>
          </div>
          <div className="space-y-3">
            {unreadNotes.map((note) => (
              <Card key={note.id} className="border border-rose-100 bg-rose-50/20 shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-rose-50/50 pb-3 border-b border-rose-100/50">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 mt-1.5">{note.title}</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                      {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'PPP p') : 'Just now'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-rose-100/50">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      Sender: <strong className="text-slate-800">{note.createdByName}</strong>
                    </span>
                    <Button 
                      onClick={() => handleConfirm(note.id)}
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-4 h-8 gap-1.5 shadow-md shadow-rose-600/10 w-full sm:w-auto"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Confirm Receipt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* ARCHIVE / READ LIST SECTION */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <History className="w-4 h-4" /> Notes & Updates Archive ({readNotes.length})
        </h4>
        {readNotes.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-2xl text-xs font-semibold text-slate-400">
            No archived instructions
          </div>
        ) : (
          <div className="space-y-3">
            {readNotes.map((note) => (
              <Card key={note.id} className="border border-slate-100 bg-white shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <Badge className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase tracking-wider gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Confirmed
                      </Badge>
                      <h4 className="text-xs font-black uppercase text-slate-900 mt-1.5">{note.title}</h4>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-[9px] font-semibold text-slate-400 block">
                        Sent: {note.createdAt?.toDate ? format(note.createdAt.toDate(), 'dd MMM yyyy, HH:mm') : 'N/A'}
                      </span>
                      {note.readAt?.toDate && (
                        <span className="text-[9px] font-bold text-emerald-600 block">
                          Confirmed: {format(note.readAt.toDate(), 'dd MMM yyyy, HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Sender: <strong className="text-slate-600">{note.createdByName}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
