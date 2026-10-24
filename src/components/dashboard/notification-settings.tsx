"use client";

import React, { useEffect, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebaseApp, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs } from '@/lib/time-mgmt';
import { VAPID_KEY, enablePush, disablePushOnThisDevice, pushSupported, isIosNotInstalled } from '@/lib/push';

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Push notification opt-in + preferences (users/{uid}/notificationSettings/prefs). */
export function NotificationSettings() {
  const { user } = useAuth();
  const app = useFirebaseApp();
  const db = useFirestore();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<string>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setPermission(Notification.permission);
  }, []);

  const prefsRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid, 'notificationSettings', 'prefs') : null), [db, user]);
  const { data: stored } = useDoc<NotificationPrefs>(prefsRef);
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(stored || {}) };

  const save = async (patch: Partial<NotificationPrefs>) => {
    if (!db || !user) return;
    const { updatedAt: _ignored, ...rest } = { ...prefs, ...patch };
    await setDoc(doc(db, 'users', user.uid, 'notificationSettings', 'prefs'), { ...rest, updatedAt: serverTimestamp() });
  };

  const onEnable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await enablePush(app, db, user.uid);
      await save({ enabled: true });
      setPermission(Notification.permission);
      toast({ title: 'Notifications enabled', description: 'This device will receive task reminders.' });
    } catch (e: any) {
      toast({ title: 'Could not enable notifications', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await disablePushOnThisDevice(app, db, user.uid);
      await save({ enabled: false });
      toast({ title: 'Notifications turned off' });
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2">
        <BellRing className="w-4 h-4 text-accent" />
        <p className="text-sm font-black uppercase tracking-wide text-foreground">Push notifications</p>
      </div>

      {!VAPID_KEY ? (
        <p className="text-xs text-muted-foreground bg-secondary/60 border rounded-md p-3">
          Push notifications are not configured yet (an admin needs to set <code>NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>).
        </p>
      ) : isIosNotInstalled() ? (
        <p className="text-xs text-foreground/75 bg-warning-soft border border-warning/25 rounded-md p-3 flex gap-2">
          <Smartphone className="w-4 h-4 shrink-0 text-warning-ink" />
          On iPhone/iPad, tap Share → <strong>Add to Home Screen</strong>, open BDM Compass from the Home Screen icon, then enable notifications here (iOS 16.4+).
        </p>
      ) : !pushSupported() ? (
        <p className="text-xs text-muted-foreground">This browser doesn&apos;t support push notifications.</p>
      ) : null}

      <Row
        label="Enable notifications on this device"
        description={permission === 'denied'
          ? 'Notifications are blocked in your browser settings for this site.'
          : 'Task reminders, daily digest and deadline nudges.'}
      >
        {prefs.enabled && permission === 'granted' ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onDisable}>Turn off</Button>
        ) : (
          <Button size="sm" disabled={busy || !VAPID_KEY || permission === 'denied'} onClick={onEnable}>Enable</Button>
        )}
      </Row>

      <Row label="Quiet hours" description="Only send between these times (Perth time). Reminders that fall outside are held until the window opens.">
        <div className="flex items-center gap-1.5">
          <Input type="time" aria-label="Allowed from" className="h-8 w-[110px] text-xs" value={prefs.allowedStart}
            onChange={e => e.target.value && save({ allowedStart: e.target.value })} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="time" aria-label="Allowed until" className="h-8 w-[110px] text-xs" value={prefs.allowedEnd}
            onChange={e => e.target.value && save({ allowedEnd: e.target.value })} />
        </div>
      </Row>
      <Row label="Weekdays only" description="Don't send on Saturday or Sunday.">
        <Switch checked={prefs.weekdaysOnly} onCheckedChange={v => save({ weekdaysOnly: v })} />
      </Row>
      <Row label="Daily digest (8am)" description="Your top 3 Do Now tasks plus anything due today.">
        <Switch checked={prefs.dailyDigest} onCheckedChange={v => save({ dailyDigest: v })} />
      </Row>
      <Row label="TWTW / Friday FW deadline nudges" description="1pm on TWTW due day and 11am Fridays, only if you haven't submitted.">
        <Switch checked={prefs.deadlineNudges} onCheckedChange={v => save({ deadlineNudges: v })} />
      </Row>
      <Row label="Stale Do Now alerts" description={'Push when a Do Now task has been untouched for 2+ days ("Delegate or Delete?").'}>
        <Switch checked={prefs.escalation} onCheckedChange={v => save({ escalation: v })} />
      </Row>
      <Label className="block text-[10px] text-muted-foreground pt-1">All times are Australia/Perth (AWST).</Label>
    </div>
  );
}
