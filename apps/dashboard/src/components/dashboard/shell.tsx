'use client';

import { Bell, Menu, Search } from 'lucide-react';
import { useState } from 'react';
import { Sidebar } from './sidebar';
import { ThemeToggle } from './theme-toggle';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="search-box">
            <Search size={16} />
            <span>Search projects…</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="icon-button" aria-label="Notifications">
              <Bell size={17} />
              <span className="notification-dot" />
            </button>
            <div className="avatar">AL</div>
          </div>
        </header>
        <main className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
