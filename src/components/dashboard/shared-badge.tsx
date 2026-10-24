'use client';

import { Share2 } from 'lucide-react';

/** Small badge marking a record that another user shared with me via the Access page. */
export function SharedBadge({ name, className = '' }: { name?: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span
      title={`Shared with you by ${name} (full access)`}
      className={`inline-flex items-center gap-1 shrink-0 rounded-full bg-accent/10 text-primary border border-accent/25 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
    >
      <Share2 className="w-2.5 h-2.5" />
      Shared by {name}
    </span>
  );
}
