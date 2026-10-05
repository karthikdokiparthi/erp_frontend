import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasAssetsAccess } from '../utils/format';

export function AssetsRoute({ children }) {
  const { user } = useAuth();
  if (!hasAssetsAccess(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
