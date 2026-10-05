import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasSuperAdmin } from '../utils/format';

export function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  if (!hasSuperAdmin(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
