import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { canEditBgtPackage, formatMoney } from '../utils/format';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Payroll window for labelled month: previous 26th → this month's 25th. */
function payrollPeriodForMonth(yearMonth) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(yearMonth || '').trim());
  if (!m) return { from: '', to: '' };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const prev = mo === 1 ? { y: y - 1, m: 12 } : { y, m: mo - 1 };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${prev.y}-${pad(prev.m)}-26`,
    to: `${y}-${pad(mo)}-25`,
  };
}

function formatPeriodLabel(fromYmd, toYmd) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const parse = (ymd) => {
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!p) return null;
    return new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3])));
  };
  const from = parse(fromYmd);
  const to = parse(toYmd);
  if (!from || !to) return '';
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyInput(v) {
  if (v === '' || v == null) return '';
  return String(v);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Optional formula fill from Salary (50%/50% or keep special); does not run on every keystroke. */
function recomputePackage(pkg) {
  const salary = num(pkg.salary);
  const basic = round2(salary * 0.5);
  const da = round2(salary * 0.5);
  const special = num(pkg.actualSpecialAllowance);
  const bonus = num(pkg.actualBonus);
  const lww = Math.max(0, round2(salary - basic - da - special));
  const gross = round2(basic + da + special + bonus + lww);
  return {
    ...pkg,
    actualBasic: basic,
    actualDa: da,
    actualLeaveWithWages: lww,
    actualTotalGross: gross,
    actualDays: pkg.actualDays != null && pkg.actualDays !== '' ? pkg.actualDays : 26,
  };
}

function recomputePackageTotals(pkg) {
  const salary = num(pkg.salary);
  const basic = num(pkg.actualBasic);
  const da = num(pkg.actualDa);
  const special = num(pkg.actualSpecialAllowance);
  const bonus = num(pkg.actualBonus);
  const lww =
    pkg.actualLeaveWithWages != null && pkg.actualLeaveWithWages !== ''
      ? num(pkg.actualLeaveWithWages)
      : Math.max(0, round2(salary - basic - da - special));
  const gross = round2(basic + da + special + bonus + lww);
  return { ...pkg, actualLeaveWithWages: lww, actualTotalGross: gross };
}

function recomputePayoutTotals(p) {
  const earnedGross =
    p.earnedGross != null && p.earnedGross !== ''
      ? num(p.earnedGross)
      : round2(
          num(p.earnedBasic) +
            num(p.earnedDa) +
            num(p.earnedSpecialAllowance) +
            num(p.earnedBonus) +
            num(p.earnedLeaveWithWages) +
            num(p.dayAllowance) +
            num(p.overtime)
        );
  const totalDeductions = round2(
    num(p.employeePf) + num(p.employeeEsi) + num(p.professionalTax) + num(p.otherCanteen)
  );
  const finalNetPay = Math.max(0, round2(earnedGross - totalDeductions));
  const invoiceTotalGross = round2(
    earnedGross + num(p.employerPf) + num(p.employerEsi) + num(p.serviceCharges)
  );
  const gstAmount = round2(invoiceTotalGross * 0.18);
  const totalInvoiceAmount = round2(invoiceTotalGross + gstAmount);
  return {
    ...p,
    earnedGross,
    totalDeductions,
    finalNetPay,
    invoiceTotalGross,
    gstAmount,
    totalInvoiceAmount,
  };
}

function employeeLabel(row) {
  const code = row.employeeNumber || '';
  const name = row.displayName || '';
  if (code && name) return `${code} — ${name}`;
  return code || name || String(row.personId);
}

function TextInput({ value, onChange, readOnly, title }) {
  if (readOnly) {
    return <input className="mono" type="text" readOnly tabIndex={-1} value={value || '—'} title={title} />;
  }
  return (
    <input
      className="mono"
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      title={title}
    />
  );
}

function NumInput({ value, onChange, readOnly, step = '0.01', title }) {
  if (readOnly) {
    const display =
      typeof value === 'number' || (value !== '' && value != null && !Number.isNaN(Number(value)))
        ? formatMoney(value)
        : '—';
    return <input className="mono" type="text" readOnly tabIndex={-1} value={display} title={title} />;
  }
  return (
    <input
      className="mono"
      type="number"
      step={step}
      value={moneyInput(value)}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      title={title}
    />
  );
}

function DaysInput({ value, onChange, readOnly }) {
  if (readOnly) {
    return (
      <input
        className="mono"
        type="text"
        readOnly
        tabIndex={-1}
        value={value === '' || value == null ? '—' : String(value)}
      />
    );
  }
  return (
    <input
      className="mono"
      type="number"
      step="0.5"
      value={moneyInput(value)}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );
}

/**
 * Salary payout → contract work group: pick one employee, edit Package (Row 1) + Payout (Rows 2–3).
 */
export function ContractSalaryPayoutSheet({ workGroup }) {
  const { user } = useAuth();
  const sheetEditable = canEditBgtPackage(user);
  const [yearMonth, setYearMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');

  const applySheet = useCallback((data, keepPersonId) => {
    setSheet(data);
    const next = {};
    for (const row of data.rows || []) {
      next[row.personId] = {
        package: {
          ...row.packageRow,
          displayName: row.packageRow?.displayName ?? row.displayName ?? '',
          dateOfJoining: row.packageRow?.dateOfJoining ?? row.dateOfJoining ?? '',
        },
        payout: { ...row.payoutRow },
      };
    }
    setDrafts(next);
    const ids = new Set((data.rows || []).map((r) => String(r.personId)));
    setSelectedPersonId((prev) => {
      const prefer = keepPersonId != null && keepPersonId !== '' ? String(keepPersonId) : prev;
      if (prefer && ids.has(prefer)) return prefer;
      return '';
    });
  }, []);

  const load = useCallback(
    async (ym, keepPersonId) => {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const data = await api(
          `/api/hr/payroll/contract/sheet?workGroup=${encodeURIComponent(workGroup)}&yearMonth=${encodeURIComponent(ym)}`
        );
        applySheet(data, keepPersonId);
      } catch (err) {
        setSheet(null);
        setDrafts({});
        setSelectedPersonId('');
        setError(extractError(err));
      } finally {
        setLoading(false);
      }
    },
    [applySheet, workGroup]
  );

  useEffect(() => {
    setSelectedPersonId('');
    setEmployeeQuery('');
    load(yearMonth);
  }, [yearMonth, workGroup, load]);

  const rows = useMemo(() => sheet?.rows || [], [sheet]);

  const filteredRows = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.employeeNumber || ''} ${row.displayName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, employeeQuery]);

  const selectedRow = useMemo(() => {
    if (!selectedPersonId) return null;
    return rows.find((r) => String(r.personId) === String(selectedPersonId)) || null;
  }, [rows, selectedPersonId]);

  const dropdownRows = useMemo(() => {
    if (!selectedRow) return filteredRows;
    if (filteredRows.some((r) => String(r.personId) === String(selectedRow.personId))) return filteredRows;
    return [selectedRow, ...filteredRows];
  }, [filteredRows, selectedRow]);

  function patchPackage(personId, patch, recomputeTotals = false) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      let pkg = { ...cur.package, ...patch };
      if (recomputeTotals) pkg = recomputePackageTotals(pkg);
      return { ...prev, [personId]: { ...cur, package: pkg } };
    });
  }

  function recalcPackageFromSalary(personId) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      return { ...prev, [personId]: { ...cur, package: recomputePackage(cur.package || {}) } };
    });
  }

  function patchPayout(personId, patch, recompute = true) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      let payout = { ...cur.payout, ...patch };
      if (recompute) payout = recomputePayoutTotals(payout);
      return { ...prev, [personId]: { ...cur, payout } };
    });
  }

  async function savePackage(row) {
    const key = `pkg:${row.personId}`;
    setBusyKey(key);
    setError('');
    setMessage('');
    try {
      const pkg = drafts[row.personId]?.package || row.packageRow;
      await api('/api/hr/payroll/contract/packages', {
        method: 'PUT',
        body: JSON.stringify({
          personId: row.personId,
          workGroup,
          salary: num(pkg.salary),
          actualBasic: num(pkg.actualBasic),
          actualDa: num(pkg.actualDa),
          actualSpecialAllowance: num(pkg.actualSpecialAllowance),
          actualBonus: num(pkg.actualBonus),
          actualLeaveWithWages: num(pkg.actualLeaveWithWages),
          actualTotalGross: num(pkg.actualTotalGross),
          actualDays: num(pkg.actualDays),
          dateOfJoining: pkg.dateOfJoining || null,
          displayName: pkg.displayName ?? row.displayName ?? '',
        }),
      });
      setMessage(`Saved package for ${row.displayName}`);
      await load(yearMonth, row.personId);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyKey('');
    }
  }

  async function savePayout(row) {
    const key = `pay:${row.personId}`;
    setBusyKey(key);
    setError('');
    setMessage('');
    try {
      const p = drafts[row.personId]?.payout || row.payoutRow;
      await api('/api/hr/payroll/contract/payouts', {
        method: 'PUT',
        body: JSON.stringify({
          personId: row.personId,
          workGroup,
          yearMonth,
          paidDays: num(p.paidDays),
          oneDayAttendance: num(p.oneDayAttendance),
          otHours: num(p.otHours),
          earnedBasic: num(p.earnedBasic),
          earnedDa: num(p.earnedDa),
          earnedSpecialAllowance: num(p.earnedSpecialAllowance),
          earnedBonus: num(p.earnedBonus),
          earnedLeaveWithWages: num(p.earnedLeaveWithWages),
          dayAllowance: num(p.dayAllowance),
          overtime: num(p.overtime),
          earnedGross: num(p.earnedGross),
          epfCutoffEmployee: num(p.epfCutoffEmployee),
          employeePf: num(p.employeePf),
          employeeEsi: num(p.employeeEsi),
          professionalTax: num(p.professionalTax),
          otherCanteen: num(p.otherCanteen),
          totalDeductions: num(p.totalDeductions),
          finalNetPay: num(p.finalNetPay),
          epfCutoffEmployer: num(p.epfCutoffEmployer),
          employerPf: num(p.employerPf),
          employerEsi: num(p.employerEsi),
          serviceCharges: num(p.serviceCharges),
          invoiceTotalGross: num(p.invoiceTotalGross),
          gstAmount: num(p.gstAmount),
          totalInvoiceAmount: num(p.totalInvoiceAmount),
        }),
      });
      setMessage(`Saved payout for ${row.displayName}`);
      await load(yearMonth, row.personId);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyKey('');
    }
  }

  async function refreshAttendance(overwrite) {
    setBusyKey('refresh');
    setError('');
    setMessage('');
    try {
      const data = await api(
        `/api/hr/payroll/contract/payouts/refresh-attendance?workGroup=${encodeURIComponent(workGroup)}&yearMonth=${encodeURIComponent(yearMonth)}&overwriteSaved=${overwrite ? 'true' : 'false'}`,
        { method: 'POST' }
      );
      applySheet(data, selectedPersonId);
      setMessage(overwrite ? 'Payouts refreshed from attendance and saved.' : 'Sheet reloaded (saved payouts kept).');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyKey('');
    }
  }

  const d = selectedRow
    ? drafts[selectedRow.personId] || { package: selectedRow.packageRow, payout: selectedRow.payoutRow }
    : null;
  const pkg = d?.package || selectedRow?.packageRow;
  const pay = d?.payout || selectedRow?.payoutRow;
  const pkgBusy = selectedRow ? busyKey === `pkg:${selectedRow.personId}` : false;
  const payBusy = selectedRow ? busyKey === `pay:${selectedRow.personId}` : false;
  const period =
    sheet?.attendanceFrom && sheet?.attendanceTo
      ? { from: sheet.attendanceFrom, to: sheet.attendanceTo }
      : payrollPeriodForMonth(yearMonth);
  const periodLabel = formatPeriodLabel(period.from, period.to);
  const dojValue =
    typeof pkg?.dateOfJoining === 'string'
      ? pkg.dateOfJoining.slice(0, 10)
      : pkg?.dateOfJoining
        ? String(pkg.dateOfJoining).slice(0, 10)
        : '';

  return (
    <div className="bgt-payout-sheet">
      <div className="list-toolbar list-toolbar-split">
        <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <span>Payout month</span>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" disabled={loading || !!busyKey} onClick={() => load(yearMonth, selectedPersonId)}>
            Refresh
          </button>
          <button
            className="btn"
            type="button"
            disabled={loading || !!busyKey}
            onClick={() => refreshAttendance(false)}
            title="Reload sheet; keeps saved payouts"
          >
            Reload attendance preview
          </button>
          <button
            className="btn"
            type="button"
            disabled={loading || !!busyKey || !sheetEditable}
            onClick={() => {
              if (
                window.confirm(
                  `Overwrite all saved ${workGroup} payouts for this month from attendance + package?`
                )
              ) {
                refreshAttendance(true);
              }
            }}
          >
            Recalc &amp; save all payouts
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8, marginBottom: 12 }}>
        Select a <strong>{workGroup}</strong> contract employee. <strong>Left</strong>: package (set once).{' '}
        <strong>Right</strong>: attendance earnings + deductions / invoice for {yearMonth}
        {periodLabel ? ` (${periodLabel})` : ''} (HR entry).
      </p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="ok-text">{message}</p> : null}
      {loading ? <p className="muted">Loading {workGroup} salary sheet…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="muted">No active {workGroup} contract employees found.</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="bgt-payout-employee-bar">
          <label className="field">
            <span>Filter</span>
            <input
              type="search"
              placeholder="Search code / name…"
              value={employeeQuery}
              onChange={(e) => setEmployeeQuery(e.target.value)}
              aria-label="Filter employees"
            />
          </label>
          <label className="field bgt-payout-employee-select">
            <span>Employee name</span>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              aria-label="Select employee"
            >
              <option value="">Select an employee</option>
              {dropdownRows.map((row) => (
                <option key={row.personId} value={String(row.personId)}>
                  {employeeLabel(row)}
                </option>
              ))}
            </select>
          </label>
          {employeeQuery.trim() && filteredRows.length === 0 ? (
            <span className="muted bgt-payout-employee-empty">No employees match filter.</span>
          ) : null}
        </div>
      ) : null}

      {!loading && rows.length > 0 && !selectedRow ? (
        <p className="muted" style={{ marginTop: 8 }}>
          Select an employee
        </p>
      ) : null}

      {!loading && selectedRow ? (
        <section className="panel bgt-person-block">
          <div className="panel-pad">
            <div className="bgt-payout-person-head">
              <span className="mono muted">#{selectedRow.slNo}</span>
              <strong>{pkg.displayName || selectedRow.displayName}</strong>
              <span className="mono muted">{selectedRow.employeeNumber}</span>
            </div>

            <div className="bgt-payout-columns">
              <div className="bgt-payout-col bgt-payout-col--package">
                <h4 className="section-title bgt-payout-col-title">
                  Actual / package
                  <span className="bgt-payout-col-badge">set once</span>
                  {!selectedRow.packagePersisted ? <span className="muted"> · not saved yet</span> : null}
                  {!sheetEditable ? <span className="muted"> · read-only</span> : null}
                </h4>
                <p className="muted bgt-payout-col-hint">
                  Receipt Contract Row 1. Salary + Actuals (structure or 50%/50% Basic/DA). Paid Days is monthly
                  (saved with payout).
                </p>
                <div className="bgt-payout-fields bgt-payout-fields--package">
                  <label className="field">
                    <span>S NO</span>
                    <input className="mono" type="text" readOnly tabIndex={-1} value={selectedRow.slNo} />
                  </label>
                  <label className="field">
                    <span>Employee Id</span>
                    <input className="mono" type="text" readOnly tabIndex={-1} value={selectedRow.employeeNumber || '—'} />
                  </label>
                  <label className="field">
                    <span>Employee Name</span>
                    <TextInput
                      value={pkg.displayName ?? selectedRow.displayName}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { displayName: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Date of Joining</span>
                    {sheetEditable ? (
                      <input
                        className="mono"
                        type="date"
                        value={dojValue}
                        onChange={(e) => patchPackage(selectedRow.personId, { dateOfJoining: e.target.value || null })}
                      />
                    ) : (
                      <input className="mono" type="text" readOnly tabIndex={-1} value={dojValue || '—'} />
                    )}
                  </label>
                  <label className="field">
                    <span>SALARY</span>
                    <NumInput
                      value={pkg.salary}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { salary: v }, true)}
                    />
                  </label>
                  <label className="field">
                    <span>Actual BASIC (50%)</span>
                    <NumInput
                      value={pkg.actualBasic}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualBasic: v }, true)}
                      title="Default 50% of Salary (or contract_salary_structures)"
                    />
                  </label>
                  <label className="field">
                    <span>Actual DA (50%)</span>
                    <NumInput
                      value={pkg.actualDa}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualDa: v }, true)}
                      title="Default 50% of Salary (or contract_salary_structures)"
                    />
                  </label>
                  <label className="field">
                    <span>Actual SPECIAL ALLOWANCE</span>
                    <NumInput
                      value={pkg.actualSpecialAllowance}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualSpecialAllowance: v }, true)}
                    />
                  </label>
                  <label className="field">
                    <span>Actual Bonus</span>
                    <NumInput
                      value={pkg.actualBonus}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualBonus: v }, true)}
                    />
                  </label>
                  <label className="field">
                    <span>Actual LEAVE WITH WAGES</span>
                    <NumInput
                      value={pkg.actualLeaveWithWages}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualLeaveWithWages: v }, true)}
                      title="Usually Salary − Basic − DA − Special"
                    />
                  </label>
                  <label className="field">
                    <span>Actual Total Gross</span>
                    <NumInput
                      value={pkg.actualTotalGross}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualTotalGross: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Actual Days</span>
                    <DaysInput
                      value={pkg.actualDays}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { actualDays: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Paid Days</span>
                    <DaysInput
                      value={pay.paidDays}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { paidDays: v }, false)}
                      title="Monthly — saved with payout (attendance 26th→25th)"
                    />
                  </label>
                </div>
                {sheetEditable ? (
                  <div className="bgt-payout-col-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!!busyKey}
                      onClick={() => recalcPackageFromSalary(selectedRow.personId)}
                      title="Fill Basic/DA at 50% of Salary and recompute LWW / Gross"
                    >
                      Recalc 50/50 from Salary
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!!busyKey}
                      onClick={() => savePackage(selectedRow)}
                    >
                      {pkgBusy ? 'Saving…' : 'Save package'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="bgt-payout-col bgt-payout-col--payout">
                <h4 className="section-title bgt-payout-col-title">
                  Monthly payout · {yearMonth}
                  <span className="bgt-payout-col-badge bgt-payout-col-badge--muted">attendance</span>
                  {!selectedRow.payoutPersisted ? <span className="muted"> · not saved yet</span> : null}
                  {!sheetEditable ? <span className="muted"> · read-only</span> : null}
                </h4>
                <p className="muted bgt-payout-col-hint">
                  {periodLabel ? (
                    <>Attendance: {periodLabel}. Row 2 earnings + Row 3 deductions / invoice (HR entry).</>
                  ) : (
                    <>Row 2 earnings + Row 3 deductions / invoice for this month (HR entry).</>
                  )}
                </p>

                <h5 className="contract-payout-subhead">Earnings (Row 2)</h5>
                <div className="bgt-payout-fields bgt-payout-fields--payout">
                  <label className="field">
                    <span>1 Day Attendance</span>
                    <NumInput
                      value={pay.oneDayAttendance}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { oneDayAttendance: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>OT Hours</span>
                    <DaysInput
                      value={pay.otHours}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { otHours: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>Earned Basic</span>
                    <NumInput
                      value={pay.earnedBasic}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedBasic: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Earned DA</span>
                    <NumInput
                      value={pay.earnedDa}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedDa: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Earned Special Allowance</span>
                    <NumInput
                      value={pay.earnedSpecialAllowance}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedSpecialAllowance: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Earned Bonus/Arrears/Other Allowance</span>
                    <NumInput
                      value={pay.earnedBonus}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedBonus: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Earned Leave with Wages</span>
                    <NumInput
                      value={pay.earnedLeaveWithWages}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedLeaveWithWages: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Day Allowance</span>
                    <NumInput
                      value={pay.dayAllowance}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { dayAllowance: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Overtime</span>
                    <NumInput
                      value={pay.overtime}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { overtime: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Earned Gross</span>
                    <NumInput
                      value={pay.earnedGross}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { earnedGross: v })}
                    />
                  </label>
                  <label className="field">
                    <span>EPF Cut OFF Amount Employee</span>
                    <NumInput
                      value={pay.epfCutoffEmployee}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { epfCutoffEmployee: v }, false)}
                      title="Photo default ₹18,000"
                    />
                  </label>
                  <label className="field">
                    <span>Employee PF</span>
                    <NumInput
                      value={pay.employeePf}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { employeePf: v })}
                    />
                  </label>
                </div>

                <h5 className="contract-payout-subhead">Deductions &amp; invoice (Row 3)</h5>
                <div className="bgt-payout-fields bgt-payout-fields--payout">
                  <label className="field">
                    <span>Employee ESI</span>
                    <NumInput
                      value={pay.employeeEsi}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { employeeEsi: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Professional Tax</span>
                    <NumInput
                      value={pay.professionalTax}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { professionalTax: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Other/Canteen</span>
                    <NumInput
                      value={pay.otherCanteen}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { otherCanteen: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Total Deductions</span>
                    <NumInput
                      value={pay.totalDeductions}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { totalDeductions: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>Final Net Pay</span>
                    <NumInput
                      value={pay.finalNetPay}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { finalNetPay: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>EPF Cut OFF Amount Employer</span>
                    <NumInput
                      value={pay.epfCutoffEmployer}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { epfCutoffEmployer: v }, false)}
                      title="Photo default ₹18,000"
                    />
                  </label>
                  <label className="field">
                    <span>Employer PF</span>
                    <NumInput
                      value={pay.employerPf}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { employerPf: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Employer ESI</span>
                    <NumInput
                      value={pay.employerEsi}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { employerEsi: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Service Charges</span>
                    <NumInput
                      value={pay.serviceCharges}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { serviceCharges: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Total Gross</span>
                    <NumInput
                      value={pay.invoiceTotalGross}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { invoiceTotalGross: v })}
                    />
                  </label>
                  <label className="field">
                    <span>GST AMOUNT</span>
                    <NumInput
                      value={pay.gstAmount}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { gstAmount: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>TOTAL INVOICE AMOUNT</span>
                    <NumInput
                      value={pay.totalInvoiceAmount}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPayout(selectedRow.personId, { totalInvoiceAmount: v }, false)}
                    />
                  </label>
                </div>

                {sheetEditable ? (
                  <div className="bgt-payout-col-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!!busyKey}
                      onClick={() => savePayout(selectedRow)}
                    >
                      {payBusy ? 'Saving…' : 'Save payout'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
