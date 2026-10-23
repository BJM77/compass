"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DashboardView, NavGroup, NavItem } from '@/lib/navigation';

interface CommandPaletteProps {
  /** Role-filtered nav groups (same list as the sidebar), so the palette never exposes a view the user can't open. */
  groups: NavGroup[];
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}

type Entry = { item: NavItem; groupLabel: string };

/** Hook for the global Cmd/Ctrl+K shortcut plus a controlled open state. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

/** Header button that opens the palette. */
export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search and jump to a page"
      className="hidden sm:flex items-center gap-2 h-9 min-w-[220px] px-3 rounded-lg border border-input bg-secondary/60 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors print:hidden"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Jump to…</span>
      <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        <span className="text-[13px] leading-none">⌘</span>K
      </kbd>
    </button>
  );
}

export function CommandPalette({ groups, activeView, onNavigate, open, setOpen }: CommandPaletteProps & { open: boolean; setOpen: (o: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const entries: Entry[] = useMemo(
    () => groups.flatMap(g => g.items.map(item => ({ item, groupLabel: g.label }))),
    [groups]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.item.label.toLowerCase().includes(q) ||
      e.groupLabel.toLowerCase().includes(q) ||
      e.item.view.toLowerCase().replace(/_/g, ' ').includes(q)
    );
  }, [entries, query]);

  useEffect(() => { setCursor(0); }, [query, open]);
  useEffect(() => { if (!open) setQuery(''); }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const choose = useCallback((entry?: Entry) => {
    if (!entry) return;
    setOpen(false);
    onNavigate(entry.item.view);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onNavigate, setOpen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[cursor]); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 max-w-xl gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Jump to a page</DialogTitle>
        <DialogDescription className="sr-only">Type to search every page you can open, then press Enter.</DialogDescription>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages…"
            aria-label="Search pages"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No pages match &ldquo;{query}&rdquo;.</p>
          )}
          {results.map((entry, i) => {
            const Icon = entry.item.icon;
            const isCursor = i === cursor;
            const isActive = entry.item.view === activeView;
            return (
              <button
                key={entry.item.view}
                type="button"
                role="option"
                aria-selected={isCursor}
                data-index={i}
                onMouseMove={() => setCursor(i)}
                onClick={() => choose(entry)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  isCursor ? 'bg-secondary text-foreground' : 'text-foreground/90'
                )}
              >
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', isCursor ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary')}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 font-medium">{entry.item.label}</span>
                {isActive && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Current</span>}
                <span className="text-xs text-muted-foreground">{entry.groupLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t bg-secondary/50 px-4 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigate</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Open</span>
          <span className="ml-auto">{results.length} {results.length === 1 ? 'page' : 'pages'}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
