'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authProvider } from '@/lib/auth-provider';
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    router = useRouter(),
    path = usePathname();
  useEffect(() => {
    authProvider
      .currentUser()
      .then(() => setReady(true))
      .catch(() => router.replace(`/login?next=${encodeURIComponent(path)}`));
  }, [path, router]);
  return ready ? (
    children
  ) : (
    <main className="grid min-h-screen place-items-center">
      Loading secure session…
    </main>
  );
}
