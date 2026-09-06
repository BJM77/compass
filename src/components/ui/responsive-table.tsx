import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResponsive } from "@/hooks/use-responsive";

interface ResponsiveTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  className?: string;
  minWidth?: string;
  mobileCardView?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
}

export function ResponsiveTable({
  headers,
  rows,
  className,
  minWidth = '600px',
  mobileCardView = true,
  emptyMessage,
  emptyIcon
}: ResponsiveTableProps) {
  const { isMobile } = useResponsive();

  // On mobile, show cards instead of table
  if (mobileCardView && isMobile) {
    return (
      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            {headers.map((header, colIdx) => (
              <div key={`${idx}-${colIdx}`} className="flex justify-between items-center border-b border-slate-100 last:border-0 py-1">
                <span className="text-xs font-black uppercase text-slate-500">{header}</span>
                <span className="text-sm font-bold text-slate-800 text-right">{row[colIdx]}</span>
              </div>
            ))}
          </div>
        ))}
        {(!rows || rows.length === 0) && emptyMessage && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            {emptyIcon && <div className="flex justify-center mb-4">{emptyIcon}</div>}
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // Desktop/Tablet: Show table with horizontal scroll
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div style={{ minWidth }}>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, idx) => (
                <TableHead key={idx} className="font-black uppercase text-xs text-slate-500">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {row.map((cell, cellIdx) => (
                  <TableCell key={cellIdx}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
            {(!rows || rows.length === 0) && emptyMessage && (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center py-20 bg-slate-50/50">
                  {emptyIcon && <div className="flex justify-center mb-4">{emptyIcon}</div>}
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
