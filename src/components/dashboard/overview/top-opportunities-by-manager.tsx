"use client";

import React, { useState } from 'react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { Briefcase, Activity, Sparkles, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { UserProfile } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ManagerOpportunityData {
  user: UserProfile;
  opportunities: { opportunityName: string; companyName: string; value: number; probability: number }[];
}

export function TopOpportunitiesByManager({ data }: { data: ManagerOpportunityData[] }) {
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [modalManager, setModalManager] = useState<ManagerOpportunityData | null>(null);

  // Sort managers by total pipeline value to show top performers first
  const sortedManagers = [...data].sort((a, b) => {
    const sumA = a.opportunities.reduce((acc, curr) => acc + curr.value, 0);
    const sumB = b.opportunities.reduce((acc, curr) => acc + curr.value, 0);
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
          <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-black text-slate-900 tracking-tight text-base sm:text-lg uppercase">
              Top 10 Opportunities per Manager
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Active high-value pipeline deals grouped by Account Manager and BDM.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {sortedManagers.map((manager) => {
          const sortedOpps = [...manager.opportunities].sort((a, b) => b.value - a.value);
          const managerId = manager.user.uid || (manager.user as any).id || manager.user.name;
          const isExpanded = expandedManagers.has(managerId);

          const displayedOpps = isExpanded ? sortedOpps.slice(0, 10) : sortedOpps.slice(0, 4);
          const totalPipeline = manager.opportunities.reduce((sum, opp) => sum + opp.value, 0);

          return (
            <div 
              key={managerId} 
              className={`bg-slate-50/60 rounded-2xl p-4 sm:p-5 border transition-all duration-200 print:bg-white print:border-slate-300 flex flex-col justify-between ${
                isExpanded ? 'border-emerald-300 ring-2 ring-emerald-500/10 bg-emerald-50/20 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'
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
                        Pipeline: {formatEAV(totalPipeline)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-100/70 text-emerald-700 rounded-xl shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="space-y-2 mt-3">
                  {displayedOpps.map((opp, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-start text-xs p-2 rounded-lg bg-white/60 hover:bg-white transition-colors border border-slate-100"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-slate-850 truncate" title={opp.opportunityName}>
                          <span className="text-slate-400 font-bold mr-1">{idx + 1}.</span>
                          {opp.opportunityName || opp.companyName || 'Unnamed Deal'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 truncate" title={opp.companyName}>
                          {opp.companyName}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-black text-indigo-700">{formatCurrency(opp.value)}</span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 mt-0.5">
                          {opp.probability}% Win
                        </span>
                      </div>
                    </div>
                  ))}

                  {sortedOpps.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs font-medium">
                      No active pipeline opportunities.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar: Expand & Focus View */}
              {sortedOpps.length > 4 && (
                <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(managerId)}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors py-1 px-1 rounded-lg"
                  >
                    {isExpanded ? (
                      <>
                        <span>Show Less</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Expand All ({sortedOpps.slice(0, 10).length} deals)</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalManager(manager)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-200/60"
                    title="View full pipeline list"
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
            No opportunity data by manager available.
          </div>
        )}
      </div>

      {/* Modal Dialog for Expanded Manager Opportunities */}
      {modalManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 bg-emerald-50 text-emerald-700 border-emerald-200">
                    {modalManager.user.role?.replace('_', ' ')}
                  </Badge>
                  <h3 className="font-black text-slate-900 text-xl mt-1">{modalManager.user.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Total Pipeline: <strong className="text-emerald-700">{formatCurrency(modalManager.opportunities.reduce((s, o) => s + o.value, 0))}</strong>
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
                {[...modalManager.opportunities]
                  .sort((a, b) => b.value - a.value)
                  .map((opp, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-start text-xs sm:text-sm p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-slate-900 truncate">
                          <span className="text-slate-400 font-bold mr-1.5">{idx + 1}.</span>
                          {opp.opportunityName || opp.companyName}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 mt-0.5">
                          {opp.companyName}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-black text-indigo-700">{formatCurrency(opp.value)}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 mt-0.5">
                          {opp.probability}% Win Probability
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Button 
                onClick={() => setModalManager(null)} 
                className="w-full bg-slate-900 text-white font-bold h-11 rounded-xl"
              >
                Close Deals View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


