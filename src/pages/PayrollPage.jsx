import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { downloadTableExcel } from '../utils/exportExcel';
import { directoryLabel, formatMoney, payTypeLabel } from '../utils/format';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

function PersonCell({ primary, secondary }) {
  return (
    <div className="cell-stack">
      <div className="primary">{primary}</div>
      {secondary ? <div className="secondary">{secondary}</div> : null}
    </div>
  );
}

function isOnRoleRow(row) {
  return row.employmentType === 'BGTEMP' || (!row.employmentType && row.personKind === 'STAFF');
}

function isContractRow(row) {
  return row.employmentType === 'CONTRACTEMP' || (!row.employmentType && row.personKind === 'EMPLOYEE');
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

function useSalaryList() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api('/api/hr/salary'));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { rows, error, loading, load };
}

function payRows(data) {
  return data?.rows || [];
}

function personName(row) {
  return `${row.firstName || ''} ${row.lastName || ''}`.trim();
}

function basePersonColumns(navigate) {
  return [
    { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <PersonCell primary={personName(row)} secondary={row.department} />,
    },
    { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
    {
      key: 'employmentType',
      header: 'Pay type',
      render: (row) => (row.employmentType ? <StatusBadge value={payTypeLabel(row.employmentType)} /> : '—'),
    },
    {
      key: 'payslip',
      header: '',
      render: (row) => (
        <Link to={`/hr/salary/${row.personKind}/${row.personId}`}>
          {row.employmentType ? 'Open payslip' : 'Set pay'}
        </Link>
      ),
    },
  ];
}

export function PayrollPage() {
  return (
    <>
      <PageHeader
        title="Payroll"
        description="On-Role CTC sheet and Contract payroll register. Structure masters, monthly processing, payslips, and statutory deductions from the live engine."
      />
      <div className="page-tabs" role="tablist" aria-label="Payroll">
        <NavLink to="/hr/salary" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Dashboard
        </NavLink>
        {/* TODO: salary structure — restore when user requests
        <NavLink
          to="/hr/salary/structure"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Structure
        </NavLink>
        */}
        <NavLink
          to="/hr/salary/processing"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Processing
        </NavLink>
        <NavLink
          to="/hr/salary/payslips"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Payslips
        </NavLink>
        <NavLink
          to="/hr/salary/deductions"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Deductions
        </NavLink>
        <NavLink to="/hr/salary/pf" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          PF
        </NavLink>
        <NavLink to="/hr/salary/esi" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          ESI
        </NavLink>
        <NavLink to="/hr/salary/pt" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          PT
        </NavLink>
        <NavLink to="/hr/salary/tds" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          TDS
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

export function PayrollDashboardPage() {
  const [openRegister, setOpenRegister] = useState(null);
  const { rows, error, loading, load } = useSalaryList();

  const onRoleRows = rows.filter(isOnRoleRow);
  const contractRows = rows.filter(isContractRow);
  const onRolePaid = onRoleRows.filter((row) => row.employmentType === 'BGTEMP');
  const contractPaid = contractRows.filter((row) => row.employmentType === 'CONTRACTEMP');
  const onRoleNet = onRolePaid.reduce((sum, row) => sum + Number(row.net || 0), 0);
  const contractNet = contractPaid.reduce((sum, row) => sum + Number(row.net || 0), 0);
  const netTotal = onRoleNet + contractNet;
  const missingPay = rows.filter((row) => !row.employmentType).length;

  function toggleRegister(register) {
    setOpenRegister((current) => (current === register ? null : register));
  }

  const registerOpen = openRegister === 'on-role' || openRegister === 'contract';
  const visibleRows = openRegister === 'on-role' ? onRoleRows : openRegister === 'contract' ? contractRows : [];

  const registerColumns = [
    { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <PersonCell primary={personName(row)} secondary={row.department} />,
    },
    { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
    {
      key: 'employmentType',
      header: 'Pay type',
      render: (row) => (row.employmentType ? <StatusBadge value={payTypeLabel(row.employmentType)} /> : '—'),
    },
    { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
    { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
    {
      key: 'payslip',
      header: '',
      render: (row) => (
        <Link to={`/hr/salary/${row.personKind}/${row.personId}`}>
          {row.employmentType ? 'Payslip' : 'Set pay'}
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="kpi-grid kpi-grid-6">
        <KpiCard
          label="On-Role"
          value={loading ? '…' : onRolePaid.length}
          hint="STAFF · BGTEMP CTC"
          active={openRegister === 'on-role'}
          onClick={() => toggleRegister('on-role')}
        />
        <KpiCard
          label="Contract"
          value={loading ? '…' : contractPaid.length}
          hint="erp.employees · register"
          active={openRegister === 'contract'}
          onClick={() => toggleRegister('contract')}
        />
        <KpiCard label="Net this run" value={loading ? '…' : formatMoney(netTotal)} hint="Current month calculation" />
        <KpiCard label="On-Role net" value={loading ? '…' : formatMoney(onRoleNet)} />
        <KpiCard label="Contract net" value={loading ? '…' : formatMoney(contractNet)} hint="Employee net, not invoice" />
        <KpiCard label="Pay not set" value={loading ? '…' : missingPay} hint="Open payslip to configure" />
      </div>
      <div className="panel">
        <DataTable
          rows={registerOpen ? visibleRows : []}
          loading={Boolean(openRegister) && loading}
          error={error}
          onRetry={load}
          emptyTitle={
            openRegister === 'on-role'
              ? 'No On-Role people'
              : openRegister === 'contract'
                ? 'No Contract people'
                : 'Click On-Role or Contract to open that register.'
          }
          emptyDescription={
            registerOpen
              ? 'Add people in BGT EMP, then set their pay type on the payslip.'
              : 'Use Structure, Processing, or Payslips tabs for the full payroll workflow.'
          }
          columns={registerColumns}
        />
      </div>
    </>
  );
}

export function PayrollStructurePage() {
  const [structures, setStructures] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setStructures(await api('/api/hr/salary/contract-structures'));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="split-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              On-Role CTC structure
            </h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Monthly CTC sheet for STAFF (BGTEMP). Set CTC per month on the person payslip; components prorate by present days.
            </p>
            <ul className="payslip-lines">
              <li><span>Basic</span><span>40% of CTC if not overridden</span></li>
              <li><span>Retention Allowance</span><span>Fixed override on payslip</span></li>
              <li><span>HRA</span><span>Fixed override on payslip</span></li>
              <li><span>Flexi Benefits</span><span>Remainder of CTC after Basic + Retention + HRA + PF + Bonus + LTA</span></li>
              <li><span>Employer PF (CTC)</span><span>15% of Basic</span></li>
              <li><span>Bonus</span><span>25% of Basic if not overridden</span></li>
              <li><span>LTA</span><span>8.33% of Basic if not overridden</span></li>
              <li><span>CTC / month · annum</span><span>Entered CTC · × 12</span></li>
              <li><span>Monthly Gross</span><span>Basic + Retention + HRA + Flexi + Bonus + LTA (excl. Er PF)</span></li>
              <li><span>Employee PF</span><span>12% of earned Basic (₹18,000 cutoff)</span></li>
              <li><span>PT</span><span>₹200 when monthly gross exceeds ₹15,000</span></li>
              <li><span>TDS · Lunch</span><span>Amount or rate on payslip · lunch deduction</span></li>
            </ul>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {/* TODO: salary structure — restore when user requests: Config-driven structures under Payroll → Structures. */}
              {/* TODO: payroll assignment — restore when user requests: assigned under Payroll → Assignment. */}
              Config-driven structures (BGT-STD / RUCHITHA-STD / …) drive payroll runs. Classic sheet is still edited
              per person under Salary.
            </p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Contract register rules
            </h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Contract employees use one of 12 fixed salary masters. Paid days default from attendance when punches exist.
            </p>
            <ul className="payslip-lines">
              <li><span>Structure days</span><span>26</span></li>
              <li><span>Leave with wages</span><span>Salary − Basic − DA − Special (one-day residual)</span></li>
              <li><span>Day allowance</span><span>Only for paid days above 26</span></li>
              <li><span>ESI</span><span>When gross is within ESI ceiling</span></li>
              <li><span>Invoice</span><span>Employer PF/ESI, service charges, GST on gross</span></li>
            </ul>
          </div>
        </div>
      </div>
      <h2 className="section-title">Contract salary masters ({structures.length})</h2>
      <DataTable
        rows={structures}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No contract structures"
        emptyDescription="Flyway seeds the 12 salary masters."
        columns={[
          { key: 'salary', header: 'Salary', render: (row) => formatMoney(row.salary) },
          { key: 'basic', header: 'Basic', render: (row) => formatMoney(row.basic) },
          { key: 'da', header: 'DA', render: (row) => formatMoney(row.da) },
          { key: 'specialAllowance', header: 'Special', render: (row) => formatMoney(row.specialAllowance) },
          { key: 'leaveWithWages', header: 'LWW', render: (row) => formatMoney(row.leaveWithWages) },
        ]}
      />
    </>
  );
}

export function PayrollProcessingPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, load } = useReport('/api/hr/reports/payroll');
  const rows = payRows(data);
  const ready = rows.filter((row) => row.gross != null);
  const pending = rows.filter((row) => row.gross == null);

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="People" value={loading ? '…' : data?.people} />
        <KpiCard label="Ready to pay" value={loading ? '…' : data?.withPay} hint="Pay master saved" />
        <KpiCard label="Pending setup" value={loading ? '…' : data ? data.people - data.withPay : undefined} />
        <KpiCard label="Total gross" value={loading ? '…' : formatMoney(data?.totalGross)} />
        <KpiCard label="Total net" value={loading ? '…' : formatMoney(data?.totalNet)} />
      </div>
      <div className="list-toolbar list-toolbar-split">
        <div>
          <label className="field" style={{ margin: 0, minWidth: 180 }}>
            <span>Processing month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Amounts reflect current salary masters. Open each payslip with this month to apply attendance and recalculate.
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/salary/payslips')}>
            All payslips
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <h2 className="section-title">Ready ({ready.length})</h2>
      <DataTable
        rows={ready}
        loading={loading}
        onRetry={load}
        emptyTitle="Nobody ready yet"
        emptyDescription="Set pay on a person payslip first."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}?month=${month}`)}
        columns={[
          ...basePersonColumns(navigate).slice(0, 4),
          { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
          { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
        ]}
      />
      <h2 className="section-title" style={{ marginTop: 24 }}>
        Pending pay setup ({pending.length})
      </h2>
      <DataTable
        rows={pending}
        loading={loading}
        emptyTitle="Everyone has pay configured"
        emptyDescription="All people in both directories have a pay type."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}?month=${month}`)}
        columns={basePersonColumns(navigate).slice(0, 5)}
      />
    </>
  );
}

export function PayrollPayslipsPage() {
  const navigate = useNavigate();
  const { rows, error, loading, load } = useSalaryList();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (kind && row.personKind !== kind) return false;
      return matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']);
    });
  }, [rows, query, kind]);

  function exportExcel() {
    downloadTableExcel(
      'Payslips',
      ['ID', 'Name', 'Directory', 'Pay type', 'Department', 'Gross', 'Net'],
      filtered.map((row) => [
        row.employeeNumber,
        personName(row),
        directoryLabel(row.personKind),
        payTypeLabel(row.employmentType),
        row.department,
        row.gross ?? '',
        row.net ?? '',
      ]),
      `BGT-payslips-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ margin: 0, minWidth: 200 }}>
            <span>Search</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ID, department" />
          </label>
          <label className="field" style={{ margin: 0, minWidth: 140 }}>
            <span>Directory</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All</option>
              <option value="STAFF">On-Role</option>
              <option value="EMPLOYEE">Contract</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={exportExcel} disabled={!filtered.length}>
          Export Excel
        </button>
      </div>
      <DataTable
        rows={filtered}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No people"
        emptyDescription="On-Role and Contract directories appear here."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          ...basePersonColumns(navigate).slice(0, 4),
          { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
          { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
        ]}
      />
    </>
  );
}

function ComplianceToolbar({ query, setQuery, onExport, exportDisabled, children }) {
  return (
    <div className="list-toolbar list-toolbar-split">
      <label className="field" style={{ margin: 0, minWidth: 220 }}>
        <span>Search</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ID, department" />
      </label>
      <div className="toolbar-actions">
        {children}
        <button className="btn btn-primary" type="button" onClick={onExport} disabled={exportDisabled}>
          Export Excel
        </button>
      </div>
    </div>
  );
}

export function PayrollDeductionsPage() {
  const navigate = useNavigate();
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data)
      .map((row) => ({
        ...row,
        totalDeductions:
          Number(row.employeePf || 0) +
          Number(row.employeeEsi || 0) +
          Number(row.professionalTax || 0) +
          Number(row.tds || 0) +
          Number(row.lunch || 0),
      }))
      .filter((row) => matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']));
  }, [data, query]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        pf: acc.pf + Number(row.employeePf || 0),
        esi: acc.esi + Number(row.employeeEsi || 0),
        pt: acc.pt + Number(row.professionalTax || 0),
        tds: acc.tds + Number(row.tds || 0),
        lunch: acc.lunch + Number(row.lunch || 0),
        all: acc.all + Number(row.totalDeductions || 0),
      }),
      { pf: 0, esi: 0, pt: 0, tds: 0, lunch: 0, all: 0 }
    );
  }, [rows]);

  function exportExcel() {
    downloadTableExcel(
      'Deductions',
      ['ID', 'Name', 'Directory', 'Emp PF', 'ESI', 'PT', 'TDS', 'Lunch', 'Total'],
      rows.map((row) => [
        row.employeeNumber,
        personName(row),
        directoryLabel(row.personKind),
        row.employeePf ?? '',
        row.employeeEsi ?? '',
        row.professionalTax ?? '',
        row.tds ?? '',
        row.lunch ?? '',
        row.totalDeductions ?? '',
      ]),
      `BGT-deductions-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-6">
        <KpiCard label="Employee PF" value={formatMoney(totals.pf)} />
        <KpiCard label="Employee ESI" value={formatMoney(totals.esi)} />
        <KpiCard label="PT" value={formatMoney(totals.pt)} />
        <KpiCard label="TDS" value={formatMoney(totals.tds)} />
        <KpiCard label="Lunch / canteen" value={formatMoney(totals.lunch)} />
        <KpiCard label="Total deductions" value={formatMoney(totals.all)} />
      </div>
      <ComplianceToolbar query={query} setQuery={setQuery} onExport={exportExcel} exportDisabled={!rows.length} />
      <p className="muted">{data?.note || 'Deductions from current salary masters.'}</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No deduction rows"
        emptyDescription="Set pay on a person payslip to populate deductions."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          { key: 'name', header: 'Name', render: (row) => <PersonCell primary={personName(row)} secondary={row.department} /> },
          { key: 'employeePf', header: 'PF', render: (row) => formatMoney(row.employeePf) },
          { key: 'employeeEsi', header: 'ESI', render: (row) => formatMoney(row.employeeEsi) },
          { key: 'professionalTax', header: 'PT', render: (row) => formatMoney(row.professionalTax) },
          { key: 'tds', header: 'TDS', render: (row) => formatMoney(row.tds) },
          { key: 'lunch', header: 'Lunch', render: (row) => formatMoney(row.lunch) },
          { key: 'totalDeductions', header: 'Total', render: (row) => formatMoney(row.totalDeductions) },
        ]}
      />
    </>
  );
}

export function PayrollPfPage() {
  const navigate = useNavigate();
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter(
      (row) =>
        matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']) &&
        (Number(row.employeePf || 0) > 0 || Number(row.employerPf || 0) > 0)
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'PF',
      ['ID', 'Name', 'Directory', 'Pay type', 'Employee PF', 'Employer PF'],
      rows.map((row) => [
        row.employeeNumber,
        personName(row),
        directoryLabel(row.personKind),
        payTypeLabel(row.employmentType),
        row.employeePf ?? '',
        row.employerPf ?? '',
      ]),
      `BGT-pf-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-3">
        <KpiCard label="Employee PF" value={formatMoney(data?.employeePf)} />
        <KpiCard label="Employer PF" value={formatMoney(data?.employerPf)} />
        <KpiCard label="People with PF" value={rows.length} />
      </div>
      <ComplianceToolbar query={query} setQuery={setQuery} onExport={exportExcel} exportDisabled={!rows.length} />
      <p className="muted">On-Role: 12% employee / 15% employer on Basic. Contract: EPF cutoff amounts on register.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No PF rows"
        emptyDescription="PF appears once pay is configured."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          { key: 'name', header: 'Name', render: (row) => <PersonCell primary={personName(row)} secondary={row.department} /> },
          { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
          { key: 'employeePf', header: 'Employee PF', render: (row) => formatMoney(row.employeePf) },
          { key: 'employerPf', header: 'Employer PF', render: (row) => formatMoney(row.employerPf) },
        ]}
      />
    </>
  );
}

export function PayrollEsiPage() {
  const navigate = useNavigate();
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter(
      (row) =>
        matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']) &&
        (row.esiApplicable || Number(row.employeeEsi || 0) > 0 || Number(row.employerEsi || 0) > 0)
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'ESI',
      ['ID', 'Name', 'Directory', 'Employee ESI', 'Employer ESI', 'Applicable'],
      rows.map((row) => [
        row.employeeNumber,
        personName(row),
        directoryLabel(row.personKind),
        row.employeeEsi ?? '',
        row.employerEsi ?? '',
        row.esiApplicable ? 'Yes' : 'No',
      ]),
      `BGT-esi-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-4">
        <KpiCard label="Employee ESI" value={formatMoney(data?.employeeEsi)} />
        <KpiCard label="Employer ESI" value={formatMoney(data?.employerEsi)} />
        <KpiCard label="ESI covered" value={data?.esiCovered} />
        <KpiCard label="In this view" value={rows.length} />
      </div>
      <ComplianceToolbar query={query} setQuery={setQuery} onExport={exportExcel} exportDisabled={!rows.length} />
      <p className="muted">ESI applies on Contract register when gross is within the statutory ceiling.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No ESI rows"
        emptyDescription="Contract employees within ESI limits show here."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          { key: 'name', header: 'Name', render: (row) => <PersonCell primary={personName(row)} secondary={row.department} /> },
          { key: 'employeeEsi', header: 'Employee ESI', render: (row) => formatMoney(row.employeeEsi) },
          { key: 'employerEsi', header: 'Employer ESI', render: (row) => formatMoney(row.employerEsi) },
          {
            key: 'esiApplicable',
            header: 'Applicable',
            render: (row) => (row.esiApplicable ? 'Yes' : 'No'),
          },
        ]}
      />
    </>
  );
}

export function PayrollPtPage() {
  const navigate = useNavigate();
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter(
      (row) =>
        matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']) &&
        Number(row.professionalTax || 0) > 0
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'PT',
      ['ID', 'Name', 'Directory', 'Pay type', 'Professional tax'],
      rows.map((row) => [
        row.employeeNumber,
        personName(row),
        directoryLabel(row.personKind),
        payTypeLabel(row.employmentType),
        row.professionalTax ?? '',
      ]),
      `BGT-pt-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-3">
        <KpiCard label="Total PT" value={formatMoney(data?.professionalTax)} />
        <KpiCard label="People with PT" value={rows.length} />
        <KpiCard label="Note" value="TN slabs" hint="₹0 / ₹150 / ₹200 or manual override" />
      </div>
      <ComplianceToolbar query={query} setQuery={setQuery} onExport={exportExcel} exportDisabled={!rows.length} />
      <p className="muted">On-Role auto-applies ₹200 above ₹15,000 gross. Contract uses TN slab or manual PT on payslip.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No PT rows"
        emptyDescription="PT appears when applicable for the person's gross."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          { key: 'name', header: 'Name', render: (row) => <PersonCell primary={personName(row)} secondary={row.department} /> },
          {
            key: 'employmentType',
            header: 'Pay type',
            render: (row) => (row.employmentType ? <StatusBadge value={payTypeLabel(row.employmentType)} /> : '—'),
          },
          { key: 'professionalTax', header: 'PT', render: (row) => formatMoney(row.professionalTax) },
        ]}
      />
    </>
  );
}

export function PayrollTdsPage() {
  const navigate = useNavigate();
  const { data, error, loading, load } = useReport('/api/hr/reports/compliance');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return payRows(data).filter(
      (row) =>
        matchesQuery(row, query, ['employeeNumber', 'firstName', 'lastName', 'department']) &&
        Number(row.tds || 0) > 0
    );
  }, [data, query]);

  function exportExcel() {
    downloadTableExcel(
      'TDS',
      ['ID', 'Name', 'Directory', 'TDS'],
      rows.map((row) => [row.employeeNumber, personName(row), directoryLabel(row.personKind), row.tds ?? '']),
      `BGT-tds-${fileStamp()}.xls`
    );
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-3">
        <KpiCard label="Total TDS" value={formatMoney(data?.tds)} />
        <KpiCard label="People with TDS" value={rows.length} />
        <KpiCard label="Engine" value="Manual" hint="Amount or rate on On-Role payslip" />
      </div>
      <ComplianceToolbar query={query} setQuery={setQuery} onExport={exportExcel} exportDisabled={!rows.length} />
      <p className="muted">TDS is entered on the On-Role payslip. A full tax engine is not built yet.</p>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No TDS rows"
        emptyDescription="Set TDS amount or rate on the person payslip."
        onRowClick={(row) => navigate(`/hr/salary/${row.personKind}/${row.personId}`)}
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
          { key: 'name', header: 'Name', render: (row) => <PersonCell primary={personName(row)} secondary={row.department} /> },
          { key: 'personKind', header: 'Directory', render: (row) => directoryLabel(row.personKind) },
          { key: 'tds', header: 'TDS', render: (row) => formatMoney(row.tds) },
        ]}
      />
    </>
  );
}
