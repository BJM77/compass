import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'ON_TRACK' | 'RECOVERING' | 'AT_RISK';
  icon?: React.ReactNode;
  info?: string;
  className?: string;
  onClick?: () => void;
}

const statusMap = {
  ON_TRACK: { label: 'On Track', color: 'bg-green-100 text-green-800' },
  RECOVERING: { label: 'Recovering', color: 'bg-yellow-100 text-yellow-800' },
  AT_RISK: { label: 'At Risk', color: 'bg-red-100 text-red-800' },
};

export function KPICard({ title, value, subtitle, status, icon, info, className, onClick }: KPICardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden border-none shadow-md transition-all h-full flex flex-col", 
        onClick && "cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-95 group",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 pb-1 md:pb-2">
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <CardTitle className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1 cursor-help truncate overflow-hidden">
                <span className="truncate">{title}</span>
                <Info className="w-2 h-2 md:w-2.5 md:h-2.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
              </CardTitle>
            </TooltipTrigger>
            {info && (
              <TooltipContent side="top" className="bg-slate-900 text-white border-none p-2 md:p-3 max-w-[180px] md:max-w-[200px] rounded-xl shadow-2xl">
                <p className="text-[9px] md:text-[10px] font-bold leading-relaxed">{info}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="text-muted-foreground shrink-0 opacity-50">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0 md:pt-0 flex-1 flex flex-col justify-end">
        <div className="text-lg md:text-2xl font-black font-headline tracking-tighter text-primary truncate">{value}</div>
        {subtitle && (
          <p className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5 font-bold uppercase tracking-tight truncate">
            {subtitle}
          </p>
        )}
        {status && (
          <div className="mt-2 md:mt-3 overflow-hidden">
            <Badge className={cn("font-black text-[7px] md:text-[9px] uppercase tracking-widest border-none px-1.5 h-4 md:h-5", statusMap[status].color)} variant="secondary">
              {statusMap[status].label}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}