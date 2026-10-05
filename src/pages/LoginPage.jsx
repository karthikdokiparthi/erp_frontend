import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { extractError, useAuth } from '../auth/AuthContext';
import { AuthCard } from '../components/AuthCard';

export function LoginPage() {
  const { user, ready, startLogin } = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fromPath = location.state?.from?.pathname;
  const from = fromPath && fromPath.startsWith('/') && fromPath !== '/login' ? fromPath : '/';

  if (ready && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSignIn() {
    setError('');
    setBusy(true);
    try {
      sessionStorage.setItem('erp.returnTo', from);
      await startLogin();
    } catch (err) {
      setError(extractError(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      lead="ERP does not store passwords. Continue to BrightGrid CCIDP with authorization code and PKCE."
    >
      {error ? <div className="form-error">{error}</div> : null}
      <button className="btn btn-primary btn-block" type="button" onClick={handleSignIn} disabled={busy}>
        {busy ? 'Redirecting…' : 'Sign in with BrightGrid'}
      </button>
      <p className="muted login-hint">
        You will sign in on CCIDP at{' '}
        <span className="mono">{`http://${window.location.hostname}:8080/ccidp/login`}</span>. MFA
        runs there if it is enabled for your account.
      </p>
    </AuthCard>
  );
}
