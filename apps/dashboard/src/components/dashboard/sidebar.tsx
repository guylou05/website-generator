'use client';

import { cn } from '@/lib/utils';
import {
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Plus,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside className={cn('sidebar', open && 'sidebar-open')}>
        <div className="brand-row">
          <span className="brand-mark">
            <Sparkles size={16} />
          </span>
          <span>Foundry</span>
          <button
            className="icon-button ml-auto md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <Link
          href="/dashboard/new"
          className="button button-primary sidebar-create"
          onClick={onClose}
        >
          <Plus size={16} /> New website
        </Link>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn('nav-item', active && 'nav-item-active')}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="usage-row">
            <span>Monthly generation</span>
            <span>7 / 20</span>
          </div>
          <div className="usage-track">
            <span />
          </div>
          <button className="button button-secondary w-full">
            Upgrade plan
          </button>
        </div>
      </aside>
    </>
  );
}
