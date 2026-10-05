import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { downloadContractPayslipExcel, downloadOnRolePayslipExcel } from '../utils/exportExcel';
import { directoryLabel, formatMoney, payTypeLabel } from '../utils/format';

const CONTRACT_SALARIES = [16500, 17000, 18500, 19000, 19300, 19500, 20000, 22000, 23000, 24000, 25500, 27000];

function contractSalaryValue(value) {
  if (value == null || value === '') return '';
  const matched = CONTRACT_SALARIES.find((amount) => Number(amount) === Number(value));
  return matched == null ? String(value) : String(matched);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const PAYROLL_COLUMNS = [
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

function isOnRoleRow(row) {
  return row.employmentType === 'BGTEMP' || (!row.employmentType && row.personKind === 'STAFF');
}

function isContractRow(row) {
  return row.employmentType === 'CONTRACTEMP' || (!row.employmentType && row.personKind === 'EMPLOYEE');
}

export function SalaryPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openRegister, setOpenRegister] = useState(null);

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

  const onRoleRows = rows.filter(isOnRoleRow);
  const contractRows = rows.filter(isContractRow);
  const onRolePaid = onRoleRows.filter((row) => row.employmentType === 'BGTEMP');
  const contractPaid = contractRows.filter((row) => row.employmentType === 'CONTRACTEMP');
  const onRoleNet = onRolePaid.reduce((sum, row) => sum + Number(row.net || 0), 0);
  const contractNet = contractPaid.reduce((sum, row) => sum + Number(row.net || 0), 0);
  const netTotal = onRoleNet + contractNet;

  function toggleRegister(register) {
    setOpenRegister((current) => (current === register ? null : register));
  }

  const registerOpen = openRegister === 'on-role' || openRegister === 'contract';
  const visibleRows = openRegister === 'on-role' ? onRoleRows : openRegister === 'contract' ? contractRows : [];

  return (
    <>
      <PageHeader
        title="Payroll"
        description="On-Role CTC payslip vs Contract payroll register. Open a person for the payslip."
      />
      <div className="kpi-grid kpi-grid-5">
        <KpiCard
          label="On-Role"
          value={loading ? '—' : onRolePaid.length}
          hint="STAFF · BGTEMP CTC sheet"
          active={openRegister === 'on-role'}
          onClick={() => toggleRegister('on-role')}
        />
        <KpiCard
          label="Contract"
          value={loading ? '—' : contractPaid.length}
          hint="erp.employees · three-section register"
          active={openRegister === 'contract'}
          onClick={() => toggleRegister('contract')}
        />
        <KpiCard
          label="Net this run"
          value={loading ? '—' : formatMoney(netTotal)}
          hint="On-Role: present = month days − LOPs. Contract: earned = paid days / actual days"
        />
        <KpiCard
          label="Total On-Role net pay"
          value={loading ? '—' : formatMoney(onRoleNet)}
          hint="Net Payt of Salary · current month run"
        />
        <KpiCard
          label="Contract total employee net pay"
          value={loading ? '—' : formatMoney(contractNet)}
          hint="Final net pay · not invoice total"
        />
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
              ? 'Add people in BGT EMP, then set their pay type here.'
              : 'Summary cards stay on this tab. Open a person from the register for the payslip.'
          }
          columns={PAYROLL_COLUMNS}
        />
      </div>
    </>
  );
}

const emptyPay = {
  employmentType: 'BGTEMP',
  salary: '',
  month: currentMonth(),
  actualDays: '',
  paidDays: '26',
  otHours: '0',
  basic: '',
  hra: '',
  location: '',
  retentionAllowance: '',
  flexiBenefits: '',
  bonusLta: '',
  lops: '0',
  presentDays: '',
  lunch: '',
  tdsAmount: '',
  tdsRate: '0',
  professionalTax: '',
  daysWorked: '22',
  specialAllowance: '',
  da: '',
  bonus: '',
  leaveWithWages: '',
  dayAllowance: '',
  otherCanteen: '',
  serviceCharges: '',
  gstRate: '0.18',
  epfCutoff: '12000',
  epfCutoffEmployer: '12000',
  overtimeAmount: '',
};

export function PayslipPage() {
  const { personKind, personId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(emptyPay);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const daysFromQuery = searchParams.get('days');
  const monthFromQuery = searchParams.get('month');
  const staffOnly = personKind === 'STAFF';

  async function load(overrides = {}) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ personKind, personId });
      const month = overrides.month ?? form.month ?? monthFromQuery ?? currentMonth();
      const daysWorked = overrides.daysWorked ?? daysFromQuery;
      const actualDays = overrides.actualDays;
      const paidDays = overrides.paidDays;
      const otHours = overrides.otHours;
      const lops = overrides.lops;
      const presentDays = overrides.presentDays;
      if (month) params.set('month', month);
      if (daysWorked) params.set('daysWorked', daysWorked);
      if (actualDays) params.set('actualDays', actualDays);
      if (paidDays) params.set('paidDays', paidDays);
      if (otHours != null && otHours !== '') params.set('otHours', otHours);
      if (lops != null && lops !== '') params.set('lops', lops);
      if (presentDays != null && presentDays !== '') params.set('presentDays', presentDays);
      const payslip = await api(`/api/hr/salary/payslip?${params}`);
      setData(payslip);
      const profile = payslip.profile || {};
      const period = payslip.period || {};
      setForm((current) => ({
        ...current,
        employmentType: profile.employmentType || (personKind === 'EMPLOYEE' ? 'CONTRACTEMP' : 'BGTEMP'),
        salary: contractSalaryValue(profile.salary),
        month: period.month || month,
        actualDays: String(period.noOfDays ?? profile.actualDays ?? ''),
        paidDays: String(period.presentInDays ?? profile.paidDays ?? 26),
        otHours: moneyField(profile.otHours) || '0',
        basic: moneyField(profile.basic),
        hra: moneyField(profile.hra),
        location: profile.location || payslip.person?.department || '',
        retentionAllowance: moneyField(profile.retentionAllowance),
        flexiBenefits: moneyField(profile.flexiBenefits),
        bonusLta: moneyField(profile.bonusLta),
        lops: String(period.lops ?? profile.lops ?? 0),
        presentDays: String(period.presentInDays ?? ''),
        lunch: moneyField(profile.lunch),
        tdsAmount: moneyField(profile.tdsAmount),
        tdsRate: profile.tdsRate == null ? '0' : String(profile.tdsRate),
        professionalTax: moneyField(profile.professionalTax),
        daysWorked: String(payslip.daysWorked ?? 22),
        specialAllowance: moneyField(profile.specialAllowance),
        da: moneyField(profile.da),
        bonus: moneyField(profile.bonus),
        leaveWithWages: moneyField(profile.leaveWithWages),
        dayAllowance: moneyField(profile.dayAllowance),
        otherCanteen: moneyField(profile.otherCanteen ?? profile.lunch),
        serviceCharges: moneyField(profile.serviceCharges),
        gstRate: profile.gstRate == null ? '0.18' : String(profile.gstRate),
        epfCutoff: moneyField(profile.epfCutoff) || '12000',
        epfCutoffEmployer: moneyField(profile.epfCutoffEmployer) || '12000',
        overtimeAmount: moneyField(profile.overtimeAmount),
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ month: monthFromQuery || currentMonth() });
    // First open uses calendar days and attendance when present; form overrides come later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personKind, personId, daysFromQuery, monthFromQuery]);

  const person = data?.person;
  const slip = data?.slip;
  const sheet = data?.bgtemp;
  const contractSheet = data?.contractemp;
  const period = data?.period;
  const isContract = personKind === 'EMPLOYEE';

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payslip = await api('/api/hr/salary', {
        method: 'POST',
        body: JSON.stringify({
          personId,
          personKind,
          employmentType: staffOnly ? 'BGTEMP' : 'CONTRACTEMP',
          salary: numberOrNull(form.salary),
          actualDays: numberOrNull(form.actualDays),
          paidDays: numberOrNull(form.paidDays),
          otHours: isContract ? numberOrNull(form.otHours) : null,
          overtimeAmount: isContract ? numberOrNull(form.overtimeAmount) : null,
          basic: numberOrNull(form.basic),
          hra: isContract ? null : numberOrNull(form.hra),
          location: form.location || null,
          retentionAllowance: isContract ? null : numberOrNull(form.retentionAllowance),
          flexiBenefits: isContract ? null : numberOrNull(form.flexiBenefits),
          bonusLta: isContract ? null : numberOrNull(form.bonusLta),
          lops: numberOrNull(form.lops),
          presentDays: isContract ? numberOrNull(form.paidDays) : numberOrNull(form.presentDays),
          lunch: isContract ? numberOrNull(form.otherCanteen) : numberOrNull(form.lunch),
          otherCanteen: isContract ? numberOrNull(form.otherCanteen) : null,
          tdsAmount: isContract ? null : numberOrNull(form.tdsAmount),
          tdsRate: isContract ? null : numberOrNull(form.tdsRate),
          professionalTax: numberOrNull(form.professionalTax),
          specialAllowance: isContract ? numberOrNull(form.specialAllowance) : null,
          da: isContract ? numberOrNull(form.da) : null,
          bonus: numberOrNull(form.bonus),
          leaveWithWages: isContract ? numberOrNull(form.leaveWithWages) : null,
          dayAllowance: isContract ? numberOrNull(form.dayAllowance) : null,
          serviceCharges: isContract ? numberOrNull(form.serviceCharges) : null,
          gstRate: isContract ? numberOrNull(form.gstRate) : null,
          epfCutoff: isContract ? numberOrNull(form.epfCutoff) : null,
          epfCutoffEmployer: isContract ? numberOrNull(form.epfCutoffEmployer) : null,
          daysWorked: numberOrNull(form.daysWorked),
          month: form.month || null,
        }),
      });
      setData(payslip);
      const nextPeriod = payslip.period || {};
      setForm((current) => ({
        ...current,
        actualDays: String(nextPeriod.noOfDays ?? current.actualDays),
        lops: String(nextPeriod.lops ?? current.lops),
        presentDays: String(nextPeriod.presentInDays ?? current.presentDays),
        paidDays: String(nextPeriod.presentInDays ?? current.paidDays),
        basic: moneyField(payslip.profile?.basic) || current.basic,
        bonusLta: moneyField(payslip.profile?.bonusLta) || current.bonusLta,
        salary: contractSalaryValue(payslip.profile?.salary) || current.salary,
        specialAllowance: moneyField(payslip.profile?.specialAllowance) || current.specialAllowance,
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function recalculate(event) {
    event.preventDefault();
    if (isContract) {
      await load({
        actualDays: form.actualDays,
        paidDays: form.paidDays,
        otHours: form.otHours,
        lops: form.lops,
        month: form.month,
      });
      return;
    }
    await load({
      month: form.month,
      actualDays: form.actualDays,
      lops: form.lops,
      presentDays: form.presentDays,
    });
  }

  async function loadMonth(month) {
    update('month', month);
    await load({ month });
  }

  const title = useMemo(() => {
    if (!person) return 'Payslip';
    return person.displayName;
  }, [person]);

  return (
    <>
      <PageHeader
        title={title}
        description={
          person
            ? `${person.employeeNumber} · ${directoryLabel(person.kind)}${
                person.hiredOn ? ` · DOJ ${person.hiredOn}` : ''
              }${person.title ? ` · ${person.title}` : ''}${person.department ? ` · ${person.department}` : ''}`
            : 'Load pay structure and calculate net.'
        }
        actions={
          <>
            {sheet ? (
              <button
                className="btn"
                type="button"
                onClick={() =>
                  downloadOnRolePayslipExcel(sheet, {
                    month: form.month || period?.month,
                    filename: `BGT-onrole-payslip-${person?.employeeNumber || 'staff'}-${form.month || 'month'}.xls`,
                  })
                }
              >
                Export Excel
              </button>
            ) : null}
            {contractSheet ? (
              <button
                className="btn"
                type="button"
                onClick={() =>
                  downloadContractPayslipExcel(contractSheet, {
                    month: form.month || period?.month,
                    filename: `BGT-contract-payslip-${person?.employeeNumber || 'employee'}-${form.month || 'month'}.xls`,
                  })
                }
              >
                Export Excel
              </button>
            ) : null}
            <button className="btn" type="button" onClick={() => navigate('/hr/salary')}>
              Back to payroll
            </button>
          </>
        }
      />
      {error ? <div className="form-error">{error}</div> : null}
      {loading && !data ? <p className="muted">Loading payslip…</p> : null}
      {sheet ? <OnRolePayslipSheet sheet={sheet} person={person} period={period} /> : null}
      {contractSheet ? <ContractEmpSheet sheet={contractSheet} person={person} period={period} /> : null}
      {!sheet && !contractSheet && slip ? (
        <div className="split-2" style={{ marginBottom: 16 }}>
          <div className="panel">
            <div className="panel-pad">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Earnings
              </h2>
              <ul className="payslip-lines">
                {slip.earnings.map((line) => (
                  <li key={line.label}>
                    <span>{line.label}</span>
                    <span className="mono">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="payslip-total">
                <span>Gross</span>
                <span className="mono">{formatMoney(slip.gross)}</span>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-pad">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Deductions
              </h2>
              <ul className="payslip-lines">
                {slip.deductions.map((line) => (
                  <li key={line.label}>
                    <span>{line.label}</span>
                    <span className="mono">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="payslip-total">
                <span>Net pay</span>
                <span className="mono">{formatMoney(slip.net)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="panel">
        <form className="panel-pad emp-form" onSubmit={handleSave}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            {data?.profile ? 'Pay structure' : 'Set pay type'}
          </h2>
          <div className="form-grid">
            <label className="field">
              <span>Pay type</span>
              <select
                value={staffOnly ? 'BGTEMP' : isContract ? 'CONTRACTEMP' : form.employmentType}
                onChange={(event) => update('employmentType', event.target.value)}
                disabled={staffOnly || personKind === 'EMPLOYEE'}
              >
                <option value="BGTEMP">On-Role</option>
                <option value="CONTRACTEMP">Contract</option>
              </select>
            </label>
            <label className="field">
              <span>Payslip month</span>
              <input
                type="month"
                value={form.month}
                onChange={(event) => loadMonth(event.target.value)}
              />
            </label>
            {isContract ? (
              <>
                <label className="field">
                  <span>Salary (₹)</span>
                  <select
                    className="mono"
                    value={form.salary}
                    onChange={(event) => update('salary', event.target.value)}
                    required
                  >
                    <option value="">Select structure</option>
                    {CONTRACT_SALARIES.map((amount) => (
                      <option key={amount} value={amount}>
                        {amount}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Paid days</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    max="31"
                    value={form.paidDays}
                    onChange={(event) => update('paidDays', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>OT hours</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.otHours}
                    onChange={(event) => update('otHours', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Other / Canteen (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.otherCanteen}
                    onChange={(event) => update('otherCanteen', event.target.value)}
                    placeholder="Fixed amount — no formula"
                  />
                </label>
                <label className="field">
                  <span>Professional tax (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.professionalTax}
                    onChange={(event) => update('professionalTax', event.target.value)}
                    placeholder="Blank = TN slab ₹0 / ₹150 / ₹200"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Location</span>
                  <input
                    value={form.location}
                    onChange={(event) => update('location', event.target.value)}
                    placeholder="Work location"
                  />
                </label>
                <label className="field">
                  <span>CTC per month (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salary}
                    onChange={(event) => update('salary', event.target.value)}
                    placeholder="Monthly CTC"
                    required
                  />
                </label>
                <label className="field">
                  <span>Basic (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.basic}
                    onChange={(event) => update('basic', event.target.value)}
                    placeholder="Blank = 40% of CTC"
                  />
                </label>
                <label className="field">
                  <span>Retention allowance (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.retentionAllowance}
                    onChange={(event) => update('retentionAllowance', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>HRA (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hra}
                    onChange={(event) => update('hra', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Flexi benefits (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.flexiBenefits}
                    onChange={(event) => update('flexiBenefits', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Bonus (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.bonus}
                    onChange={(event) => update('bonus', event.target.value)}
                    placeholder="Blank = 25% of Basic"
                  />
                </label>
                <label className="field">
                  <span>LTA (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.bonusLta}
                    onChange={(event) => update('bonusLta', event.target.value)}
                    placeholder="Blank = 8.33% of Basic"
                  />
                </label>
                <label className="field">
                  <span>Employer PF in CTC</span>
                  <input
                    className="mono"
                    readOnly
                    value={sheet?.pf != null ? formatMoney(sheet.pf) : '15% of Basic (after save)'}
                  />
                </label>
                <label className="field">
                  <span>CTC / annum · Monthly gross</span>
                  <input
                    className="mono"
                    readOnly
                    value={
                      sheet
                        ? `${formatMoney(sheet.ctcPerAnnum)} · ${formatMoney(sheet.monthlyGrossSalary)}`
                        : 'After save / calculate'
                    }
                  />
                </label>
                <label className="field">
                  <span>No of days</span>
                  <input
                    className="mono"
                    type="number"
                    min="1"
                    max="31"
                    value={form.actualDays}
                    onChange={(event) => update('actualDays', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>LOPs</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    max="31"
                    value={form.lops}
                    onChange={(event) => update('lops', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Present in days</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    max="31"
                    value={form.presentDays}
                    onChange={(event) => update('presentDays', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>TDS amount (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tdsAmount}
                    onChange={(event) => update('tdsAmount', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>TDS rate</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={form.tdsRate}
                    onChange={(event) => update('tdsRate', event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>PT (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.professionalTax}
                    onChange={(event) => update('professionalTax', event.target.value)}
                    placeholder="Blank = auto ₹200 over ₹15,000"
                  />
                </label>
                <label className="field">
                  <span>Lunch (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.lunch}
                    onChange={(event) => update('lunch', event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {isContract
              ? 'Contract register uses the 12 salary structures. Leave with wages is the residual one-day structure (Salary − Basic − DA − Special), then × Paid Days / 26 — not Salary/26 × paid days as extra gross. Basic/DA/Special/LWW prorate by Paid Days / 26. Bonus is ₹0. Day allowance is only for paid days above 26.'
              : 'On-Role CTC sheet: Basic is stored if set, otherwise 40% of CTC per month (photo; was 10%). Employer PF in CTC is 15% of Basic. Bonus defaults to 25% of Basic; LTA to 8.33% of Basic. Monthly amounts prorate by present days / calendar days. Employee PF is 12% of earned Basic (₹18,000 cutoff).'}
          </p>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save and calculate'}
            </button>
            {data?.profile ? (
              <button className="btn" type="button" onClick={recalculate} disabled={saving || loading}>
                Recalculate
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}

function OnRolePayslipSheet({ sheet, person, period }) {
  const structureHeaders = [
    'SI No.',
    'Name of Employee',
    'Designation',
    'Location',
    'Basic (40% of CTC)',
    'Retention Allowance',
    'HRA',
    'Flexi Benefits',
    'PF (15%)',
    'Bonus (25%)',
    'LTA (8.33%)',
    'CTC Per Month',
    'CTC Per Annum',
    'Monthly Gross Salary',
  ];
  const payoutHeaders = [
    'No of Days',
    'LOPs',
    'Present in Days',
    'Basic',
    'Retention Allowance',
    'HRA',
    'Flexi Benefits',
    'Net Salary',
    'Less : Employee PF',
    'Less : PT',
    'Less : TDS',
    'LUNCH',
    'Net Payt of Salary',
  ];
  const structureValues = [
    1,
    sheet.employeeName,
    sheet.designation || person?.title || '—',
    sheet.location || person?.department || '—',
    formatMoney(sheet.basic),
    formatMoney(sheet.retentionAllowance),
    formatMoney(sheet.hra),
    formatMoney(sheet.flexiBenefits),
    formatMoney(sheet.pf),
    formatMoney(sheet.bonus),
    formatMoney(sheet.lta),
    formatMoney(sheet.ctcPerMonth),
    formatMoney(sheet.ctcPerAnnum),
    formatMoney(sheet.monthlyGrossSalary),
  ];
  const payoutValues = [
    sheet.noOfDays,
    sheet.lops,
    sheet.presentInDays,
    formatMoney(sheet.earnedBasic),
    formatMoney(sheet.earnedRetentionAllowance),
    formatMoney(sheet.earnedHra),
    formatMoney(sheet.earnedFlexiBenefits),
    formatMoney(sheet.netSalary),
    formatMoney(sheet.employeePf),
    formatMoney(sheet.professionalTax),
    formatMoney(sheet.tds),
    formatMoney(sheet.lunch),
    formatMoney(sheet.netPaytOfSalary),
  ];
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          On-Role payslip{period?.month ? ` · ${period.month}` : ''}
        </h2>
        {period?.attendanceApplied ? (
          <p className="muted">
            Present days taken from attendance punches ({period.attendancePresentDays} distinct days).
          </p>
        ) : (
          <p className="muted">No attendance punches for this month — enter LOP / present days below if needed.</p>
        )}
        <div className="table-wrap">
          <table className="data-table payslip-paper">
            <thead>
              <tr>
                {structureHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {structureValues.map((value, index) => (
                  <td key={structureHeaders[index]} className="mono">
                    {value}
                  </td>
                ))}
              </tr>
              <tr>
                {payoutHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
              <tr>
                {payoutValues.map((value, index) => (
                  <td key={payoutHeaders[index]} className="mono">
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={13}>On-Role</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContractEmpSheet({ sheet, person, period }) {
  const actualHeaders = [
    'S NO',
    'Employee Id',
    'Employee Name',
    'Date of Joining',
    'SALARY',
    'Actual BASIC',
    'Actual DA',
    'Actual SPECIAL ALLOWANCE',
    'Actual Bonus',
    'Actual LEAVE WITH WAGES',
    'Actual Total Gross',
    'Actual Days',
    'Paid Days',
  ];
  const earnedHeaders = [
    '1 Day Attendance',
    'OT Hours',
    'Earned Basic',
    'Earned DA',
    'Earned Special Allowance',
    'Earned Bonus/Arrears/Other Allowance',
    'Earned Leave with Wages',
    'Day Allowance',
    'Overtime',
    'Earned Gross',
    'EPF Cut OFF Amount Employee',
    'Employee PF',
  ];
  const invoiceHeaders = [
    'Employee ESI',
    'Professional Tax',
    'Other/Canteen',
    'Total Deductions',
    'Final Net Pay',
    'EPF Cut OFF Amount Employer',
    'Employer PF',
    'Employer ESI',
    'Service Charges',
    'Total Gross',
    'GST AMOUNT',
    'TOTAL INVOICE AMOUNT',
  ];
  const actualValues = [
    sheet.serialNo ?? 1,
    sheet.employeeId || person?.employeeNumber || '—',
    sheet.employeeName,
    sheet.dateOfJoining || person?.hiredOn || '—',
    formatMoney(sheet.salary),
    formatMoney(sheet.actualBasic),
    formatMoney(sheet.actualDa),
    formatMoney(sheet.actualSpecialAllowance),
    formatMoney(sheet.actualBonus),
    formatMoney(sheet.actualLeaveWithWages),
    formatMoney(sheet.actualTotalGross),
    sheet.actualDays,
    sheet.paidDays,
  ];
  const earnedValues = [
    formatMoney(sheet.oneDayAttendance),
    sheet.otHours ?? 0,
    formatMoney(sheet.earnedBasic),
    formatMoney(sheet.earnedDa),
    formatMoney(sheet.earnedSpecialAllowance),
    formatMoney(sheet.earnedBonusOther),
    formatMoney(sheet.earnedLeaveWithWages),
    formatMoney(sheet.dayAllowance),
    formatMoney(sheet.overtime),
    formatMoney(sheet.earnedGross),
    formatMoney(sheet.epfCutoffEmployee),
    formatMoney(sheet.employeePf),
  ];
  const invoiceValues = [
    formatMoney(sheet.employeeEsi),
    formatMoney(sheet.professionalTax),
    formatMoney(sheet.otherCanteen),
    formatMoney(sheet.totalDeductions),
    formatMoney(sheet.finalNetPay),
    formatMoney(sheet.epfCutoffEmployer),
    formatMoney(sheet.employerPf),
    formatMoney(sheet.employerEsi),
    formatMoney(sheet.serviceCharges),
    formatMoney(sheet.invoiceTotalGross),
    formatMoney(sheet.gstAmount),
    formatMoney(sheet.totalInvoiceAmount),
  ];
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Contract payslip{period?.month ? ` · ${period.month}` : ''}
        </h2>
        {period?.attendanceApplied ? (
          <p className="muted">
            Paid days taken from attendance punches ({period.attendancePresentDays} distinct days).
          </p>
        ) : (
          <p className="muted">No attendance punches for this month — enter paid days below if needed.</p>
        )}
        <div className="table-wrap">
          <table className="data-table payslip-paper">
            <thead>
              <tr>
                {actualHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {actualValues.map((value, index) => (
                  <td key={actualHeaders[index]} className="mono">
                    {value}
                  </td>
                ))}
              </tr>
              <tr>
                {earnedHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
              <tr>
                {earnedValues.map((value, index) => (
                  <td key={earnedHeaders[index]} className="mono">
                    {value}
                  </td>
                ))}
              </tr>
              <tr>
                {invoiceHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
              <tr>
                {invoiceValues.map((value, index) => (
                  <td key={invoiceHeaders[index]} className="mono">
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={13}>Contract</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function SheetSection({ title, cells }) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        <div className="sheet-grid">
          {cells.map((cell) => (
            <div className="sheet-cell" key={cell.label}>
              <div className="label">{cell.label}</div>
              <div className="value mono">{cell.money === false ? cell.value ?? '—' : formatMoney(cell.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function moneyField(value) {
  return value == null || value === '' ? '' : String(value);
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  return Number(value);
}
