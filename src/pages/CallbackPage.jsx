import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { extractError, useAuth } from '../auth/AuthContext';
import { AuthCard } from '../components/AuthCard';

export function CallbackPage() {
  const { user, completeLogin } = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    const oauthError = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (oauthError) {
      setError(params.get('error_description') || oauthError);
      return;
    }
    if (!code || !state) {
      setError('Missing authorization code. Start again from BrightGrid ERP.');
      return;
    }
    if (started.current) {
      return;
    }
    started.current = true;
    completeLogin({ code, state }).catch((err) => setError(extractError(err)));
  }, [completeLogin, params]);

  if (user) {
    const returnTo = sessionStorage.getItem('erp.returnTo') || '/';
    sessionStorage.removeItem('erp.returnTo');
    return <Navigate to={returnTo.startsWith('/') ? returnTo : '/'} replace />;
  }

  return (
    <AuthCard title={error ? 'Sign-in failed' : 'Completing sign-in'} lead={error ? null : 'Exchanging the CCIDP authorization code…'}>
      {error ? (
        <>
          <div className="form-error">{error}</div>
          <a className="btn btn-primary btn-block" href="/login">
            Back to sign in
          </a>
        </>
      ) : (
        <div className="state-block" style={{ padding: '12px 0' }}>
          <div className="spinner" />
        </div>
      )}
    </AuthCard>
  );
}
