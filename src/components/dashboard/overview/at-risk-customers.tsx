"use client";

import React from 'react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AtRiskCustomer {
  companyName: string;
  currentRevenue: number;
  lastYearRevenue: number;
  variance: number;
  managerName?: string;
}

export function AtRiskCustomers({ data }: { data: AtRiskCustomer[] }) {
  // Find customers with the largest negative variance
  const atRisk = [...data]
    .filter(c => c.variance < 0 && c.lastYearRevenue > 500)
    .sort((a, b) => a.variance - b.variance)
    .slice(0, 10);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-rose-200/80 p-5 sm:p-6 print:shadow-none print:border-none print:p-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-black text-rose-900 tracking-tight text-base sm:text-lg uppercase">
              At-Risk Accounts (Top Revenue Drop vs LY)
            </h3>
            <p className="text-xs text-rose-700/80 font-medium">
              Customers experiencing the steepest decline in revenue compared to previous year.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {atRisk.map((c, idx) => {
          const pctDrop = c.lastYearRevenue > 0 
            ? Math.min(100, Math.abs((c.variance / c.lastYearRevenue) * 100))
            : 100;
          
          return (
            <div 
              key={idx} 
              className="bg-rose-50/40 rounded-xl p-3.5 border border-rose-100/90 flex items-center justify-between hover:border-rose-200 transition-colors"
            >
              <div className="min-w-0 pr-2">
                <h4 className="font-bold text-slate-900 text-sm truncate" title={c.companyName}>
                  {c.companyName}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[9px] font-bold py-0 px-1.5 bg-white text-slate-500 border-rose-200/60">
                    {c.managerName || 'Unassigned'}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    LY: {formatEAV(c.lastYearRevenue)}
                  </span>
                </div>
              </div>

              <div className="text-right flex flex-col items-end shrink-0">
                <span className="font-black text-rose-600 text-sm">
                  -{formatCurrency(Math.abs(c.variance))}
                </span>
                <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded mt-0.5">
                  ↓ {pctDrop.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}

        {atRisk.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-400 font-medium text-sm">
            No severe at-risk revenue decline detected.
          </div>
        )}
      </div>
    </div>
  );
}

