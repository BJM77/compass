'use client';

import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ExternalLink, Copy, Check, Plus, Loader2, Radar, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getSalesforceSearchUrl } from '@/lib/utils';
import { BELTS, VERTICALS, normaliseCompany, type VerticalProspect } from '@/lib/verticals';
import { PAIN_LABEL, MAX_NAME, MAX_NOTES, PAIN_RECHECK_DAYS, canRecheck, type Lookalike, type PainSignals, type PainScore } from '@/lib/intel';
import { WA_SUGGESTED_PROSPECTS } from '@/data/wa-suggested-prospects';
import type { VerticalDismissals } from '@/hooks/use-vertical-dismissals';

const label = <T extends { id: string; label: string }>(list: T[], id: string) => list.find(x => x.id === id)?.label || id;

/** Calls an intel route with the caller's Firebase ID token. */
export function useIntelApi() {
  const { user } = useAuth();
  return async <T,>(path: 'pain' | 'lookalikes', body: Record<string, unknown>): Promise<T> => {
    if (!user) throw new Error('Not signed in');
    const token = await (user as any).getIdToken();
    const res = await fetch(`/api/intel/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
    return j as T;
  };
}

const PAIN_CLASS: Record<PainScore, string> = {
  NONE: 'bg-secondary/60 text-foreground/75 border-border',
  LOW: 'bg-warning-soft text-warning-ink border-warning/25',
  MEDIUM: 'bg-warning-soft text-warning-ink border-warning/25',
  HIGH: 'bg-danger-soft text-destructive border-destructive/25',
};

export function PainBadge({ p, onClick }: { p?: PainSignals | null; onClick?: () => void }) {
  if (!p) return null;
  return (
    <button type="button" onClick={onClick} title="Delivery-pain check" className={cn('inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5', PAIN_CLASS[p.score])}>
      <ShieldAlert className="w-3 h-3" />{PAIN_LABEL[p.score]}{p.carrier ? ` · ${p.carrier}` : ''}
    </button>
  );
}

export type PainTarget = { company: string; prospectId?: string; suggestedId?: string; existing?: PainSignals | null };

export function PainDialog({ target, onClose }: { target: PainTarget | null; onClose: () => void }) {
  const api = useIntelApi();
  const { toast } = useToast();
  const [result, setResult] = useState<PainSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = result || target?.existing || null;

  React.useEffect(() => { setResult(null); setError(null); }, [target]);

  const run = async () => {
    if (!target) return;
    setLoading(true); setError(null);
    try {
      const r = await api<{ result: PainSignals; cached: boolean }>('pain', { prospectId: target.prospectId, suggestedId: target.suggestedId, company: target.company });
      setResult(r.result);
      if (r.cached) toast({ title: 'Recent result reused', description: `Re-check allowed ${PAIN_RECHECK_DAYS} days after the last check.` });
    } catch (e: any) { setError(e.message || 'Failed'); } finally { setLoading(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delivery pain: {target?.company}</DialogTitle>
          <DialogDescription>Public reviews and the company&apos;s own shipping pages, found with Google Search. Only sourced findings are shown.</DialogDescription>
        </DialogHeader>
        {shown ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <PainBadge p={shown} />
              <span className="text-[11px] text-muted-foreground">Checked {new Date(shown.checkedAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth' })} (Perth)</span>
            </div>
            {shown.noSignal ? <p className="text-foreground/75">No public delivery-pain signal found.</p> : (
              <ul className="space-y-2">
                {shown.findings.map((f, i) => (
                  <li key={i} className="rounded border p-2 bg-card">
                    <p className="text-foreground break-words">{f.text}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {f.sources.map(s => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 break-all">
                          {s.title || new URL(s.url).hostname}<ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {shown.opening && <div className="rounded bg-accent/10 border border-accent/15 p-2"><p className="text-[11px] font-bold text-primary">Suggested opener (TGE Parcel)</p><p className="text-foreground">{shown.opening}</p></div>}
          </div>
        ) : !loading && <p className="text-sm text-foreground/75">Not checked yet.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={run} disabled={loading || (!!shown && !canRecheck(shown))} title={shown && !canRecheck(shown) ? `Re-check after ${PAIN_RECHECK_DAYS} days` : undefined}>
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Radar className="w-4 h-4 mr-1" />}
            {shown ? 'Re-check' : 'Check delivery pain'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── WA Lookalike finder ────────────────────────────────────────────────────
export function LookalikeFinder({ prospects, canAdd, uid, myName, dismissals }: { prospects: VerticalProspect[]; canAdd: boolean; uid: string; myName: string; dismissals?: VerticalDismissals }) {
  const api = useIntelApi();
  const db = useFirestore();
  const { toast } = useToast();
  const [mode, setMode] = useState<'prospect' | 'suggested' | 'typed'>('suggested');
  const [seedId, setSeedId] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Lookalike[] | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const inProspects = new Set(prospects.map(p => normaliseCompany(p.company)));
  const ready = mode === 'typed' ? company.trim().length > 0 : !!seedId;

  const find = async () => {
    setLoading(true); setResults(null);
    try {
      const body: Record<string, unknown> = { notes: notes.trim() || undefined };
      if (mode === 'prospect') body.prospectId = seedId; else if (mode === 'suggested') body.suggestedId = seedId; else body.company = company.trim();
      const r = await api<{ results: Lookalike[] }>('lookalikes', body);
      setResults(r.results);
    } catch (e: any) { toast({ title: 'Lookalike search failed', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const add = async (l: Lookalike) => {
    try {
      await addDoc(collection(db, 'verticalProspects'), {
        company: l.company.slice(0, 200), vertical: l.vertical, belt: l.belt, source: 'LOOKALIKE',
        contactName: '', contactTitle: '', freightProfile: ['PARCEL'],
        notes: `WA lookalike: ${l.why}\n${l.sector}${l.size ? ` · ${l.size}` : ''}${l.region ? ` · ${l.region}` : ''}\nWebsite: ${l.website}`.slice(0, 5000),
        ownerUid: null, ownerName: null, claimedAt: null,
        sfStatus: 'UNCHECKED', sfCheckedBy: null, sfCheckedAt: null,
        scores: { frequency: false, freightFit: false, regionalNeed: false, carrierPain: false, growth: false }, score: 0,
        amUid: null, amName: null, amNotes: '', convertedAt: null, convertedBy: null,
        createdBy: uid, createdByName: myName, createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
      });
      setAdded(a => ({ ...a, [l.company]: true }));
      toast({ title: `${l.company} added`, description: 'Check Salesforce next.' });
    } catch (e) { console.error(e); toast({ title: 'Could not add prospect', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" />WA lookalike finder</CardTitle>
        <CardDescription>Pick a great customer or prospect; find 5–10 similar WA companies. Every result has a verified website.</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={mode} onValueChange={v => { setMode(v as any); setSeedId(''); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="suggested">From suggested list</SelectItem>
              <SelectItem value="prospect">From my prospects</SelectItem>
              <SelectItem value="typed">Type a company</SelectItem>
            </SelectContent>
          </Select>
          <div className="sm:col-span-2 min-w-0">
            {mode === 'typed' ? (
              <Input placeholder="Company name" value={company} maxLength={MAX_NAME} onChange={e => setCompany(e.target.value)} className="h-10" />
            ) : (
              <Select value={seedId} onValueChange={setSeedId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Choose seed company" /></SelectTrigger>
                <SelectContent>
                  {(mode === 'prospect' ? prospects.map(p => ({ id: p.id, name: p.company })) : WA_SUGGESTED_PROSPECTS.map(s => ({ id: s.id, name: s.company })))
                    .sort((a, b) => a.name.localeCompare(b.name)).map(x => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Why they&apos;re a great customer (optional)</Label>
          <Textarea rows={2} maxLength={MAX_NOTES} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. ships 200 satchels/day to regional WA, cartons to eastern states" />
        </div>
        <Button onClick={find} disabled={!ready || loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Find lookalikes
        </Button>

        {results && (results.length === 0 ? <p className="text-sm text-muted-foreground">No verified lookalikes found. Try adding notes or a different seed.</p> : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {results.map(l => {
              // Companies marked "Trading with TGE" (shared) are existing customers: flag them, don't offer to add
              const trading = !!dismissals?.isDismissed(l.company);
              const already = l.alreadyInList || inProspects.has(normaliseCompany(l.company)) || added[l.company];
              return (
                <div key={l.company} className={cn('min-w-0 rounded-lg border bg-card p-3 space-y-1.5', (already || trading) && 'opacity-70 bg-secondary/60')}>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <a href={getSalesforceSearchUrl(l.company)} target="_blank" rel="noopener noreferrer" title="Search Salesforce" className="font-bold text-sm text-foreground hover:text-primary hover:underline truncate">{l.company}</a>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                        <button type="button" aria-label={`Copy ${l.company}`} title="Copy name" className="shrink-0 p-1 rounded hover:bg-secondary text-muted-foreground"
                          onClick={async () => { try { await navigator.clipboard.writeText(l.company); setCopied(l.company); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } }}>
                          {copied === l.company ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground break-words">{l.sector}{l.region ? ` · ${l.region}` : ''}{l.size ? ` · ${l.size}` : ''}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase border rounded-full px-1.5 py-0.5">{l.confidence}</span>
                  </div>
                  <p className="text-xs text-foreground/85 break-words">{l.why}</p>
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <Badge variant="outline">{label(VERTICALS, l.vertical)}</Badge>
                    <Badge variant="outline">{label(BELTS, l.belt)}</Badge>
                    <a href={l.website} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 break-all">{l.website.replace(/^https:\/\//, '')}<ExternalLink className="w-3 h-3" /></a>
                    <span className="text-muted-foreground">{l.verifiedBy === 'grounded' ? 'seen in search sources' : 'domain verified'}</span>
                    <div className="flex-1" />
                    {trading ? <Badge variant="outline" className="text-info border-info/25 bg-info-soft"><CheckCircle2 className="w-3 h-3 mr-1" />Trading with TGE</Badge>
                      : already ? <Badge variant="outline" className="text-success-ink border-success/25 bg-success-soft"><CheckCircle2 className="w-3 h-3 mr-1" />Already in list</Badge>
                      : canAdd ? <Button size="sm" className="h-7 text-xs" onClick={() => add(l)}><Plus className="w-3.5 h-3.5 mr-1" />Add to prospects</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
