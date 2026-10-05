/**
 * Map the current route to a module id used for AppShell `data-module`
 * theming (accent, header motif, tabs/KPIs). Keep ids stable — CSS keys off them.
 */
const RULES = [
  { id: 'settings', test: (p) => p.startsWith('/hr/settings') },
  { id: 'reports', test: (p) => p.startsWith('/hr/reports') },
  { id: 'recruitment', test: (p) => p.startsWith('/hr/recruitment') },
  { id: 'performance', test: (p) => p.startsWith('/hr/performance') },
  { id: 'assets', test: (p) => p === '/assets' || p.startsWith('/assets/') },
  { id: 'expenses', test: (p) => p.startsWith('/hr/expenses') },
  { id: 'payroll', test: (p) => p.startsWith('/hr/payroll') || p.startsWith('/hr/salary') || p === '/me/payslips' },
  { id: 'leave', test: (p) => p === '/leave' || p.startsWith('/leave/') },
  { id: 'exit', test: (p) => p.startsWith('/hr/exit') },
  {
    id: 'biometric',
    test: (p) =>
      p.startsWith('/hr/organization') ||
      p === '/hr/employees/biometric' ||
      p.startsWith('/hr/attendance/devices'),
  },
  {
    id: 'attendance',
    test: (p) => p.startsWith('/hr/attendance') || p === '/me/attendance' || p.startsWith('/me/attendance/'),
  },
  {
    id: 'employees',
    test: (p) =>
      p.startsWith('/hr/employee-master') ||
      p.startsWith('/hr/employees') ||
      p.startsWith('/hr/people'),
  },
  { id: 'profile', test: (p) => p === '/me' || p.startsWith('/me/') },
  { id: 'dashboard', test: (p) => p === '/' || p === '/hr' },
];

const LABELS = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  employees: 'Employee Management',
  biometric: 'Organization',
  payroll: 'Payroll',
  expenses: 'Expenses',
  leave: 'Leave',
  exit: 'Exit',
  settings: 'Settings',
  assets: 'Assets',
  recruitment: 'Recruitment',
  performance: 'Performance',
  reports: 'Reports',
  profile: 'My profile',
};

export function resolveModule(pathname) {
  const path = pathname || '/';
  for (const rule of RULES) {
    if (rule.test(path)) return rule.id;
  }
  return 'dashboard';
}

export function moduleLabel(id) {
  return LABELS[id] || 'Workspace';
}
