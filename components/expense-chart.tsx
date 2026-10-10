'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import type { ExpenseChartData } from '@/lib/types';
import { formatCurrency, formatCompactINR } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ExpenseChartProps {
  data: ExpenseChartData[];
  type?: 'bar' | 'pie';
  className?: string;
}

const essentialColor = 'hsl(var(--chart-1))';
const discretionaryColor = 'hsl(var(--chart-3))';

export function ExpenseChart({ data, type = 'bar', className }: ExpenseChartProps) {
  if (type === 'pie') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.type === 'essential' ? essentialColor : discretionaryColor}
                />
              ))}
            </Pie>
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
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 12, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="category"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={60}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
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
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.type === 'essential' ? essentialColor : discretionaryColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
