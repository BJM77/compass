"use client";

import React, { useState } from 'react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { Users, Banknote, Building2, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { UserProfile } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ManagerCustomerData {
  user: UserProfile;
  customers: { companyName: string; revenue: number }[];
}

export function TopCustomersByManager({ data }: { data: ManagerCustomerData[] }) {
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [modalManager, setModalManager] = useState<ManagerCustomerData | null>(null);

  // Sort managers by total revenue of their top customers to show top performers first
  const sortedManagers = [...data].sort((a, b) => {
    const sumA = a.customers.reduce((acc, curr) => acc + curr.revenue, 0);
    const sumB = b.customers.reduce((acc, curr) => acc + curr.revenue, 0);
    return sumB - sumA;
  });

  const toggleExpand = (id: string) => {
    setExpandedManagers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 print:shadow-none print:border-none print:p-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-black text-slate-900 tracking-tight text-base sm:text-lg uppercase">
              Top 10 Customers per Manager
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Top spending customer accounts attributed to each Account Manager and BDM.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {sortedManagers.map((manager) => {
          const sortedCusts = [...manager.customers].sort((a, b) => b.revenue - a.revenue);
          const managerId = manager.user.uid || (manager.user as any).id || manager.user.name;
          const isExpanded = expandedManagers.has(managerId);
          
          // Show 4 by default on mobile/compact, or all 10 when expanded
          const displayedCusts = isExpanded ? sortedCusts.slice(0, 10) : sortedCusts.slice(0, 4);
          const totalBooked = manager.customers.reduce((sum, c) => sum + c.revenue, 0);

          return (
            <div 
              key={managerId} 
              className={`bg-slate-50/60 rounded-2xl p-4 sm:p-5 border transition-all duration-200 print:bg-white print:border-slate-300 flex flex-col justify-between ${
                isExpanded ? 'border-indigo-300 ring-2 ring-indigo-500/10 bg-indigo-50/20 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-200/80 pb-3">
                  <div className="min-w-0 pr-2">
                    <h4 className="font-black text-slate-900 text-sm sm:text-base truncate">{manager.user.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 bg-white text-slate-500 border-slate-200">
                        {manager.user.role?.replace('_', ' ')}
                      </Badge>
                      <span className="text-[11px] font-bold text-slate-500">
                        Total: {formatEAV(totalBooked)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-indigo-100/70 text-indigo-700 rounded-xl shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="space-y-1.5 mt-3">
                  {displayedCusts.map((c, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center text-xs p-1.5 rounded-lg hover:bg-white/80 transition-colors bg-white/40"
                    >
                      <span className="font-semibold text-slate-700 truncate max-w-[150px] sm:max-w-[170px]" title={c.companyName}>
                        <span className="text-slate-400 font-bold mr-1.5">{idx + 1}.</span>
                        {c.companyName}
                      </span>
                      <span className="font-black text-slate-900">{formatCurrency(c.revenue)}</span>
                    </div>
                  ))}

                  {sortedCusts.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs font-medium">
                      No active customer spend linked yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar: Expand & Focus View */}
              {sortedCusts.length > 4 && (
                <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(managerId)}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors py-1 px-1 rounded-lg"
                  >
                    {isExpanded ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Expand All ({sortedCusts.slice(0, 10).length} accounts)</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalManager(manager)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-200/60"
                    title="View full account list"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {sortedManagers.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-400 font-medium">
            No team managers or customer accounts found.
          </div>
        )}
      </div>

      {/* Modal Dialog for Expanded Manager Customers */}
      {modalManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 bg-indigo-50 text-indigo-700 border-indigo-200">
                    {modalManager.user.role?.replace('_', ' ')}
                  </Badge>
                  <h3 className="font-black text-slate-900 text-xl mt-1">{modalManager.user.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Total Booked: <strong className="text-slate-800">{formatCurrency(modalManager.customers.reduce((s, c) => s + c.revenue, 0))}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setModalManager(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 mt-4 max-h-[48vh] overflow-y-auto pr-1">
                {[...modalManager.customers]
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center text-xs sm:text-sm p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 truncate" title={c.companyName}>
                          {c.companyName}
                        </span>
                      </div>
                      <span className="font-black text-indigo-700 shrink-0">{formatCurrency(c.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Button 
                onClick={() => setModalManager(null)} 
                className="w-full bg-slate-900 text-white font-bold h-11 rounded-xl"
              >
                Close List
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


