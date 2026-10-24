"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { chartGridProps, chartAxisProps } from "@/lib/chart-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendData {
  week: string;
  revenue: number;
}

interface TrendChartProps {
  data: TrendData[];
  title?: string;
  className?: string;
}

export function TrendChart({ data, title = "Revenue Trends", className }: TrendChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis 
                dataKey="week" 
                {...chartAxisProps}
                tickFormatter={(val) => val.split('-')[1]} // Just show week number
              />
              <YAxis 
                {...chartAxisProps}
                tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-border bg-popover text-popover-foreground px-3 py-2 shadow-elevated tabular-nums">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              Week
                            </span>
                            <span className="font-semibold text-foreground">
                              {payload[0].payload.week}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              Revenue
                            </span>
                            <span className="font-bold">
                              ${(payload[0].value as number / 1000000).toFixed(2)}M
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--accent))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                stroke="hsl(var(--accent))"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
