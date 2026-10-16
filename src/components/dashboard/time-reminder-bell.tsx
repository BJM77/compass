"use client";

import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { listenForeground } from '@/lib/push';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DueChip } from '@/components/dashboard/time-task-due';
import { Task, needsAttention } from '@/lib/time-mgmt';

/**
 * Header bell: count of overdue + due-today incomplete tasks in the user's
 * current (latest) Manage Time plan, with a popover list.
 */
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
    return query(collection(db, 'timeManagementPlans'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(1));
  }, [db, user, isGuest]);
  const { data: plans } = useCollection<{ tasks?: Task[] }>(latestPlanQuery);

  if (!user || isGuest) return null;
  const items = (plans?.[0]?.tasks || [])
    .filter(t => needsAttention(t, now))
    .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" aria-label={`Task reminders${count ? `: ${count} due` : ''}`}>
          <Bell className="w-5 h-5 text-slate-600" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-bold text-slate-900">Overdue & due today</p>
          <p className="text-[11px] text-slate-500">From your current Manage Time plan (Perth time)</p>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {count === 0 ? (
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
