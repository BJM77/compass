"use client";

/**
 * "M" (message owner) and "TD" (to-do for owner) buttons for a Fact Finding record.
 * Admins/leaders only (users/{uid}.role via useAuth().isLeader); Firestore rules enforce the same.
 */
import { useState } from 'react';
import {
  collection, doc, getDocs, query, where, writeBatch, serverTimestamp, arrayUnion,
  orderBy, limit,
} from 'firebase/firestore';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { mergeContinuousPlans, formatPerth } from '@/lib/time-mgmt';
import { buildFollowUpTask, findOpenFollowUp, followUpTitle, MESSAGE_MAX } from '@/lib/fact-finding-actions';
import { cn } from '@/lib/utils';

type Props = {
  factFindingId?: string;
  ownerId?: string;
  ownerName?: string;
  companyName?: string;
  className?: string;
};

const iconBtn =
  'h-7 min-w-7 px-1.5 text-[11px] font-black tracking-tight rounded-md border border-border bg-background text-primary hover:bg-primary hover:text-primary-foreground';

export function FactFindingOwnerActions({ factFindingId, ownerId, ownerName, companyName, className }: Props) {
  const db = useFirestore();
  const { user, isLeader, profile } = useAuth();
  const { toast } = useToast();
  const [msgOpen, setMsgOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [addingTodo, setAddingTodo] = useState(false);

  if (!isLeader || !user || !db || !factFindingId || !ownerId) return null;

  const fromName = (profile as any)?.name || user.displayName || user.email || 'A leader';
  const who = ownerName || 'the owner';
  const customer = (companyName || '').trim() || 'Unnamed customer';
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const batch = writeBatch(db);
      const msgRef = doc(collection(db, 'factFindingDocs', factFindingId, 'messages'));
      batch.set(msgRef, {
        fromUid: user.uid,
        fromName,
        toUid: ownerId,
        text: body,
        createdAt: serverTimestamp(),
      });
      const nRef = doc(collection(db, 'users', ownerId, 'notifications'));
      batch.set(nRef, {
        type: 'FACT_FINDING_MESSAGE',
        title: `${fromName} · ${customer} Fact Finding`,
        body,
        factFindingId,
        fromUid: user.uid,
        fromName,
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      toast({ title: 'Message sent', description: `${who} will see it in their notifications bell.` });
      setText('');
      setMsgOpen(false);
    } catch (err: any) {
      console.error('Fact Finding message failed', err);
      toast({ variant: 'destructive', title: 'Message not sent', description: err?.message || 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const addTodo = async () => {
    setAddingTodo(true);
    try {
      const snap = await getDocs(query(collection(db, 'timeManagementPlans'), where('userId', '==', ownerId)));
      const plans = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const merged = mergeContinuousPlans(plans);
      const existing = findOpenFollowUp(merged.tasks, factFindingId);
      if (existing) {
        toast({
          title: 'Follow-up already open',
          description: `${who} already has "${existing.text}"${existing.dueAt ? ` due ${formatPerth(existing.dueAt)} (Perth)` : ''}. No duplicate added.`,
        });
        return;
      }
      const task = buildFollowUpTask({ factFindingId, companyName, assignedBy: user.uid, assignedByName: fromName });
      const batch = writeBatch(db);
      if (merged.activePlanId) {
        batch.update(doc(db, 'timeManagementPlans', merged.activePlanId), {
          tasks: arrayUnion(task),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(collection(db, 'timeManagementPlans')), {
          userId: ownerId,
          tasks: [task],
          carriedIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(collection(db, 'users', ownerId, 'notifications')), {
        type: 'FACT_FINDING_TODO',
        title: `${fromName} added a follow-up`,
        body: `${followUpTitle(companyName)}: due ${formatPerth(task.dueAt!)} (Perth), in Do Soon.`,
        factFindingId,
        fromUid: user.uid,
        fromName,
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      toast({
        title: 'Follow-up added',
        description: `Added to ${who}'s Do Soon. Due and reminder: ${formatPerth(task.dueAt!, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (Perth). Moves to Do Now if not done by then.`,
      });
    } catch (err: any) {
      console.error('Fact Finding follow-up failed', err);
      toast({ variant: 'destructive', title: 'Follow-up not added', description: err?.message || 'Please try again.' });
    } finally {
      setAddingTodo(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <span className={cn('inline-flex items-center gap-1', className)} onClick={stop} onKeyDown={stop}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={iconBtn} aria-label={`Message ${who}`}
              onClick={(e) => { e.stopPropagation(); setMsgOpen(true); }}>
              M
            </Button>
          </TooltipTrigger>
          <TooltipContent>Message {who}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={iconBtn} disabled={addingTodo}
              aria-label={`Add a follow-up to ${who}'s Do Soon`}
              onClick={(e) => { e.stopPropagation(); addTodo(); }}>
              {addingTodo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'TD'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a follow-up to {who}&apos;s Do Soon (3pm next working day)</TooltipContent>
        </Tooltip>
      </span>

      <Dialog open={msgOpen} onOpenChange={(o) => { if (!sending) setMsgOpen(o); }}>
        <DialogContent className="max-w-lg" onClick={stop}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" /> Message {who}
            </DialogTitle>
            <DialogDescription>
              About {customer} Fact Finding. {who} gets it in their notifications bell, and it is saved on the record.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={text}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage(); }}
            placeholder="Type your message…"
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={sendMessage} disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

/** Message history on the record. Visible to admins/leaders and the record owner. */
export function FactFindingMessages({ factFindingId, ownerId }: { factFindingId?: string; ownerId?: string }) {
  const db = useFirestore();
  const { user, isLeader } = useAuth();
  const canRead = !!user && !!factFindingId && (isLeader || user.uid === ownerId);
  const q = useMemoFirebase(() => {
    if (!db || !canRead || !factFindingId) return null;
    return query(collection(db, 'factFindingDocs', factFindingId, 'messages'), orderBy('createdAt', 'desc'), limit(50));
  }, [db, canRead, factFindingId]);
  const { data: messages } = useCollection<any>(q);

  if (!canRead || !messages || messages.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-black text-foreground flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" /> Messages to owner ({messages.length})
      </h3>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {messages.map((m: any) => {
          const at = m.createdAt?.toMillis ? m.createdAt.toMillis() : null;
          return (
            <li key={m.id} className="rounded-lg bg-muted/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground font-semibold">
                {m.fromName || 'Leader'}{at ? ` · ${formatPerth(at)}` : ''}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.text}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
