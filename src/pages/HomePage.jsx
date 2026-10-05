import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { displayName, hasAssetsAccess, hasHrAccess } from '../utils/format';

export function HomePage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const assets = hasAssetsAccess(user);

  return (
    <>
      <PageHeader
        title="Home"
        eyebrow="Dashboard"
        description="Signed in through BrightGrid CCIDP. Identity comes from the ID token and UserInfo — ERP has no local password table."
      />
      <div className="kpi-grid">
        <KpiCard label="Username" value={user?.username} hint={user?.email || 'No email on token'} />
        <KpiCard label="Display name" value={displayName(user)} hint="From OIDC profile claims" />
        <KpiCard
          label="HR access"
          value={hr ? 'Yes' : 'No'}
          hint={hr ? 'ERP_HR_READ or SUPER_ADMIN' : 'Ask an admin to grant ERP_HR_READ'}
        />
        <KpiCard
          label="Company assets"
          value={assets ? 'Yes' : 'No'}
          hint={assets ? 'IT / Ele / Mech manager' : 'IT_MANAGER, ELE_MANAGER, or MECH_MANAGER in CCIDP'}
        />
      </div>
      <div className="panel">
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Roles
          </h2>
          <div className="badge-row">
            {(user?.roles || []).length
              ? user.roles.map((role) => <StatusBadge key={role} value={role} />)
              : <span className="muted">No roles on the token.</span>}
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Quick links
          </h2>
          <div className="home-quick-links">
            {hr ? <Link to="/hr">Human Resources</Link> : null}
            {assets ? <Link to="/assets">Asset Master</Link> : null}
            <Link to="/leave">Leave management</Link>
            <Link to="/me">My profile</Link>
            {!hr && !assets ? (
              <span className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>
                HR menus stay hidden unless this account has <span className="mono">ERP_HR_READ</span> or{' '}
                <span className="mono">SUPER_ADMIN</span>.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
