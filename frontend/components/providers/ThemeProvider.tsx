'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTradingStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--toast-bg', '#1a1a1a');
      root.style.setProperty('--toast-color', '#ffffff');
      root.style.setProperty('--toast-border', '#333333');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--toast-bg', '#ffffff');
      root.style.setProperty('--toast-color', '#000000');
      root.style.setProperty('--toast-border', '#e5e5e5');
    }
  }, [theme]);

  return <>{children}</>;
}
