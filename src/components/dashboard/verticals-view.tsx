"use client";

import React, { useMemo, useState } from 'react';
import {
  Factory, ExternalLink, MapPin, Search, X, Plus, Copy, Check, Trophy, Flag, Lock, UserPlus,
  FileSearch, Trash2, Pencil, Briefcase, AlertTriangle, BookOpen, ClipboardCopy, Info,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useNavigation } from '@/contexts/navigation-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, getSalesforceSearchUrl } from '@/lib/utils';
import { SuggestedProspectsPanel } from './suggested-prospects-panel';
import {
  VERTICALS, VerticalId, BELTS, BeltId, METRO_BELTS, FREIGHT_PROFILES, FreightProfile, SF_STATUSES, SfStatus,
  SCORE_CRITERIA, ScoreKey, SOURCE_TAGS, LeadSourceTag, LEAD_SOURCES, MAPS_KEYWORDS, PLAYBOOKS, PARCEL_SCOPE,
  VerticalProspect, isClaimExpired, canBdmClaim, scoreOf, perthWeekStart, tsMs, mapsSearchUrl, templatesFor,
} from '@/lib/verticals';

const AM_ROLES = ['ACCOUNT_MANAGER', 'AM'];
const sfMeta = (s: SfStatus) => SF_STATUSES.find(x => x.id === s) || SF_STATUSES[0];
const label = <T extends { id: string; label: string }>(list: T[], id: string) => list.find(x => x.id === id)?.label || id;

function useCopy() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, key: string, what = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
      toast({ title: what });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
  return { copied, copy };
}

type UserLite = { id: string; name: string; role: string };

// ─── Prospect form ──────────────────────────────────────────────────────────
type FormState = {
  company: string; vertical: VerticalId; belt: BeltId; source: LeadSourceTag;
  contactName: string; contactTitle: string; freightProfile: FreightProfile[]; notes: string;
};

function ProspectDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: FormState; onSave: (f: FormState) => Promise<void>;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (open) setF(initial); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.company ? 'Edit prospect' : 'Add prospect'}</DialogTitle>
          <DialogDescription>Parcel prospects: satchels through to 2–3 pallets.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Company *</Label><Input value={f.company} maxLength={200} onChange={e => set('company', e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1"><Label>Vertical</Label>
              <Select value={f.vertical} onValueChange={v => set('vertical', v as VerticalId)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VERTICALS.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Belt / region</Label>
              <Select value={f.belt} onValueChange={v => set('belt', v as BeltId)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BELTS.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Source</Label>
              <Select value={f.source} onValueChange={v => set('source', v as LeadSourceTag)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_TAGS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Contact name</Label><Input value={f.contactName} maxLength={200} onChange={e => set('contactName', e.target.value)} /></div>
            <div className="space-y-1"><Label>Contact title</Label><Input value={f.contactTitle} maxLength={200} onChange={e => set('contactTitle', e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Shipping profile</Label>
            <div className="flex flex-wrap gap-1.5">
              {FREIGHT_PROFILES.map(fp => {
                const on = f.freightProfile.includes(fp.id);
                return (
                  <button key={fp.id} type="button" onClick={() => set('freightProfile', on ? f.freightProfile.filter(x => x !== fp.id) : [...f.freightProfile, fp.id])}
                    className={cn('px-2.5 py-1 rounded-full border text-xs font-semibold', on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200')}>
                    {fp.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={f.notes} maxLength={5000} rows={3} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!f.company.trim() || saving} onClick={async () => { setSaving(true); try { await onSave({ ...f, company: f.company.trim() }); onOpenChange(false); } finally { setSaving(false); } }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────
export function VerticalsView() {
  const { user, profile, isLeader } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { navigateTo } = useNavigation();
  const { copied, copy } = useCopy();

  const role = String(profile?.role || '');
  const isAdmin = isLeader;
  const isBdm = role === 'BDM';
  const isAmUser = AM_ROLES.includes(role);
  const canSource = isBdm || isAdmin;
  const uid = user?.uid || '';
  const myName = profile?.name || user?.email || 'Me';

  const prospectsRef = useMemoFirebase(() => (db && user ? collection(db, 'verticalProspects') : null), [db, user]);
  const { data: prospectsRaw } = useCollection<VerticalProspect>(prospectsRef);
  const usersRef = useMemoFirebase(() => (db && user ? collection(db, 'users') : null), [db, user]);
  const { data: usersRaw } = useCollection<any>(usersRef);

  const users: UserLite[] = useMemo(() => (usersRaw || []).map((u: any) => ({ id: u.id, name: u.name || u.displayName || u.email || 'Unknown', role: String(u.role || '') })), [usersRaw]);
  const userName = (id?: string | null) => (id ? users.find(u => u.id === id)?.name || '—' : '—');
  const amUsers = users.filter(u => AM_ROLES.includes(u.role));
  const prospects = prospectsRaw || [];

  const [tab, setTab] = useState<VerticalId>('MINING');
  const [vFilter, setVFilter] = useState<VerticalId | 'ALL'>('MINING');
  const [beltFilter, setBeltFilter] = useState<BeltId | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SfStatus | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; p: VerticalProspect } | null>(null);
  const [amNotesTarget, setAmNotesTarget] = useState<VerticalProspect | null>(null);
  const [amNotesText, setAmNotesText] = useState('');
  const now = Date.now();

  const onTab = (v: string) => { setTab(v as VerticalId); setVFilter(v as VerticalId); };

  // Permissions (mirror firestore.rules)
  const isOwner = (p: VerticalProspect) => !!p.ownerUid && p.ownerUid === uid && !isClaimExpired(p, now);
  const canEdit = (p: VerticalProspect) => isAdmin || (isBdm && (isOwner(p) || !p.ownerUid || isClaimExpired(p, now)));
  const canClaim = (p: VerticalProspect) => isBdm && canBdmClaim(p, now) && p.ownerUid !== uid;
  const canDelete = (p: VerticalProspect) => isAdmin || (isBdm && p.ownerUid === uid);
  const canAmNote = (p: VerticalProspect) => isAdmin || (isAmUser && p.amUid === uid);

  const update = async (p: VerticalProspect, patch: Record<string, unknown>, msg?: string) => {
    try {
      await updateDoc(doc(db, 'verticalProspects', p.id), { ...patch, lastActivityAt: serverTimestamp() });
      if (msg) toast({ title: msg });
    } catch (e) {
      console.error(e);
      toast({ title: 'Not allowed or failed to save', variant: 'destructive' });
    }
  };

  const save = async (f: FormState) => {
    if (dialog?.mode === 'edit') {
      await update(dialog.p, { ...f }, 'Prospect updated');
      return;
    }
    try {
      await addDoc(collection(db, 'verticalProspects'), {
        ...f,
        ownerUid: null, ownerName: null, claimedAt: null,
        sfStatus: 'UNCHECKED', sfCheckedBy: null, sfCheckedAt: null,
        scores: { frequency: false, freightFit: false, regionalNeed: false, carrierPain: false, growth: false },
        score: 0,
        amUid: null, amName: null, amNotes: '',
        convertedAt: null, convertedBy: null,
        createdBy: uid, createdByName: myName, createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
      });
      toast({ title: 'Prospect added', description: 'Check Salesforce next, then score and claim.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not add prospect', variant: 'destructive' });
    }
  };

  const setSf = (p: VerticalProspect, s: SfStatus) => {
    const patch: Record<string, unknown> = { sfStatus: s, sfCheckedBy: uid, sfCheckedAt: serverTimestamp() };
    if (s === 'EXISTING_AM') { patch.ownerUid = null; patch.ownerName = null; patch.claimedAt = null; }
    if (s === 'UNCHECKED') { patch.scores = { frequency: false, freightFit: false, regionalNeed: false, carrierPain: false, growth: false }; patch.score = 0; patch.sfCheckedBy = null; patch.sfCheckedAt = null; }
    update(p, patch, s === 'EXISTING_AM' ? 'Routed to AM: locked from BDM claim' : 'SF status updated');
  };

  const toggleScore = (p: VerticalProspect, k: ScoreKey) => {
    const scores = { ...(p.scores || {}), [k]: !p.scores?.[k] } as Record<ScoreKey, boolean>;
    update(p, { scores, score: scoreOf(scores) });
  };

  const convert = async (p: VerticalProspect) => {
    await update(p, { convertedAt: serverTimestamp(), convertedBy: uid });
    navigateTo('FACT_FINDING', {
      doc: 'new',
      prefill: {
        companyName: p.company,
        keyDecisionMaker: [p.contactName, p.contactTitle].filter(Boolean).join(' – '),
        freightSize: (p.freightProfile || []).map(x => label(FREIGHT_PROFILES, x)).join(', '),
        locations: label(BELTS, p.belt),
        businessDetails: `${label(VERTICALS, p.vertical)} prospect (source: ${label(SOURCE_TAGS, p.source)}).${p.notes ? `\n${p.notes}` : ''}`,
      },
    });
  };

  // Filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects
      .filter(p => vFilter === 'ALL' || p.vertical === vFilter)
      .filter(p => beltFilter === 'ALL' || p.belt === beltFilter)
      .filter(p => statusFilter === 'ALL' || p.sfStatus === statusFilter)
      .filter(p => {
        if (ownerFilter === 'ALL') return true;
        if (ownerFilter === 'MINE') return p.ownerUid === uid;
        if (ownerFilter === 'UNCLAIMED') return !p.ownerUid || isClaimExpired(p, now);
        return p.ownerUid === ownerFilter;
      })
      .filter(p => !q || [p.company, p.contactName, p.contactTitle, p.notes].some(x => (x || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || tsMs(b.lastActivityAt) - tsMs(a.lastActivityAt));
  }, [prospects, vFilter, beltFilter, statusFilter, ownerFilter, search, uid, now]);

  const owners = useMemo(() => {
    const ids = Array.from(new Set(prospects.map(p => p.ownerUid).filter(Boolean))) as string[];
    return ids.map(id => ({ id, name: prospects.find(p => p.ownerUid === id)?.ownerName || userName(id) }));
  }, [prospects, users]); // eslint-disable-line react-hooks/exhaustive-deps

  const amLeads = prospects.filter(p => p.sfStatus === 'EXISTING_AM' && p.amUid === uid);

  // Weekly leaderboard (leading indicators, Perth week from Monday)
  const leaderboard = useMemo(() => {
    const start = perthWeekStart(now);
    const rows: Record<string, { sourced: number; checked: number; ff: number; claimed: number }> = {};
    const bump = (id: string | null | undefined, k: keyof (typeof rows)[string], at: any) => {
      if (!id || tsMs(at) < start) return;
      rows[id] = rows[id] || { sourced: 0, checked: 0, ff: 0, claimed: 0 };
      rows[id][k]++;
    };
    prospects.forEach(p => {
      bump(p.createdBy, 'sourced', p.createdAt);
      bump(p.sfCheckedBy, 'checked', p.sfCheckedAt);
      bump(p.convertedBy, 'ff', p.convertedAt);
      bump(p.ownerUid, 'claimed', p.claimedAt);
    });
    return Object.entries(rows)
      .map(([id, r]) => ({ id, name: userName(id), ...r, total: r.sourced + r.checked + r.ff + r.claimed }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [prospects, users, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyForm: FormState = { company: '', vertical: tab, belt: 'NORTH', source: 'GOOGLE_MAPS', contactName: '', contactTitle: '', freightProfile: [], notes: '' };

  // ─── Prospect card ────────────────────────────────────────────────────────
  const ProspectCard = ({ p }: { p: VerticalProspect }) => {
    const sf = sfMeta(p.sfStatus);
    const expired = isClaimExpired(p, now);
    const editable = canEdit(p);
    const unchecked = p.sfStatus === 'UNCHECKED';
    return (
      <Card className="min-w-0 border shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-2.5 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <a href={getSalesforceSearchUrl(p.company)} target="_blank" rel="noopener noreferrer" title="Search Salesforce"
                  className="font-black text-slate-900 hover:text-indigo-700 hover:underline truncate">
                  {p.company}
                </a>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                <button type="button" onClick={() => copy(p.company, `n-${p.id}`, 'Company name copied')} title="Copy name" aria-label="Copy company name"
                  className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                  {copied === `n-${p.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              {(p.contactName || p.contactTitle) && (
                <p className="text-xs text-slate-600 truncate">{[p.contactName, p.contactTitle].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black px-2 py-0.5" title="Lead score">{p.score || 0}/5</span>
          </div>

          <div className="flex flex-wrap gap-1 text-[10px]">
            <Badge variant="outline">{label(VERTICALS, p.vertical)}</Badge>
            <Badge variant="outline"><MapPin className="w-3 h-3 mr-0.5" />{label(BELTS, p.belt)}</Badge>
            <Badge variant="outline">{label(SOURCE_TAGS, p.source)}</Badge>
            {(p.freightProfile || []).map(fp => <Badge key={fp} variant="secondary">{label(FREIGHT_PROFILES, fp)}</Badge>)}
            {p.convertedAt && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Fact Finding</Badge>}
          </div>

          {/* SF status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-[11px] font-bold border rounded-full px-2 py-0.5', sf.className)}>{sf.label}</span>
            {editable && (
              <Select value={p.sfStatus} onValueChange={v => setSf(p, v as SfStatus)}>
                <SelectTrigger className="h-7 w-auto min-w-0 text-xs"><SelectValue placeholder="Set SF status" /></SelectTrigger>
                <SelectContent>{SF_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          {/* Owner / claim */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {p.sfStatus === 'EXISTING_AM' ? (
              <span className="flex items-center gap-1 text-blue-800"><Lock className="w-3.5 h-3.5" /> AM opportunity: {p.amUid ? userName(p.amUid) : 'no AM assigned'}</span>
            ) : p.ownerUid && !expired ? (
              <span className="text-slate-600">Claimed by <strong>{p.ownerName || userName(p.ownerUid)}</strong></span>
            ) : p.ownerUid && expired ? (
              <span className="text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Claim lapsed ({p.ownerName}): 30+ days no activity</span>
            ) : (
              <span className="text-slate-500">Unclaimed</span>
            )}
            {canClaim(p) && (
              <Button size="sm" className="h-7 text-xs" onClick={() => update(p, { ownerUid: uid, ownerName: myName, claimedAt: serverTimestamp() }, 'Claimed')}>
                <Flag className="w-3.5 h-3.5 mr-1" /> Claim
              </Button>
            )}
            {isBdm && unchecked && !p.ownerUid && <span className="text-[11px] text-slate-400">Set SF status to claim/score</span>}
            {(isOwner(p) || (isAdmin && p.ownerUid)) && p.sfStatus !== 'EXISTING_AM' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => update(p, { ownerUid: null, ownerName: null, claimedAt: null }, 'Released')}>Release</Button>
            )}
            {isAdmin && p.sfStatus !== 'EXISTING_AM' && (
              <Select value="" onValueChange={v => { const u = users.find(x => x.id === v); update(p, { ownerUid: v, ownerName: u?.name || null, claimedAt: serverTimestamp() }, 'Reassigned'); }}>
                <SelectTrigger className="h-7 w-auto text-xs"><SelectValue placeholder="Reassign…" /></SelectTrigger>
                <SelectContent>{users.filter(u => u.role === 'BDM').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          {/* AM assignment */}
          {p.sfStatus === 'EXISTING_AM' && editable && (
            <div className="flex items-center gap-2 text-xs">
              <UserPlus className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <Select value={p.amUid || ''} onValueChange={v => update(p, { amUid: v, amName: users.find(u => u.id === v)?.name || null }, 'AM assigned')}>
                <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs"><SelectValue placeholder="Assign AM…" /></SelectTrigger>
                <SelectContent>{amUsers.length ? amUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>) : <SelectItem value="__none" disabled>No AM users</SelectItem>}</SelectContent>
              </Select>
            </div>
          )}

          {/* Score */}
          <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1', unchecked && 'opacity-50')} title={unchecked ? 'Set SF status before scoring' : undefined}>
            {SCORE_CRITERIA.map(c => (
              <label key={c.id} className="flex items-center gap-1.5 text-xs min-w-0" title={c.hint}>
                <input type="checkbox" checked={!!p.scores?.[c.id]} disabled={!editable || unchecked || p.sfStatus === 'EXISTING_AM'} onChange={() => toggleScore(p, c.id)} />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>

          {p.notes && <p className="text-xs text-slate-600 whitespace-pre-wrap break-words line-clamp-3">{p.notes}</p>}
          {p.amNotes && <p className="text-xs text-blue-900 bg-blue-50 rounded p-2 whitespace-pre-wrap break-words"><strong>AM notes:</strong> {p.amNotes}</p>}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t">
            {editable && p.sfStatus !== 'EXISTING_AM' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => convert(p)}>
                <FileSearch className="w-3.5 h-3.5 mr-1" /> Convert to Fact Finding
              </Button>
            )}
            {canAmNote(p) && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAmNotesTarget(p); setAmNotesText(p.amNotes || ''); }}>
                <Briefcase className="w-3.5 h-3.5 mr-1" /> Growth notes
              </Button>
            )}
            {editable && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDialog({ mode: 'edit', p })}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button>
            )}
            {canDelete(p) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={async () => {
                if (!confirm(`Delete ${p.company}?`)) return;
                try { await deleteDoc(doc(db, 'verticalProspects', p.id)); } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
              }}><Trash2 className="w-3.5 h-3.5" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const pb = PLAYBOOKS[tab];

  return (
    <div className="max-w-7xl mx-auto space-y-6 min-w-0">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-start justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="w-7 h-7 text-indigo-600 shrink-0" /> Verticals
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            WA Parcel prospecting by vertical: satchels, parcels, cartons, skids, single pallets and small multi-pallet customers. Source leads, check Salesforce, score, claim, and convert to Fact Finding.
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="w-full lg:w-[460px] shrink-0">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> This week (from Monday, Perth time)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3 overflow-x-auto">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 px-2">No activity yet this week.</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="text-slate-500">
                  <th className="text-left font-semibold px-2 py-1">Rep</th>
                  <th className="px-1" title="Prospects sourced">Src</th>
                  <th className="px-1" title="Salesforce checked">SF</th>
                  <th className="px-1" title="Fact Findings created">FF</th>
                  <th className="px-1" title="Claimed">Clm</th>
                </tr></thead>
                <tbody>{leaderboard.map((r, i) => (
                  <tr key={r.id} className={cn(r.id === uid && 'bg-indigo-50')}>
                    <td className="px-2 py-1 font-semibold truncate max-w-[140px]">{i + 1}. {r.name}</td>
                    <td className="text-center">{r.sourced}</td><td className="text-center">{r.checked}</td>
                    <td className="text-center">{r.ff}</td><td className="text-center">{r.claimed}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AM growth leads */}
      {isAmUser && (
        <Card className="border-blue-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-700" /> AM growth leads ({amLeads.length})</CardTitle>
            <CardDescription>Existing customers routed to you from Verticals. Add growth notes as you work them.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {amLeads.length === 0 ? <p className="text-sm text-slate-500">No routed leads yet.</p> : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{amLeads.map(p => <ProspectCard key={p.id} p={p} />)}</div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={onTab} className="min-w-0">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {VERTICALS.map(v => <TabsTrigger key={v.id} value={v.id} className="text-xs sm:text-sm">{v.label}</TabsTrigger>)}
          </TabsList>
        </div>
        {VERTICALS.map(v => (
          <TabsContent key={v.id} value={v.id} className="space-y-4 min-w-0">
            {/* Lead sources */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-base">Lead sources</CardTitle></CardHeader>
              <CardContent className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {LEAD_SOURCES[v.id].map(s => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="group block min-w-0 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-slate-900 truncate group-hover:text-indigo-700">{s.label}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                    {s.flag && <p className="text-[10px] text-amber-700 mt-1 flex gap-1"><Info className="w-3 h-3 shrink-0 mt-px" />{s.flag}</p>}
                  </a>
                ))}
              </CardContent>
            </Card>

            <SuggestedProspectsPanel vertical={v.id} prospects={prospects} canAdd={canSource} uid={uid} myName={myName} />

            {/* Google Maps by belt */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Google Maps by industrial belt</CardTitle>
                <CardDescription>Searches &quot;{MAPS_KEYWORDS[v.id][0]}&quot; and similar terms in each suburb.</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                {METRO_BELTS.map(b => (
                  <div key={b.id} className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">{b.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {b.suburbs.map(sub => (
                        <a key={sub} href={mapsSearchUrl(MAPS_KEYWORDS[v.id][0], sub)} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:border-red-300 hover:text-red-700">
                          {sub}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  <span className="text-[11px] text-slate-500 w-full">More keywords (whole metro):</span>
                  {MAPS_KEYWORDS[v.id].map(k => (
                    <a key={k} href={mapsSearchUrl(k, 'Perth')} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:border-red-300">{k}</a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Playbook */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> {v.label} playbook</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-3 text-sm">
                <p className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-900 p-2 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{PARCEL_SCOPE}</p>
                <p className="text-slate-800">{pb.pitch}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className="font-bold text-xs uppercase text-slate-500 mb-1">Pains</p><ul className="list-disc pl-4 space-y-0.5 text-xs">{pb.pains.map(x => <li key={x}>{x}</li>)}</ul></div>
                  <div><p className="font-bold text-xs uppercase text-slate-500 mb-1">Decision-makers</p><ul className="list-disc pl-4 space-y-0.5 text-xs">{pb.titles.map(x => <li key={x}>{x}</li>)}</ul></div>
                  <div><p className="font-bold text-xs uppercase text-slate-500 mb-1">Outreach steps</p><ol className="list-decimal pl-4 space-y-0.5 text-xs">{pb.steps.map(x => <li key={x}>{x}</li>)}</ol></div>
                </div>
                <div>
                  <p className="font-bold text-xs uppercase text-slate-500 mb-1">Templates</p>
                  <div className="flex flex-wrap gap-1.5">
                    {templatesFor(v.id).map(t => (
                      <Button key={t.id} size="sm" variant="outline" className="h-8 text-xs" onClick={() => copy(t.body, `t-${v.id}-${t.id}`, `${t.label} copied`)}>
                        {copied === `t-${v.id}-${t.id}` ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <ClipboardCopy className="w-3.5 h-3.5 mr-1" />}
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Prospect list */}
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Prospects ({filtered.length})</CardTitle>
          {canSource && <Button size="sm" onClick={() => setDialog({ mode: 'add' })}><Plus className="w-4 h-4 mr-1" /> Add prospect</Button>}
        </CardHeader>
        <CardContent className="px-3 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input placeholder="Search company, contact…" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape' && search) { e.preventDefault(); setSearch(''); } }} className="pl-9 pr-10 h-10" />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" title="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={vFilter} onValueChange={v => setVFilter(v as any)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All verticals</SelectItem>{VERTICALS.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent></Select>
            <Select value={beltFilter} onValueChange={v => setBeltFilter(v as any)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All belts</SelectItem>{BELTS.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All SF statuses</SelectItem>{SF_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All owners</SelectItem>
                <SelectItem value="MINE">Mine</SelectItem>
                <SelectItem value="UNCLAIMED">Unclaimed / lapsed</SelectItem>
                {owners.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent></Select>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No prospects match.{canSource ? ' Add one from a lead source above.' : ''}</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{filtered.map(p => <ProspectCard key={p.id} p={p} />)}</div>
          )}
        </CardContent>
      </Card>

      <ProspectDialog
        open={!!dialog}
        onOpenChange={o => !o && setDialog(null)}
        initial={dialog?.mode === 'edit'
          ? { company: dialog.p.company, vertical: dialog.p.vertical, belt: dialog.p.belt, source: dialog.p.source || 'OTHER', contactName: dialog.p.contactName || '', contactTitle: dialog.p.contactTitle || '', freightProfile: dialog.p.freightProfile || [], notes: dialog.p.notes || '' }
          : emptyForm}
        onSave={save}
      />


      <Dialog open={!!amNotesTarget} onOpenChange={o => !o && setAmNotesTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AM growth notes</DialogTitle>
            <DialogDescription>{amNotesTarget?.company}</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} maxLength={5000} value={amNotesText} onChange={e => setAmNotesText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmNotesTarget(null)}>Cancel</Button>
            <Button onClick={async () => { if (!amNotesTarget) return; await update(amNotesTarget, { amNotes: amNotesText }, 'Notes saved'); setAmNotesTarget(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
