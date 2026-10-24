"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, GripVertical, History, Loader2, Monitor, RotateCcw, Save, Smartphone, Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useDashboardLayout } from '@/hooks/use-dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatPerth } from '@/lib/time-mgmt';
import {
  DEFAULT_LAYOUT, HISTORY_LIMIT, cleanLayout, moveWidget, normalizeLayout, pushHistory, resolveLayout, widgetMeta,
  type DashboardWidgetConfig, type LayoutHistoryEntry, type WidthCols,
} from '@/lib/dashboard-layout';
import { DashboardWidgetGrid, type GridMode } from './widgets/dashboard-widget-grid';

type Tab = 'everyone' | 'leaders';

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Admin / Leader tool: choose which widgets appear on the dashboard, their order and width,
 * for everyone (BDM + Account Manager) and optionally a separate layout for Leaders.
 * Writes appSettings/global (rules: admin-only write).
 */
export function DashboardDesigner() {
  const { user, profile, isLeader } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { settings, history, isLoading } = useDashboardLayout('everyone');

  const [everyone, setEveryone] = useState<DashboardWidgetConfig[]>(DEFAULT_LAYOUT);
  const [leaders, setLeaders] = useState<DashboardWidgetConfig[]>(DEFAULT_LAYOUT);
  const [same, setSame] = useState(true);
  const [tab, setTab] = useState<Tab>('everyone');
  const [previewMode, setPreviewMode] = useState<GridMode>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const initialised = useRef(false);

  // The saved state (what is in Firestore right now), used for "unsaved changes".
  const saved = useMemo(() => ({
    everyone: cleanLayout(resolveLayout(settings, 'everyone')),
    leaders: cleanLayout(normalizeLayout(settings?.leaderDashboardLayout ?? settings?.dashboardLayout)),
    same: settings?.useSameLayoutForLeaders !== false,
  }), [settings]);

  useEffect(() => {
    if (isLoading || initialised.current) return;
    initialised.current = true;
    setEveryone(saved.everyone);
    setLeaders(saved.leaders);
    setSame(saved.same);
  }, [isLoading, saved]);

  const dirty = initialised.current && (!sameJson(cleanLayout(everyone), saved.everyone) || !sameJson(cleanLayout(leaders), saved.leaders) || same !== saved.same);

  const editingLeaders = tab === 'leaders';
  const layout = editingLeaders ? leaders : everyone;
  const setLayout = editingLeaders ? setLeaders : setEveryone;
  const locked = editingLeaders && same;

  const update = (index: number, patch: Partial<DashboardWidgetConfig>) => setLayout(l => l.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const onSwitchSame = (value: boolean) => {
    setSame(value);
    // Turning "same" off for the first time: start the Leaders layout from the Everyone layout.
    if (!value && !settings?.leaderDashboardLayout && sameJson(leaders, DEFAULT_LAYOUT)) setLeaders(everyone.map(w => ({ ...w })));
    if (value && tab === 'leaders') setTab('everyone');
  };

  const handleSave = async () => {
    if (!db || !user || !isLeader) return;
    setIsSaving(true);
    try {
      const entry: LayoutHistoryEntry = {
        savedAt: Date.now(),
        savedBy: user.uid,
        savedByName: profile?.name || 'Unknown',
        everyone: cleanLayout(everyone),
        leaders: cleanLayout(leaders),
        useSameLayoutForLeaders: same,
      };
      await setDoc(doc(db, 'appSettings', 'global'), {
        dashboardLayout: cleanLayout(everyone),
        leaderDashboardLayout: cleanLayout(leaders),
        useSameLayoutForLeaders: same,
        dashboardLayoutHistory: pushHistory(history, entry),
        dashboardLayoutUpdatedAt: serverTimestamp(),
        dashboardLayoutUpdatedBy: user.uid,
      }, { merge: true });
      toast({ title: 'Dashboard layout saved', description: 'Everyone sees it on their next load.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Save failed', description: 'Only admins and leaders can change the dashboard layout.' });
    } finally {
      setIsSaving(false);
    }
  };

  const restore = (entry: LayoutHistoryEntry) => {
    setEveryone(entry.everyone);
    setLeaders(entry.leaders);
    setSame(entry.useSameLayoutForLeaders);
    if (entry.useSameLayoutForLeaders) setTab('everyone');
    toast({ title: 'Layout restored in the editor', description: 'Press Save to apply it.' });
  };

  if (!isLeader) return null;
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const previewAudience = editingLeaders ? 'leader' : 'everyone';
  const previewContext = {
    userId: user?.uid || '',
    userName: profile?.name || '',
    role: profile?.role || 'BDM',
    territory: profile?.territory,
    audience: previewAudience as 'leader' | 'everyone',
    preview: true,
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold">Dashboard Design</CardTitle>
              <CardDescription className="text-xs">Choose, order and size the dashboard widgets. Changes only apply when you press Save.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs font-semibold" onClick={() => setLayout(DEFAULT_LAYOUT.map(w => ({ ...w })))} disabled={locked}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to default
              </Button>
              <Button size="sm" className="text-xs font-semibold" onClick={handleSave} disabled={!dirty || isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Save{dirty ? ' changes' : ''}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border bg-muted px-4 py-3">
            <div>
              <p className="text-xs font-semibold">Leaders use the same layout as everyone</p>
              <p className="text-xs text-muted-foreground">Turn off to design a separate Leader dashboard.</p>
            </div>
            <Switch checked={same} onCheckedChange={onSwitchSame} aria-label="Leaders use the same layout as everyone" />
          </label>

          <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="everyone" className="text-xs font-semibold">Everyone (BDM + AM)</TabsTrigger>
              <TabsTrigger value="leaders" disabled={same} className="text-xs font-semibold">Leaders</TabsTrigger>
            </TabsList>
          </Tabs>
          {same && <p className="text-xs text-muted-foreground">Leaders currently see the Everyone layout (with the Leader-only widgets). Turn the switch off to edit the Leaders tab.</p>}

          {/* Widget list */}
          <ul className="space-y-2" aria-label="Widget order">
            {layout.map((w, index) => {
              const meta = widgetMeta(w.id);
              if (!meta) return null;
              return (
                <li
                  key={w.id}
                  draggable={!locked}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={e => { e.preventDefault(); setOverIndex(index); }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragIndex !== null) setLayout(l => moveWidget(l, dragIndex, index));
                    setDragIndex(null); setOverIndex(null);
                  }}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors',
                    !w.visible && 'opacity-60 bg-muted',
                    overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary ring-1 ring-primary',
                    locked && 'pointer-events-none opacity-70',
                  )}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" aria-hidden />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{meta.title}</span>
                      {meta.leaderOnly && <Badge variant="outline" className="text-xs font-semibold">Leaders only</Badge>}
                      {!meta.defaultVisible && <Badge variant="outline" className="text-xs font-semibold">Optional</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label={`${meta.title} width`}>
                    {([1, 2, 3] as WidthCols[]).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => update(index, { width: n })}
                        aria-pressed={w.width === n}
                        className={cn('h-7 w-8 rounded-md border text-xs font-semibold', w.width === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted')}
                        title={`${n} column${n > 1 ? 's' : ''} wide`}
                      >{n}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => setLayout(l => moveWidget(l, index, index - 1))} aria-label={`Move ${meta.title} up`}><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === layout.length - 1} onClick={() => setLayout(l => moveWidget(l, index, index + 1))} aria-label={`Move ${meta.title} down`}><ArrowDown className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Switch checked={w.visible} onCheckedChange={v => update(index, { visible: v })} aria-label={`Show ${meta.title}`} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Version history */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4" /> Version history</CardTitle>
          <CardDescription className="text-xs">The last {HISTORY_LIMIT} saved layouts. Restore loads one into the editor; press Save to apply it.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved versions yet. Your first Save creates one.</p>
          ) : (
            <ul className="divide-y">
              {history.map((h, i) => (
                <li key={`${h.savedAt}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {formatPerth(h.savedAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} AWST
                      {i === 0 && <Badge className="ml-2 text-xs font-semibold">Current</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {h.savedByName || 'Unknown'} · {h.everyone.filter(w => w.visible).length} widgets · {h.useSameLayoutForLeaders ? 'Leaders same' : 'Leaders separate'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs font-semibold shrink-0" onClick={() => restore(h)}>
                    <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Live preview with the real widgets */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm font-bold">Preview · {editingLeaders ? 'Leaders' : 'Everyone'}</CardTitle>
              <CardDescription className="text-xs">Real widgets with your own data; links are switched off. Mobile shows one column in the same order.</CardDescription>
            </div>
            <div className="flex gap-1" role="group" aria-label="Preview size">
              <Button variant={previewMode === 'desktop' ? 'default' : 'outline'} size="sm" className="text-xs font-semibold" onClick={() => setPreviewMode('desktop')}><Monitor className="w-3.5 h-3.5 mr-1.5" /> Desktop</Button>
              <Button variant={previewMode === 'mobile' ? 'default' : 'outline'} size="sm" className="text-xs font-semibold" onClick={() => setPreviewMode('mobile')}><Smartphone className="w-3.5 h-3.5 mr-1.5" /> Mobile</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn('rounded-2xl border bg-muted p-4', previewMode === 'mobile' && 'max-w-[390px] mx-auto')}>
            <DashboardWidgetGrid layout={layout} context={previewContext} mode={previewMode} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
