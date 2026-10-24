"use client";

import React, { useEffect, useState } from 'react';
import { Moon, Sun, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type ThemeMode, THEME_EVENT, readThemeMode, setThemeMode, applyThemeClass } from '@/lib/theme-mode';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemeMode, React.ElementType> = { light: Sun, dark: Moon, system: Laptop };
const LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const sync = () => { const m = readThemeMode(); setMode(m); applyThemeClass(m); };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onOs = () => { if (readThemeMode() === 'system') applyThemeClass('system'); };
    mq.addEventListener('change', onOs);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
      mq.removeEventListener('change', onOs);
    };
  }, []);

  const Icon = ICONS[mode];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${LABELS[mode]}`}
          title={`Theme: ${LABELS[mode]}`}
          className={cn('h-9 w-9 text-muted-foreground hover:text-foreground', className)}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map(m => {
            const I = ICONS[m];
            return (
              <DropdownMenuRadioItem key={m} value={m} className="min-h-[40px]">
                <I className="mr-2 h-4 w-4" />{LABELS[m]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
