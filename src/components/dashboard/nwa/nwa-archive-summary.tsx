"use client";

import React from 'react';
import { isLegacyFridayDoc, mapStoredNwa, followThroughScore } from '@/lib/nwa';
import { LegacyFridaySummary } from './nwa-legacy';
import { OutcomeBadge, ScoreChip } from './nwa-ui';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

/**
 * Compact read-only NWA summary for the weekly archive. V1/V2 NWA docs use the NWA layout;
 * pre-NWA Friday FW docs keep their original fields via LegacyFridaySummary.
 */
export function NwaArchiveSummary({ data, role = 'BDM' }: { data: any; role?: string }) {
  if (!data) return null;
  if (isLegacyFridayDoc(data)) return <LegacyFridaySummary data={{ ...data, managerNote: data.managerNote || data.gmFeedback }} compact />;

  const p = mapStoredNwa(data, role);
  const review = (p.commitmentReview || []).filter(r => r.text.trim());
  const ft = data.followThrough?.score !== undefined ? data.followThrough : followThroughScore(review);
  const wins = [p.wins.customerWins, p.wins.closedOpportunities, p.wins.positiveFeedback, p.wins.teamRecognition].filter(w => w.trim());
  const priorities = p.topPriorities.filter(t => t.trim());
  const challenges = [
    ['Slowing progress', p.challenges.slowingProgress], ['Customer', p.challenges.customerIssues],
    ['Internal', p.challenges.internalIssues], ['Resources', p.challenges.resourcesRequired],
  ].filter(([, v]) => v.trim());
  const commitments = p.commitments.filter(c => c.text.trim());
  const stalled = p.pipeline.stalled.filter(r => r.account.trim());

  return (
    <div className="space-y-4 text-sm">
      {wins.length > 0 && <Block title="Wins"><p className="whitespace-pre-wrap text-muted-foreground">{wins.join('\n')}</p></Block>}
      {p.wins.shoutOut.teammate && <p className="rounded-lg bg-gold/10 px-3 py-2 text-foreground">Shout-out: <span className="font-semibold">{p.wins.shoutOut.teammate}</span>{p.wins.shoutOut.reason && ` · ${p.wins.shoutOut.reason}`}</p>}
      {priorities.length > 0 && (
        <Block title="Top 3 priorities">
          <ol className="list-decimal space-y-0.5 pl-5 text-foreground">{priorities.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </Block>
      )}
      {stalled.length > 0 && (
        <Block title="Stalled deals">
          <ul className="space-y-0.5 text-muted-foreground">{stalled.map(r => <li key={r.id}><span className="text-foreground">{r.account}</span>{r.note && ` · ${r.note}`}</li>)}</ul>
        </Block>
      )}
      {challenges.length > 0 && (
        <Block title="Challenges">
          <ul className="space-y-0.5 text-muted-foreground">{challenges.map(([l, v]) => <li key={l}><span className="font-medium text-foreground">{l}:</span> {v}</li>)}</ul>
        </Block>
      )}
      {commitments.length > 0 && (
        <Block title="Commitments">
          <ul className="space-y-0.5 text-foreground">{commitments.map(c => <li key={c.id}>{c.text}{(c.owner || c.dueDate) && <span className="text-muted-foreground"> · {[c.owner, c.dueDate].filter(Boolean).join(' · ')}</span>}</li>)}</ul>
        </Block>
      )}
      {review.length > 0 && (
        <Block title="Last week’s commitments">
          <div className="mb-1"><ScoreChip score={ft.score ?? null} /></div>
          <ul className="space-y-1">{review.map(r => <li key={r.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{r.text}</span><OutcomeBadge value={r.outcome} /></li>)}</ul>
        </Block>
      )}
      {(data.managerNote || data.adminCoachingNotes || data.gmFeedback) && (
        <div className="rounded-lg bg-surface-2/60 px-3 py-2">
          <h4 className="text-sm font-semibold text-foreground">Manager note</h4>
          <p className="whitespace-pre-wrap text-muted-foreground">{data.managerNote || data.adminCoachingNotes || data.gmFeedback}</p>
        </div>
      )}
    </div>
  );
}
