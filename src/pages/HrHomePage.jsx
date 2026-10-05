import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { hasSuperAdmin } from '../utils/format';

const LIVE = [
  {
    title: 'My profile',
    text: 'Your CCIDP profile and signed-in user details. Leave apply, inbox, and requests live under Leave.',
    to: '/me',
  },
  {
    title: 'Employee Management',
    text: 'BGT EMP directory: On-Role (erp.staff) and Contract (erp.employees). Open a person for the profile.',
    to: '/hr/employees',
  },
  {
    title: 'Attendance',
    text: 'Upload the TimeWatch Machine Raw Punch Report. In is Punch-1 (I), Out is the last O, and a full day needs 8 hours between them.',
    to: '/hr/attendance',
  },
  {
    title: 'Leave Management',
    text: 'Every signed-in employee can apply, approve requests assigned to them, and see their year. HR also sees all people. Leave types admin is still a placeholder.',
    to: '/leave',
  },
  {
    title: 'Exit / Resign',
    text: 'Apply, HR inbox, notice period, and clearance. Letters are not issued as PDFs yet.',
    to: '/hr/exit',
  },
  {
    title: 'Payroll',
    text: 'Dashboard, salary structure, processing, payslips, and statutory tabs (PF, ESI, PT, TDS) from the live On-Role and Contract engines.',
    to: '/hr/payroll',
  },
  {
    title: 'Reports',
    text: 'Employee, attendance, leave, payroll, and PF/ESI/PT/TDS reports from live data, with Excel export.',
    to: '/hr/reports',
  },
  {
    title: 'Expenses',
    text: 'Employees raise claims with receipts or xerox copies. HR approves, files paper, and marks reimbursement.',
    to: '/hr/expenses',
  },
  {
    title: 'Recruitment',
    text: 'Requisitions, openings, candidates with resumes, interviews, and offers — full hire pipeline for HR.',
    to: '/hr/recruitment',
  },
  {
    title: 'Organization',
    text: 'Department, designation, branch, and location masters. Reporting lines, transfers, and promotions with HR approval.',
    to: '/hr/organization',
  },
  {
    title: 'Assets',
    text: 'Master register, assignment, transfer, maintenance, QR labels, and physical audit.',
    to: '/assets',
  },
];

const SETTINGS = {
  title: 'Settings',
  text: 'Company profile, CCIDP users and roles, leave/exit workflow, notification bell, and runtime config. Super Admin only.',
  to: '/hr/settings',
};

const SOON = [
  {
    title: 'Performance',
    text: 'Goals, KPI, appraisals, and reviews are not built.',
    to: '/hr/performance',
  },
];

export function HrHomePage() {
  const { user } = useAuth();
  const live = hasSuperAdmin(user) ? [...LIVE, SETTINGS] : LIVE;

  return (
    <>
      <PageHeader
        title="Human Resources"
        eyebrow="Dashboard"
        description="Grouped HR ERP: live modules keep the existing leave, assets, and payroll engines. Coming Soon items are menu homes only — not fake headcount."
      />
      <h2 className="section-title">Live</h2>
      <div className="card-grid">
        {live.map((item) => (
          <Link key={item.to} className="panel panel-link hub-card" to={item.to}>
            <div className="panel-pad">
              <h2>{item.title}</h2>
              <p className="muted">{item.text}</p>
            </div>
          </Link>
        ))}
      </div>
      <h2 className="section-title" style={{ marginTop: 8 }}>
        Coming soon
      </h2>
      <div className="card-grid">
        {SOON.map((item) => (
          <Link key={item.to} className="panel panel-link hub-card" to={item.to}>
            <div className="panel-pad">
              <h2>{item.title}</h2>
              <p className="muted">{item.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
