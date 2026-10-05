import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasHrAccess } from '../utils/format';

export function HrRoute({ children }) {
  const { user } = useAuth();
  if (!hasHrAccess(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
