
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { chartColor, chartAxisProps } from "@/lib/chart-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelData {
  prospecting: number;
  discovery: number;
  proposal: number;
  closed: number;
}

interface PipelineFunnelProps {
  data: FunnelData;
  className?: string;
}

export function PipelineFunnel({ data, className }: PipelineFunnelProps) {
  const chartData = [
    { name: "Prospecting", value: data.prospecting, color: chartColor(6) },
    { name: "Discovery", value: data.discovery, color: chartColor(2) },
    { name: "Proposal", value: data.proposal, color: chartColor(1) },
    { name: "Closed Won", value: data.closed, color: chartColor(4) },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Pipeline Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                {...chartAxisProps}
                width={88}
              />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover text-popover-foreground border border-border px-3 py-2 rounded-xl shadow-elevated text-xs tabular-nums">
                        <span className="font-bold">${(payload[0].value as number).toLocaleString()}</span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
