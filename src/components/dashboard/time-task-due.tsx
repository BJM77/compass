"use client";

import React, { useState } from 'react';
import { CalendarPlus, CalendarClock, X, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Task, ReminderOffset, REMINDER_OFFSETS, dueStatus, formatPerth, quickPick,
  toPerthInputValue, fromPerthInputValue, downloadIcs,
} from '@/lib/time-mgmt';
import { cn } from '@/lib/utils';

/** Coloured due chip: red overdue, amber due today, grey later. */
export function DueChip({ task }: { task: Task }) {
  const status = dueStatus(task);
  if (!status || !task.dueAt) return null;
  const label = status === 'overdue' ? 'Overdue' : status === 'today' ? 'Today' : 'Due';
  const time = status === 'today'
    ? formatPerth(task.dueAt, { hour: 'numeric', minute: '2-digit' })
    : formatPerth(task.dueAt);
  return (
    <span
      title={`Due ${formatPerth(task.dueAt, { dateStyle: 'full', timeStyle: 'short' })} (Perth time)`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0 whitespace-nowrap',
        task.completed ? 'bg-slate-100 text-slate-400 line-through'
          : status === 'overdue' ? 'bg-red-100 text-red-700 border border-red-200'
          : status === 'today' ? 'bg-amber-100 text-amber-800 border border-amber-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200'
      )}
    >
      <CalendarClock className="w-3 h-3" />
      {label} · {time}
    </span>
  );
}

/** Popover to set/clear the due date, choose reminders, and export to calendar. */
export function TaskDueControls({
  task, onChange, compact,
}: { task: Task; onChange: (patch: Partial<Task>) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const reminders = task.reminders || [];

  const setDue = (ms: number | null) => {
    onChange({ dueAt: ms, snoozedUntil: null, ...(ms && !task.reminders ? { reminders: ['15m'] as ReminderOffset[] } : {}) });
  };

  const toggleReminder = (id: ReminderOffset) => {
    const next = reminders.includes(id) ? reminders.filter(r => r !== id) : [...reminders, id];
    onChange({ reminders: next });
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setCustom(task.dueAt ? toPerthInputValue(task.dueAt) : ''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Set due date & reminders"
          className={cn('text-slate-500 hover:text-indigo-600 print:hidden', compact ? 'h-6 px-1.5 text-[11px]' : 'h-8 px-2 text-xs')}
        >
          <CalendarClock className={compact ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-1'} />
          {task.dueAt ? 'Edit due' : 'Due date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Due (Perth time)</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDue(quickPick('today5pm'))}>Today 5pm</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDue(quickPick('tomorrow9am'))}>Tmrw 9am</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDue(quickPick('friday5pm'))}>Fri 5pm</Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            aria-label="Custom due date and time (Perth)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 h-8 rounded-md border border-slate-200 px-2 text-xs"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!fromPerthInputValue(custom)}
            onClick={() => { const ms = fromPerthInputValue(custom); if (ms) setDue(ms); }}
          >
            Set
          </Button>
        </div>
        {task.dueAt && (
          <>
            <p className="text-xs text-slate-600">
              Due <strong>{formatPerth(task.dueAt, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</strong> AWST
            </p>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1"><BellRing className="w-3 h-3" /> Push reminders</p>
              <div className="space-y-1">
                {REMINDER_OFFSETS.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={reminders.includes(r.id)} onChange={() => toggleReminder(r.id)} />
                    {r.label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Enable notifications in Settings → Notifications.</p>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => downloadIcs(task)}>
                <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Add to calendar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" onClick={() => { setDue(null); setOpen(false); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
