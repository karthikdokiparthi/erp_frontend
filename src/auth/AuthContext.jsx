import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../api/client';
import { getStoredTheme } from '../theme/theme';
import { authorizeUrl, createPkce } from '../utils/pkce';

const AuthContext = createContext(null);
const PKCE_KEY = 'erp.pkce';
const inflightCallbacks = new Map();

function readPkce() {
  return localStorage.getItem(PKCE_KEY) || sessionStorage.getItem(PKCE_KEY);
}

function writePkce(value) {
  const json = JSON.stringify(value);
  sessionStorage.setItem(PKCE_KEY, json);
  localStorage.setItem(PKCE_KEY, json);
}

function clearPkce() {
  sessionStorage.removeItem(PKCE_KEY);
  localStorage.removeItem(PKCE_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    try {
      const me = await api('/api/me', { signal: controller.signal });
      setUser(me);
      return me;
    } catch (error) {
      setUser(null);
      if (error.status !== 401 && error.name !== 'AbortError') {
        throw error;
      }
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const startLogin = useCallback(async () => {
    const origin = window.location.origin;
    const config = await api(`/api/auth/config?origin=${encodeURIComponent(origin)}`);
    const pkce = await createPkce();
    const redirectUri = config.redirectUri;
    writePkce({ ...pkce, redirectUri, clientId: config.clientId });
    await api('/api/auth/pkce', {
      method: 'POST',
      body: JSON.stringify({
        verifier: pkce.verifier,
        state: pkce.state,
        redirectUri,
      }),
    });
    window.location.assign(
      authorizeUrl({
        issuer: config.issuer,
        clientId: config.clientId,
        redirectUri,
        scopes: config.scopes,
        state: pkce.state,
        challenge: pkce.challenge,
        theme: getStoredTheme(),
      })
    );
  }, []);

  const completeLogin = useCallback(async ({ code, state }) => {
    if (!code) {
      throw new Error('Missing authorization code. Start again from BrightGrid ERP.');
    }
    const existing = inflightCallbacks.get(code);
    if (existing) {
      return existing;
    }

    const run = (async () => {
      try {
        const raw = readPkce();
        const stored = raw ? JSON.parse(raw) : {};
        if (stored.state && state && stored.state !== state) {
          throw new Error('Sign-in state did not match. Start again from BrightGrid ERP.');
        }
        const me = await api('/api/auth/callback', {
          method: 'POST',
          body: JSON.stringify({
            code,
            state,
            codeVerifier: stored.verifier,
            redirectUri: stored.redirectUri,
          }),
        });
        clearPkce();
        setUser(me);
        return me;
      } catch (error) {
        try {
          const me = await api('/api/me');
          if (me) {
            clearPkce();
            setUser(me);
            return me;
          }
        } catch {
          // first attempt did not create a session
        }
        throw error;
      }
    })();

    inflightCallbacks.set(code, run);
    try {
      return await run;
    } finally {
      inflightCallbacks.delete(code);
    }
  }, []);

  const logout = useCallback(async () => {
    clearPkce();
    try {
      // Must match CCIDP erp-hr post_logout_redirect_uris (origin root).
      const result = await api(
        `/api/auth/logout?origin=${encodeURIComponent(window.location.origin)}&postLogoutRedirectUri=${encodeURIComponent(`${window.location.origin}/`)}`,
        { method: 'POST' }
      );
      setUser(null);
      if (result?.endSessionUrl) {
        window.location.assign(result.endSessionUrl);
        return;
      }
    } catch {
      setUser(null);
    }
    window.location.assign('/login');
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      startLogin,
      completeLogin,
      logout,
      extractError,
    }),
    [user, ready, startLogin, completeLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { extractError };
