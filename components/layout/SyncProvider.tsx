'use client';

import { useEffect } from 'react';
import { pullSync } from '@/lib/db/sync';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Pull sync on initial load
    pullSync();

    // Pull sync periodically (every 5 minutes)
    const interval = setInterval(pullSync, 5 * 60 * 1000);

    // Pull sync on window focus
    const onFocus = () => pullSync();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return <>{children}</>;
}
