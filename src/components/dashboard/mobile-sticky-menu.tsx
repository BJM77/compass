"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Sliders, Check, RotateCcw, LogOut, LayoutGrid, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useIsMobileNav } from '@/hooks/use-mobile';
import type { DashboardView, NavGroup, NavItem } from '@/lib/navigation';

export const PINNED_STORAGE_KEY = 'compass_mobile_pinned_items';
export const DEFAULT_PINNED_VIEWS: DashboardView[] = ['DASHBOARD', 'TWIW', 'MANAGE_TIME', 'CALL_PLANNING'];
const MAX_PINS = 4;

interface MobileStickyMenuProps {
  /** Role-filtered nav groups (same list the desktop sidebar renders). */
  groups: NavGroup[];
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onSignOut: () => void | Promise<void>;
  email?: string;
  showReturnToGovernance?: boolean;
  onReturnToGovernance?: () => void;
}

/**
 * Sticky bottom navigation for phones and touch tablets, with an "All Menus" sheet
 * listing every item the user can reach and a per-device pin customiser.
 */
export function MobileStickyMenu({
  groups, activeView, onNavigate, onSignOut, email, showReturnToGovernance, onReturnToGovernance,
}: MobileStickyMenuProps) {
  const isMobileNav = useIsMobileNav();
  const { toast } = useToast();
  const [pinnedIds, setPinnedIds] = useState<DashboardView[]>(DEFAULT_PINNED_VIEWS);
  const [tempPinnedIds, setTempPinnedIds] = useState<DashboardView[]>(DEFAULT_PINNED_VIEWS);
  const [isFullOpen, setIsFullOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Cap at MAX_PINS (All Menus is always shown separately and doesn't count).
          const trimmed = Array.from(new Set(parsed)).slice(0, MAX_PINS) as DashboardView[];
          setPinnedIds(trimmed);
          if (trimmed.length !== parsed.length) localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(trimmed));
        }
      }
    } catch (e) {
      console.error('Failed to load pinned menu items', e);
    }
  }, []);

  const accessibleItems: NavItem[] = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // Only show pins the user can actually reach; fall back to their first items if none survive.
  const validPinned = useMemo(() => {
    const valid = pinnedIds.slice(0, MAX_PINS)
      .map(id => accessibleItems.find(i => i.view === id))
      .filter((i): i is NavItem => !!i);
    return valid.length > 0 ? valid : accessibleItems.slice(0, MAX_PINS);
  }, [pinnedIds, accessibleItems]);

  const accessibleDefaults = (): DashboardView[] => {
    const d = DEFAULT_PINNED_VIEWS.filter(v => accessibleItems.some(i => i.view === v));
    return d.length > 0 ? d : accessibleItems.slice(0, MAX_PINS).map(i => i.view);
  };

  const go = (view: DashboardView) => {
    setIsFullOpen(false);
    onNavigate(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCustomize = () => {
    setTempPinnedIds(validPinned.map(i => i.view).slice(0, MAX_PINS));
    setIsCustomizeOpen(true);
  };

  // Toggle is handled in exactly one place (the row); the checkbox is display-only.
  const togglePin = (id: DashboardView) => {
    if (tempPinnedIds.includes(id)) {
      if (tempPinnedIds.length <= 1) {
        toast({ title: 'Minimum pinned items', description: 'Please keep at least 1 item pinned.', variant: 'destructive' });
        return;
      }
      setTempPinnedIds(tempPinnedIds.filter(v => v !== id));
    } else {
      if (tempPinnedIds.length >= MAX_PINS) {
        toast({ title: 'Maximum quick links', description: `You can pin up to ${MAX_PINS} items. All Menus is always shown in addition.`, variant: 'destructive' });
        return;
      }
      setTempPinnedIds([...tempPinnedIds, id]);
    }
  };

  const saveCustomize = () => {
    setPinnedIds(tempPinnedIds);
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(tempPinnedIds));
      toast({ title: 'Sticky menu updated', description: 'Your quick links have been saved on this device.' });
    } catch (e) {
      console.error('Failed to save pinned menu items', e);
    }
    setIsCustomizeOpen(false);
  };

  if (!isMobileNav || accessibleItems.length === 0) return null;

  return (
    <>
      <nav
        aria-label="Quick navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch justify-around gap-0.5 px-1 py-1.5 h-16 max-w-2xl mx-auto">
          {validPinned.map(item => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => go(item.view)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 basis-0 min-w-0 py-1 px-0.5 rounded-xl gap-1 transition-all',
                  isActive ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'stroke-[2.5px]')} />
                <span className="truncate max-w-[70px] w-full text-center text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsFullOpen(true)}
            className="flex flex-col items-center justify-center flex-1 basis-0 min-w-0 py-1 px-0.5 rounded-xl gap-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <Menu className="h-5 w-5 shrink-0" />
            <span className="truncate max-w-[70px] w-full text-center text-[10px] font-bold leading-none">All Menus</span>
          </button>
        </div>
      </nav>

      <Sheet open={isFullOpen} onOpenChange={setIsFullOpen}>
        <SheetContent side="bottom" className="h-[88dvh] rounded-t-2xl p-0 flex flex-col z-50">
          <SheetHeader className="p-4 pr-12 border-b flex flex-row items-center justify-between space-y-0 text-left">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-indigo-600" />
              <SheetTitle className="text-lg font-black">All Menus</SheetTitle>
              <SheetDescription className="sr-only">Every menu item available to you</SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCustomize} className="h-8 px-2.5 text-xs gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-indigo-600" />
              Customize Sticky
            </Button>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-2">
              {showReturnToGovernance && onReturnToGovernance && (
                <button
                  type="button"
                  onClick={() => { setIsFullOpen(false); onReturnToGovernance(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 text-amber-700 font-black text-xs uppercase tracking-wider border border-amber-500/20"
                >
                  <XCircle className="w-4 h-4" />
                  Return to Governance
                </button>
              )}
              <Accordion type="multiple" defaultValue={groups.map(g => g.id)} className="w-full">
                {groups.map(group => (
                  <AccordionItem key={group.id} value={group.id} className="border-none mb-1">
                    <AccordionTrigger className="px-3 py-2.5 hover:no-underline rounded-lg bg-slate-100 mb-1 text-xs font-black uppercase tracking-widest text-slate-600">
                      <span>{group.label} <span className="font-medium text-slate-400">({group.items.length})</span></span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 space-y-0.5">
                      {group.items.map(item => {
                        const isActive = activeView === item.view;
                        return (
                          <button
                            key={item.view}
                            type="button"
                            onClick={() => go(item.view)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                              isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-100 text-slate-800'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                            {validPinned.some(p => p.view === item.view) && (
                              <span className="ml-auto text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Pinned</span>
                            )}
                          </button>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </ScrollArea>

          <div className="p-4 border-t flex items-center justify-between gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Signed in as</p>
              <p className="text-xs font-medium truncate max-w-[220px]">{email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setIsFullOpen(false); onSignOut(); }} className="text-red-500 gap-1.5">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="sm:max-w-md w-[92vw] max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600" />
              Customize Sticky Bar
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select up to {MAX_PINS} quick access items to feature on your mobile bottom bar. The All Menus button is always shown and doesn't count. Saved on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-4">
            <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-lg border text-xs">
              <span className="font-semibold">Selected ({tempPinnedIds.length}/{MAX_PINS})</span>
              <Button variant="ghost" size="sm" onClick={() => setTempPinnedIds(accessibleDefaults())} className="h-7 text-[11px] gap-1">
                <RotateCcw className="h-3 w-3" />
                Reset Defaults
              </Button>
            </div>
            {groups.map(group => (
              <div key={group.id} className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">{group.label}</h4>
                <div className="grid grid-cols-1 gap-1.5 border rounded-lg p-2 bg-white">
                  {group.items.map(item => {
                    const isPinned = tempPinnedIds.includes(item.view);
                    return (
                      <div
                        key={item.view}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isPinned}
                        onClick={() => togglePin(item.view)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(item.view); } }}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors',
                          isPinned ? 'border-indigo-400 bg-indigo-50 font-semibold' : 'border-transparent hover:bg-slate-50'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className={cn('h-4 w-4', isPinned ? 'text-indigo-600' : 'text-slate-400')} />
                          <span>{item.label}</span>
                        </div>
                        {/* Display-only: the whole row is the tap target (avoids double toggle). */}
                        <Checkbox checked={isPinned} tabIndex={-1} aria-hidden className="pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-row gap-2 justify-end pt-3 border-t mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCustomizeOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveCustomize}>
              <Check className="h-4 w-4 mr-1" />
              Save Bar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
