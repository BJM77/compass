'use client';

import React, { useMemo, useState } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Minus, ExternalLink, RefreshCw, Loader2, Pencil, AlertTriangle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  AIP_TGP_URL, CARRIERS, TGE_BENCHMARK_LABEL, deltaFor, seedDoc,
  type Carrier, type FuelDoc, type FuelOverride, type FuelRate,
} from '@/lib/fuel-surcharges';

const STAFF = ['BDM', 'ACCOUNT_MANAGER', 'AM', 'LEADER', 'GM', 'ADMIN', 'SUPER_ADMIN'];
const awst = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString('en-AU', { timeZone: 'Australia/Perth', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' AWST' : '—');
const dmy = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-AU', { timeZone: 'Australia/Perth', day: 'numeric', month: 'short' }) : '');
const period = (r: FuelRate) => (r.from ? (r.to ? `${dmy(r.from)} – ${dmy(r.to)}` : `from ${dmy(r.from)}`) : '');
const tsMs = (t: any) => (t?.toMillis ? t.toMillis() : typeof t === 'number' ? t : null);
const fmt = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, '')}%`;

function Delta({ d }: { d: number | null }) {
  if (d == null) return null;
  if (d === 0) return <span className="inline-flex items-center text-[11px] text-slate-500"><Minus className="w-3 h-3" />0</span>;
  const up = d > 0;
  return <span className={cn('inline-flex items-center text-[11px] font-bold', up ? 'text-red-600' : 'text-emerald-600')} title="Change vs previous period (points)">
    {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{up ? '+' : ''}{d.toFixed(2)}
  </span>;
}

type Row = { c: Carrier; d: FuelDoc; o: FuelOverride | null };

export function FuelSurchargesView() {
  const { user, profile, isLeader } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const role = String(profile?.role || '');
  const isStaff = isLeader || STAFF.includes(role);
  const isAdmin = isLeader;

  const docsRef = useMemoFirebase(() => (db && user && isStaff ? collection(db, 'fuelSurcharges') : null), [db, user, isStaff]);
  const ovRef = useMemoFirebase(() => (db && user && isStaff ? collection(db, 'fuelSurchargeOverrides') : null), [db, user, isStaff]);
  const { data: docs } = useCollection<FuelDoc>(docsRef);
  const { data: ovs } = useCollection<FuelOverride>(ovRef);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const rows: Row[] = useMemo(() => CARRIERS.map(c => ({
    c,
    d: (docs || []).find((x: any) => x.id === c.id || x.carrierId === c.id) || seedDoc(c),
    o: ((ovs || []).find((x: any) => x.id === c.id) as FuelOverride) || null,
  })), [docs, ovs]);

  const tgeRoad = rows.find(r => r.c.ours)?.d.current.find(x => x.label === TGE_BENCHMARK_LABEL)?.pct ?? null;
  const lastChecked = Math.max(0, ...rows.map(r => r.d.lastCheckedAt || 0));

  if (!isStaff) return <Card><CardContent className="p-6 text-sm text-slate-600">Fuel Surcharges is available to staff only.</CardContent></Card>;

  const refresh = async () => {
    setRefreshing(true);
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch('/api/fuel-surcharges/refresh', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (!j.ran) toast({ title: 'Recently refreshed', description: `Prices were checked ${awst(j.lastRunAt)}. Refresh is limited to once every 10 minutes.` });
      else {
        const bad = j.results.filter((r: any) => r.status !== 'ok' && r.status !== 'not_published').length;
        toast({ title: 'Prices refreshed', description: bad ? `${bad} carrier page(s) couldn't be read; showing last known values.` : 'All published carrier pages read.' });
      }
    } catch (e: any) { toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' }); }
    finally { setRefreshing(false); }
  };

  const headline = (r: Row): { pct: number; label: string; manual: boolean } | null => {
    if (r.o) return { pct: r.o.pct, label: r.o.label, manual: true };
    const h = r.c.ours ? r.d.current.find(x => x.label === TGE_BENCHMARK_LABEL) : r.d.current[0];
    return h ? { pct: h.pct, label: h.label, manual: false } : null;
  };
  const vsTge = (r: Row) => {
    const h = headline(r);
    if (!h || tgeRoad == null || r.c.ours) return null;
    const diff = Math.round((h.pct - tgeRoad) * 100) / 100;
    return <span className={cn('text-xs font-bold', diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-600' : 'text-slate-500')} title={`vs TGE ${TGE_BENCHMARK_LABEL} ${fmt(tgeRoad)}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)} pts</span>;
  };

  const Status = ({ r }: { r: Row }) => {
    const { d, c } = r;
    if (c.notPublished) return <span className="text-xs text-slate-500">Not published — rate card/portal only</span>;
    if (d.status === 'stale') return <span className="text-xs text-amber-700 inline-flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Couldn&apos;t refresh — showing last known ({awst(d.lastSuccessAt)})</span>;
    if (d.status === 'check_source') return <span className="text-xs text-amber-700">Check source</span>;
    if (d.status === 'unavailable') return <span className="text-xs text-slate-500">Unavailable</span>;
    return <span className="text-xs text-slate-500">{d.seeded ? 'Seeded 18 Oct 2026 (research)' : `Checked ${awst(d.lastCheckedAt)}`}</span>;
  };

  const Rates = ({ r }: { r: Row }) => {
    const { d, o } = r;
    return (
      <div className="space-y-0.5 min-w-0">
        {o && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-black text-slate-900">{fmt(o.pct)}</span><span className="text-xs text-slate-600">{o.label}</span>
            <Badge variant="outline" className="text-[10px] border-purple-200 bg-purple-50 text-purple-800">Manual{o.effective ? ` · ${dmy(o.effective)}` : ''}</Badge>
            {o.note && <span className="text-[11px] text-slate-500 break-words w-full">{o.note} ({o.enteredByName}, {awst(tsMs(o.enteredAt))})</span>}
          </div>
        )}
        {d.current.map(x => (
          <div key={x.label} className={cn('flex flex-wrap items-center gap-1.5', o && 'opacity-60')}>
            <span className={cn('font-black', r.c.ours ? 'text-indigo-800' : 'text-slate-900')}>{fmt(x.pct)}</span>
            <span className="text-xs text-slate-600">{x.label}</span>
            <Delta d={deltaFor(d, x)} />
            {o && <span className="text-[10px] text-slate-400">(published)</span>}
          </div>
        ))}
        {!o && !d.current.length && !r.c.notPublished && (r.c.url ? <a href={r.c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 hover:underline">Check source</a> : null)}
        {!o && !d.current.length && r.c.notPublished && <span className="text-xs text-slate-400">—</span>}
      </div>
    );
  };

  const Effective = ({ r }: { r: Row }) => (
    <div className="text-xs text-slate-600 space-y-0.5">
      {r.d.current[0] && <div>{period(r.d.current[0])}</div>}
      {r.d.upcoming.slice(0, r.c.ours ? 3 : 2).map((u, i) => <div key={i} className="text-slate-500">Next: {fmt(u.pct)}{r.c.ours ? ` ${u.label.replace('Express ', '')}` : ''} {period(u)}</div>)}
      <div className="text-slate-400">{r.c.frequency}</div>
    </div>
  );

  const Source = ({ r }: { r: Row }) => (
    <div className="flex flex-wrap items-center gap-2">
      {r.c.url && <a href={r.c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 hover:underline inline-flex items-center gap-0.5">Source<ExternalLink className="w-3 h-3" /></a>}
      {isAdmin && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(r)}><Pencil className="w-3 h-3 mr-1" />Manual</Button>}
    </div>
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle>Fuel Surcharges</CardTitle>
            <CardDescription>Published domestic fuel surcharges from each carrier&apos;s official page. Last checked {awst(lastChecked)}.</CardDescription>
          </div>
          <Button onClick={refresh} disabled={refreshing}>{refreshing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Refresh prices</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="py-2 pr-3">Carrier</th><th className="py-2 pr-3">Current surcharge</th><th className="py-2 pr-3">Effective</th>
                <th className="py-2 pr-3" title={`Difference vs TGE ${TGE_BENCHMARK_LABEL}`}>vs TGE Road</th><th className="py-2 pr-3">Status</th><th className="py-2">Source</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.c.id} className={cn('border-b align-top', r.c.ours && 'bg-indigo-50/60')}>
                    <td className="py-2 pr-3 font-bold">{r.c.name}{r.c.ours && <Badge className="ml-2 bg-indigo-600 hover:bg-indigo-600 text-[10px]">Our rate</Badge>}{r.c.note && <div className="text-[11px] font-normal text-slate-500">{r.c.note}</div>}</td>
                    <td className="py-2 pr-3"><Rates r={r} /></td>
                    <td className="py-2 pr-3"><Effective r={r} /></td>
                    <td className="py-2 pr-3">{vsTge(r)}</td>
                    <td className="py-2 pr-3 max-w-[14rem]"><Status r={r} /></td>
                    <td className="py-2"><Source r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: one card per row */}
          <div className="md:hidden grid grid-cols-1 gap-2">
            {rows.map(r => (
              <div key={r.c.id} className={cn('rounded-lg border p-3 space-y-1.5 min-w-0', r.c.ours ? 'bg-indigo-50 border-indigo-200' : 'bg-white')}>
                <div className="flex items-center gap-2"><span className="font-bold">{r.c.name}</span>{r.c.ours && <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[10px]">Our rate</Badge>}<div className="flex-1" />{vsTge(r)}</div>
                {r.c.note && <p className="text-[11px] text-slate-500">{r.c.note}</p>}
                <Rates r={r} />
                <Effective r={r} />
                <Status r={r} />
                <Source r={r} />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Arrows show the change vs the previous period (percentage points). &quot;vs TGE Road&quot; = carrier headline minus TGE {TGE_BENCHMARK_LABEL}; positive means they charge more.
            Diesel benchmark: <a href={AIP_TGP_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">AIP terminal gate prices</a>.
          </p>
        </CardContent>
      </Card>
      {editing && <OverrideDialog row={editing} onClose={() => setEditing(null)} uid={user?.uid || ''} name={profile?.name || user?.email || ''} />}
    </div>
  );
}

function OverrideDialog({ row, onClose, uid, name }: { row: Row; onClose: () => void; uid: string; name: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [pct, setPct] = useState(row.o ? String(row.o.pct) : '');
  const [label, setLabel] = useState(row.o?.label || 'Domestic');
  const [effective, setEffective] = useState(row.o?.effective || '');
  const [note, setNote] = useState(row.o?.note || '');
  const n = Number(pct);
  const valid = pct !== '' && Number.isFinite(n) && n >= 0 && n < 100 && label.trim().length > 0;
  const ref = doc(db, 'fuelSurchargeOverrides', row.c.id);
  const save = async () => {
    try {
      await setDoc(ref, { pct: Math.round(n * 100) / 100, label: label.trim().slice(0, 60), note: note.trim().slice(0, 300), effective: effective || null, enteredBy: uid, enteredByName: name.slice(0, 120), enteredAt: serverTimestamp() });
      toast({ title: 'Manual rate saved' }); onClose();
    } catch (e) { console.error(e); toast({ title: 'Not allowed or failed to save', variant: 'destructive' }); }
  };
  const clear = async () => { try { await deleteDoc(ref); toast({ title: 'Manual rate cleared' }); onClose(); } catch { toast({ title: 'Failed', variant: 'destructive' }); } };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Manual rate: {row.c.name}</DialogTitle><DialogDescription>Overrides the published/scraped value on this page. Shown with a Manual badge.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Surcharge %</Label><Input inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} /></div>
          <div className="space-y-1"><Label>Effective from</Label><Input type="date" value={effective} onChange={e => setEffective(e.target.value)} /></div>
          <div className="space-y-1 col-span-2"><Label>Service</Label><Input maxLength={60} value={label} onChange={e => setLabel(e.target.value)} /></div>
          <div className="space-y-1 col-span-2"><Label>Note (source)</Label><Input maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. from customer's Oct invoice" /></div>
        </div>
        <DialogFooter className="gap-2">
          {row.o && <Button variant="outline" onClick={clear}>Clear manual</Button>}
          <Button disabled={!valid} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
