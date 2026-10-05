import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { displayName } from '../utils/format';

export function MyProfilePage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="My profile"
        description="This is your CCIDP sign-in. ERP does not store a password. HR keeps On-Role and Contract records in BGT EMP."
      />
      <div className="panel">
        <div className="panel-pad">
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input readOnly value={displayName(user)} />
            </label>
            <label className="field">
              <span>Username</span>
              <input readOnly value={user?.username || ''} />
            </label>
            <label className="field span-2">
              <span>Email</span>
              <input readOnly value={user?.email || ''} />
            </label>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Payslips, documents, and assigned assets appear here when HR links this login to a BGT EMP record.
            Apply leave from <Link to="/leave/apply">Leave info</Link>
            {' · '}
            <Link to="/me/attendance">My attendance</Link>
            {' · '}
            <Link to="/hr/exit/apply">Exit / Resign</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
