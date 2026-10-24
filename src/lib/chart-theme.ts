/**
 * Shared recharts styling so every on-screen chart uses the same tokens for
 * series colours, gridlines, axes, tooltips and legends (light + dark aware).
 *
 * NOTE: PDF/html2canvas export pages keep literal hex colours, because CSS
 * variables inside serialised SVG are not resolved by html2canvas.
 */
import type { CSSProperties } from 'react';

export const chartColor = (n: 1 | 2 | 3 | 4 | 5 | 6) => `hsl(var(--chart-${n}))`;

/** Ordered categorical palette: navy, teal, orange, green, indigo, slate. */
export const CHART_PALETTE = [1, 2, 3, 4, 5, 6].map((n) => chartColor(n as 1)) as string[];

export const CHART_SEMANTIC = {
  primary: 'hsl(var(--chart-1))',
  accent: 'hsl(var(--accent))',
  success: 'hsl(var(--success-fill))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--chart-6))',
} as const;

export const chartGridProps = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: 'hsl(var(--border))',
} as const;

export const chartAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
} as const;

export const chartTooltipProps = {
  cursor: { fill: 'hsl(var(--muted))', opacity: 0.6 },
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    boxShadow: '0 8px 24px -12px rgb(11 37 69 / 0.25)',
    color: 'hsl(var(--popover-foreground))',
    fontSize: 12,
    padding: '8px 12px',
  } as CSSProperties,
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 } as CSSProperties,
  itemStyle: { color: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' } as CSSProperties,
} as const;

export const chartLegendProps = {
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: 'hsl(var(--muted-foreground))', paddingTop: 8 } as CSSProperties,
};
