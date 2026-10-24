"use client";

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useIsMobileNav } from '@/hooks/use-mobile';

const TZ = 'Australia/Perth';
const dateFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const shortFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

/** Live Australia/Perth clock. Renders only after mount to avoid hydration mismatch. */
export function HeaderClock() {
  const isMobileNav = useIsMobileNav();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!now) return <span className="w-12 shrink-0" aria-hidden />;

  const full = `${dateFmt.format(now).replace(',', '')} · ${timeFmt.format(now).replace(/\s?(am|pm)$/i, ' $1').toLowerCase()} WST`;
  return (
    <time
      dateTime={now.toISOString()}
      title={full}
      className="flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-lg bg-secondary/60 border border-border/70 px-2 py-1 text-xs font-bold tabular-nums text-foreground/85"
    >
      <Clock className="w-3.5 h-3.5 text-accent" />
      {isMobileNav ? shortFmt.format(now) : full}
    </time>
  );
}
