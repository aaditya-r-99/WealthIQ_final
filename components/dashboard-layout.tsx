'use client';

import { SidebarProvider, useSidebar } from '@/components/sidebar-context';
import { Sidebar } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

function DashboardLayoutInner({ children, className }: DashboardLayoutProps) {
  const { collapsed, setMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main
          className={cn(
            'w-full max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8 xl:px-10',
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <DashboardLayoutInner {...props} />
      </SidebarProvider>
    </ProtectedRoute>
  );
}
