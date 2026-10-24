"use client";

import React, { useMemo, useState } from 'react';
import { Lightbulb, ExternalLink, Copy, Check, Plus, ChevronDown, ChevronRight, CheckCircle2, Info, Handshake, Undo2, Search, Loader2, Sparkles, Trash2, Globe } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getSalesforceSearchUrl } from '@/lib/utils';
import { VerticalId, VerticalProspect, FreightProfile, normaliseCompany, guessBelt, dismissalKey } from '@/lib/verticals';
import { WA_SUGGESTED_PROSPECTS, SuggestedProspect } from '@/data/wa-suggested-prospects';
import type { VerticalDismissals } from '@/hooks/use-vertical-dismissals';
import { discoveredAtMs } from '@/hooks/use-discovered-leads';
import { useIntelApi } from './verticals-intel';
import { DISCOVER_DAILY_LIMIT, type DiscoveredLead } from '@/lib/intel';

/** A research-list row, or a lead found by "Find new leads" (discoveredId set). */
export type PanelProspect = SuggestedProspect & { discoveredId?: string; discoveredByName?: string; discoveredAt?: number };

/** Leads younger than this show a "New" badge; older finds show "Web find". */
const NEW_BADGE_DAYS = 14;

function fromDiscovered(d: DiscoveredLead): PanelProspect {
  const at = discoveredAtMs(d);
  return {
    id: `disc-${d.id}`, discoveredId: d.id, discoveredByName: d.discoveredByName, discoveredAt: at,
    company: d.company, aka: null, vertical: d.vertical, sector: d.sector || 'Web search find', onlineCategory: null,
    size: d.size || null, whyTheyShip: d.whyTheyShip, region: d.region || '', website: d.website || null,
    evidenceUrl: d.evidenceUrl || null, evidenceNote: null, confidence: String(d.confidence || 'LOW').toLowerCase(),
    lowPriority: false, lowPriorityReason: null,
    sources: [`Found by ${d.discoveredByName || 'search'}${at ? ` · ${new Date(at).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth', day: 'numeric', month: 'short' })}` : ''}`],
  };
}

function confidenceClass(c: string) {
  if (c === 'high') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (c === 'medium') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function buildNotes(s: PanelProspect): string {
  return [
    `Why they ship: ${s.whyTheyShip}`,
    s.size ? `Size: ${s.size}` : '',
    s.aka ? `Group/legal: ${s.aka}` : '',
    s.website ? `Website: ${s.website}` : '',
    s.evidenceUrl ? `Evidence: ${s.evidenceUrl}` : s.evidenceNote ? `Evidence: ${s.evidenceNote}` : '',
    s.discoveredId
      ? `Find new leads web search (${s.sources.join(', ')}), confidence ${s.confidence}`
      : `Research list (${s.sources.join(', ')}), confidence ${s.confidence}${s.lowPriority ? `. LOW PRIORITY: ${s.lowPriorityReason}` : ''}`,
  ].filter(Boolean).join('\n').slice(0, 5000);
}

function freightGuess(s: PanelProspect): FreightProfile[] {
  if (s.discoveredId) return s.vertical === 'ECOMMERCE' ? ['SATCHEL', 'PARCEL', 'CARTON'] : ['PARCEL', 'CARTON'];
  return s.vertical === 'ECOMMERCE' ? ['SATCHEL', 'PARCEL', 'CARTON'] : ['CARTON', 'SKID', 'PALLET'];
}

/**
 * "Suggested WA prospects" from the research handover, per vertical tab.
 * Rows already in verticalProspects (normalised name match) are marked.
 * "Trading with TGE" marks a company that is already a customer: it is hidden for everyone
 * (shared verticalDismissals) and can be restored from "Show hidden".
 */
export function SuggestedProspectsPanel({
  vertical, prospects, canAdd, uid, myName, onCheckPain, dismissals, discovered = [], canDiscover = false,
}: {
  vertical: VerticalId; prospects: VerticalProspect[]; canAdd: boolean; uid: string; myName: string;
  onCheckPain?: (s: PanelProspect) => void; dismissals: VerticalDismissals;
  /** Team-wide "Find new leads" results (all verticals; filtered here). */
  discovered?: DiscoveredLead[];
  /** Leaders/admins: can run "Find new leads" and remove bad finds. The server enforces this too. */
  canDiscover?: boolean;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const api = useIntelApi();
  const [discovering, setDiscovering] = useState(false);
  const [open, setOpen] = useState(true);
  const [showLow, setShowLow] = useState(false);
  const [hideAdded, setHideAdded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const existing = useMemo(() => new Set(prospects.map(p => normaliseCompany(p.company))), [prospects]);
  const research: PanelProspect[] = WA_SUGGESTED_PROSPECTS.filter(s => s.vertical === vertical);
  const found: PanelProspect[] = useMemo(() => discovered.filter(d => d.vertical === vertical).map(fromDiscovered), [discovered, vertical]);
  const rows = [...found, ...research];
  const isAdded = (s: PanelProspect) => existing.has(normaliseCompany(s.company));
  const hiddenRows = rows.filter(s => dismissals.isDismissed(s.company));
  const visible = rows.filter(s => !dismissals.isDismissed(s.company)).filter(s => !(hideAdded && isAdded(s)));
  const newFinds = visible.filter(s => s.discoveredId);
  const main = visible.filter(s => !s.discoveredId && !s.lowPriority);
  const low = visible.filter(s => !s.discoveredId && s.lowPriority);
  const addedCount = rows.filter(s => isAdded(s) && !dismissals.isDismissed(s.company)).length;

  if (rows.length === 0 && !canDiscover) return null;

  const discover = async () => {
    setDiscovering(true);
    try {
      const r = await api<{ added: number; companies: string[]; remaining: number }>('discover', { vertical });
      setOpen(true);
      toast(r.added
        ? { title: `${r.added} new lead${r.added === 1 ? '' : 's'} found`, description: `Added to the top of this list with a "New" badge. ${r.remaining} search${r.remaining === 1 ? '' : 'es'} left today.` }
        : { title: 'No new leads found', description: `Everything the search found is already in your lists. Try again another day. ${r.remaining} search${r.remaining === 1 ? '' : 'es'} left today.` });
    } catch (e: any) {
      toast({ title: 'Could not search for new leads', description: e?.message || 'Please try again later.', variant: 'destructive' });
    } finally {
      setDiscovering(false);
    }
  };

  const removeFind = async (s: PanelProspect) => {
    if (!s.discoveredId) return;
    setBusy(b => ({ ...b, [`r-${s.id}`]: true }));
    try { await deleteDoc(doc(db, 'discoveredLeads', s.discoveredId)); toast({ title: `${s.company} removed from new leads` }); }
    catch (e) { console.error(e); toast({ title: 'Could not remove', variant: 'destructive' }); }
    finally { setBusy(b => ({ ...b, [`r-${s.id}`]: false })); }
  };

  const add = async (s: PanelProspect) => {
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

  const markTrading = async (s: PanelProspect) => {
    setBusy(b => ({ ...b, [`t-${s.id}`]: true }));
    try {
      await dismissals.markTrading(s.company, s.discoveredId ? undefined : s.id);
      toast({ title: `${s.company} marked as trading with TGE`, description: 'Hidden from suggestions for everyone. Use "Show hidden" to restore.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not mark as trading with TGE', variant: 'destructive' });
    } finally {
      setBusy(b => ({ ...b, [`t-${s.id}`]: false }));
    }
  };

  const restore = async (s: PanelProspect) => {
    try { await dismissals.restore(s.company); toast({ title: `${s.company} restored to suggestions` }); }
    catch (e) { console.error(e); toast({ title: 'Could not restore', variant: 'destructive' }); }
  };

  const copy = async (s: PanelProspect) => {
    try { await navigator.clipboard.writeText(s.company); setCopied(s.id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const Row = ({ s }: { s: PanelProspect }) => {
    const added = isAdded(s);
    const isNew = !!s.discoveredId && (!s.discoveredAt || Date.now() - s.discoveredAt < NEW_BADGE_DAYS * 864e5);
    return (
      <div className={cn('min-w-0 rounded-lg border bg-white p-3 space-y-1.5', s.discoveredId && 'border-indigo-200', added && 'opacity-70 bg-slate-50')}>
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
          {s.discoveredId && (
            <span className={cn('shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase border rounded-full px-1.5 py-0.5',
              isNew ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200')}>
              <Sparkles className="w-3 h-3" />{isNew ? 'New' : 'Web find'}
            </span>
          )}
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
          {s.discoveredId && s.website && (
            <a href={s.website} target="_blank" rel="noopener noreferrer nofollow" className="text-[11px] text-indigo-700 hover:underline inline-flex items-center gap-0.5">
              <Globe className="w-3 h-3" />Website
            </a>
          )}
          <span className="text-[10px] text-slate-400 break-words">{s.sources.join(' · ')}</span>
          <div className="flex-1" />
          {onCheckPain && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCheckPain(s)}>Check delivery pain</Button>}
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy[`t-${s.id}`]} onClick={() => markTrading(s)}
            title="Already a customer: remove from suggestions for everyone">
            <Handshake className="w-3.5 h-3.5 mr-1" />Trading with TGE
          </Button>
          {s.discoveredId && canDiscover && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" disabled={busy[`r-${s.id}`]} onClick={() => removeFind(s)}
              title="Not a good lead: remove it for everyone" aria-label={`Remove ${s.company}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {added ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50"><CheckCircle2 className="w-3 h-3 mr-1" />In prospects</Badge>
          ) : canAdd ? (
            <Button size="sm" className="h-7 text-xs" disabled={busy[s.id]} onClick={() => add(s)}><Plus className="w-3.5 h-3.5 mr-1" />Add to prospects</Button>
          ) : null}
        </div>
      </div>
    );
  };

  const grouped = (list: PanelProspect[]) => {
    if (vertical !== 'OTHER') return <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">{list.map(s => <Row key={s.id} s={s} />)}</div>;
    const bySector = list.reduce<Record<string, PanelProspect[]>>((acc, s) => { (acc[s.sector] = acc[s.sector] || []).push(s); return acc; }, {});
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
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left flex-1 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
            <CardTitle className="text-base flex items-center gap-2 min-w-0"><Lightbulb className="w-4 h-4 text-amber-500 shrink-0" /><span className="truncate">Suggested WA prospects ({rows.length})</span></CardTitle>
          </button>
          {canDiscover && (
            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={discovering} onClick={discover}
              title={`Search the web for WA businesses in this vertical that aren't in any list yet (${DISCOVER_DAILY_LIMIT} searches a day)`}>
              {discovering ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
              {discovering ? 'Searching… (about 30s)' : 'Find new leads'}
            </Button>
          )}
        </div>
        {open && (
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Researched WA-HQ businesses{found.length ? ` plus ${found.length} found by web search` : ''}. {addedCount} already in prospects.</span>
            <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={hideAdded} onChange={e => setHideAdded(e.target.checked)} /> Hide added
            </label>
            {hiddenRows.length > 0 && (
              <button type="button" onClick={() => setShowHidden(v => !v)} className="text-xs font-bold text-indigo-700 hover:underline">
                {showHidden ? 'Hide' : 'Show'} hidden ({hiddenRows.length} trading with TGE)
              </button>
            )}
          </CardDescription>
        )}
      </CardHeader>
      {open && (
        <CardContent className="px-3 pb-3 space-y-3">
          {discovering && (
            <p className="text-xs text-indigo-700 flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />Searching the web for new WA leads. This takes about 20 to 30 seconds.
            </p>
          )}
          {newFinds.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Found by web search ({newFinds.length})</p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">{newFinds.map(s => <Row key={s.id} s={s} />)}</div>
            </div>
          )}
          {main.length ? (
            <div className={cn(newFinds.length > 0 && 'border-t pt-2 space-y-1.5')}>
              {newFinds.length > 0 && <p className="text-xs font-black uppercase tracking-wider text-slate-500">Research list ({main.length})</p>}
              {grouped(main)}
            </div>
          ) : !newFinds.length && (
            <p className="text-sm text-slate-500">
              No suggestions to show: all are in prospects or marked as trading with TGE.{canDiscover ? ' Use Find new leads to search for more.' : ''}
            </p>
          )}
          {low.length > 0 && (
            <div className="border-t pt-2">
              <button type="button" onClick={() => setShowLow(v => !v)} className="text-xs font-bold text-slate-600 flex items-center gap-1">
                {showLow ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Low priority / mostly bulk ({low.length})
              </button>
              {showLow && <div className="mt-2">{grouped(low)}</div>}
            </div>
          )}
          {showHidden && hiddenRows.length > 0 && (
            <div className="border-t pt-2 space-y-1.5">
              <p className="text-xs font-bold text-slate-600">Hidden: already trading with TGE</p>
              {hiddenRows.map(s => (
                <div key={s.id} className="flex items-center gap-2 min-w-0 rounded-md border bg-slate-50 px-2 py-1.5">
                  <span className="text-sm font-semibold truncate min-w-0 flex-1">{s.company}</span>
                  <span className="hidden sm:block text-[11px] text-slate-500 truncate max-w-[40%]">
                    {dismissals.byKey.get(dismissalKey(s.company))?.dismissedByName ? `by ${dismissals.byKey.get(dismissalKey(s.company))?.dismissedByName}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => restore(s)}><Undo2 className="w-3.5 h-3.5 mr-1" />Restore</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
