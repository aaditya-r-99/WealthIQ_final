'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { ForecastPoint } from '@/lib/types';
import { formatCurrency, formatCompactINR } from '@/lib/format';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForecastChartProps {
  data: ForecastPoint[];
  className?: string;
}

export function ForecastChart({ data, className }: ForecastChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center',
          className
        )}
      >
        <TrendingUp className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">Insufficient financial history for forecast</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
          Add your monthly income, expense, and asset records to generate your 36-month net worth trajectory.
        </p>
      </div>
    );
  }

  const lastHistoricalMonth = [...data]
    .reverse()
    .find((d) => !d.isForecast)?.month;

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={310}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 16, left: 16, bottom: 4 }}
        >
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={65}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatCompactINR}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'hsl(var(--card-foreground))',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          {lastHistoricalMonth && (
            <ReferenceLine
              x={lastHistoricalMonth}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={({ viewBox }: any) => {
                if (!viewBox) return <g />;
                return (
                  <text
                    x={(viewBox.x ?? 0) + 8}
                    y={(viewBox.y ?? 0) + 12}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={11}
                    textAnchor="start"
                    className="font-medium"
                  >
                    Forecast →
                  </text>
                );
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="net_worth"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2.5}
            fill="url(#netWorthGradient)"
            dot={{ fill: 'hsl(var(--chart-1))', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
