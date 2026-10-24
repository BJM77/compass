import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  status?: 'ON_TRACK' | 'RECOVERING' | 'AT_RISK';
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

export function KPICard({ title, value, subtitle, status, icon, info, className, onClick }: KPICardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden border-none shadow-md transition-all h-full flex flex-col", 
        onClick && "cursor-pointer hover:shadow-xl active:scale-[0.98] group",
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
                <Info className="w-2 h-2 md:w-2.5 md:h-2.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
              </CardTitle>
            </TooltipTrigger>
            {info && (
              <TooltipContent side="top" className="bg-primary text-primary-foreground border-none p-2 md:p-3 max-w-[180px] md:max-w-[200px] rounded-xl shadow-2xl">
                <p className="text-xs font-bold leading-relaxed">{info}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="text-muted-foreground shrink-0 opacity-50">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0 md:pt-0 flex-1 flex flex-col justify-end">
        <div className="text-base md:text-2xl font-extrabold font-headline tracking-tighter text-primary truncate">{value}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5 font-bold tracking-tight truncate">
            {subtitle}
          </div>
        )}
        {status && (
          <div className="mt-2 md:mt-3 overflow-hidden">
            <Badge className={cn("font-semibold text-xs border-none px-1.5 h-4 md:h-5", statusMap[status].color)} variant="secondary">
              {statusMap[status].label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}