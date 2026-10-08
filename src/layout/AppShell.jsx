import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BrandLockup } from '../components/BrandLockup';
import { Icon } from '../components/Icons';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';
import { displayName, hasAssetsAccess, hasAttendanceAccess, hasHrAccess, hasSuperAdmin, initials, primaryRoleLabel } from '../utils/format';
import { NavGroup, NavItem } from './NavGroup';
import { moduleLabel, resolveModule } from './moduleTheme';

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const hr = hasHrAccess(user);
  const attendance = hasAttendanceAccess(user);
  const superAdmin = hasSuperAdmin(user);
  const assets = hasAssetsAccess(user);
  const moduleId = resolveModule(location.pathname);
  const moduleName = moduleLabel(moduleId);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen);
    return () => document.body.classList.remove('nav-open');
  }, [navOpen]);

  return (
    <div className="shell" data-module={moduleId}>
      <div
        className={`sidebar-overlay${navOpen ? ' is-open' : ''}`}
        onClick={() => setNavOpen(false)}
      />
      <aside className={`sidebar${navOpen ? ' is-open' : ''}`} id="app-sidebar">
        <div className="sidebar-brand">
          <BrandLockup product="ERP" />
          <button
            className="btn btn-ghost btn-sm sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            Close
          </button>
        </div>
        <nav className="nav" aria-label="HR ERP">
          <NavItem to="/" end>
            <Icon name="home" />
            Dashboard
          </NavItem>
          <NavItem to="/me">
            <Icon name="users" />
            My profile
          </NavItem>
          {hr ? (
            <NavGroup title="Employee Management" match={['/hr/employees', '/hr/people', '/hr/exit', '/hr/employee-master', '/hr/organization']}>
              <NavItem to="/hr/employee-master">Employee Master</NavItem>
              <NavItem to="/hr/employees">All employees</NavItem>
              <NavItem to="/hr/employees/biometric">Biometric</NavItem>
              <NavItem to="/hr/organization" end>
                Department Master
              </NavItem>
              <NavItem to="/hr/organization/designations">Designation Master</NavItem>
              <NavItem to="/hr/organization/transfers">Transfers</NavItem>
              <NavItem to="/hr/organization/promotions">Promotions</NavItem>
              <NavItem to="/hr/exit">Exit / Resign</NavItem>
            </NavGroup>
          ) : null}
          {attendance ? (
            <NavGroup title="Attendance" match={['/hr/attendance', '/me/attendance']}>
              <NavItem to="/me/attendance">My attendance</NavItem>
              <NavItem to="/hr/attendance" end>
                Attendance dashboard
              </NavItem>
              <NavItem to="/hr/attendance/daily">Daily attendance</NavItem>
              <NavItem to="/hr/attendance/monthly">Monthly attendance</NavItem>
              <NavItem to="/hr/attendance/shifts">Shift management</NavItem>
              <NavItem to="/hr/attendance/devices">Biometric devices</NavItem>
              <NavItem to="/hr/attendance/late">In time</NavItem>
              <NavItem to="/hr/attendance/early">Early leaving</NavItem>
              <NavItem to="/hr/attendance/overtime">Overtime</NavItem>
              <NavItem to="/hr/attendance/regularization">Regularization</NavItem>
            </NavGroup>
          ) : (
            <NavGroup title="Attendance" match={['/me/attendance']}>
              <NavItem to="/me/attendance">My attendance</NavItem>
            </NavGroup>
          )}
          {hr ? null : (
            <>
              <NavGroup title="Leave Management" match={['/leave']}>
                <NavItem to="/leave" end>
                  Leave dashboard
                </NavItem>
                <NavItem to="/leave/apply">Apply leave</NavItem>
                <NavItem to="/leave/inbox">Leave approval</NavItem>
                <NavItem to="/leave/my-requests">My requests</NavItem>
                <NavItem to="/leave/holidays">Holiday calendar</NavItem>
              </NavGroup>
              <NavGroup title="Expenses" match={['/hr/expenses']}>
                <NavItem to="/hr/expenses/apply">New claim</NavItem>
                <NavItem to="/hr/expenses" end>
                  My claims
                </NavItem>
              </NavGroup>
              <NavGroup title="Exit / Resign" match={['/hr/exit']}>
                <NavItem to="/hr/exit/apply">Apply resignation</NavItem>
                <NavItem to="/hr/exit/cases">My cases</NavItem>
              </NavGroup>
              <NavGroup title="Payroll" match={['/me/payslips']}>
                <NavItem to="/me/payslips">My payslips</NavItem>
              </NavGroup>
            </>
          )}
          {hr ? (
            <>
              <NavGroup title="Payroll" match={['/hr/payroll', '/hr/salary']}>
                <NavItem to="/hr/payroll" end>
                  Dashboard
                </NavItem>
                {/* TODO: salary structure — restore when user requests
                <NavItem to="/hr/payroll/structures">Structures</NavItem>
                */}
                {/* TODO: payroll assignment — restore when user requests
                <NavItem to="/hr/payroll/assignments">Assignment</NavItem>
                */}
                <NavItem to="/hr/payroll/payout">Salary payout</NavItem>
                <NavItem to="/hr/payroll/processing">Payroll processing</NavItem>
                <NavItem to="/hr/payroll/payslips">Salary Slips</NavItem>
                <NavItem to="/hr/payroll/company-expenses">Company expenses</NavItem>
                <NavItem to="/hr/payroll/reports">Payroll reports</NavItem>
                <NavItem to="/hr/payroll/settings">Payroll settings</NavItem>
                <NavItem to="/me/payslips">My payslips</NavItem>
                {/* TODO: classic salary sheets — restore when user requests
                <NavItem to="/hr/salary">Classic salary sheets</NavItem>
                */}
              </NavGroup>
              <NavGroup title="Leave Management" match={['/leave']}>
                <NavItem to="/leave" end>
                  Leave dashboard
                </NavItem>
                <NavItem to="/leave/apply">Apply leave</NavItem>
                <NavItem to="/leave/inbox">Leave approval</NavItem>
                <NavItem to="/leave/my-requests">My requests</NavItem>
                <NavItem to="/leave/requests">All requests</NavItem>
                <NavItem to="/leave/types">Leave types</NavItem>
                <NavItem to="/leave/holidays">Holiday calendar</NavItem>
              </NavGroup>
              <NavGroup title="Recruitment" match={['/hr/recruitment']}>
                <NavItem to="/hr/recruitment" end>
                  Job requisitions
                </NavItem>
                <NavItem to="/hr/recruitment/openings">Job openings</NavItem>
                <NavItem to="/hr/recruitment/candidates">Candidates</NavItem>
                <NavItem to="/hr/recruitment/interviews">Interviews</NavItem>
                <NavItem to="/hr/recruitment/offers">Offers</NavItem>
              </NavGroup>
              <NavGroup title="Performance" match={['/hr/performance']}>
                <NavItem to="/hr/performance">Goals</NavItem>
                <NavItem to="/hr/performance/kpi">KPI</NavItem>
                <NavItem to="/hr/performance/appraisals">Appraisals</NavItem>
                <NavItem to="/hr/performance/reviews">Reviews</NavItem>
              </NavGroup>
              <NavGroup title="Expenses" match={['/hr/expenses']}>
                <NavItem to="/hr/expenses" end>
                  Expense claims
                </NavItem>
                <NavItem to="/hr/expenses/apply">New claim</NavItem>
                <NavItem to="/hr/expenses/approvals">Approvals</NavItem>
                <NavItem to="/hr/expenses/reports">Expense reports</NavItem>
              </NavGroup>
            </>
          ) : null}
          {assets ? (
            <NavGroup title="Assets" match={['/assets']}>
              <NavItem to="/assets">Asset Master</NavItem>
              <NavItem to="/assets/assign">Asset Assignment</NavItem>
              <NavItem to="/assets/transfer">Asset Transfer</NavItem>
              <NavItem to="/assets/maintenance">Asset Maintenance</NavItem>
              <NavItem to="/assets/qr">QR Code</NavItem>
              <NavItem to="/assets/audit" end={false}>
                Asset Audit
              </NavItem>
            </NavGroup>
          ) : null}
          {hr ? (
            <>
              <NavGroup title="Organization" match={['/hr/organization']}>
                <NavItem to="/hr/organization" end>
                  Department Master
                </NavItem>
                <NavItem to="/hr/organization/designations">Designation Master</NavItem>
                <NavItem to="/hr/organization/branches">Branches</NavItem>
                <NavItem to="/hr/organization/locations">Locations</NavItem>
                <NavItem to="/hr/organization/reporting">Reporting structure</NavItem>
                <NavItem to="/hr/organization/transfers">Transfers</NavItem>
                <NavItem to="/hr/organization/promotions">Promotions</NavItem>
              </NavGroup>
              <NavGroup title="Reports" match={['/hr/reports']}>
                <NavItem to="/hr/reports" end>
                  Employee reports
                </NavItem>
                <NavItem to="/hr/reports/attendance">Attendance reports</NavItem>
                <NavItem to="/hr/reports/leave">Leave reports</NavItem>
                <NavItem to="/hr/reports/payroll">Classic pay report</NavItem>
                <NavItem to="/hr/payroll/reports">Payroll module reports</NavItem>
                <NavItem to="/hr/reports/compliance">Compliance reports</NavItem>
              </NavGroup>
              {superAdmin ? (
                <NavGroup title="Settings" match={['/hr/settings']}>
                  <NavItem to="/hr/settings" end>
                    Company settings
                  </NavItem>
                  <NavItem to="/hr/settings/users">Users</NavItem>
                  <NavItem to="/hr/settings/roles">Roles & permissions</NavItem>
                  <NavItem to="/hr/settings/workflow">Workflow</NavItem>
                  <NavItem to="/hr/settings/notifications">Notifications</NavItem>
                  <NavItem to="/hr/settings/system">System configuration</NavItem>
                </NavGroup>
              ) : null}
            </>
          ) : null}
        </nav>
        <div className="sidebar-foot">
          <span className="sidebar-foot-note">BrightGrid HR · CCIDP signed-in</span>
          <button
            className="btn btn-icon nav-signout"
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="menu-toggle"
              type="button"
              aria-label="Open navigation"
              aria-controls="app-sidebar"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar-title">BrightGrid HR</span>
            <span className="topbar-module" title={moduleName}>
              {moduleName}
            </span>
            <span className="env-badge role-badge">{primaryRoleLabel(user)}</span>
          </div>
          <div className="topbar-user">
            <ThemeToggle />
            <NotificationBell />
            <div className="topbar-profile">
              <div className="user-meta">
                <div className="name">{displayName(user)}</div>
                <div className="email">{user?.username}</div>
              </div>
              <div className="avatar">{initials(user)}</div>
            </div>
            <button
              className="btn btn-icon topbar-logout"
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>
        <main className="content" data-shell-content data-module={moduleId}>
          <div className="content-inner" data-shell-pad>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
