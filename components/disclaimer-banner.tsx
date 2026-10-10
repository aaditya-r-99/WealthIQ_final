'use client';

import { cn } from '@/lib/utils';
import { Info, X } from 'lucide-react';
import { useState } from 'react';

interface DisclaimerBannerProps {
  text?: string;
  className?: string;
  dismissible?: boolean;
}

const defaultText =
  'WealthIQ is an educational AI project for a college course. It is not professional financial advice. All calculations, forecasts, and classifications are for learning purposes only.';

export function DisclaimerBanner({
  text = defaultText,
  className,
  dismissible = true,
}: DisclaimerBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3',
        className
      )}
    >
      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/80 leading-relaxed flex-1">
        {text}
      </p>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
