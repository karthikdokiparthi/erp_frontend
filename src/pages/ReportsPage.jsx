import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { downloadTableExcel } from '../utils/exportExcel';
import {
  directoryLabel,
  formatDate,
  formatMoney,
  leaveStatusLabel,
  leaveTypeLabel,
  payTypeLabel,
} from '../utils/format';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYear() {
  return new Date().getFullYear();
}

function fileStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function matchesQuery(row, query, fields) {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle));
}

function uniqueValues(rows, key) {
  return [...new Set((rows || []).map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function useReport(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api(path));
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return { data, error, loading, load };
}

export function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Headcount, monthly attendance, yearly leave, payroll, and statutory amounts from live ERP data. Export Excel from each tab."
      />
      <div className="page-tabs" role="tablist" aria-label="Reports">
        <NavLink to="/hr/reports" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Employees
        </NavLink>
        <NavLink
          to="/hr/reports/attendance"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Attendance
        </NavLink>
        <NavLink to="/hr/reports/leave" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Leave
        </NavLink>
        <NavLink
          to="/hr/reports/payroll"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Payroll
        </NavLink>
        <NavLink
          to="/hr/reports/compliance"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Compliance
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

export function ReportsEmployeesPage() {
  const { data, error, loading, load } = useReport('/api/hr/reports/employees');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  const rows = useMemo(() => {
    return (data?.rows || []).filter((row) => {
      if (kind && row.personKind !== kind) return false;
      if (status && String(row.status || '').toUpperCase() !== status) return false;
      if (department && row.department !== department) return false;
      if (designation && row.title !== designation) return false;
      return matchesQuery(row, query, ['employeeNumber', 'displayName', 'email', 'title', 'department']);
    });
  }, [data, query, kind, status, department, designation]);

  function exportExcel() {
    downloadTableExcel(
      'Employees',
      ['ID', 'Name', 'Directory', 'Email', 'Title', 'Department', 'Status', 'Hired on'],
      rows.map((row) => [
        row.employeeNumber,
        row.displayName,
        directoryLabel(row.personKind),
        row.email,
        row.title,
        row.department,
        row.status,
        row.hiredOn || '',
      ]),
      `BGT-employee-report-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="People" value={data?.total} />
        <KpiCard label="Active" value={data?.active} />
        <KpiCard label="Inactive" value={data?.inactive} />
        <KpiCard label="On-Role" value={data?.onRole} />
        <KpiCard label="Contract" value={data?.contract} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, email" />
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <span>Directory</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">All</option>
              <option value="STAFF">On-Role</option>
              <option value="EMPLOYEE">Contract</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Department</span>
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">All</option>
              {uniqueValues(data?.rows, 'department').map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Designation</span>
            <select value={designation} onChange={(event) => setDesignation(event.target.value)}>
              <option value="">All</option>
              {uniqueValues(data?.rows, 'title').map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!rows.length}>
          Export Excel
        </button>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No people in this report"
        emptyDescription="Add On-Role or Contract people first, or clear the filters."
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          {
            key: 'displayName',
            header: 'Name',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.displayName}</div>
                <div className="secondary">{row.email || row.title || '—'}</div>
              </div>
            ),
          },
          { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
          { key: 'department', header: 'Department' },
          { key: 'title', header: 'Designation', render: (row) => row.title || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          { key: 'hiredOn', header: 'Hired', render: (row) => formatDate(row.hiredOn) },
        ]}
      />
    </>
  );
}

export function ReportsAttendancePage() {
  const [month, setMonth] = useState(currentMonth);
  const { data, error, loading, load } = useReport(`/api/hr/reports/attendance?month=${encodeURIComponent(month)}`);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return (data?.rows || []).filter((row) =>
      matchesQuery(row, query, ['employeeNumber', 'displayName', 'department'])
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'Attendance',
      ['ID', 'Name', 'Directory', 'Department', 'Present days', 'Leave days', 'Absent days', 'Working days'],
      rows.map((row) => [
        row.employeeNumber,
        row.displayName,
        directoryLabel(row.personKind),
        row.department,
        row.presentDays,
        row.leaveDays,
        row.absentDays,
        row.workingDays,
      ]),
      `BGT-attendance-report-${month}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="Working days" value={data?.workingDays} hint={data ? `${data.from} to ${data.to}` : undefined} />
        <KpiCard label="Expected" value={data?.expected} />
        <KpiCard label="Present" value={data?.peoplePresent} />
        <KpiCard label="On leave only" value={data?.peopleOnLeave} />
        <KpiCard label="No punch / leave" value={data?.peopleAbsent} hint={data?.unmatchedPunches ? `${data.unmatchedPunches} unmatched punches` : undefined} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Month</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, department" />
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!rows.length}>
          Export Excel
        </button>
      </div>
      <p className="muted">Sundays are excluded. The current month counts through today. Approved leave days without a punch are leave, not absent.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No attendance rows"
        emptyDescription="Active On-Role and Contract people appear here once they exist in the directory."
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          {
            key: 'displayName',
            header: 'Name',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.displayName}</div>
                <div className="secondary">{row.department}</div>
              </div>
            ),
          },
          { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
          { key: 'presentDays', header: 'Present' },
          { key: 'leaveDays', header: 'Leave' },
          { key: 'absentDays', header: 'Absent' },
          { key: 'workingDays', header: 'Working days' },
        ]}
      />
    </>
  );
}

export function ReportsLeavePage() {
  const [year, setYear] = useState(currentYear);
  const { data, error, loading, load } = useReport(`/api/hr/reports/leave?year=${year}`);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const years = useMemo(() => {
    const now = currentYear();
    return [now, now - 1, now - 2];
  }, []);

  const rows = useMemo(() => {
    return (data?.rows || []).filter((row) => {
      if (status && String(row.status || '').toUpperCase() !== status) return false;
      return matchesQuery(row, query, ['employeeNumber', 'displayName', 'leaveType', 'recipientName']);
    });
  }, [data, query, status]);

  function exportExcel() {
    downloadTableExcel(
      'Leave',
      ['ID', 'Name', 'Type', 'From', 'To', 'Days', 'Days in year', 'Status', 'Approver'],
      rows.map((row) => [
        row.employeeNumber,
        row.displayName,
        leaveTypeLabel(row.leaveType),
        row.startOn,
        row.endOn,
        row.days,
        row.daysInYear,
        leaveStatusLabel(row.status),
        row.recipientName,
      ]),
      `BGT-leave-report-${year}.xls`
    );
  }

  const typeHint = (data?.byType || []).map((item) => `${leaveTypeLabel(item.name)} ${item.count}`).join(' · ');

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="Requests" value={data?.total} />
        <KpiCard label="Pending" value={data?.pending} />
        <KpiCard label="Approved" value={data?.approved} />
        <KpiCard label="Rejected" value={data?.rejected} />
        <KpiCard label="Approved days" value={data?.approvedDays} hint={typeHint || undefined} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
            <span>Year</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, type" />
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!rows.length}>
          Export Excel
        </button>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No leave in this year"
        emptyDescription="Requests that overlap the selected calendar year appear here."
        columns={[
          { key: 'displayName', header: 'Person', render: (row) => (
            <div className="cell-stack">
              <div className="primary">{row.displayName}</div>
              <div className="secondary">{row.employeeNumber}</div>
            </div>
          ) },
          { key: 'leaveType', header: 'Type', render: (row) => <StatusBadge value={row.leaveType} /> },
          { key: 'startOn', header: 'From', render: (row) => formatDate(row.startOn) },
          { key: 'endOn', header: 'To', render: (row) => formatDate(row.endOn) },
          { key: 'daysInYear', header: 'Days in year' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          { key: 'recipientName', header: 'Approver' },
        ]}
      />
    </>
  );
}

function payRows(data) {
  return data?.rows || [];
}

export function ReportsPayrollPage() {
  const { data, error, loading, load } = useReport('/api/hr/reports/payroll');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter((row) => {
      if (kind && row.personKind !== kind) return false;
      return matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']);
    });
  }, [data, query, kind]);

  function exportExcel() {
    downloadTableExcel(
      'Payroll',
      ['ID', 'Name', 'Directory', 'Pay type', 'Department', 'Gross', 'Net', 'Employee PF', 'PT', 'TDS'],
      rows.map((row) => [
        row.employeeNumber,
        `${row.firstName || ''} ${row.lastName || ''}`.trim(),
        directoryLabel(row.personKind),
        payTypeLabel(row.employmentType),
        row.department,
        row.gross ?? '',
        row.net ?? '',
        row.employeePf ?? '',
        row.professionalTax ?? '',
        row.tds ?? '',
      ]),
      `BGT-payroll-report-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="People" value={data?.people} />
        <KpiCard label="With pay set" value={data?.withPay} />
        <KpiCard label="Total gross" value={formatMoney(data?.totalGross)} />
        <KpiCard label="Total net" value={formatMoney(data?.totalNet)} />
        <KpiCard label="No pay yet" value={data ? data.people - data.withPay : undefined} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, department" />
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
            <span>Directory</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">All</option>
              <option value="STAFF">On-Role</option>
              <option value="EMPLOYEE">Contract</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!rows.length}>
          Export Excel
        </button>
      </div>
      <p className="muted">Gross and net use the current payslip engine, same as Payroll. Open a person on Payroll to change inputs.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No payroll rows"
        emptyDescription="People from On-Role and Contract directories appear here."
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          {
            key: 'name',
            header: 'Name',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">
                  {row.firstName} {row.lastName}
                </div>
                <div className="secondary">{row.department}</div>
              </div>
            ),
          },
          { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
          {
            key: 'employmentType',
            header: 'Pay type',
            render: (row) => (row.employmentType ? <StatusBadge value={payTypeLabel(row.employmentType)} /> : '—'),
          },
          { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
          { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
        ]}
      />
    </>
  );
}

export function ReportsCompliancePage() {
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter((row) =>
      matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department'])
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'Compliance',
      [
        'ID',
        'Name',
        'Directory',
        'Pay type',
        'Employee PF',
        'Employer PF',
        'Employee ESI',
        'Employer ESI',
        'PT',
        'TDS',
        'ESI applicable',
      ],
      rows.map((row) => [
        row.employeeNumber,
        `${row.firstName || ''} ${row.lastName || ''}`.trim(),
        directoryLabel(row.personKind),
        payTypeLabel(row.employmentType),
        row.employeePf ?? '',
        row.employerPf ?? '',
        row.employeeEsi ?? '',
        row.employerEsi ?? '',
        row.professionalTax ?? '',
        row.tds ?? '',
        row.esiApplicable ? 'Yes' : 'No',
      ]),
      `BGT-compliance-report-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="Employee PF" value={formatMoney(data?.employeePf)} />
        <KpiCard label="Employer PF" value={formatMoney(data?.employerPf)} />
        <KpiCard label="Employee ESI" value={formatMoney(data?.employeeEsi)} />
        <KpiCard label="PT" value={formatMoney(data?.professionalTax)} />
        <KpiCard label="TDS" value={formatMoney(data?.tds)} hint={data?.esiCovered != null ? `${data.esiCovered} ESI covered` : undefined} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <label className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID, department" />
        </label>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!rows.length}>
          Export Excel
        </button>
      </div>
      <p className="muted">{data?.note || 'Statutory amounts from salary masters. E-return files are not generated.'}</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No compliance rows"
        emptyDescription="Set pay on a person in Payroll to populate PF, ESI, PT, and TDS."
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          {
            key: 'name',
            header: 'Name',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">
                  {row.firstName} {row.lastName}
                </div>
                <div className="secondary">{row.department}</div>
              </div>
            ),
          },
          { key: 'employeePf', header: 'Emp PF', render: (row) => formatMoney(row.employeePf) },
          { key: 'employerPf', header: 'Er PF', render: (row) => formatMoney(row.employerPf) },
          { key: 'employeeEsi', header: 'ESI', render: (row) => formatMoney(row.employeeEsi) },
          { key: 'professionalTax', header: 'PT', render: (row) => formatMoney(row.professionalTax) },
          { key: 'tds', header: 'TDS', render: (row) => formatMoney(row.tds) },
        ]}
      />
    </>
  );
}
