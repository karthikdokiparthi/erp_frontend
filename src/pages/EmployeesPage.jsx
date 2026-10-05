import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../utils/format';

export const EMPLOYEE_COLUMNS = [
  { slug: 'bgt', label: 'BGT', kind: 'STAFF', workGroup: 'BGT' },
  { slug: 'ruchitha', label: 'Ruchitha', kind: 'EMPLOYEE', workGroup: 'Ruchitha' },
  { slug: 'akhil', label: 'Akhil', kind: 'EMPLOYEE', workGroup: 'Akhil' },
  { slug: 'bsk', label: 'BSK', kind: 'EMPLOYEE', workGroup: 'BSK' },
  { slug: 'krystal', label: 'Krystal', kind: 'EMPLOYEE', workGroup: 'Krystal' },
];

function matchesNameOrId(row, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const code = String(row.employeeNumber || '').toLowerCase();
  const name = `${row.firstName || ''} ${row.lastName || ''}`.trim().toLowerCase();
  return code.includes(needle) || name.includes(needle);
}

export function BgtEmpPage() {
  return (
    <>
      <PageHeader
        title="All employees"
        description="On-Role people under BGT. Contract people under Ruchitha, Akhil, BSK, or Krystal."
      />
      <div className="page-tabs" role="tablist" aria-label="Employee columns">
        {EMPLOYEE_COLUMNS.map((column) => (
          <NavLink
            key={column.slug}
            to={`/hr/employees/${column.slug}`}
            role="tab"
            className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
          >
            {column.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  );
}

export function BgtEmpListPage({ column }) {
  const meta = EMPLOYEE_COLUMNS.find((item) => item.slug === column) || EMPLOYEE_COLUMNS[0];
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const kind = meta.kind;
  const path = useMemo(() => {
    const base = kind === 'STAFF' ? '/api/hr/staff' : '/api/hr/employees';
    if (kind === 'STAFF') return base;
    return `${base}?workGroup=${encodeURIComponent(meta.workGroup)}`;
  }, [kind, meta.workGroup]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesNameOrId(row, search)),
    [rows, search],
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api(path));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return (
    <>
      <div className="list-toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <Link
          className="btn btn-primary"
          to={`/hr/employee-master?new=1&employmentType=${kind === 'STAFF' ? 'PERMANENT' : 'CONTRACT'}&workGroup=${encodeURIComponent(meta.workGroup)}`}
        >
          Register in Employee Master
        </Link>
      </div>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-pad">
          <label className="field" style={{ maxWidth: 360, marginBottom: 0 }}>
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID"
              aria-label="Search by name or ID"
            />
          </label>
        </div>
      </div>
      <div className="panel">
        <DataTable
          rows={filteredRows}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle={`No people in ${meta.label}`}
          emptyDescription={
            kind === 'STAFF'
              ? 'On-Role (BGT) people appear here. Use Add details to create one.'
              : `Contract people assigned to ${meta.label} appear here. Edit a person to set their column.`
          }
          columns={[
            { key: 'employeeNumber', header: 'Code', render: (row) => <span className="mono">{row.employeeNumber}</span> },
            {
              key: 'name',
              header: 'Name',
              render: (row) => (
                <div className="cell-stack">
                  <div className="primary">
                    <Link to={`/hr/people/${kind === 'STAFF' ? 'staff' : 'employees'}/${row.id}`}>
                      {row.firstName} {row.lastName}
                    </Link>
                  </div>
                  <div className="secondary">{row.email || row.mobile || '—'}</div>
                </div>
              ),
            },
            { key: 'department', header: 'Department' },
            { key: 'title', header: 'Designation', render: (row) => row.title || '—' },
            {
              key: 'employmentType',
              header: 'Employment type',
              render: (row) => row.employmentType || (kind === 'STAFF' ? 'On-Role' : 'Contract'),
            },
            { key: 'hiredOn', header: 'DOJ', render: (row) => formatDate(row.hiredOn) },
            {
              key: 'reportingManagerName',
              header: 'Reporting manager',
              render: (row) => row.reportingManagerName || '—',
            },
            {
              key: 'workGroup',
              header: 'Company / group',
              render: (row) => row.workGroup || meta.label,
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <Link
                  className="btn btn-sm"
                  to={`/hr/employees/edit/${kind === 'STAFF' ? 'staff' : 'employees'}/${row.id}`}
                >
                  Edit
                </Link>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

/** Old /staff and /employees routes redirect into the new columns. */
export function LegacyEmpRedirect({ to }) {
  return <Navigate to={to} replace />;
}
