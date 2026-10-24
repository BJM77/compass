import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface KPITrend {
  /** Change value, e.g. 12 for +12%. Sign decides the arrow. */
  value: number;
  /** Suffix shown after the number. Defaults to "%". */
  suffix?: string;
  /** Optional label, e.g. "vs last week". */
  label?: string;
  /** Set when a decrease is good (e.g. overdue tasks). */
  invert?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  status?: 'ON_TRACK' | 'RECOVERING' | 'AT_RISK';
  trend?: KPITrend;
  icon?: React.ReactNode;
  info?: string;
  className?: string;
  onClick?: () => void;
}

const statusMap = {
  ON_TRACK: { label: 'On Track', color: 'bg-success-soft text-success-ink' },
  RECOVERING: { label: 'Recovering', color: 'bg-warning-soft text-warning-ink' },
  AT_RISK: { label: 'At Risk', color: 'bg-danger-soft text-destructive' },
};

function TrendChip({ trend }: { trend: KPITrend }) {
  const { value, suffix = '%', label, invert } = trend;
  const flat = value === 0;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? 'bg-muted text-muted-foreground'
    : good
      ? 'bg-success-soft text-success-ink'
      : 'bg-danger-soft text-destructive';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums', tone)}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {value > 0 ? '+' : ''}{value}{suffix}
      </span>
      {label && <span className="truncate">{label}</span>}
    </span>
  );
}

export function KPICard({ title, value, subtitle, status, trend, icon, info, className, onClick }: KPICardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/60 shadow-card transition-all duration-200 h-full flex flex-col",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] group focus-within:ring-2 focus-within:ring-ring",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1 cursor-help truncate overflow-hidden">
                <span className="truncate">{title}</span>
                {info && <Info className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />}
              </CardTitle>
            </TooltipTrigger>
            {info && (
              <TooltipContent side="top" className="bg-panel text-panel-foreground border-none p-2 md:p-3 max-w-[200px] rounded-xl shadow-lg">
                <p className="text-xs font-medium leading-relaxed">{info}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="text-muted-foreground shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0 md:pt-0 flex-1 flex flex-col justify-end gap-1">
        <div className="text-xl md:text-2xl font-black font-headline tracking-tight tabular-nums text-primary truncate">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground font-medium truncate">
            {subtitle}
          </div>
        )}
        {(trend || status) && (
          <div className="mt-1 md:mt-2 flex flex-wrap items-center gap-2 overflow-hidden">
            {trend && <TrendChip trend={trend} />}
            {status && (
              <Badge className={cn("font-semibold text-xs border-none px-2 h-5", statusMap[status].color)} variant="secondary">
                {statusMap[status].label}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
