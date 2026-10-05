import { Navigate, useLocation } from 'react-router-dom';
import { hasSignedInIdentity } from '../utils/format';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p className="muted">Checking sign-in…</p>
      </div>
    );
  }

  if (!hasSignedInIdentity(user)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
