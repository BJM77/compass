"use client";

/**
 * Read-only blocks shared by the individual TWA and the whole-team view: wins pulled from the TWTW,
 * appointments from the Salesforce upload, CRM pipeline rows and the leader's notes.
 */
import React from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatEAV } from '@/lib/utils';
import { formatPerth } from '@/lib/time-mgmt';
import {
  hasLeaderNotes, weekDateRange,
  type NwaAppointment, type NwaBusinessUpdates, type NwaDealRow, type NwaLeaderNotes, type NwaWins, type NwaWinsSource,
} from '@/lib/nwa';
import { EmptyHint } from './nwa-ui';

const weekNo = (w: string) => w.split('-')[1] || w;

export const WIN_FIELDS = [
  ['customerWins', 'Customer wins', 'What went well with customers?'],
  ['closedOpportunities', 'Closed opportunities', 'Pre-filled from CRM closed won deals'],
  ['positiveFeedback', 'Positive feedback', 'Quotes or feedback worth sharing'],
  ['teamRecognition', 'Team recognition', 'Who helped you get there?'],
] as const;

/** Opens the TWTW view (works on desktop and the mobile shell). */
export function openTwtw() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('switch-view', { detail: { view: 'TWIW' } }));
}

function dayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return ymd || '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Mon 7 Jul – Sun 13 Jul" for a week key. */
export function weekRangeLabel(week: string): string {
  const r = weekDateRange(week);
  return r ? `${dayLabel(r.start)} – ${dayLabel(r.end)}` : `week ${weekNo(week)}`;
}

export function WinsView({ wins, source, reviewWeek, compact, showTwtwLink = true }: {
  wins: NwaWins; source: NwaWinsSource; reviewWeek: string; compact?: boolean; showTwtwLink?: boolean;
}) {
  const filled = WIN_FIELDS.filter(([k]) => (wins[k] || '').trim());
  return (
    <div className="space-y-3">
      {filled.length > 0 ? (
        <div className={cn('grid gap-3', !compact && 'md:grid-cols-2')}>
          {WIN_FIELDS.map(([key, label, hint]) => (
            <div key={key} className="rounded-xl bg-surface-2/50 p-3">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              {!compact && <p className="text-xs text-muted-foreground">{hint}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{(wins[key] || '').trim() || <span className="text-muted-foreground">–</span>}</p>
            </div>
          ))}
        </div>
      ) : null}
      {source === 'none' ? (
        <div className="flex flex-wrap items-center gap-2">
          <EmptyHint>No TWTW for week {weekNo(reviewWeek)} yet. Wins come from the TWTW, so they’re only typed once.</EmptyHint>
          {showTwtwLink && <Button variant="outline" size="sm" onClick={openTwtw}>Open TWTW<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {source === 'twtw'
            ? <>From the week {weekNo(reviewWeek)} TWTW; closed opportunities from CRM closed won deals. Edit them in the TWTW.</>
            : <>Entered on an earlier version of this form.</>}
          {showTwtwLink && source === 'twtw' && <Button variant="link" size="sm" className="ml-1 h-auto p-0 text-xs" onClick={openTwtw}>Open TWTW</Button>}
        </p>
      )}
    </div>
  );
}

export function AppointmentsView({ appointments, planWeek, latestUploadMs, compact }: {
  appointments: NwaAppointment[]; planWeek: string; latestUploadMs: number | null; compact?: boolean;
}) {
  const crm = appointments.filter(a => a.source === 'crm');
  const legacy = appointments.filter(a => a.source !== 'crm' && (a.customer || '').trim());
  const upload = latestUploadMs ? formatPerth(latestUploadMs, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <div className="space-y-3">
      {crm.length === 0 ? (
        <EmptyHint>
          No appointments in the Salesforce upload for {weekRangeLabel(planWeek)}.
          {' '}{upload ? `Latest upload: ${upload} (Perth).` : 'No Salesforce upload found yet.'}
        </EmptyHint>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {crm.map(a => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{dayLabel(a.date)}</span>
              <span className="min-w-0 flex-1 font-medium text-foreground">{a.customer || 'Unnamed account'}</span>
              {a.purpose && !compact && <span className="text-muted-foreground">{a.purpose}</span>}
            </li>
          ))}
        </ul>
      )}
      {crm.length > 0 && !compact && (
        <p className="text-xs text-muted-foreground">From the Salesforce upload (appointments dated {weekRangeLabel(planWeek)}){upload ? `, latest upload ${upload} (Perth)` : ''}.</p>
      )}
      {legacy.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Entered on the old form</p>
          <ul className="space-y-2">
            {legacy.map(a => (
              <li key={a.id} className="rounded-xl bg-surface-2/50 px-4 py-2.5 text-sm">
                <span className="font-medium text-foreground">{a.customer}</span>
                <span className="text-muted-foreground">{[a.date && dayLabel(a.date), a.meetingType].filter(Boolean).map(x => ` · ${x}`).join('')}</span>
                {[a.purpose, a.desiredOutcome, a.supportRequired].some(Boolean) && !compact && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[a.purpose && `Why: ${a.purpose}`, a.desiredOutcome && `Outcome: ${a.desiredOutcome}`, a.supportRequired && `Support: ${a.supportRequired}`].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DealRowsView({ rows, empty }: { rows: NwaDealRow[]; empty?: string }) {
  const shown = rows.filter(r => (r.account || '').trim() || (r.note || '').trim());
  if (!shown.length) return empty ? <EmptyHint>{empty}</EmptyHint> : null;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {shown.map(r => (
        <li key={r.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm', r.autoFlagged && 'bg-warning-soft/30')}>
          <span className="min-w-0 flex-1 font-medium text-foreground">{r.account || 'Unnamed'}</span>
          {r.value > 0 && <span className="tabular-nums text-muted-foreground">{formatEAV(r.value)}</span>}
          {r.nextStep && <span className="text-muted-foreground">Next: {r.nextStep}{r.nextStepDate ? ` (${r.nextStepDate})` : ''}</span>}
          {typeof r.daysWithoutMovement === 'number' && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', r.autoFlagged ? 'bg-warning-soft text-warning-ink' : 'bg-surface-2 text-muted-foreground')}>{r.daysWithoutMovement}d no movement</span>
          )}
          {r.note && <p className="w-full text-xs text-muted-foreground">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** The leader's team-wide and per-person notes for one section, read-only. */
export function LeaderNotesView({ field, team, person, personName }: {
  field: keyof NwaLeaderNotes; team?: Partial<NwaLeaderNotes> | null; person?: Partial<NwaLeaderNotes> | null; personName?: string;
}) {
  const t = (team?.[field] || '').trim();
  const p = (person?.[field] || '').trim();
  if (!t && !p) return null;
  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">From your leader</p>
      {t && <p className="whitespace-pre-wrap text-sm text-foreground">{t}</p>}
      {p && (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          <span className="font-semibold">{personName ? `For ${personName}: ` : 'For you: '}</span>{p}
        </p>
      )}
    </div>
  );
}

export const UPDATE_FIELDS: { key: 'pricingChanges' | 'productUpdates' | 'competitorActivity' | 'other'; label: string }[] = [
  { key: 'pricingChanges', label: 'Pricing changes' },
  { key: 'productUpdates', label: 'Product updates' },
  { key: 'competitorActivity', label: 'Competitor activity' },
  { key: 'other', label: 'Other' },
];

export function BusinessUpdatesView({ value, large }: { value: NwaBusinessUpdates; large?: boolean }) {
  return (
    <div className={cn('grid gap-4', large ? 'md:grid-cols-2' : 'md:grid-cols-2')}>
      {UPDATE_FIELDS.filter(f => value[f.key]?.trim()).map(f => (
        <div key={f.key} className="rounded-xl bg-surface-2/50 p-4">
          <p className={cn('font-semibold text-foreground', large ? 'text-base' : 'text-sm')}>{f.label}</p>
          <p className={cn('mt-1 whitespace-pre-wrap text-muted-foreground', large ? 'text-lg' : 'text-sm')}>{value[f.key]}</p>
        </div>
      ))}
      {value.updatedBy && <p className="text-xs text-muted-foreground md:col-span-2">Posted by {value.updatedBy}</p>}
    </div>
  );
}

