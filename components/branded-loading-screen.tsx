'use client';

import { WealthIQIcon } from '@/components/wealthiq-logo';
import { cn } from '@/lib/utils';

interface BrandedLoadingScreenProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export function BrandedLoadingScreen({
  message = 'Loading your financial dashboard...',
  className,
  fullScreen = false,
}: BrandedLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center p-6 select-none',
        fullScreen ? 'fixed inset-0 z-50 min-h-screen bg-background/95 backdrop-blur-sm' : 'py-14',
        className
      )}
    >
      <div className="relative mb-5 flex items-center justify-center">
        {/* Subtle breathing glow */}
        <div className="absolute -inset-2 rounded-2xl bg-slate-300/30 blur-md animate-pulse dark:bg-slate-700/30" />
        <div className="relative transform transition-transform duration-500 hover:scale-105">
          <WealthIQIcon size={56} className="shadow-md shadow-black/10" />
        </div>
      </div>

      <div className="space-y-1 mb-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Wealth<span className="text-primary">IQ</span>
        </h2>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Personal Finance & Analytics
        </p>
      </div>

      {/* Small subtle loading bar indicator */}
      <div className="w-36 h-1 bg-muted rounded-full overflow-hidden mb-3.5">
        <div
          className="h-full w-full bg-foreground/80 rounded-full animate-pulse"
          style={{
            animationDuration: '1.4s',
          }}
        />
      </div>

      <p className="text-xs font-medium text-muted-foreground tracking-wide">
        {message}
      </p>
    </div>
  );
}
