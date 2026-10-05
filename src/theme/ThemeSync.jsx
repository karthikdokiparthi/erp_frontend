import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from './ThemeContext';

export function ThemeSync() {
  const { ready } = useAuth();
  const { applyStoredTheme } = useTheme();

  useEffect(() => {
    if (!ready) {
      return;
    }
    const saved = document.documentElement.getAttribute('data-theme');
    const stored = window.localStorage.getItem('erp.theme');
    if (saved === 'light' && stored === 'light') {
      return;
    }
    if (saved === 'dark' && stored === 'dark') {
      return;
    }
    applyStoredTheme();
  }, [ready, applyStoredTheme]);

  return null;
}
