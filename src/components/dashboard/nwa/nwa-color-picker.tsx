"use client";

import React, { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { NWA_COLORS, type NwaColor } from '@/lib/nwa-colors';

/**
 * Swatch picker for a person's NWA team-view colour (users/{uid}.nwaColor).
 * `value` is the stored palette id (or null for automatic); `resolved` is the colour actually shown.
 */
export function NwaColorPicker({ name, value, resolved, onChange, disabled }: {
  name: string;
  value: string | null;
  resolved: NwaColor;
  onChange: (id: string | null) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pick = async (id: string | null) => { setOpen(false); await onChange(id); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`NWA colour for ${name}: ${resolved.label}${value ? '' : ' (auto)'}`}
          aria-label={`NWA colour for ${name}`}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-surface-2 disabled:opacity-50"
        >
          <span className="h-5 w-5 rounded-full border-2" style={{ backgroundColor: resolved.tint, borderColor: resolved.strip }} aria-hidden />
          <Palette className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-sm font-semibold text-foreground">NWA colour</p>
        <p className="mb-3 text-xs text-muted-foreground">Used for {name}’s items in the whole-team NWA view.</p>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Colour">
          {NWA_COLORS.map(c => {
            const selected = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                title={c.label}
                aria-label={c.label}
                onClick={() => pick(c.id)}
                className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'ring-2 ring-offset-1 ring-ring')}
                style={{ backgroundColor: c.tint, borderColor: c.strip, color: c.ink }}
              >
                {selected && <Check className="h-4 w-4" aria-hidden />}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => pick(null)}
          className={cn('mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2', !value && 'bg-surface-2 text-foreground')}
        >
          Auto{!value ? ` · ${resolved.label}` : ''}
        </button>
      </PopoverContent>
    </Popover>
  );
}
