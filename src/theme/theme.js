const STORAGE_KEY = 'erp.theme';
const LEGACY_USER_PREFIX = `${STORAGE_KEY}.user.`;

export function normalizeTheme(value) {
  const stored = String(value || '').trim().toLowerCase();
  if (stored === 'dark' || stored === 'night') return 'dark';
  if (stored === 'light' || stored === 'day') return 'light';
  return null;
}

function readTheme(key) {
  if (!key) return null;
  try {
    return normalizeTheme(localStorage.getItem(key));
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

function clearLegacyUserThemes() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_USER_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function getStoredTheme() {
  return readTheme(STORAGE_KEY) || 'light';
}

export function applyTheme(theme, { persist = true } = {}) {
  const next = normalizeTheme(theme) === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  if (!persist) {
    return next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
    clearLegacyUserThemes();
  } catch {
    // ignore
  }
  return next;
}
