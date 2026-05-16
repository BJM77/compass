
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
    { name: "Prospecting", value: data.prospecting, color: "#94a3b8" },
    { name: "Discovery", value: data.discovery, color: "#64748b" },
    { name: "Proposal", value: data.proposal, color: "#475569" },
    { name: "Closed Won", value: data.closed, color: "#2563eb" },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pipeline Velocity</CardTitle>
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
                fontSize={10} 
                fontWeight="bold" 
                axisLine={false} 
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border p-2 rounded shadow-sm text-xs">
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
