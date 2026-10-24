"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Audience, type DashboardWidgetConfig, type WidgetId, visibleWidgets, widgetMeta, widgetSpanClass,
} from '@/lib/dashboard-layout';
import { WidgetContextProvider, type WidgetContextValue } from './widget-context';
import {
  AmbdNotesDashboardWidget, CallPlansWidget, CanvassingWidget, CrmSummaryDashboardWidget, CustomerReviewDashboardWidget,
  FactFindingWidget, FuelWidget, KpiPipelineWidget, PipelineReviewDashboardWidget, TeamSnapshotWidget, TodayWidget,
  VerticalsWidget, WeeklyRhythmWidget,
} from './dashboard-widgets';

/** Single registry: widget id -> component. Used by the dashboards and the designer preview. */
export const WIDGET_COMPONENTS: Record<WidgetId, React.ComponentType> = {
  'today': TodayWidget,
  'kpi-pipeline': KpiPipelineWidget,
  'weekly-rhythm': WeeklyRhythmWidget,
  'verticals': VerticalsWidget,
  'fuel': FuelWidget,
  'fact-finding': FactFindingWidget,
  'canvassing': CanvassingWidget,
  'call-plans': CallPlansWidget,
  'ambd-notes': AmbdNotesDashboardWidget,
  'team-snapshot': TeamSnapshotWidget,
  'crm-summary': CrmSummaryDashboardWidget,
  'customer-review': CustomerReviewDashboardWidget,
  'pipeline-review': PipelineReviewDashboardWidget,
};

export type GridMode = 'responsive' | 'desktop' | 'mobile';

interface Props {
  layout: DashboardWidgetConfig[];
  context: WidgetContextValue;
  /** responsive = Tailwind breakpoints (live dashboards); desktop/mobile = forced columns (designer preview). */
  mode?: GridMode;
  /** Sticky quick-jump bar above the grid (live dashboards only). */
  anchors?: boolean;
  /** Allow collapsing a widget (live dashboards only). */
  collapsible?: boolean;
}

export function DashboardWidgetGrid({ layout, context, mode = 'responsive', anchors = false, collapsible = false }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const items = visibleWidgets(layout, context.audience).filter(w => WIDGET_COMPONENTS[w.id as WidgetId]);

  const jump = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: false }));
    setTimeout(() => {
      const el = document.getElementById(`widget-${id}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 160, behavior: 'smooth' });
    }, 100);
  };

  const forcedCols = mode === 'desktop' ? 3 : mode === 'mobile' ? 1 : 0;

  return (
    <WidgetContextProvider value={context}>
      <div className="space-y-6">
        {anchors && items.length > 1 && (
          <div className="bg-card border p-1 rounded-xl shadow-sm flex w-full overflow-x-auto scrollbar-hide sticky top-16 z-20 max-w-full">
            {items.map(w => (
              <button
                key={w.id}
                onClick={() => jump(w.id)}
                className="flex-1 text-center rounded-lg px-4 py-2.5 font-semibold text-xs md:text-xs text-muted-foreground hover:bg-muted hover:text-primary transition-all whitespace-nowrap"
              >
                {widgetMeta(w.id)?.title}
              </button>
            ))}
          </div>
        )}

        <div
          className={cn('grid gap-6', forcedCols === 0 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3')}
          style={forcedCols ? { gridTemplateColumns: `repeat(${forcedCols}, minmax(0, 1fr))` } : undefined}
        >
          {items.map(w => {
            const Body = WIDGET_COMPONENTS[w.id as WidgetId];
            const isCollapsed = collapsible && !!collapsed[w.id];
            return (
              <section
                key={w.id}
                id={context.preview ? undefined : `widget-${w.id}`}
                data-widget={w.id}
                className={cn(
                  forcedCols === 0 && widgetSpanClass(w.width),
                  'flex flex-col gap-3 border border-border bg-card rounded-3xl p-4 md:p-5 shadow-sm scroll-mt-40 h-fit min-w-0 overflow-hidden',
                )}
                style={forcedCols > 1 ? { gridColumn: `span ${Math.min(w.width, forcedCols)} / span ${Math.min(w.width, forcedCols)}` } : undefined}
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <h3 className="text-xs font-bold text-foreground truncate">{widgetMeta(w.id)?.title}</h3>
                  </div>
                  {collapsible && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setCollapsed(prev => ({ ...prev, [w.id]: !prev[w.id] }))}
                      className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-primary gap-1"
                    >
                      {isCollapsed ? <>Show <ChevronDown className="w-3.5 h-3.5 text-accent" /></> : <>Hide <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /></>}
                    </Button>
                  )}
                </div>
                {!isCollapsed && <div className="min-w-0"><Body /></div>}
              </section>
            );
          })}
        </div>
      </div>
    </WidgetContextProvider>
  );
}
