import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasAttendanceAccess } from '../utils/format';

export function AttendanceRoute({ children }) {
  const { user } = useAuth();
  if (!hasAttendanceAccess(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
