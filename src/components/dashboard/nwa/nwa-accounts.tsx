"use client";

import React from 'react';
import { AlertTriangle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatEAV } from '@/lib/utils';
import {
  HANDOVER_STATUS_LABEL, RENEWAL_STATUS_LABEL, RENEWAL_TYPE_LABEL, RISK_STATUS_LABEL,
  type AccountOption, type AccountSignal, type HandoverStatus, type NwaAccountMgmt, type NwaAtRiskRow, type NwaGrowthRow,
  type NwaHandover, type NwaRenewalRow, type RenewalStatus, type RenewalType, type RiskStatus,
  emptyAtRiskRow, emptyGrowthRow, emptyHandover, emptyRenewalRow, signalToAtRiskRow, totalRevenueAtRisk,
} from '@/lib/nwa';
import { EmptyHint, SubHeading } from './nwa-ui';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const LIST_ID = 'nwa-account-options';

/** Account name input with a CRM picker; typing a name that matches a CRM account links its id. */
function AccountInput({ value, options, disabled, onPick }: {
  value: string; options: AccountOption[]; disabled: boolean; onPick: (name: string, accountId: string) => void;
}) {
  return (
    <Input
      aria-label="Account"
      placeholder="Account (pick from CRM or type)"
      list={LIST_ID}
      disabled={disabled}
      value={value}
      onChange={e => {
        const name = e.target.value;
        const hit = options.find(o => o.name.toLowerCase() === name.trim().toLowerCase());
        onPick(name, hit?.id || '');
      }}
    />
  );
}

export function AccountOptionsList({ options }: { options: AccountOption[] }) {
  return <datalist id={LIST_ID}>{options.map(o => <option key={o.id} value={o.name} />)}</datalist>;
}

function EnumSelect<T extends string>({ value, labels, onChange, disabled, label, className }: {
  value: T; labels: Record<T, string>; onChange: (v: T) => void; disabled: boolean; label: string; className?: string;
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as T)} disabled={disabled}>
      <SelectTrigger className={cn('h-10', className)} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as T[]).map(k => <SelectItem key={k} value={k}>{labels[k]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RowShell({ children, onRemove, readOnly, warn }: { children: React.ReactNode; onRemove: () => void; readOnly: boolean; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3', warn ? 'border-warning/50 bg-warning-soft/30' : 'border-border')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">{children}</div>
        {!readOnly && <Button variant="ghost" size="icon" aria-label="Remove" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

/** At-risk / declining accounts, renewals and rate reviews, growth in existing accounts. */
export function AccountMgmtEditor({ value, onChange, readOnly, options, signals }: {
  value: NwaAccountMgmt;
  onChange: (fn: (a: NwaAccountMgmt) => NwaAccountMgmt) => void;
  readOnly: boolean;
  options: AccountOption[];
  signals: AccountSignal[];
}) {
  const used = new Set(value.atRisk.map(r => r.accountId).filter(Boolean));
  const suggested = signals.filter(s => !used.has(s.id));
  const atRisk = totalRevenueAtRisk(value);
  const setAtRisk = (i: number, patch: Partial<NwaAtRiskRow>) => onChange(a => ({ ...a, atRisk: a.atRisk.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setRenewal = (i: number, patch: Partial<NwaRenewalRow>) => onChange(a => ({ ...a, renewals: a.renewals.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setGrowth = (i: number, patch: Partial<NwaGrowthRow>) => onChange(a => ({ ...a, growth: a.growth.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  return (
    <div className="space-y-6">
      <AccountOptionsList options={options} />

      <div className="space-y-3">
        <SubHeading
          hint="Accounts down on last year, not invoicing or on credit hold. Pick from CRM suggestions or add your own."
          right={(
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', atRisk > 0 ? 'bg-warning-soft text-warning-ink' : 'bg-surface-2 text-muted-foreground')}>
              <AlertTriangle className="h-3.5 w-3.5" />Revenue at risk {money(atRisk)}
            </span>
          )}
        >At-risk and declining accounts</SubHeading>
        {value.atRisk.length === 0 && <EmptyHint>No at-risk accounts listed.</EmptyHint>}
        {value.atRisk.map((r, i) => (
          <RowShell key={r.id} readOnly={readOnly} warn={r.status === 'open'} onRemove={() => onChange(a => ({ ...a, atRisk: a.atRisk.filter((_, j) => j !== i) }))}>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_140px_150px]">
              <AccountInput value={r.account} options={options} disabled={readOnly} onPick={(account, accountId) => setAtRisk(i, { account, accountId })} />
              <Input aria-label="Revenue at risk" type="number" min={0} placeholder="At risk $" disabled={readOnly} value={r.revenueAtRisk || ''} onChange={e => setAtRisk(i, { revenueAtRisk: Number(e.target.value) || 0 })} />
              <EnumSelect<RiskStatus> label="Status" value={r.status} labels={RISK_STATUS_LABEL} disabled={readOnly} onChange={status => setAtRisk(i, { status })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input aria-label="Why it’s at risk" placeholder="Why it’s at risk" disabled={readOnly} value={r.reason} onChange={e => setAtRisk(i, { reason: e.target.value })} />
              <Input aria-label="Action this week" placeholder="Action this week" disabled={readOnly} value={r.action} onChange={e => setAtRisk(i, { action: e.target.value })} />
            </div>
            {r.signal && <p className="text-xs text-muted-foreground">CRM: {r.signal}</p>}
          </RowShell>
        ))}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onChange(a => ({ ...a, atRisk: [...a.atRisk, emptyAtRiskRow()] }))}><Plus className="mr-1.5 h-4 w-4" />Add account</Button>
            {suggested.length > 1 && (
              <Button variant="secondary" size="sm" onClick={() => onChange(a => ({ ...a, atRisk: [...a.atRisk, ...suggested.map(signalToAtRiskRow)] }))}>Add all {suggested.length} flagged</Button>
            )}
            {suggested.slice(0, 6).map(s => (
              <button key={s.id} type="button" onClick={() => onChange(a => ({ ...a, atRisk: [...a.atRisk, signalToAtRiskRow(s)] }))}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/50 px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2"
                title={s.reasons.join(' · ')}>
                <Sparkles className="h-3 w-3 text-accent" />{s.name}
                {s.revenueAtRisk > 0 && <span className="text-muted-foreground">{formatEAV(s.revenueAtRisk)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SubHeading hint="Contracts up for renewal and rate reviews coming up.">Renewals and rate reviews</SubHeading>
        {value.renewals.length === 0 && <EmptyHint>No renewals or rate reviews listed.</EmptyHint>}
        {value.renewals.map((r, i) => (
          <RowShell key={r.id} readOnly={readOnly} onRemove={() => onChange(a => ({ ...a, renewals: a.renewals.filter((_, j) => j !== i) }))}>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_150px_150px]">
              <AccountInput value={r.account} options={options} disabled={readOnly} onPick={(account, accountId) => setRenewal(i, { account, accountId })} />
              <EnumSelect<RenewalType> label="Type" value={r.type} labels={RENEWAL_TYPE_LABEL} disabled={readOnly} onChange={type => setRenewal(i, { type })} />
              <EnumSelect<RenewalStatus> label="Status" value={r.status} labels={RENEWAL_STATUS_LABEL} disabled={readOnly} onChange={status => setRenewal(i, { status })} />
            </div>
            <div className="grid gap-2 md:grid-cols-[150px_140px_minmax(0,1fr)]">
              <Input aria-label="Due date" type="date" disabled={readOnly} value={r.dueDate} onChange={e => setRenewal(i, { dueDate: e.target.value })} />
              <Input aria-label="Annual value" type="number" min={0} placeholder="Value $" disabled={readOnly} value={r.value || ''} onChange={e => setRenewal(i, { value: Number(e.target.value) || 0 })} />
              <Input aria-label="Note" placeholder="Note" disabled={readOnly} value={r.note} onChange={e => setRenewal(i, { note: e.target.value })} />
            </div>
          </RowShell>
        ))}
        {!readOnly && <Button variant="outline" size="sm" onClick={() => onChange(a => ({ ...a, renewals: [...a.renewals, emptyRenewalRow()] }))}><Plus className="mr-1.5 h-4 w-4" />Add renewal or rate review</Button>}
      </div>

      <div className="space-y-3">
        <SubHeading hint="More lanes, services or volume from customers you already have.">Growth in existing accounts</SubHeading>
        {value.growth.length === 0 && <EmptyHint>No growth opportunities listed.</EmptyHint>}
        {value.growth.map((r, i) => (
          <RowShell key={r.id} readOnly={readOnly} onRemove={() => onChange(a => ({ ...a, growth: a.growth.filter((_, j) => j !== i) }))}>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_140px]">
              <AccountInput value={r.account} options={options} disabled={readOnly} onPick={(account, accountId) => setGrowth(i, { account, accountId })} />
              <Input aria-label="Opportunity" placeholder="Opportunity" disabled={readOnly} value={r.opportunity} onChange={e => setGrowth(i, { opportunity: e.target.value })} />
              <Input aria-label="Value" type="number" min={0} placeholder="Value $" disabled={readOnly} value={r.value || ''} onChange={e => setGrowth(i, { value: Number(e.target.value) || 0 })} />
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px]">
              <Input aria-label="Next step" placeholder="Next step" disabled={readOnly} value={r.nextStep} onChange={e => setGrowth(i, { nextStep: e.target.value })} />
              <Input aria-label="Next step date" type="date" disabled={readOnly} value={r.nextStepDate} onChange={e => setGrowth(i, { nextStepDate: e.target.value })} />
            </div>
          </RowShell>
        ))}
        {!readOnly && <Button variant="outline" size="sm" onClick={() => onChange(a => ({ ...a, growth: [...a.growth, emptyGrowthRow()] }))}><Plus className="mr-1.5 h-4 w-4" />Add growth opportunity</Button>}
      </div>
    </div>
  );
}

/** Structured account handovers (who from, who to, status). */
export function HandoverEditor({ value, onChange, readOnly, options, people, defaultFrom }: {
  value: NwaHandover[];
  onChange: (rows: NwaHandover[]) => void;
  readOnly: boolean;
  options: AccountOption[];
  people: { id: string; name: string }[];
  defaultFrom: { id: string; name: string };
}) {
  const set = (i: number, patch: Partial<NwaHandover>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const personSelect = (label: string, id: string, name: string, onPick: (id: string, name: string) => void) => (
    <Select value={id || undefined} disabled={readOnly} onValueChange={v => onPick(v, people.find(p => p.id === v)?.name || '')}>
      <SelectTrigger className="h-10" aria-label={label}><SelectValue placeholder={name || label} /></SelectTrigger>
      <SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
  return (
    <div className="space-y-3">
      <AccountOptionsList options={options} />
      {value.length === 0 && <EmptyHint>No handovers this week.</EmptyHint>}
      {value.map((h, i) => (
        <RowShell key={h.id} readOnly={readOnly} onRemove={() => onChange(value.filter((_, j) => j !== i))}>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_150px]">
            <AccountInput value={h.account} options={options} disabled={readOnly} onPick={(account, accountId) => set(i, { account, accountId })} />
            {personSelect('From', h.fromUserId, h.fromName, (fromUserId, fromName) => set(i, { fromUserId, fromName }))}
            {personSelect('To', h.toUserId, h.toName, (toUserId, toName) => set(i, { toUserId, toName }))}
            <Select value={h.status} disabled={readOnly} onValueChange={v => set(i, { status: v as HandoverStatus })}>
              <SelectTrigger className="h-10" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(HANDOVER_STATUS_LABEL) as HandoverStatus[]).map(k => <SelectItem key={k} value={k}>{HANDOVER_STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px]">
            <Input aria-label="Reason and context" placeholder="Reason and context for the new owner" disabled={readOnly} value={h.reason} onChange={e => set(i, { reason: e.target.value })} />
            <Input aria-label="Handover date" type="date" disabled={readOnly} value={h.date} onChange={e => set(i, { date: e.target.value })} />
          </div>
        </RowShell>
      ))}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => onChange([...value, emptyHandover({ fromUserId: defaultFrom.id, fromName: defaultFrom.name })])}>
          <Plus className="mr-1.5 h-4 w-4" />Add handover
        </Button>
      )}
    </div>
  );
}
