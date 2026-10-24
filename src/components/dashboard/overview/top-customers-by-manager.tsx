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
    <div className="bg-card rounded-2xl shadow-xs border border-border p-4 sm:p-6 print:shadow-none print:border-none print:p-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-accent/10 text-accent rounded-lg">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-foreground tracking-tight text-base sm:text-lg">
              Top 10 Customers per Manager
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
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
              className={`bg-secondary/35 rounded-2xl p-4 sm:p-5 border transition-all duration-200 print:bg-card print:border-border flex flex-col justify-between ${
                isExpanded ? 'border-accent/40 ring-2 ring-accent/10 bg-accent/5 shadow-sm' : 'border-border/80 hover:border-border'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-border/80 pb-3">
                  <div className="min-w-0 pr-2">
                    <h4 className="font-bold text-foreground text-sm sm:text-base truncate">{manager.user.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-xs font-bold uppercase tracking-wide py-0 px-1.5 bg-card text-muted-foreground border-border">
                        {manager.user.role?.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs font-bold text-muted-foreground">
                        Total: {formatEAV(totalBooked)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-accent/10 text-primary rounded-xl shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="space-y-1.5 mt-3">
                  {displayedCusts.map((c, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center text-xs p-1.5 rounded-lg hover:bg-card/80 transition-colors bg-white/40"
                    >
                      <span className="font-semibold text-foreground/85 truncate max-w-[150px] sm:max-w-[170px]" title={c.companyName}>
                        <span className="text-muted-foreground font-bold mr-1.5">{idx + 1}.</span>
                        {c.companyName}
                      </span>
                      <span className="font-semibold text-foreground">{formatCurrency(c.revenue)}</span>
                    </div>
                  ))}

                  {sortedCusts.length === 0 && (
                    <div className="py-6 text-center text-muted-foreground text-xs font-medium">
                      No active customer spend linked yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar: Expand & Focus View */}
              {sortedCusts.length > 4 && (
                <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(managerId)}
                    className="flex items-center gap-1 text-xs font-bold text-accent hover:text-primary transition-colors py-1 px-1 rounded-lg"
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
                    className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-1.5 rounded-lg hover:bg-border/60"
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
          <div className="col-span-full text-center py-10 text-muted-foreground font-medium">
            No team managers or customer accounts found.
          </div>
        )}
      </div>

      {/* Modal Dialog for Expanded Manager Customers */}
      {modalManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-panel/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border/60 space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div>
                  <Badge variant="outline" className="text-xs font-bold uppercase py-0 px-2 bg-accent/10 text-primary border-accent/25">
                    {modalManager.user.role?.replace('_', ' ')}
                  </Badge>
                  <h3 className="font-black tabular-nums text-foreground text-xl mt-1">{modalManager.user.name}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Total Booked: <strong className="text-foreground">{formatCurrency(modalManager.customers.reduce((s, c) => s + c.revenue, 0))}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setModalManager(null)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground/85 hover:bg-secondary transition-colors"
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
                      className="flex justify-between items-center text-xs sm:text-sm p-2.5 rounded-xl bg-secondary/60 border border-border/60 hover:bg-secondary/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-full bg-border text-foreground/85 font-semibold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-foreground truncate" title={c.companyName}>
                          {c.companyName}
                        </span>
                      </div>
                      <span className="font-semibold text-primary shrink-0">{formatCurrency(c.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border/60">
              <Button 
                onClick={() => setModalManager(null)} 
                className="w-full bg-panel text-panel-foreground font-bold h-11 rounded-xl"
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


