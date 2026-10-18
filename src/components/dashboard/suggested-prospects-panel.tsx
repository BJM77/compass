"use client";

import React, { useMemo, useState } from 'react';
import { Lightbulb, ExternalLink, Copy, Check, Plus, ChevronDown, ChevronRight, CheckCircle2, Info } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getSalesforceSearchUrl } from '@/lib/utils';
import { VerticalId, VerticalProspect, FreightProfile, normaliseCompany, guessBelt } from '@/lib/verticals';
import { WA_SUGGESTED_PROSPECTS, SuggestedProspect } from '@/data/wa-suggested-prospects';

function confidenceClass(c: string) {
  if (c === 'high') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (c === 'medium') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function buildNotes(s: SuggestedProspect): string {
  return [
    `Why they ship: ${s.whyTheyShip}`,
    s.size ? `Size: ${s.size}` : '',
    s.aka ? `Group/legal: ${s.aka}` : '',
    s.website ? `Website: ${s.website}` : '',
    s.evidenceUrl ? `Evidence: ${s.evidenceUrl}` : s.evidenceNote ? `Evidence: ${s.evidenceNote}` : '',
    `Research list (${s.sources.join(', ')}), confidence ${s.confidence}${s.lowPriority ? `. LOW PRIORITY: ${s.lowPriorityReason}` : ''}`,
  ].filter(Boolean).join('\n').slice(0, 5000);
}

function freightGuess(s: SuggestedProspect): FreightProfile[] {
  return s.vertical === 'ECOMMERCE' ? ['SATCHEL', 'PARCEL', 'CARTON'] : ['CARTON', 'SKID', 'PALLET'];
}

/**
 * "Suggested WA prospects" from the research handover, per vertical tab.
 * Rows already in verticalProspects (normalised name match) are marked.
 */
export function SuggestedProspectsPanel({
  vertical, prospects, canAdd, uid, myName, onCheckPain,
}: { vertical: VerticalId; prospects: VerticalProspect[]; canAdd: boolean; uid: string; myName: string; onCheckPain?: (s: SuggestedProspect) => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [showLow, setShowLow] = useState(false);
  const [hideAdded, setHideAdded] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const existing = useMemo(() => new Set(prospects.map(p => normaliseCompany(p.company))), [prospects]);
  const rows = WA_SUGGESTED_PROSPECTS.filter(s => s.vertical === vertical);
  const isAdded = (s: SuggestedProspect) => existing.has(normaliseCompany(s.company));
  const visible = rows.filter(s => !(hideAdded && isAdded(s)));
  const main = visible.filter(s => !s.lowPriority);
  const low = visible.filter(s => s.lowPriority);
  const addedCount = rows.filter(isAdded).length;

  if (rows.length === 0) return null;

  const add = async (s: SuggestedProspect) => {
    if (isAdded(s)) return;
    setBusy(b => ({ ...b, [s.id]: true }));
    try {
      await addDoc(collection(db, 'verticalProspects'), {
        company: s.company.slice(0, 200), vertical: s.vertical, belt: guessBelt(s.region), source: 'RESEARCH',
        contactName: '', contactTitle: '', freightProfile: freightGuess(s), notes: buildNotes(s),
        ownerUid: null, ownerName: null, claimedAt: null,
        sfStatus: 'UNCHECKED', sfCheckedBy: null, sfCheckedAt: null,
        scores: { frequency: false, freightFit: false, regionalNeed: false, carrierPain: false, growth: false }, score: 0,
        amUid: null, amName: null, amNotes: '', convertedAt: null, convertedBy: null,
        createdBy: uid, createdByName: myName, createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
      });
      toast({ title: `${s.company} added`, description: 'Check Salesforce next, then score and claim.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not add prospect', variant: 'destructive' });
    } finally {
      setBusy(b => ({ ...b, [s.id]: false }));
    }
  };

  const copy = async (s: SuggestedProspect) => {
    try { await navigator.clipboard.writeText(s.company); setCopied(s.id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const Row = ({ s }: { s: SuggestedProspect }) => {
    const added = isAdded(s);
    return (
      <div className={cn('min-w-0 rounded-lg border bg-white p-3 space-y-1.5', added && 'opacity-70 bg-slate-50')}>
        <div className="flex items-start gap-1.5 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <a href={getSalesforceSearchUrl(s.company)} target="_blank" rel="noopener noreferrer" title="Search Salesforce"
                className="font-bold text-sm text-slate-900 hover:text-indigo-700 hover:underline truncate">{s.company}</a>
              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
              <button type="button" onClick={() => copy(s)} aria-label={`Copy ${s.company}`} title="Copy name"
                className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                {copied === s.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 break-words">{s.sector}{s.region ? ` · ${s.region}` : ''}</p>
          </div>
          <span className={cn('shrink-0 text-[10px] font-bold uppercase border rounded-full px-1.5 py-0.5', confidenceClass(s.confidence))}>{s.confidence}</span>
        </div>
        <p className="text-xs text-slate-700 break-words">{s.whyTheyShip}</p>
        {s.lowPriority && s.lowPriorityReason && <p className="text-[11px] text-amber-800 flex gap-1"><Info className="w-3 h-3 shrink-0 mt-px" />{s.lowPriorityReason}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {s.evidenceUrl ? (
            <a href={s.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-700 hover:underline inline-flex items-center gap-0.5">
              Evidence <ExternalLink className="w-3 h-3" />
            </a>
          ) : s.evidenceNote ? <span className="text-[11px] text-slate-500 break-words">Evidence: {s.evidenceNote}</span> : null}
          <span className="text-[10px] text-slate-400 break-words">{s.sources.join(' · ')}</span>
          <div className="flex-1" />
          {onCheckPain && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCheckPain(s)}>Check delivery pain</Button>}
          {added ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="w-3 h-3 mr-1" />In prospects</Badge>
          ) : canAdd ? (
            <Button size="sm" className="h-7 text-xs" disabled={busy[s.id]} onClick={() => add(s)}><Plus className="w-3.5 h-3.5 mr-1" />Add to prospects</Button>
          ) : null}
        </div>
      </div>
    );
  };

  const grouped = (list: SuggestedProspect[]) => {
    if (vertical !== 'OTHER') return <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">{list.map(s => <Row key={s.id} s={s} />)}</div>;
    const bySector = list.reduce<Record<string, SuggestedProspect[]>>((acc, s) => { (acc[s.sector] = acc[s.sector] || []).push(s); return acc; }, {});
    return (
      <div className="space-y-3">
        {Object.entries(bySector).sort(([a], [b]) => a.localeCompare(b)).map(([sector, items]) => (
          <div key={sector} className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">{sector} ({items.length})</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">{items.map(s => <Row key={s.id} s={s} />)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left w-full min-w-0">
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <CardTitle className="text-base flex items-center gap-2 min-w-0"><Lightbulb className="w-4 h-4 text-amber-500 shrink-0" /><span className="truncate">Suggested WA prospects ({rows.length})</span></CardTitle>
        </button>
        {open && (
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Researched WA-HQ businesses. {addedCount} already in prospects.</span>
            <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={hideAdded} onChange={e => setHideAdded(e.target.checked)} /> Hide added
            </label>
          </CardDescription>
        )}
      </CardHeader>
      {open && (
        <CardContent className="px-3 pb-3 space-y-3">
          {main.length ? grouped(main) : <p className="text-sm text-slate-500">All suggestions are already in prospects.</p>}
          {low.length > 0 && (
            <div className="border-t pt-2">
              <button type="button" onClick={() => setShowLow(v => !v)} className="text-xs font-bold text-slate-600 flex items-center gap-1">
                {showLow ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Low priority / mostly bulk ({low.length})
              </button>
              {showLow && <div className="mt-2">{grouped(low)}</div>}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
