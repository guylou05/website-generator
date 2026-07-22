'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  FilePlus2,
  FolderKanban,
  Grid2X2,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Logo } from './logo';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/new', label: 'New website', icon: FilePlus2 },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/templates', label: 'Templates', icon: Grid2X2 },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem('theme') === 'dark';
    setDark(value);
    document.documentElement.classList.toggle('dark', value);
  }, []);
  const toggleTheme = () => {
    const value = !dark;
    setDark(value);
    localStorage.setItem('theme', value ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', value);
  };
  return (
    <div className="bg-background min-h-screen">
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          'bg-card fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r px-3 py-5 transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Logo />
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const active =
              item.href === '/dashboard'
                ? path === item.href
                : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1">
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
              path.includes('settings')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <div className="bg-muted/60 mt-4 rounded-xl border p-3">
            <p className="text-xs font-medium">Starter plan</p>
            <div className="bg-border my-2 h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-2/3 rounded-full" />
            </div>
            <p className="text-muted-foreground text-xs">
              3 of 5 websites used
            </p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="bg-background/85 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <input
              aria-label="Search"
              className="field py-2 pl-9"
              placeholder="Search projects..."
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="text-muted-foreground hover:bg-muted rounded-lg p-2"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              aria-label="Notifications"
              className="text-muted-foreground hover:bg-muted relative rounded-lg p-2"
            >
              <Bell className="size-4" />
              <span className="bg-primary absolute right-1.5 top-1.5 size-1.5 rounded-full" />
            </button>
            <div className="ml-2 flex items-center gap-2 border-l pl-3">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
                AM
              </span>
              <span className="hidden text-sm font-medium sm:block">
                Alex Morgan
              </span>
              <ChevronDown className="text-muted-foreground hidden size-3.5 sm:block" />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
