"use client";

import React from 'react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { Landmark, TrendingUp } from 'lucide-react';

export interface TopCustomer {
  companyName: string;
  revenue: number;
}

export function TopCustomersCompany({ data }: { data: TopCustomer[] }) {
  const top10 = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const maxRevenue = top10.length > 0 ? top10[0].revenue : 1;

  return (
    <div className="bg-card rounded-2xl shadow-xs border border-border p-5 sm:p-6 print:shadow-none print:border-none print:p-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-accent/10 text-accent rounded-lg">
            <Landmark className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-black text-foreground tracking-tight text-base sm:text-lg uppercase">
              Top 10 Traders (Company-Wide)
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Ranked by total actual spend booked across all accounts.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {top10.map((item, idx) => {
          const barWidth = Math.min(100, Math.max(8, (item.revenue / maxRevenue) * 100));

          return (
            <div 
              key={idx} 
              className="p-2.5 hover:bg-secondary/60 rounded-xl transition-colors border border-border/50 bg-secondary/25 relative overflow-hidden"
            >
              {/* Background fill bar */}
              <div 
                className="absolute top-0 left-0 bottom-0 bg-accent/5 -z-0 rounded-xl transition-all duration-700"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    idx === 0 ? 'bg-accent text-accent-foreground shadow-xs' :
                    idx === 1 ? 'bg-accent/20 text-primary' :
                    idx === 2 ? 'bg-accent/15 text-primary' :
                    'bg-border/80 text-foreground/75'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="font-bold text-foreground text-sm truncate max-w-[180px] sm:max-w-[260px]" title={item.companyName}>
                    {item.companyName}
                  </span>
                </div>
                <div className="font-black text-primary text-sm">
                  {formatCurrency(item.revenue)}
                </div>
              </div>
            </div>
          );
        })}
        {top10.length === 0 && (
          <div className="text-center py-8 text-muted-foreground font-medium text-sm">
            No customer actual spend data available.
          </div>
        )}
      </div>
    </div>
  );
}

