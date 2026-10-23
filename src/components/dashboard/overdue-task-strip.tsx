"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { collection, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { mergeContinuousPlans, completeTask, cleanTask } from '@/lib/time-mgmt';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Task, formatPerth } from '@/lib/time-mgmt';

const DISMISS_KEY = 'overdueStripDismissed';

/**
 * Red strip under the header listing the user's overdue (dueAt < now),
 * incomplete tasks from their current Manage Time plan.
 */
export function OverdueTaskStrip({ onRearrange }: { onRearrange: (taskId?: string) => void }) {
  const { user, isGuest } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const planQuery = useMemoFirebase(() => {
    if (!db || !user || isGuest) return null;
    return query(collection(db, 'timeManagementPlans'), where('userId', '==', user.uid));
  }, [db, user, isGuest]);
  const { data: plans } = useCollection<{ tasks?: Task[] }>(planQuery);
  // Continuous plan: open tasks across all plans, written back to the newest plan.
  const merged = mergeContinuousPlans((plans || []) as any);

  if (!user || isGuest || dismissed || now === null) return null;
  const overdue = merged.tasks
    .filter(t => !t.completed && !pending[t.id] && t.dueAt && t.dueAt < now)
    .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  if (!merged.activePlanId || overdue.length === 0) return null;

  const markDone = async (taskId: string) => {
    setPending(p => ({ ...p, [taskId]: true }));
    try {
      const tasks = merged.tasks.map(t => t.id === taskId ? cleanTask(completeTask(t)) : t);
      await updateDoc(doc(db, 'timeManagementPlans', merged.activePlanId!), { tasks, carriedIds: merged.carriedIds, updatedAt: serverTimestamp() });
    } catch (e) {
      setPending(p => ({ ...p, [taskId]: false }));
      toast({ title: 'Could not mark done', variant: 'destructive' });
    }
  };

  return (
    <div role="region" aria-label="Overdue tasks" className="bg-danger-soft border-b border-destructive/25 text-destructive print:hidden min-w-0 max-w-full">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 font-semibold text-xs text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span className="hidden sm:inline">Overdue</span>
          <span className="rounded-full bg-destructive text-white px-1.5 min-w-[20px] text-center text-xs">{overdue.length}</span>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:thin]">
          <ul className="flex items-center gap-1.5 w-max pr-2">
            {overdue.map(t => (
              <li key={t.id} className="flex items-center gap-1 rounded-full border border-destructive/25 bg-card pl-2.5 pr-1 py-0.5 text-xs shadow-sm">
                <button
                  type="button"
                  onClick={() => onRearrange(t.id)}
                  title={`Due ${formatPerth(t.dueAt as number)} (Perth)`}
                  className="max-w-[45vw] sm:max-w-[240px] truncate font-semibold text-destructive hover:underline"
                >
                  {t.text || 'Untitled task'}
                </button>
                <button
                  type="button"
                  onClick={() => markDone(t.id)}
                  className="flex items-center gap-0.5 rounded-full bg-destructive hover:bg-destructive/90 text-white px-2 py-0.5 text-xs font-bold"
                  aria-label={`Mark "${t.text}" done`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => onRearrange(overdue[0]?.id)}
          className="shrink-0 flex items-center gap-1 text-xs font-bold text-destructive hover:text-destructive hover:underline"
        >
          <span className="hidden sm:inline">Rearrange</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { sessionStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
          className="shrink-0 p-1 rounded hover:bg-danger-soft"
          aria-label="Dismiss overdue tasks for this session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
