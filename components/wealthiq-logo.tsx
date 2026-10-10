'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface WealthIQLogoProps {
  variant?: 'icon' | 'full' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'default' | 'sidebar' | 'light' | 'dark';
  href?: string;
  animate?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    iconSize: 28,
    iconClass: 'h-7 w-7',
    titleClass: 'text-base font-bold',
    subClass: 'text-[9px] font-semibold',
    gap: 'gap-2',
  },
  md: {
    iconSize: 36,
    iconClass: 'h-9 w-9',
    titleClass: 'text-lg font-bold',
    subClass: 'text-[10px] font-semibold',
    gap: 'gap-2.5',
  },
  lg: {
    iconSize: 44,
    iconClass: 'h-11 w-11',
    titleClass: 'text-xl font-bold',
    subClass: 'text-xs font-semibold',
    gap: 'gap-3',
  },
  xl: {
    iconSize: 64,
    iconClass: 'h-16 w-16',
    titleClass: 'text-2xl font-bold',
    subClass: 'text-xs font-semibold',
    gap: 'gap-4',
  },
};

export function WealthIQIcon({
  size = 36,
  className,
  animate = false,
}: {
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0 select-none', animate && 'transition-transform duration-300 hover:scale-105', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wiq-gradient-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="wiq-gradient-stroke" x1="8" y1="12" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <filter id="wiq-subtle-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.22" floodColor="#000000" />
        </filter>
      </defs>

      {/* Rounded Squircle Container */}
      <rect
        width="40"
        height="40"
        rx="10"
        fill="url(#wiq-gradient-bg)"
        filter="url(#wiq-subtle-shadow)"
      />
      {/* Precision Inner Border */}
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />

      {/* Modern Financial Growth 'WQ' Monogram */}
      <path
        d="M 9 15 L 14 27 L 19.5 16.5 L 25 27 L 31.5 13"
        stroke="url(#wiq-gradient-stroke)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Integrated Financial Growth Arrow Head */}
      <path
        d="M 26.5 13 H 31.5 V 18"
        stroke="url(#wiq-gradient-stroke)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WealthIQLogo({
  variant = 'full',
  size = 'md',
  theme = 'default',
  href,
  animate = false,
  className,
}: WealthIQLogoProps) {
  const config = sizeConfig[size];

  const getThemeTextClass = () => {
    switch (theme) {
      case 'sidebar':
        return 'text-sidebar-foreground';
      case 'light':
        return 'text-slate-900';
      case 'dark':
        return 'text-white';
      default:
        return 'text-foreground';
    }
  };

  const getThemeSubClass = () => {
    switch (theme) {
      case 'sidebar':
        return 'text-sidebar-muted';
      case 'light':
        return 'text-slate-500';
      case 'dark':
        return 'text-slate-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getThemeHighlightClass = () => {
    switch (theme) {
      case 'sidebar':
      case 'dark':
        return 'text-white';
      case 'light':
        return 'text-slate-900 font-black';
      default:
        return 'text-foreground font-black';
    }
  };

  const content = (
    <div className={cn('inline-flex items-center', config.gap, className)}>
      <WealthIQIcon size={config.iconSize} animate={animate} />
      {variant !== 'icon' && (
        <div className="flex flex-col justify-center leading-none">
          <span className={cn('tracking-tight font-bold', config.titleClass, getThemeTextClass())}>
            Wealth<span className={getThemeHighlightClass()}>IQ</span>
          </span>
          {variant === 'full' && (
            <span
              className={cn(
                'mt-1 tracking-wider uppercase select-none font-medium',
                config.subClass,
                getThemeSubClass()
              )}
            >
              Personal Finance
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition-opacity hover:opacity-95" aria-label="WealthIQ Home">
        {content}
      </Link>
    );
  }

  return content;
}
