import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResponsiveCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export function ResponsiveCard({
  title,
  children,
  className,
  headerClassName,
  contentClassName,
  variant = 'default',
}: ResponsiveCardProps) {
  const paddingClasses = {
    default: 'p-4 md:p-6',
    compact: 'p-3 md:p-4',
    minimal: 'p-2 md:p-3',
  };

  return (
    <Card className={cn(
      "border-none shadow-md bg-white overflow-hidden h-full",
      className
    )}>
      <CardHeader className={cn(
        "border-b border-slate-100",
        variant === 'minimal' ? 'py-2 px-3 md:py-3 md:px-4' : 'py-3 px-4 md:py-4 md:px-6',
        headerClassName
      )}>
        <CardTitle className={cn(
          "font-black uppercase tracking-tight",
          variant === 'minimal' ? 'text-xs md:text-sm' : 'text-sm md:text-base lg:text-lg'
        )}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(
        paddingClasses[variant],
        contentClassName
      )}>
        {children}
      </CardContent>
    </Card>
  );
}
