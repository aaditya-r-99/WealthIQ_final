'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/components/sidebar-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Wallet,
  TrendingDown,
  PiggyBank,
  CreditCard,
  LineChart,
  Landmark,
  TrendingUp,
  BarChart3,
  User,
  Settings,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
} from 'lucide-react';
import { WealthIQLogo } from '@/components/wealthiq-logo';

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Finances',
    items: [
      { href: '/income', label: 'Income', icon: Wallet },
      { href: '/expenses', label: 'Expenses', icon: TrendingDown },
      { href: '/savings', label: 'Savings', icon: PiggyBank },
      { href: '/debts', label: 'Debts', icon: CreditCard },
      { href: '/investments', label: 'Investments', icon: LineChart },
      { href: '/fd', label: 'Fixed Deposits', icon: Landmark },
    ],
  },
  {
    label: 'Planning & Insights',
    items: [
      { href: '/forecast', label: 'Forecast', icon: TrendingUp },
      { href: '/household-benchmark', label: 'Household Benchmark', icon: Scale },
      { href: '/market-insights', label: 'Market Insights', icon: BarChart3 },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen: propIsOpen, onClose: propOnClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  // Support both context-based and prop-based mobile drawer handling
  const isDrawerOpen = propIsOpen !== undefined ? propIsOpen : mobileOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    setMobileOpen(false);
  };

  const displayName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Demo User';
  const displayEmail = user?.email || 'demo@wealthiq.ai';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DU';

  return (
    <>
      {/* Mobile overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[#171A27] bg-[#0B0D14] text-slate-200 transition-all duration-300 ease-in-out',
          collapsed ? 'w-20' : 'w-64',
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Primary Navigation"
      >
        {/* Header / Brand Area */}
        <div
          className={cn(
            'flex border-b border-[#171A27] transition-all duration-300',
            collapsed
              ? 'h-20 flex-col items-center justify-center gap-1.5 px-2'
              : 'h-16 items-center justify-between px-4 sm:px-5'
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center justify-center w-full gap-1.5">
              <WealthIQLogo variant="icon" size="sm" theme="dark" href="/dashboard" />
              <button
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white transition-all shadow-sm"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <WealthIQLogo variant="full" size="md" theme="dark" href="/dashboard" />
              <div className="flex items-center gap-1">
                {/* Desktop Collapse Button */}
                <button
                  onClick={toggleCollapsed}
                  className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors lg:flex items-center justify-center"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
                {/* Mobile Drawer Close Button */}
                <button
                  onClick={handleClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white lg:hidden flex items-center justify-center"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onClick={handleClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer / User Profile Area */}
        <div className={cn('border-t border-[#171A27] transition-all duration-300', collapsed ? 'p-2' : 'p-4')}>
          {collapsed ? (
            <div
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-bold text-white transition-colors hover:bg-white/[0.08] cursor-pointer"
              title={`${displayName} (${displayEmail})`}
            >
              {initials}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.06]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-xs font-bold text-white">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{displayEmail}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onClick,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/');

  if (collapsed) {
    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={item.label}
        aria-label={item.label}
        className={cn(
          'group flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all duration-150',
          isActive
            ? 'bg-white text-black font-semibold shadow-sm'
            : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-black' : 'text-slate-400 group-hover:text-white')} />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-white text-black font-semibold shadow-sm'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-black' : 'text-slate-500 group-hover:text-slate-300'
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}
