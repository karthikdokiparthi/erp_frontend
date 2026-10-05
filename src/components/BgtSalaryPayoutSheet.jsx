import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { canEditBgtPackage, formatMoney } from '../utils/format';
import { previewBgtStructure } from '../utils/bgtSalaryPhoto';

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

/** Optional formula fill from CTC (Super_HR “Recalc from CTC”); does not run on every keystroke. */
function recomputePackage(pkg) {
  const preview = previewBgtStructure(
    [
      { componentCode: 'BASIC', calcType: 'PERCENTAGE', percentageValue: 40, percentageBase: 'CTC', active: true },
      { componentCode: 'RETENTION', calcType: 'FIXED', amount: num(pkg.retention), active: true },
      { componentCode: 'HRA', calcType: 'FIXED', amount: num(pkg.hra), active: true },
      { componentCode: 'FLEXI', calcType: 'REMAINING_CTC', active: true },
      { componentCode: 'PF_ER', calcType: 'PERCENTAGE', percentageValue: 15, percentageBase: 'BASIC', active: true },
      { componentCode: 'BONUS', calcType: 'PERCENTAGE', percentageValue: 25, percentageBase: 'BASIC', active: true },
      { componentCode: 'LEAVE_TRAVEL', calcType: 'PERCENTAGE', percentageValue: 8.33, percentageBase: 'BASIC', active: true },
    ],
    num(pkg.ctcPerMonth)
  );
  return {
    ...pkg,
    basic: preview.basic,
    flexi: preview.flexi,
    pfEr: preview.pfEr,
    bonus: preview.bonus,
    lta: preview.lta,
    ctcPerAnnum: preview.ctcAnnum,
    monthlyGrossSalary: preview.monthlyGross,
  };
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

function recomputePayout(p) {
  const basic = num(p.basic);
  const retention = num(p.retention);
  const hra = num(p.hra);
  const flexi = num(p.flexi);
  const netSalary = Math.round((basic + retention + hra + flexi) * 100) / 100;
  const lessPfEe = num(p.lessPfEe);
  const lessPt = num(p.lessPt);
  const lessTds = num(p.lessTds);
  const lunch = num(p.lunch);
  const netPay = Math.round((netSalary - lessPfEe - lessPt - lessTds - lunch) * 100) / 100;
  return { ...p, netSalary, netPay };
}

function employeeLabel(row) {
  const code = row.employeeNumber || '';
  const name = row.displayName || '';
  if (code && name) return `${code} — ${name}`;
  return code || name || String(row.personId);
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

function DaysInput({ value, onChange }) {
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
 * Salary payout → BGT: pick one On-Role person, then edit Package + Payout for that person.
 */
export function BgtSalaryPayoutSheet() {
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
          designation: row.packageRow?.designation ?? row.designation ?? '',
          location: row.packageRow?.location ?? row.location ?? '',
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
        const data = await api(`/api/hr/payroll/bgt/sheet?yearMonth=${encodeURIComponent(ym)}`);
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
    [applySheet]
  );

  useEffect(() => {
    load(yearMonth);
  }, [yearMonth, load]);

  const rows = useMemo(() => sheet?.rows || [], [sheet]);

  const filteredRows = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.employeeNumber || ''} ${row.displayName || ''} ${row.designation || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, employeeQuery]);

  const selectedRow = useMemo(() => {
    if (!selectedPersonId) return null;
    return rows.find((r) => String(r.personId) === String(selectedPersonId)) || null;
  }, [rows, selectedPersonId]);

  /** Keep current selection visible in the dropdown even if filter would hide it. */
  const dropdownRows = useMemo(() => {
    if (!selectedRow) return filteredRows;
    if (filteredRows.some((r) => String(r.personId) === String(selectedRow.personId))) return filteredRows;
    return [selectedRow, ...filteredRows];
  }, [filteredRows, selectedRow]);

  function patchPackage(personId, patch) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      return { ...prev, [personId]: { ...cur, package: { ...cur.package, ...patch } } };
    });
  }

  function recalcPackageFromCtc(personId) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      return { ...prev, [personId]: { ...cur, package: recomputePackage(cur.package || {}) } };
    });
  }

  function patchPayout(personId, patch, recompute = true) {
    setDrafts((prev) => {
      const cur = prev[personId] || { package: {}, payout: {} };
      let payout = { ...cur.payout, ...patch };
      if (recompute) payout = recomputePayout(payout);
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
      await api('/api/hr/payroll/bgt/packages', {
        method: 'PUT',
        body: JSON.stringify({
          personId: row.personId,
          personKind: row.personKind,
          displayName: pkg.displayName ?? row.displayName ?? '',
          designation: pkg.designation ?? row.designation ?? '',
          location: pkg.location ?? row.location ?? '',
          ctcPerMonth: num(pkg.ctcPerMonth),
          ctcPerAnnum: num(pkg.ctcPerAnnum),
          basic: num(pkg.basic),
          retention: num(pkg.retention),
          hra: num(pkg.hra),
          flexi: num(pkg.flexi),
          pfEr: num(pkg.pfEr),
          bonus: num(pkg.bonus),
          lta: num(pkg.lta),
          monthlyGrossSalary: num(pkg.monthlyGrossSalary),
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
      await api('/api/hr/payroll/bgt/payouts', {
        method: 'PUT',
        body: JSON.stringify({
          personId: row.personId,
          personKind: row.personKind,
          yearMonth,
          noOfDays: num(p.noOfDays),
          lops: num(p.lops),
          presentDays: num(p.presentDays),
          basic: num(p.basic),
          retention: num(p.retention),
          hra: num(p.hra),
          flexi: num(p.flexi),
          netSalary: num(p.netSalary),
          lessPfEe: num(p.lessPfEe),
          lessPt: num(p.lessPt),
          lessTds: num(p.lessTds),
          lunch: num(p.lunch),
          netPay: num(p.netPay),
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
        `/api/hr/payroll/bgt/payouts/refresh-attendance?yearMonth=${encodeURIComponent(yearMonth)}&overwriteSaved=${overwrite ? 'true' : 'false'}`,
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
            disabled={loading || !!busyKey}
            onClick={() => {
              if (window.confirm('Overwrite all saved BGT payouts for this month from attendance + package?')) {
                refreshAttendance(true);
              }
            }}
          >
            Recalc &amp; save all payouts
          </button>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 8, marginBottom: 12 }}>
        Select a BGT On-Role employee. <strong>Left</strong>: package (HR / Super HR editable).{' '}
        <strong>Right</strong>: attendance payout for {yearMonth}
        {periodLabel ? ` (${periodLabel})` : ''} (HR entry).
      </p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="ok-text">{message}</p> : null}
      {loading ? <p className="muted">Loading BGT salary sheet…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="muted">No active BGT (On-Role) staff found.</p>
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
                  Super HR package
                  <span className="bgt-payout-col-badge">set once</span>
                  {!selectedRow.packagePersisted ? <span className="muted"> · not saved yet</span> : null}
                  {!sheetEditable ? <span className="muted"> · read-only</span> : null}
                </h4>
                <p className="muted bgt-payout-col-hint">
                  Fixed CTC structure. Enter any field manually
                  {sheetEditable ? '; use Recalc from CTC for formula defaults' : ''}. Monthly payout uses this package.
                </p>
                <div className="bgt-payout-fields bgt-payout-fields--package">
                  <label className="field">
                    <span>Name display</span>
                    <TextInput
                      value={pkg.displayName ?? selectedRow.displayName}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { displayName: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Employee code</span>
                    <input className="mono" type="text" readOnly tabIndex={-1} value={selectedRow.employeeNumber || '—'} />
                  </label>
                  <label className="field">
                    <span>Designation</span>
                    <TextInput
                      value={pkg.designation ?? selectedRow.designation}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { designation: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <TextInput
                      value={pkg.location ?? selectedRow.location}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { location: v })}
                    />
                  </label>
                  <label className="field">
                    <span>CTC Per Month</span>
                    <NumInput
                      value={pkg.ctcPerMonth}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { ctcPerMonth: v })}
                    />
                  </label>
                  <label className="field">
                    <span>CTC Per Annum</span>
                    <NumInput
                      value={pkg.ctcPerAnnum}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { ctcPerAnnum: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Basic</span>
                    <NumInput
                      value={pkg.basic}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { basic: v })}
                      title="Manual entry (or Recalc from CTC ≈ 40%)"
                    />
                  </label>
                  <label className="field">
                    <span>Retention Allowance</span>
                    <NumInput
                      value={pkg.retention}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { retention: v })}
                    />
                  </label>
                  <label className="field">
                    <span>HRA</span>
                    <NumInput
                      value={pkg.hra}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { hra: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Flexi Benefits</span>
                    <NumInput
                      value={pkg.flexi}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { flexi: v })}
                      title="Manual entry (or Recalc from CTC = remaining)"
                    />
                  </label>
                  <label className="field">
                    <span>PF (employer)</span>
                    <NumInput
                      value={pkg.pfEr}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { pfEr: v })}
                      title="Manual entry (or Recalc from CTC ≈ 15% Basic)"
                    />
                  </label>
                  <label className="field">
                    <span>Bonus</span>
                    <NumInput
                      value={pkg.bonus}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { bonus: v })}
                      title="Manual entry (or Recalc from CTC ≈ 25% Basic)"
                    />
                  </label>
                  <label className="field">
                    <span>LTA</span>
                    <NumInput
                      value={pkg.lta}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { lta: v })}
                      title="Manual entry (or Recalc from CTC ≈ 8.33% Basic)"
                    />
                  </label>
                  <label className="field">
                    <span>Monthly Gross Salary</span>
                    <NumInput
                      value={pkg.monthlyGrossSalary}
                      readOnly={!sheetEditable}
                      onChange={(v) => patchPackage(selectedRow.personId, { monthlyGrossSalary: v })}
                      title="Manual entry (excl. employer PF when using Recalc)"
                    />
                  </label>
                </div>
                {sheetEditable ? (
                  <div className="bgt-payout-col-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!!busyKey}
                      onClick={() => recalcPackageFromCtc(selectedRow.personId)}
                      title="Fill Basic / Flexi / PF / Bonus / LTA / Annuum / Gross from CTC + Retention + HRA formulas"
                    >
                      Recalc from CTC
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
                </h4>
                <p className="muted bgt-payout-col-hint">
                  {periodLabel ? (
                    <>
                      Attendance: {periodLabel}. Days, LOPs, prorated earnings &amp; deductions (HR entry).
                    </>
                  ) : (
                    <>Days, LOPs, prorated earnings &amp; deductions for this month (HR entry).</>
                  )}
                </p>
                <div className="bgt-payout-fields bgt-payout-fields--payout">
                  <label className="field">
                    <span>No of Days</span>
                    <DaysInput
                      value={pay.noOfDays}
                      onChange={(v) => patchPayout(selectedRow.personId, { noOfDays: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>LOPs</span>
                    <DaysInput
                      value={pay.lops}
                      onChange={(v) => patchPayout(selectedRow.personId, { lops: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>Present in Days</span>
                    <DaysInput
                      value={pay.presentDays}
                      onChange={(v) => patchPayout(selectedRow.personId, { presentDays: v }, false)}
                    />
                  </label>
                  <label className="field">
                    <span>Basic (prorated)</span>
                    <NumInput
                      value={pay.basic}
                      onChange={(v) => patchPayout(selectedRow.personId, { basic: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Retention (prorated)</span>
                    <NumInput
                      value={pay.retention}
                      onChange={(v) => patchPayout(selectedRow.personId, { retention: v })}
                    />
                  </label>
                  <label className="field">
                    <span>HRA (prorated)</span>
                    <NumInput
                      value={pay.hra}
                      onChange={(v) => patchPayout(selectedRow.personId, { hra: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Flexi (prorated)</span>
                    <NumInput
                      value={pay.flexi}
                      onChange={(v) => patchPayout(selectedRow.personId, { flexi: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Net Salary</span>
                    <NumInput value={pay.netSalary} readOnly />
                  </label>
                  <label className="field">
                    <span>Less : Employee PF</span>
                    <NumInput
                      value={pay.lessPfEe}
                      onChange={(v) => patchPayout(selectedRow.personId, { lessPfEe: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Less : PT</span>
                    <NumInput
                      value={pay.lessPt}
                      onChange={(v) => patchPayout(selectedRow.personId, { lessPt: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Less : TDS</span>
                    <NumInput
                      value={pay.lessTds}
                      onChange={(v) => patchPayout(selectedRow.personId, { lessTds: v })}
                    />
                  </label>
                  <label className="field">
                    <span>LUNCH</span>
                    <NumInput
                      value={pay.lunch}
                      onChange={(v) => patchPayout(selectedRow.personId, { lunch: v })}
                    />
                  </label>
                  <label className="field">
                    <span>Net Payt of Salary</span>
                    <NumInput value={pay.netPay} readOnly />
                  </label>
                </div>
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
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
