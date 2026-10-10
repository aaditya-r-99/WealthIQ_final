'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getScoreColor, getHealthCategoryBg } from '@/lib/format';
import type { HealthCategory } from '@/lib/types';

interface HealthScoreCardProps {
  score: number;
  category: HealthCategory;
  className?: string;
}

export function HealthScoreCard({ score, category, className }: HealthScoreCardProps) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Financial Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="relative flex items-center justify-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                'transition-all duration-1000 ease-out',
                score >= 75 && 'stroke-success',
                score >= 60 && score < 75 && 'stroke-warning',
                score >= 40 && score < 60 && 'stroke-warning',
                score < 40 && 'stroke-danger'
              )}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={cn('text-4xl font-bold', getScoreColor(score))}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-semibold',
              getHealthCategoryBg(category)
            )}
          >
            {category}
          </span>
          <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
            {getCategoryInterpretation(category)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function getCategoryInterpretation(category: HealthCategory): string {
  switch (category) {
    case 'Excellent':
      return 'Exceptional resilience across savings, debt obligations, and accumulated assets.';
    case 'Healthy':
      return 'Solid financial foundation with sustainable living expenses and healthy cash surplus.';
    case 'Moderate':
      return 'Balanced foundation; prioritize building emergency runway and lowering obligations.';
    case 'Weak':
      return 'High expense or debt burden; targeted budgeting adjustments recommended.';
    case 'Critical':
      return 'Elevated debt obligations and cash deficit requiring immediate attention.';
    default:
      return 'Comprehensive evaluation across savings, expenses, debt, emergency fund, and assets.';
  }
}
