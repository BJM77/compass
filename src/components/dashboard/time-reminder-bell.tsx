"use client";

import React, { useEffect, useState } from 'react';
import { Bell, MessageSquare, ListTodo, Check } from 'lucide-react';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { mergeContinuousPlans } from '@/lib/time-mgmt';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { listenForeground } from '@/lib/push';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DueChip } from '@/components/dashboard/time-task-due';
import { Task, needsAttention, formatPerth } from '@/lib/time-mgmt';
import { useNavigation } from '@/contexts/navigation-context';

/**
 * Header bell: unread in-app notifications (users/{uid}/notifications, e.g. Fact Finding
 * messages/follow-ups from a leader) plus overdue + due-today incomplete tasks in the
 * user's current Manage Time plan, with a popover list.
 */

type InAppNotification = {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  factFindingId?: string;
  fromName?: string;
  read?: boolean;
  createdAt?: any;
};

const tsMs = (v: any): number => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : 0);
export function TimeReminderBell({ onOpenManageTime }: { onOpenManageTime: () => void }) {
  const { user, isGuest } = useAuth();
  const db = useFirestore();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  const app = useFirebaseApp();
  const { toast } = useToast();

  // Show pushes that arrive while the app is open as toasts.
  useEffect(() => {
    if (!user) return;
    let unsub: () => void = () => {};
    let cancelled = false;
    listenForeground(app, (title, body) => toast({ title, description: body }))
      .then(u => { if (cancelled) u(); else unsub = u; })
      .catch(() => {});
    return () => { cancelled = true; unsub(); };
  }, [app, user, toast]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  const latestPlanQuery = useMemoFirebase(() => {
    if (!db || !user || isGuest) return null;
    return query(collection(db, 'timeManagementPlans'), where('userId', '==', user.uid));
  }, [db, user, isGuest]);
  const { data: plans } = useCollection<{ tasks?: Task[] }>(latestPlanQuery);

  const { navigateTo } = useNavigation();
  const unreadQuery = useMemoFirebase(() => {
    if (!db || !user || isGuest) return null;
    return query(collection(db, 'users', user.uid, 'notifications'), where('read', '==', false));
  }, [db, user, isGuest]);
  const { data: unreadRaw } = useCollection<InAppNotification>(unreadQuery);
  const unread = [...(unreadRaw || [])].sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));

  const markRead = async (n: InAppNotification) => {
    if (!db || !user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true, readAt: serverTimestamp() });
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };
  const openNotification = (n: InAppNotification) => {
    setOpen(false);
    markRead(n);
    if (n.factFindingId) navigateTo('FACT_FINDING', { docId: n.factFindingId });
  };

  if (!user || isGuest) return null;
  const items = mergeContinuousPlans((plans || []) as any).tasks
    .filter(t => needsAttention(t, now))
    .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  const count = items.length + unread.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" aria-label={`Notifications and task reminders${count ? `: ${count}` : ''}`}>
          <Bell className="w-5 h-5 text-slate-600" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {unread.length > 0 && (
          <>
            <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground">Messages ({unread.length})</p>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => unread.forEach(markRead)}>
                Mark all read
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y border-b">
              {unread.map(n => {
                const at = tsMs(n.createdAt);
                const Icon = n.type === 'FACT_FINDING_TODO' ? ListTodo : MessageSquare;
                return (
                  <div key={n.id} className="flex items-start gap-2 px-4 py-2.5 hover:bg-muted/50">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    <button onClick={() => openNotification(n)} className="flex-1 min-w-0 text-left flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground line-clamp-1">{n.title || 'Message'}</span>
                      <span className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap break-words">{n.body}</span>
                      {at > 0 && <span className="text-[10px] text-muted-foreground">{formatPerth(at)} (Perth)</span>}
                    </button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Mark read" aria-label="Mark read" onClick={() => markRead(n)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-bold text-slate-900">Overdue & due today</p>
          <p className="text-[11px] text-slate-500">From your current Manage Time plan (Perth time)</p>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">Nothing due. Nice work.</p>
          ) : items.map(t => (
            <button
              key={t.id}
              onClick={() => { setOpen(false); onOpenManageTime(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex flex-col gap-1"
            >
              <span className="text-sm font-medium text-slate-800 line-clamp-2">{t.text || 'Untitled task'}</span>
              <DueChip task={t} />
            </button>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full text-indigo-700" onClick={() => { setOpen(false); onOpenManageTime(); }}>
            Open Manage Time
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
