import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, apiUrl, extractError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { DataTable } from '../../components/DataTable';
import { PayslipIconButton } from '../../components/PayslipActionIcon';
import { KpiCard, StatusBadge } from '../../components/KpiCard';
import { PageHeader } from '../../components/PageHeader';
import { downloadBinaryFromUrl, downloadTableExcel } from '../../utils/exportExcel';
import {
  BGT_PHOTO_MONTHLY_DEDUCTION_COLS,
  BGT_PHOTO_MONTHLY_EARNING_COLS,
  compAmt,
  formulaLabel,
  lineCode,
  previewBgtStructure,
  sortLinesPhotoOrder,
} from '../../utils/bgtSalaryPhoto';
import {
  CONTRACT_PHOTO_REGISTER_COLS,
  contractRegisterCell,
  isContractStdCode,
  isContractWorkGroup,
  previewContractStructure,
  sortContractLinesPhotoOrder,
} from '../../utils/contractSalaryPhoto';
import { formatMoney, hasHrAccess, expenseCategoryLabel, expenseStatusLabel, formatDate } from '../../utils/format';
import { BgtPhotoStructureTable } from '../../components/BgtPhotoStructureTable';
import { ContractPhotoStructureTable } from '../../components/ContractPhotoStructureTable';
import { MonthPayoutByGroup } from '../../components/MonthPayoutByGroup';
import { BgtSalaryPayoutSheet } from '../../components/BgtSalaryPayoutSheet';
import { ContractSalaryPayoutSheet } from '../../components/ContractSalaryPayoutSheet';

async function savePayslipPdf(id, payslipNumber) {
  const raw = String(payslipNumber || 'SalarySlip').replace(/\.html?$/i, '');
  const fallback = raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
  await downloadBinaryFromUrl(`/api/hr/payroll/payslips/${id}/download`, fallback);
}

export const WORK_GROUPS = [
  { value: 'BGT', label: 'BGT' },
  { value: 'Ruchitha', label: 'Ruchitha' },
  { value: 'Akhil', label: 'Akhil' },
  { value: 'BSK', label: 'BSK' },
  { value: 'Krystal', label: 'Krystal' },
];

/** Canonical STD codes per company — never open another group's sheet. */
const STD_CODES_BY_GROUP = {
  BGT: ['BGT-STD'],
  Ruchitha: ['RUCHITHA-STD', 'RUCH-STD'],
  Akhil: ['AKHIL-STD'],
  BSK: ['BSK-STD'],
  Krystal: ['KRYSTAL-STD', 'KRY-STD'],
};

/** Match backend PayrollWorkGroups.normalize — keep UI keys canonical. */
export function normalizeWorkGroup(value) {
  if (value == null || String(value).trim() === '') return 'ALL';
  const raw = String(value).trim();
  if (raw.toUpperCase() === 'ALL') return 'ALL';
  const hit = WORK_GROUPS.find((g) => g.value.toLowerCase() === raw.toLowerCase());
  return hit ? hit.value : raw;
}

export function sameWorkGroup(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/** Client safeguard: keep only rows for the selected work-group tab. */
function filterByWorkGroup(rows, workGroup, getGroup = (r) => r?.workGroup) {
  const wg = normalizeWorkGroup(workGroup);
  if (!wg || wg === 'ALL') return rows || [];
  return (rows || []).filter((r) => sameWorkGroup(getGroup(r), wg));
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Runs-list credit summary: "3/10 credited" plus pending/failed hints when useful. */
function formatRunCreditSummary(row) {
  const total = Number(row?.employeeCount) || 0;
  if (total <= 0) return '—';
  const credited = Number(row?.creditedCount) || 0;
  const pending = Number(row?.pendingCount);
  const failed = Number(row?.failedCount) || 0;
  const onHold = Number(row?.onHoldCount) || 0;
  const pendingResolved =
    Number.isFinite(pending) && pending >= 0
      ? pending
      : Math.max(0, total - credited - failed - onHold);
  const parts = [`${credited}/${total} credited`];
  if (pendingResolved > 0) parts.push(`${pendingResolved} pending`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (onHold > 0) parts.push(`${onHold} on hold`);
  return parts.join(' · ');
}

/**
 * List fetch with work-group isolation: clear rows on path change and ignore stale responses
 * when the user switches BGT / Ruchitha / … before the previous request finishes.
 */
function useApiList(path, deps = []) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const data = await api(path);
      if (reqId !== reqIdRef.current) return;
      setRows(Array.isArray(data) ? data : data?.rows || []);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setRows([]);
      setError(extractError(err));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
    // deps kept for call sites that list explicit keys alongside path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { rows, error, loading, load, setRows };
}

function WorkGroupTabs({ value, onChange, includeAll = true }) {
  return (
    <div className="page-tabs" role="tablist" aria-label="Work group">
      {includeAll ? (
        <button
          type="button"
          role="tab"
          className={`page-tab${value === 'ALL' || !value ? ' is-active' : ''}`}
          onClick={() => onChange('ALL')}
        >
          All
        </button>
      ) : null}
      {WORK_GROUPS.map((g) => (
        <button
          key={g.value}
          type="button"
          role="tab"
          className={`page-tab${value === g.value ? ' is-active' : ''}`}
          onClick={() => onChange(g.value)}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

export function PayrollModuleLayout() {
  return (
    <>
      <PageHeader
        title="Payroll"
        eyebrow="Payroll"
        description="Assigned people by company structure, monthly processing, and payslips."
      />
      <div className="page-tabs" role="tablist" aria-label="Payroll module">
        <NavLink to="/hr/payroll" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Dashboard
        </NavLink>
        {/* TODO: salary structure — restore when user requests
        <NavLink to="/hr/payroll/structures" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Structures
        </NavLink>
        */}
        {/* TODO: payroll assignment — restore when user requests
        <NavLink to="/hr/payroll/assignments" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Assignment
        </NavLink>
        */}
        <NavLink to="/hr/payroll/payout" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Salary payout
        </NavLink>
        <NavLink to="/hr/payroll/processing" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Processing
        </NavLink>
        <NavLink to="/hr/payroll/payslips" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Salary Slips
        </NavLink>
        <NavLink
          to="/hr/payroll/company-expenses"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Company expenses
        </NavLink>
        <NavLink to="/hr/payroll/reports" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Reports
        </NavLink>
        <NavLink to="/hr/payroll/settings" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Settings
        </NavLink>
        {/* TODO: classic salary — restore when user requests
        <NavLink to="/hr/salary" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Classic salary
        </NavLink>
        */}
      </div>
      <Outlet />
    </>
  );
}

export function PayrollDashboardPage() {
  const [yearMonth, setYearMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api(`/api/hr/payroll/dashboard?yearMonth=${encodeURIComponent(yearMonth)}`));
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [yearMonth]);

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <span>Month</span>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </label>
        <button className="btn" type="button" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <MonthPayoutByGroup
        yearMonth={yearMonth}
        onYearMonthChange={setYearMonth}
        showToolbar={false}
        loading={loading}
      />
      <h3 className="section-title" style={{ marginTop: 24 }}>
        Runs this month
      </h3>
      <DataTable
        rows={data?.runs || []}
        loading={loading}
        error=""
        emptyTitle="No payroll runs this month"
        emptyDescription="Create a run under Processing."
        columns={[
          { key: 'workGroup', header: 'Work group' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          { key: 'employeeCount', header: 'People' },
          {
            key: 'credited',
            header: 'Credited',
            render: (row) => (
              <span title={formatRunCreditSummary(row)}>
                {row.employeeCount > 0
                  ? `${Number(row.creditedCount) || 0}/${row.employeeCount}`
                  : '—'}
              </span>
            ),
          },
          { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
          { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
          {
            key: 'open',
            header: '',
            render: (row) => <Link to={`/hr/payroll/processing/${row.id}`}>Open</Link>,
          },
        ]}
      />
    </>
  );
}

/** Assigned people by company — read-only mirror of Assignment (no master component CRUD). */
export function PayrollComponentsPage() {
  const [workGroup, setWorkGroup] = useState('BGT');

  return (
    <>
      <WorkGroupTabs
        value={workGroup}
        onChange={(g) => setWorkGroup(normalizeWorkGroup(g))}
        includeAll={false}
      />
      {workGroup === 'BGT' ? (
        <BgtSalaryPayoutSheet />
      ) : isContractWorkGroup(workGroup) ? (
        <ContractSalaryPayoutSheet workGroup={workGroup} />
      ) : (
        <p className="muted" style={{ margin: '16px 0' }}>
          Salary payout grid for <strong>{workGroup}</strong> is not configured yet. Use the BGT tab for the
          On-Role package / payout sheet.
        </p>
      )}
    </>
  );
}

function draftLineFromApi(line) {
  return {
    componentId: line.componentId,
    componentCode: line.componentCode,
    componentName: line.componentName,
    componentType: line.componentType,
    calcType: line.calcType || 'FIXED',
    amount: String(line.amount ?? 0),
    percentageValue: line.percentageValue != null ? String(line.percentageValue) : '',
    percentageBase: line.percentageBase || 'BASIC',
    percentageOfCode: line.percentageOfCode || '',
    formulaExpr: line.formulaExpr || '',
    sortOrder: String(line.sortOrder ?? 100),
    active: line.active !== false,
  };
}

function draftLinesToPreview(lines) {
  return (lines || []).map((l) => ({
    componentId: l.componentId,
    componentCode: l.componentCode,
    componentName: l.componentName,
    componentType: l.componentType,
    calcType: l.calcType,
    amount: Number(l.amount || 0),
    percentageValue: l.percentageValue === '' || l.percentageValue == null ? null : Number(l.percentageValue),
    percentageBase: l.percentageBase || null,
    percentageOfCode: l.percentageOfCode || null,
    formulaExpr: l.formulaExpr || null,
    sortOrder: Number(l.sortOrder || 0),
    active: l.active !== false,
  }));
}

/** Pick only this work group's *-STD sheet — never fall back to BGT / another company. */
function preferredStdStructure(rows, workGroup) {
  const wg = normalizeWorkGroup(workGroup);
  if (!rows?.length || !wg || wg === 'ALL') return null;
  const scoped = rows.filter((r) => sameWorkGroup(r.workGroup, wg));
  if (!scoped.length) return null;
  const codes = (STD_CODES_BY_GROUP[wg] || [`${wg.toUpperCase()}-STD`]).map((c) => c.toUpperCase());
  return (
    scoped.find((r) => codes.includes(String(r.code || '').toUpperCase())) ||
    scoped.find((r) => String(r.code || '').toUpperCase().endsWith('-STD')) ||
    scoped[0]
  );
}

export function PayrollStructuresPage() {
  const [workGroup, setWorkGroup] = useState('BGT');
  const path = `/api/hr/payroll/structures?workGroup=${encodeURIComponent(workGroup)}`;
  const { rows, error, loading, load } = useApiList(path, [workGroup]);
  const scopedRows = useMemo(() => filterByWorkGroup(rows, workGroup), [rows, workGroup]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editMeta, setEditMeta] = useState({
    name: '',
    description: '',
    defaultCtc: '',
    active: true,
  });
  const [editLines, setEditLines] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api(`/api/hr/payroll/structures/${selectedId}`)
      .then((d) => {
        if (cancelled) return;
        // Hard guard: refuse another company's structure while this tab is selected.
        if (d && !sameWorkGroup(d.workGroup, workGroup)) {
          setDetail(null);
          setSelectedId(null);
          return;
        }
        setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, workGroup]);

  useEffect(() => {
    if (!detail) {
      setEditLines([]);
      setEditMeta({ name: '', description: '', defaultCtc: '', active: true });
      return;
    }
    setEditMeta({
      name: detail.name || '',
      description: detail.description || '',
      defaultCtc: String(detail.defaultCtc ?? ''),
      active: detail.active !== false,
    });
    const sorter =
      detail.workGroup === 'BGT' || String(detail.code || '').toUpperCase() === 'BGT-STD'
        ? sortLinesPhotoOrder
        : sortContractLinesPhotoOrder;
    setEditLines(sorter(detail.lines || []).map(draftLineFromApi));
    setSaveMsg('');
  }, [detail]);

  // Auto-open this work group's STD only after scoped rows load (never another group's sheet).
  useEffect(() => {
    if (selectedId || loading) return;
    const preferred = preferredStdStructure(scopedRows, workGroup);
    if (preferred) setSelectedId(preferred.id);
  }, [scopedRows, selectedId, workGroup, loading]);

  function updateLine(index, patch) {
    setEditLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function saveStructureLines(event) {
    event.preventDefault();
    if (!detail?.id) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await api(`/api/hr/payroll/structures/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id: detail.id,
          code: detail.code,
          name: editMeta.name || detail.name,
          workGroup: detail.workGroup,
          personKind: detail.personKind,
          description: editMeta.description,
          defaultCtc: Number(editMeta.defaultCtc || 0),
          active: editMeta.active !== false,
          lines: editLines.map((l) => ({
            componentId: l.componentId,
            calcType: l.calcType,
            amount: Number(l.amount || 0),
            percentageValue:
              l.calcType === 'PERCENTAGE' && l.percentageValue !== ''
                ? Number(l.percentageValue)
                : null,
            percentageBase: l.calcType === 'PERCENTAGE' ? l.percentageBase || 'BASIC' : null,
            percentageOfCode: l.percentageOfCode || null,
            formulaExpr: l.calcType === 'FORMULA' ? l.formulaExpr || null : null,
            sortOrder: Number(l.sortOrder || 0),
            active: l.active !== false,
          })),
        }),
      });
      setDetail(updated);
      setSaveMsg('Structure lines saved');
      await load();
    } catch (err) {
      setSaveMsg(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const previewLines = draftLinesToPreview(editLines);
  const ctc = Number(editMeta.defaultCtc || detail?.defaultCtc || 0);
  const isBgt = workGroup === 'BGT' || detail?.workGroup === 'BGT';
  const isContract =
    !isBgt &&
    (isContractStdCode(detail?.code) ||
      ['Ruchitha', 'Akhil', 'BSK', 'Krystal'].includes(workGroup));
  const preview = isBgt
    ? previewBgtStructure(previewLines, ctc)
    : previewContractStructure(previewLines, ctc);

  return (
    <>
      <WorkGroupTabs
        value={workGroup}
        onChange={(g) => {
          setWorkGroup(normalizeWorkGroup(g));
          setSelectedId(null);
          setDetail(null);
          setEditLines([]);
          setSaveMsg('');
        }}
        includeAll={false}
      />
      {error ? (
        <p className="muted" style={{ marginTop: 16 }}>
          {error}{' '}
          <button type="button" className="btn btn-sm" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}
      {loading && !detail ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Loading {workGroup} structure…
        </p>
      ) : null}
      {detail && sameWorkGroup(detail.workGroup, workGroup) ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              {detail.code} · {editMeta.name || detail.name || 'structure'}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Edit amounts / % below and Save. CTC/annum and monthly gross stay computed. Assignment has CTC
              override only — Retention/HRA per person are set on structure lines here.
            </p>
            <form onSubmit={saveStructureLines}>
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={editMeta.name}
                    onChange={(e) => setEditMeta({ ...editMeta, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Default CTC (monthly)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editMeta.defaultCtc}
                    onChange={(e) => setEditMeta({ ...editMeta, defaultCtc: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input
                    value={editMeta.description}
                    onChange={(e) => setEditMeta({ ...editMeta, description: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Structure active</span>
                  <select
                    value={editMeta.active ? 'Y' : 'N'}
                    onChange={(e) => setEditMeta({ ...editMeta, active: e.target.value === 'Y' })}
                  >
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </label>
              </div>
              {isBgt ? (
                <BgtPhotoStructureTable
                  lines={previewLines}
                  ctc={ctc}
                  title="Photo CTC sheet (live preview from edits)"
                />
              ) : null}
              {isContract ? (
                <ContractPhotoStructureTable
                  lines={previewLines}
                  salary={ctc}
                  title="Receipt Contract photo (live preview from edits)"
                />
              ) : null}
              <h4 className="section-title" style={{ marginTop: isBgt || isContract ? 8 : 0, fontSize: 14 }}>
                Edit structure lines
              </h4>
              {editLines.length === 0 ? (
                <p className="muted">No lines — restart app so Flyway V47/V48 seeds *-STD structures.</p>
              ) : (
                <div className="table-wrap" style={{ marginBottom: 12 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Calc</th>
                        <th>Amount ₹</th>
                        <th>%</th>
                        <th>% base</th>
                        <th>Preview ₹</th>
                        <th>Order</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editLines.map((row, index) => {
                        const code = lineCode(row);
                        let previewAmt = '—';
                        if (preview[code] != null) previewAmt = formatMoney(preview[code]);
                        else if (row.calcType === 'FIXED') previewAmt = formatMoney(Number(row.amount || 0));
                        const showAmount =
                          row.calcType === 'FIXED' || row.calcType === 'REMAINING_CTC' || row.calcType === 'FORMULA';
                        const showPct = row.calcType === 'PERCENTAGE';
                        return (
                          <tr key={`${row.componentId}-${index}`}>
                            <td className="mono">{code}</td>
                            <td>{row.componentName}</td>
                            <td>
                              <select
                                value={row.calcType}
                                onChange={(e) => {
                                  const calcType = e.target.value;
                                  const patch = { calcType };
                                  if (calcType === 'PERCENTAGE' && !row.percentageBase) {
                                    patch.percentageBase = code === 'BASIC' ? 'CTC' : 'BASIC';
                                  }
                                  if (calcType === 'FIXED' && row.percentageValue) {
                                    /* keep amount editable */
                                  }
                                  updateLine(index, patch);
                                }}
                              >
                                <option value="FIXED">Fixed</option>
                                <option value="PERCENTAGE">Percentage</option>
                                <option value="REMAINING_CTC">Remaining CTC</option>
                                <option value="FORMULA">Formula</option>
                              </select>
                            </td>
                            <td>
                              {showAmount ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ width: 100 }}
                                  value={row.amount}
                                  disabled={row.calcType === 'REMAINING_CTC'}
                                  title={
                                    row.calcType === 'REMAINING_CTC'
                                      ? 'Computed as remaining CTC — switch Calc to Fixed to override'
                                      : undefined
                                  }
                                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                                />
                              ) : (
                                <span className="muted">—</span>
                              )}
                              {row.calcType === 'REMAINING_CTC' ? (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ marginLeft: 6 }}
                                  onClick={() =>
                                    updateLine(index, {
                                      calcType: 'FIXED',
                                      amount: String(preview[code] ?? row.amount ?? 0),
                                    })
                                  }
                                >
                                  Override
                                </button>
                              ) : null}
                            </td>
                            <td>
                              {showPct ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ width: 72 }}
                                  value={row.percentageValue}
                                  onChange={(e) => updateLine(index, { percentageValue: e.target.value })}
                                />
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td>
                              {showPct ? (
                                <select
                                  value={row.percentageBase || 'BASIC'}
                                  onChange={(e) => updateLine(index, { percentageBase: e.target.value })}
                                >
                                  <option value="CTC">CTC</option>
                                  <option value="BASIC">Basic</option>
                                  <option value="GROSS">Gross</option>
                                </select>
                              ) : (
                                <span className="muted">{formulaLabel(draftLinesToPreview([row])[0])}</span>
                              )}
                            </td>
                            <td className="mono">{previewAmt}</td>
                            <td>
                              <input
                                type="number"
                                style={{ width: 64 }}
                                value={row.sortOrder}
                                onChange={(e) => updateLine(index, { sortOrder: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.active !== false}
                                onChange={(e) => updateLine(index, { active: e.target.checked })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="toolbar-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || editLines.length === 0}>
                  {saving ? 'Saving…' : 'Save structure lines'}
                </button>
                {saveMsg ? <span className="muted">{saveMsg}</span> : null}
              </div>
            </form>
          </div>
        </div>
      ) : !loading && !error ? (
        <p className="muted" style={{ marginTop: 16 }}>
          {`No STD structure found for ${workGroup}. Restart the app so Flyway seeds ${String(workGroup).toUpperCase()}-STD.`}
        </p>
      ) : null}
    </>
  );
}

export function PayrollAssignmentsPage() {
  const [workGroup, setWorkGroup] = useState('ALL');
  const path = `/api/hr/payroll/assignments?workGroup=${encodeURIComponent(workGroup)}`;
  const { rows, error, loading, load } = useApiList(path, [workGroup]);
  const [structures, setStructures] = useState([]);
  const [people, setPeople] = useState([]);
  const [structureDetail, setStructureDetail] = useState(null);
  const [previewCache, setPreviewCache] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = {
    personKey: '',
    structureId: '',
    effectiveFrom: `${currentMonth()}-01`,
    ctcOverride: '',
    status: 'ACTIVE',
  };
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/api/hr/payroll/structures').then(setStructures).catch(() => setStructures([]));
    Promise.all([api('/api/hr/staff'), api('/api/hr/employees')])
      .then(([staff, employees]) => {
        const list = [
          ...(staff || []).map((s) => ({
            key: `STAFF:${s.id}`,
            personId: s.id,
            personKind: 'STAFF',
            label: `${s.employeeNumber} — ${s.firstName} ${s.lastName} (BGT)`,
            workGroup: normalizeWorkGroup(s.workGroup || 'BGT'),
          })),
          ...(employees || []).map((e) => ({
            key: `EMPLOYEE:${e.id}`,
            personId: e.id,
            personKind: 'EMPLOYEE',
            label: `${e.employeeNumber} — ${e.firstName} ${e.lastName} (${e.workGroup || 'Contract'})`,
            workGroup: e.workGroup ? normalizeWorkGroup(e.workGroup) : e.workGroup,
          })),
        ];
        setPeople(list);
      })
      .catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    setExpandedId(null);
    setEditingId(null);
    setForm(emptyForm);
    setStructureDetail(null);
    setMsg('');
  }, [workGroup]);

  useEffect(() => {
    if (!form.structureId) {
      setStructureDetail(null);
      return;
    }
    let cancelled = false;
    api(`/api/hr/payroll/structures/${form.structureId}`)
      .then((s) => {
        if (!cancelled) setStructureDetail(s);
      })
      .catch(() => {
        if (!cancelled) setStructureDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.structureId]);

  const filteredStructures = useMemo(() => {
    if (normalizeWorkGroup(workGroup) === 'ALL') return structures;
    return structures.filter((s) => sameWorkGroup(s.workGroup, workGroup));
  }, [structures, workGroup]);

  const previewCtc = useMemo(() => {
    if (form.ctcOverride !== '' && form.ctcOverride != null) {
      const n = Number(form.ctcOverride);
      if (!Number.isNaN(n)) return n;
    }
    return Number(structureDetail?.defaultCtc || 0);
  }, [form.ctcOverride, structureDetail]);

  const isBgtStructure =
    structureDetail &&
    (structureDetail.workGroup === 'BGT' ||
      String(structureDetail.code || '').toUpperCase() === 'BGT-STD');

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setStructureDetail(null);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      personKey: `${row.personKind}:${row.personId}`,
      structureId: row.structureId || '',
      effectiveFrom: row.effectiveFrom || `${currentMonth()}-01`,
      ctcOverride: row.ctcOverride != null ? String(row.ctcOverride) : '',
      status: row.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
    });
    setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadPreviewFor(row) {
    if (!row?.structureId) return null;
    if (previewCache[row.structureId]) return previewCache[row.structureId];
    try {
      const s = await api(`/api/hr/payroll/structures/${row.structureId}`);
      setPreviewCache((prev) => ({ ...prev, [row.structureId]: s }));
      return s;
    } catch {
      return null;
    }
  }

  async function togglePreview(row) {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    await loadPreviewFor(row);
  }

  async function save(event) {
    event.preventDefault();
    setMsg('');
    const person = people.find((p) => p.key === form.personKey);
    if (!person) {
      setMsg('Select a person');
      return;
    }
    try {
      await api('/api/hr/payroll/assignments', {
        method: 'POST',
        body: JSON.stringify({
          id: editingId || null,
          personId: person.personId,
          personKind: person.personKind,
          structureId: form.structureId,
          effectiveFrom: form.effectiveFrom,
          status: form.status,
          ctcOverride: form.ctcOverride === '' ? null : Number(form.ctcOverride),
        }),
      });
      setMsg(editingId ? 'Assignment updated — next Calculate uses these structure lines' : 'Assignment saved');
      resetForm();
      await load();
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  async function activate(id) {
    try {
      await api(`/api/hr/payroll/assignments/${id}/activate`, { method: 'POST' });
      await load();
    } catch (err) {
      setMsg(extractError(err));
    }
  }
  async function removeAssignment(id) {
    try {
      await api(`/api/hr/payroll/assignments/${id}/cancel`, { method: 'POST' });
      if (editingId === id) resetForm();
      if (expandedId === id) setExpandedId(null);
      await load();
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  const visibleAssignments = useMemo(
    () =>
      filterByWorkGroup(rows, workGroup).filter(
        (r) => r.status === 'ACTIVE' || r.status === 'DRAFT'
      ),
    [rows, workGroup]
  );

  return (
    <>
      <WorkGroupTabs value={workGroup} onChange={(g) => setWorkGroup(normalizeWorkGroup(g))} />
      <p className="muted" style={{ margin: '8px 0 0' }}>
        Assign a salary structure to each person (e.g. BGT-STD or RUCHITHA-STD). Pay uses that structure’s
        lines. Only CTC override is set here. Changes apply on the next Processing Calculate (no re-assign
        needed). Generated payslips stay frozen.
        {/* TODO: salary structure — restore when user requests: Edit structure lines under Structures. */}
      </p>
      <form className="form-grid" onSubmit={save} style={{ margin: '16px 0 12px' }}>
        <label className="field">
          <span>Person</span>
          <select
            required
            disabled={!!editingId}
            value={form.personKey}
            onChange={(e) => setForm({ ...form, personKey: e.target.value })}
          >
            <option value="">Select…</option>
            {people
              .filter((p) => workGroup === 'ALL' || sameWorkGroup(p.workGroup, workGroup))
              .map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>Structure</span>
          <select required value={form.structureId} onChange={(e) => setForm({ ...form, structureId: e.target.value })}>
            <option value="">Select…</option>
            {filteredStructures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Effective from</span>
          <input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </label>
        <label className="field">
          <span>CTC override</span>
          <input
            type="number"
            step="0.01"
            placeholder={structureDetail?.defaultCtc != null ? `Default ${structureDetail.defaultCtc}` : 'Structure default'}
            value={form.ctcOverride}
            onChange={(e) => setForm({ ...form, ctcOverride: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            value={form.status}
            disabled={editingId && form.status === 'ACTIVE'}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
        <div className="toolbar-actions" style={{ alignItems: 'end' }}>
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Update assignment' : 'Assign'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-sm" onClick={resetForm}>
              Discard edit
            </button>
          ) : null}
        </div>
        {msg ? <span className="muted">{msg}</span> : null}
      </form>

      {structureDetail ? (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              CTC sheet preview · {structureDetail.code}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              This employee will be paid using these structure lines
              {form.ctcOverride !== '' ? ' (CTC override applied below)' : ' (structure default CTC)'}.
            </p>
            {isBgtStructure ? (
              <BgtPhotoStructureTable
                lines={structureDetail.lines}
                ctc={previewCtc}
                title={`${structureDetail.code} · photo CTC order`}
              />
            ) : null}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Formula / %</th>
                  </tr>
                </thead>
                <tbody>
                  {sortLinesPhotoOrder(structureDetail.lines || []).map((line) => (
                    <tr key={line.id || lineCode(line)}>
                      <td className="mono">{lineCode(line)}</td>
                      <td>{line.componentName || '—'}</td>
                      <td>{formulaLabel(line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <DataTable
        rows={visibleAssignments}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No assignments"
        columns={[
          { key: 'employeeNumber', header: 'ID', render: (r) => <span className="mono">{r.employeeNumber}</span> },
          { key: 'displayName', header: 'Name' },
          { key: 'workGroup', header: 'Group' },
          { key: 'structureCode', header: 'Structure' },
          {
            key: 'effectiveCtc',
            header: 'CTC',
            render: (r) => (
              <span className="mono" title={r.ctcOverride != null ? 'CTC override' : 'Structure default'}>
                {formatMoney(r.effectiveCtc ?? r.ctcOverride ?? r.structureDefaultCtc)}
                {r.ctcOverride != null ? <span className="muted"> · ov</span> : null}
              </span>
            ),
          },
          { key: 'effectiveFrom', header: 'From' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <div className="toolbar-actions">
                <button type="button" className="btn btn-sm" onClick={() => togglePreview(r)}>
                  {expandedId === r.id ? 'Hide' : 'Preview'}
                </button>
                {r.status === 'DRAFT' || r.status === 'ACTIVE' ? (
                  <button type="button" className="btn btn-sm" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                ) : null}
                {r.status === 'DRAFT' ? (
                  <button type="button" className="btn btn-sm" onClick={() => activate(r.id)}>
                    Activate
                  </button>
                ) : null}
                {r.status === 'ACTIVE' || r.status === 'DRAFT' ? (
                  <button type="button" className="btn btn-sm" onClick={() => removeAssignment(r.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {expandedId
        ? (() => {
            const row = visibleAssignments.find((r) => r.id === expandedId);
            const detail = row ? previewCache[row.structureId] : null;
            if (!row) return null;
            const ctc = Number(row.effectiveCtc ?? row.ctcOverride ?? row.structureDefaultCtc ?? detail?.defaultCtc ?? 0);
            const bgt =
              detail &&
              (detail.workGroup === 'BGT' || String(detail.code || '').toUpperCase() === 'BGT-STD');
            return (
              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-pad">
                  <h4 className="section-title" style={{ marginTop: 0 }}>
                    {row.displayName} · {row.structureCode} · CTC {formatMoney(ctc)}
                  </h4>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Live structure lines — same sheet used on next Processing Calculate.
                  </p>
                  {!detail ? <p className="muted">Loading structure…</p> : null}
                  {detail && bgt ? <BgtPhotoStructureTable lines={detail.lines} ctc={ctc} /> : null}
                  {detail ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Formula / %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortLinesPhotoOrder(detail.lines || []).map((line) => (
                            <tr key={line.id || lineCode(line)}>
                              <td className="mono">{lineCode(line)}</td>
                              <td>{line.componentName || '—'}</td>
                              <td>{formulaLabel(line)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()
        : null}
    </>
  );
}

export function PayrollProcessingPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialWg = searchParams.get('workGroup');
  const initialYm = searchParams.get('yearMonth');
  const [yearMonth, setYearMonth] = useState(
    initialYm && /^\d{4}-\d{2}$/.test(initialYm) ? initialYm : currentMonth()
  );
  const [workGroup, setWorkGroup] = useState(
    initialWg && WORK_GROUPS.some((g) => g.value === initialWg) ? initialWg : 'BGT'
  );
  const { rows, error, loading, load } = useApiList(
    `/api/hr/payroll/runs?yearMonth=${encodeURIComponent(yearMonth)}`,
    [yearMonth]
  );
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [creditFilter, setCreditFilter] = useState('ALL');
  const [selected, setSelected] = useState(() => new Set());

  const visibleRows = useMemo(() => {
    const base = (rows || []).filter((r) => (r.status || '').toUpperCase() !== 'CANCELLED');
    if (normalizeWorkGroup(workGroup) === 'ALL') return base;
    return base.filter((r) => sameWorkGroup(r.workGroup, workGroup));
  }, [rows, workGroup]);

  function showMsg(text, isError = false) {
    setMsg(text || '');
    setMsgError(!!isError && !!text);
  }

  async function loadDetail(id) {
    if (!id) {
      setDetail(null);
      setSelected(new Set());
      return;
    }
    try {
      const run = await api(`/api/hr/payroll/runs/${id}`);
      // CANCELLED runs are hidden from the list; do not keep them open in the detail pane.
      if ((run?.status || '').toUpperCase() === 'CANCELLED') {
        setDetail(null);
        setSelected(new Set());
        navigate('/hr/payroll/processing', { replace: true });
        return;
      }
      setDetail(run);
      setSelected(new Set());
    } catch (err) {
      showMsg(extractError(err), true);
    }
  }

  useEffect(() => {
    loadDetail(runId);
  }, [runId]);

  useEffect(() => {
    const wg = searchParams.get('workGroup');
    const ym = searchParams.get('yearMonth');
    if (wg) {
      const canonical = normalizeWorkGroup(wg);
      if (canonical !== 'ALL' && WORK_GROUPS.some((g) => g.value === canonical)) {
        setWorkGroup(canonical);
      }
    }
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      setYearMonth(ym);
    }
  }, [searchParams]);

  const employees = detail?.employees || [];
  const creditDueToday = !!detail?.creditDueToday;
  const filteredEmployees = useMemo(() => {
    if (creditFilter === 'ALL') return employees;
    return employees.filter((r) => (r.creditStatus || 'PENDING') === creditFilter);
  }, [employees, creditFilter]);

  const filteredIds = useMemo(() => filteredEmployees.map((r) => r.id), [filteredEmployees]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredIds));
  }

  function formatCreditedAt(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  /** Merge credit fields into local run detail (survives incomplete API payloads). */
  function patchEmployeeCredits(prev, employeeIds, creditStatus, creditedAt) {
    if (!prev?.employees?.length) return prev;
    const idSet = new Set(employeeIds.map(String));
    return {
      ...prev,
      employees: prev.employees.map((row) => {
        if (!idSet.has(String(row.id))) return row;
        return {
          ...row,
          creditStatus,
          creditedAt: creditStatus === 'CREDITED' ? creditedAt || row.creditedAt || new Date().toISOString() : null,
        };
      }),
    };
  }

  function applyCreditResponse(run, employeeIds, creditStatus) {
    const fallbackAt = creditStatus === 'CREDITED' ? new Date().toISOString() : null;
    if (run?.employees?.length) {
      const fromServer = run.employees.find((e) =>
        employeeIds.some((id) => String(id) === String(e.id))
      );
      let creditedAt = null;
      if (creditStatus === 'CREDITED') {
        creditedAt = fromServer?.creditedAt || fallbackAt;
      }
      setDetail(patchEmployeeCredits(run, employeeIds, creditStatus, creditedAt));
      return;
    }
    setDetail((prev) => patchEmployeeCredits(prev, employeeIds, creditStatus, fallbackAt));
  }

  async function createRun() {
    if (workGroup === 'ALL') {
      showMsg('Pick a work group before creating a run', true);
      return;
    }
    setBusy('create');
    showMsg('');
    try {
      const run = await api('/api/hr/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, workGroup, attendanceBased: true }),
      });
      await load();
      navigate(`/hr/payroll/processing/${run.id}`);
    } catch (err) {
      showMsg(extractError(err), true);
    } finally {
      setBusy('');
    }
  }

  async function action(path, label) {
    if (!runId) return;
    setBusy(label);
    showMsg('');
    try {
      const run = await api(`/api/hr/payroll/runs/${runId}/${path}`, { method: 'POST' });
      setDetail(run);
      setSelected(new Set());
      await load();
      showMsg(`${label} done`);
    } catch (err) {
      showMsg(extractError(err), true);
    } finally {
      setBusy('');
    }
  }

  function confirmDeleteMessage(run) {
    const status = (run?.status || '').toUpperCase();
    const people = Number(run?.employeeCount) || (run?.employees?.length ?? 0);
    const label = `${run?.yearMonth || ''} · ${run?.workGroup || ''}`.trim();
    if (status === 'DRAFT' && people === 0) {
      return `Delete payroll run ${label}? This cannot be undone.`;
    }
    if (status === 'APPROVED' || status === 'PROCESSED' || people > 0) {
      return (
        `Permanently delete payroll run ${label} (${status || 'unknown'})` +
        (people > 0 ? ` with ${people} employee line(s)` : '') +
        `?\n\nThis hard-deletes the run, employee lines, components, and any payslips. This cannot be undone.`
      );
    }
    return `Delete payroll run ${label} (${status || 'unknown'})? This cannot be undone.`;
  }

  async function deleteRun(run) {
    if (!run?.id) return;
    if (!window.confirm(confirmDeleteMessage(run))) return;
    setBusy('delete');
    showMsg('');
    try {
      await api(`/api/hr/payroll/runs/${run.id}`, { method: 'DELETE' });
      if (String(runId) === String(run.id) || String(detail?.id) === String(run.id)) {
        setDetail(null);
        setSelected(new Set());
        navigate('/hr/payroll/processing', { replace: true });
      }
      await load();
      showMsg('Run deleted');
    } catch (err) {
      showMsg(extractError(err), true);
    } finally {
      setBusy('');
    }
  }

  async function setCreditStatus(employeeId, creditStatus) {
    if (!runId || !employeeId) return;
    setBusy(`credit-${employeeId}`);
    showMsg('');
    const optimisticAt = creditStatus === 'CREDITED' ? new Date().toISOString() : null;
    setDetail((prev) => patchEmployeeCredits(prev, [employeeId], creditStatus, optimisticAt));
    try {
      const run = await api(`/api/hr/payroll/runs/${runId}/employees/${employeeId}/credit-status`, {
        method: 'PUT',
        body: JSON.stringify({ creditStatus }),
      });
      applyCreditResponse(run, [employeeId], creditStatus);
      await load();
      showMsg(`Credit status → ${creditStatus}`);
    } catch (err) {
      await loadDetail(runId);
      showMsg(extractError(err), true);
    } finally {
      setBusy('');
    }
  }

  async function bulkCredit(creditStatus) {
    if (!runId) return;
    const ids = [...selected];
    if (!ids.length) {
      showMsg('Select at least one employee', true);
      return;
    }
    setBusy(`bulk-${creditStatus}`);
    showMsg('');
    const optimisticAt = creditStatus === 'CREDITED' ? new Date().toISOString() : null;
    setDetail((prev) => patchEmployeeCredits(prev, ids, creditStatus, optimisticAt));
    try {
      const run = await api(`/api/hr/payroll/runs/${runId}/credit-status`, {
        method: 'POST',
        body: JSON.stringify({ employeeIds: ids, creditStatus }),
      });
      applyCreditResponse(run, ids, creditStatus);
      setSelected(new Set());
      await load();
      showMsg(`Marked ${ids.length} as ${creditStatus}`);
    } catch (err) {
      await loadDetail(runId);
      showMsg(extractError(err), true);
    } finally {
      setBusy('');
    }
  }

  const selectCol = {
    key: '_sel',
    header: (
      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
    ),
    render: (r) => (
      <input
        type="checkbox"
        checked={selected.has(r.id)}
        onChange={() => toggleOne(r.id)}
        aria-label={`Select ${r.employeeNumber}`}
      />
    ),
  };

  const creditCols = [
    {
      key: 'creditStatus',
      header: 'Credit status',
      render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <StatusBadge value={r.creditStatus || 'PENDING'} />
          {r.creditStatus === 'CREDITED' && r.creditedAt ? (
            <span className="muted" style={{ fontSize: 11 }}>
              {formatCreditedAt(r.creditedAt)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'creditAction',
      header: 'Set credit',
      render: (r) => (
        <select
          className="input-sm"
          value={r.creditStatus || 'PENDING'}
          disabled={!!busy}
          aria-label={`Credit status for ${r.employeeNumber}`}
          onChange={(e) => setCreditStatus(r.id, e.target.value)}
          style={{ minWidth: 110 }}
        >
          <option value="PENDING">Pending</option>
          <option value="CREDITED">Credited</option>
          <option value="FAILED">Failed</option>
          <option value="ON_HOLD">On hold</option>
        </select>
      ),
    },
  ];

  /** Identity + net + credit first; salary/photo fields scroll after. */
  const earlyCols = [
    selectCol,
    { key: 'employeeNumber', header: 'Code', render: (r) => <span className="mono">{r.employeeNumber}</span> },
    { key: 'displayName', header: 'Name' },
    { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
    ...creditCols,
  ];

  function employeeColumns() {
    if (!detail) return [];
    if (detail.workGroup === 'BGT') {
      return [
        ...earlyCols,
        { key: 'workingDays', header: 'No of Days' },
        { key: 'lopDays', header: 'LOPs' },
        { key: 'presentDays', header: 'Present in Days' },
        ...BGT_PHOTO_MONTHLY_EARNING_COLS.map((col) => ({
          key: col.code.toLowerCase(),
          header: col.header,
          render: (r) => formatMoney(compAmt(r.components, col.code)),
        })),
        { key: 'gross', header: 'Net Salary', render: (r) => formatMoney(r.gross) },
        ...BGT_PHOTO_MONTHLY_DEDUCTION_COLS.map((col) => ({
          key: `ded-${col.code.toLowerCase()}`,
          header: col.header,
          render: (r) => formatMoney(compAmt(r.components, col.code)),
        })),
        { key: 'netPayt', header: 'Net Payt of Salary', render: (r) => formatMoney(r.net) },
        { key: 'lineStatus', header: 'Status', render: (r) => <StatusBadge value={r.lineStatus} /> },
      ];
    }
    if (['Ruchitha', 'Akhil', 'BSK', 'Krystal'].includes(detail.workGroup)) {
      return [
        ...earlyCols,
        ...CONTRACT_PHOTO_REGISTER_COLS.map((col, colIdx) => ({
          key: col.code || col.key || `col-${colIdx}`,
          header: col.header,
          render: (r, rowIndex) => {
            const idx =
              typeof rowIndex === 'number' ? rowIndex : filteredEmployees.indexOf(r);
            const cell = contractRegisterCell(r, col, Math.max(0, idx), formatMoney);
            if (col.key === 'employeeId') {
              return <span className="mono">{cell}</span>;
            }
            return cell;
          },
        })),
        { key: 'lineStatus', header: 'Status', render: (r) => <StatusBadge value={r.lineStatus} /> },
      ];
    }
    return [
      ...earlyCols,
      { key: 'payableDays', header: 'Payable' },
      { key: 'lopDays', header: 'LOP' },
      { key: 'gross', header: 'Gross', render: (r) => formatMoney(r.gross) },
      { key: 'totalDeductions', header: 'Deductions', render: (r) => formatMoney(r.totalDeductions) },
      { key: 'lineStatus', header: 'Status', render: (r) => <StatusBadge value={r.lineStatus} /> },
    ];
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Month</span>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Work group</span>
          <select value={workGroup} onChange={(e) => setWorkGroup(normalizeWorkGroup(e.target.value))}>
            <option value="ALL">All</option>
            {WORK_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="button" onClick={createRun} disabled={!!busy || workGroup === 'ALL'}>
          New run
        </button>
      </div>
      {msg ? <div className={msgError ? 'form-error' : 'form-notice'}>{msg}</div> : null}
      <DataTable
        rows={visibleRows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No runs for this month"
        columns={[
          { key: 'workGroup', header: 'Group' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'employeeCount', header: 'People' },
          {
            key: 'credited',
            header: 'Credited',
            render: (r) => (
              <span title={formatRunCreditSummary(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {r.employeeCount > 0 ? `${Number(r.creditedCount) || 0}/${r.employeeCount}` : '—'}
                {r.creditDueToday ? (
                  <span
                    className="status-badge"
                    style={{
                      background: '#fff3cd',
                      color: '#856404',
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Credit due today
                  </span>
                ) : null}
              </span>
            ),
          },
          { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
          {
            key: 'open',
            header: '',
            render: (r) => (
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button type="button" className="btn btn-sm" onClick={() => navigate(`/hr/payroll/processing/${r.id}`)}>
                  Open
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={!!busy}
                  onClick={() => deleteRun(r)}
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />
      {detail ? (
        <div style={{ marginTop: 24 }}>
          <h3 className="section-title">
            Run {detail.yearMonth} · {detail.workGroup} · <StatusBadge value={detail.status} />
            {creditDueToday ? (
              <span
                style={{
                  marginLeft: 10,
                  background: '#fff3cd',
                  color: '#856404',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 4,
                  verticalAlign: 'middle',
                }}
              >
                Credit due today
              </span>
            ) : null}
          </h3>
          <div className="toolbar-actions" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {detail.status === 'DRAFT' ? (
              <>
                <button className="btn" type="button" disabled={!!busy} onClick={() => action('fetch', 'Fetch')}>
                  Fetch
                </button>
                <button className="btn" type="button" disabled={!!busy} onClick={() => action('calculate', 'Calculate')}>
                  Calculate
                </button>
                <button className="btn" type="button" disabled={!!busy} onClick={() => action('recalculate', 'Recalculate')}>
                  Recalculate
                </button>
                <button className="btn btn-primary" type="button" disabled={!!busy} onClick={() => action('submit', 'Submit')}>
                  Submit
                </button>
              </>
            ) : null}
            {detail.status === 'PENDING_APPROVAL' ? (
              <button className="btn btn-primary" type="button" disabled={!!busy} onClick={() => action('approve', 'Approve')}>
                Approve
              </button>
            ) : null}
            {detail.status === 'APPROVED' || detail.status === 'PROCESSED' ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={!!busy}
                title="Creates slips for included employees that do not already have an active (GENERATED) slip. Cancelled slips are kept for audit."
                onClick={() => action('generate-slips', 'Generate slips')}
              >
                {detail.status === 'PROCESSED' ? 'Generate / regenerate slips' : 'Generate slips'}
              </button>
            ) : null}
            <a className="btn" href={apiUrl(`/api/hr/payroll/runs/${detail.id}/export.xls`)}>
              Export Excel
            </a>
            <button
              className="btn btn-danger"
              type="button"
              disabled={!!busy}
              onClick={() => deleteRun(detail)}
            >
              Delete
            </button>
          </div>
          {employees.length > 0 ? (
            <div
              className="toolbar-actions"
              style={{
                flexWrap: 'wrap',
                marginBottom: 12,
                gap: 8,
                alignItems: 'center',
                ...(creditDueToday
                  ? {
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid #ffe08a',
                      background: '#fffbeb',
                    }
                  : {}),
              }}
            >
              {creditDueToday ? (
                <span style={{ fontWeight: 600, color: '#856404', marginRight: 4 }}>
                  Update salary credit status
                </span>
              ) : null}
              <label className="field" style={{ marginBottom: 0 }}>
                <span>Credit filter</span>
                <select value={creditFilter} onChange={(e) => setCreditFilter(e.target.value)}>
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="CREDITED">Credited</option>
                  <option value="FAILED">Failed</option>
                  <option value="ON_HOLD">On hold</option>
                </select>
              </label>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!!busy || selected.size === 0}
                onClick={() => bulkCredit('CREDITED')}
              >
                Mark selected Credited
              </button>
              <button
                className="btn"
                type="button"
                disabled={!!busy || selected.size === 0}
                onClick={() => bulkCredit('PENDING')}
              >
                Mark selected Pending
              </button>
              <button
                className="btn"
                type="button"
                disabled={!!busy || selected.size === 0}
                onClick={() => bulkCredit('FAILED')}
              >
                Mark selected Failed
              </button>
              {selected.size > 0 ? (
                <span className="muted">{selected.size} selected</span>
              ) : null}
            </div>
          ) : null}
          {employees.length === 0 ? (
            <div className="state-block" style={{ marginTop: 8 }}>
              <h3>No employees in this run</h3>
              <p>
                Credit status appears after people are loaded. Click <strong>Fetch</strong> to pull the work-group
                roster (defaults to Pending — independent of Calculate / Net).
              </p>
              {detail.status === 'DRAFT' ? (
                <button className="btn btn-primary" type="button" disabled={!!busy} onClick={() => action('fetch', 'Fetch')}>
                  Fetch employees
                </button>
              ) : (
                <p className="muted">This run is {detail.status}; open a DRAFT run to Fetch.</p>
              )}
            </div>
          ) : (
            <DataTable
              rows={filteredEmployees}
              emptyTitle="No employees match credit filter"
              emptyDescription="Try Credit filter → All."
              columns={employeeColumns()}
            />
          )}
          {employees.length > 0 && detail.workGroup === 'BGT' ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Credit status is next to Name / Net (scroll sideways for salary photo columns). Structure PF / Bonus /
              LTA come from the assigned structure; credit tracks bank transfer — independent of Calculate / slips.
            </p>
          ) : null}
          {employees.length > 0 && ['Ruchitha', 'Akhil', 'BSK', 'Krystal'].includes(detail.workGroup) ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Credit status is next to Name / Net; scroll sideways for the full contract photo register (
              {CONTRACT_PHOTO_REGISTER_COLS.length} fields). Credit tracks bank transfer — independent of Calculate /
              slips.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function PayrollPayslipsPage() {
  const initialYm = currentMonth();
  const [year, setYear] = useState(Number(initialYm.slice(0, 4)));
  const [month, setMonth] = useState(initialYm.slice(5, 7));
  const yearMonth = `${year}-${month}`;
  const [workGroup, setWorkGroup] = useState('BGT');
  const [employeeQ, setEmployeeQ] = useState('');
  const [departmentQ, setDepartmentQ] = useState('');
  const [designationQ, setDesignationQ] = useState('');
  const [statusQ, setStatusQ] = useState('ALL');
  const [emailStatusQ, setEmailStatusQ] = useState('ALL');
  const [pendingEmailOnly, setPendingEmailOnly] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [viewId, setViewId] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewError, setViewError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [validateInfo, setValidateInfo] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => y - 5 + i);
  }, []);

  const path =
    workGroup === 'ALL'
      ? `/api/hr/payroll/payslips?yearMonth=${encodeURIComponent(yearMonth)}`
      : `/api/hr/payroll/payslips?yearMonth=${encodeURIComponent(yearMonth)}&workGroup=${encodeURIComponent(workGroup)}`;
  const { rows, error, loading, load } = useApiList(path, [yearMonth, workGroup]);

  const filtered = useMemo(() => {
    const emp = employeeQ.trim().toLowerCase();
    const dept = departmentQ.trim().toLowerCase();
    const desig = designationQ.trim().toLowerCase();
    const scoped = filterByWorkGroup(rows, workGroup);
    return scoped.filter((r) => {
      if (statusQ !== 'ALL' && (r.status || 'GENERATED') !== statusQ) return false;
      const emailStatus = r.emailStatus || 'NOT_SENT';
      if (pendingEmailOnly && emailStatus === 'SENT') return false;
      if (emailStatusQ !== 'ALL' && emailStatus !== emailStatusQ) return false;
      if (emp) {
        const hay = `${r.employeeNumber || ''} ${r.displayName || ''}`.toLowerCase();
        if (!hay.includes(emp)) return false;
      }
      if (dept && !(r.department || '').toLowerCase().includes(dept)) return false;
      if (desig && !(r.designation || '').toLowerCase().includes(desig)) return false;
      return true;
    });
  }, [rows, workGroup, employeeQ, departmentQ, designationQ, statusQ, emailStatusQ, pendingEmailOnly]);

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredIds));
  }

  function formatEmailWhen(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  async function openBulkConfirm(resend, idsOverride) {
    const ids = idsOverride ? [...idsOverride] : [...selected];
    if (!ids.length) {
      setMsg('Select at least one salary slip');
      return;
    }
    setMsg('');
    setConfirmResend(!!resend);
    try {
      const info = await api('/api/hr/payroll/payslips/email/validate', {
        method: 'POST',
        body: JSON.stringify({ payslipIds: ids, resend: !!resend }),
      });
      setValidateInfo(info);
      setSelected(new Set(ids));
      setConfirmOpen(true);
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  async function runBulkEmail() {
    const ids = [...selected];
    setConfirmOpen(false);
    setMsg('');
    try {
      const result = await api('/api/hr/payroll/payslips/email/bulk', {
        method: 'POST',
        body: JSON.stringify({ payslipIds: ids, resend: confirmResend }),
      });
      setMsg(`Queued ${result.queued} of ${result.selected} (skipped ${result.skipped}). Batch ${result.batchId}`);
      setSelected(new Set());
      await load();
      if (result.batchId) {
        pollBatch(result.batchId);
      }
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  async function pollBatch(batchId) {
    setBatchProgress({ batchId, total: 0, processed: 0, sent: 0, failed: 0, skipped: 0, pending: 0 });
    for (let i = 0; i < 120; i++) {
      try {
        const progress = await api(`/api/hr/payroll/payslips/email/batches/${batchId}`);
        setBatchProgress(progress);
        if (progress.complete) {
          setSummaryOpen(true);
          await load();
          return;
        }
      } catch (err) {
        setMsg(extractError(err));
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function openView(id) {
    setViewId(id);
    setViewDetail(null);
    setViewError('');
    try {
      setViewDetail(await api(`/api/hr/payroll/payslips/${id}`));
    } catch (err) {
      setViewError(extractError(err));
    }
  }

  async function downloadOne(id, payslipNumber) {
    setMsg('');
    try {
      await savePayslipPdf(id, payslipNumber);
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  async function emailOne(id, alreadySent) {
    const resend = !!alreadySent;
    if (resend && !window.confirm('This salary slip was already emailed. Send again?')) return;
    setBusyId(id);
    setMsg('');
    try {
      const result = await api(`/api/hr/payroll/payslips/${id}/email?resend=${resend ? 'true' : 'false'}`, {
        method: 'POST',
      });
      setMsg(result.details?.[0] || (result.batchId ? `Queued batch ${result.batchId}` : 'Email queued'));
      await load();
      if (result.batchId) pollBatch(result.batchId);
    } catch (err) {
      setMsg(extractError(err));
    } finally {
      setBusyId('');
    }
  }

  async function cancelOne(id) {
    if (!window.confirm('Cancel this payslip? The snapshot is kept for audit; it will no longer be active.')) return;
    setBusyId(id);
    setMsg('');
    try {
      await api(`/api/hr/payroll/payslips/${id}/cancel`, { method: 'POST' });
      setMsg('Payslip cancelled');
      if (viewId === id) await openView(id);
      await load();
    } catch (err) {
      setMsg(extractError(err));
    } finally {
      setBusyId('');
    }
  }

  const failedSkipped = (batchProgress?.items || []).filter((i) => i.status === 'FAILED' || i.status === 'SKIPPED');

  return (
    <>
      <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, '0');
              return (
                <option key={m} value={m}>
                  {new Date(2000, i, 1).toLocaleString('en', { month: 'short' })}
                </option>
              );
            })}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Year</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Employee</span>
          <input value={employeeQ} onChange={(e) => setEmployeeQ(e.target.value)} placeholder="Code or name" />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Department</span>
          <input value={departmentQ} onChange={(e) => setDepartmentQ(e.target.value)} placeholder="Department" />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Designation</span>
          <input value={designationQ} onChange={(e) => setDesignationQ(e.target.value)} placeholder="Designation" />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Employee Type</span>
          <select value={workGroup} onChange={(e) => setWorkGroup(normalizeWorkGroup(e.target.value))}>
            <option value="ALL">All</option>
            {WORK_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Slip Status</span>
          <select value={statusQ} onChange={(e) => setStatusQ(e.target.value)}>
            <option value="ALL">All</option>
            <option value="GENERATED">Generated</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Email Status</span>
          <select value={emailStatusQ} onChange={(e) => setEmailStatusQ(e.target.value)}>
            <option value="ALL">All</option>
            <option value="NOT_SENT">Not Sent</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={pendingEmailOnly} onChange={(e) => setPendingEmailOnly(e.target.checked)} />
          <span>Pending Email</span>
        </label>
        <button className="btn" type="button" onClick={toggleAll}>
          {allSelected ? 'Clear selection' : 'Select All'}
        </button>
        <button className="btn btn-primary" type="button" onClick={() => openBulkConfirm(false)}>
          Bulk Email Salary Slips
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setEmailStatusQ('FAILED');
            setPendingEmailOnly(false);
            const failedIds = (rows || [])
              .filter((r) => (r.emailStatus || '') === 'FAILED')
              .map((r) => r.id);
            setSelected(new Set(failedIds));
            if (!failedIds.length) {
              setMsg('No failed emails in this month to resend');
              return;
            }
            openBulkConfirm(true, failedIds);
          }}
        >
          Send Salary Slips Again
        </button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      {batchProgress && !batchProgress.complete ? (
        <p className="muted">
          Email progress — Total {batchProgress.total}, Processed {batchProgress.processed}, Sent {batchProgress.sent}, Failed{' '}
          {batchProgress.failed}, Skipped {batchProgress.skipped}
        </p>
      ) : null}
        <p className="muted">
          Each employee receives only their own PDF at their <strong>official email</strong> (Employee Master —
          same as Add Employee). BrightGrid emails BGT (On-Role) staff by default; non-BGT slips are skipped
          unless Settings enable all work groups. Sending runs in the background — this page polls batch progress.
          For one-click month send, use Payroll → Settings.
        </p>
      <DataTable
        rows={filtered}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No payslips"
        columns={[
          {
            key: 'select',
            header: (
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
            ),
            render: (r) => (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
                aria-label={`Select ${r.employeeNumber}`}
              />
            ),
          },
          { key: 'employeeNumber', header: 'Employee Code' },
          { key: 'displayName', header: 'Name' },
          { key: 'department', header: 'Department', render: (r) => r.department || '—' },
          { key: 'designation', header: 'Designation', render: (r) => r.designation || '—' },
          { key: 'yearMonth', header: 'Salary Month' },
          { key: 'periodStart', header: 'Start Date', render: (r) => r.periodStart || '—' },
          { key: 'periodEnd', header: 'End Date', render: (r) => r.periodEnd || '—' },
          { key: 'gross', header: 'Gross', render: (r) => formatMoney(r.gross) },
          { key: 'totalDeductions', header: 'Deductions', render: (r) => formatMoney(r.totalDeductions) },
          { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
          { key: 'email', header: 'Employee Email', render: (r) => r.email || '—' },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status || 'GENERATED'} />,
          },
          {
            key: 'emailStatus',
            header: 'Email Status',
            render: (r) => <StatusBadge status={r.emailStatus || 'NOT_SENT'} />,
          },
          {
            key: 'emailSentOn',
            header: 'Email Sent Date/Time',
            render: (r) => formatEmailWhen(r.emailSentOn),
          },
          {
            key: 'actions',
            header: 'Action',
            render: (r) => (
              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <PayslipIconButton className="btn-ghost" icon="view" label="View" onClick={() => openView(r.id)} />
                <PayslipIconButton
                  className="btn-ghost"
                  icon="print"
                  label="Print"
                  href={`/api/hr/payroll/payslips/${r.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                />
                <PayslipIconButton
                  className="btn-ghost"
                  icon="download"
                  label="Download"
                  onClick={() => downloadOne(r.id, r.payslipNumber)}
                />
                {(r.status || 'GENERATED') !== 'CANCELLED' ? (
                  <PayslipIconButton
                    className="btn-ghost"
                    icon="mail"
                    label={(r.emailStatus || '') === 'SENT' ? 'Resend email' : 'Email'}
                    disabled={busyId === r.id}
                    onClick={() => emailOne(r.id, (r.emailStatus || '') === 'SENT')}
                  />
                ) : null}
                {(r.status || 'GENERATED') !== 'CANCELLED' ? (
                  <PayslipIconButton
                    className="btn-ghost"
                    icon="cancel"
                    label="Cancel"
                    disabled={busyId === r.id}
                    onClick={() => cancelOne(r.id)}
                  />
                ) : null}
              </span>
            ),
          },
        ]}
      />

      {confirmOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setConfirmOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmResend ? 'Resend salary slips' : 'Bulk email salary slips'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p>
                Selected: <strong>{validateInfo?.selected ?? selected.size}</strong>
              </p>
              <p>
                Valid: <strong>{validateInfo?.valid ?? '—'}</strong>
              </p>
              <p>Missing email: {validateInfo?.missingEmail ?? 0}</p>
              <p>Invalid email: {validateInfo?.invalidEmail ?? 0}</p>
              <p>Not generated / cancelled: {validateInfo?.notGenerated ?? 0}</p>
              <p>Already sent (need resend): {validateInfo?.alreadySent ?? 0}</p>
              <p>Non-BGT skipped: {validateInfo?.nonBgt ?? 0}</p>
              {confirmResend ? (
                <p className="muted">Resend is enabled — slips already marked Sent can be emailed again.</p>
              ) : null}
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={runBulkEmail} disabled={(validateInfo?.valid || 0) < 1}>
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {summaryOpen && batchProgress ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSummaryOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Email batch complete</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setSummaryOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p>
                Total {batchProgress.total} · Sent {batchProgress.sent} · Failed {batchProgress.failed} · Skipped{' '}
                {batchProgress.skipped}
              </p>
              {failedSkipped.length ? (
                <>
                  <h4 className="section-title">Failed / skipped</h4>
                  <ul>
                    {failedSkipped.map((item) => (
                      <li key={`${item.payslipId}-${item.status}`}>
                        {item.employeeNumber} {item.displayName} — {item.status}
                        {item.detail ? `: ${item.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">No failures or skips.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {viewId ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewId(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: 920, width: '94vw', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Salary slip</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setViewId(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              {viewError ? <p className="error-text">{viewError}</p> : null}
              {!viewDetail && !viewError ? <p className="muted">Loading…</p> : null}
              {viewDetail ? <PayslipPreview detail={viewDetail} /> : null}
            </div>
            {viewDetail ? (
              <div className="modal-footer" style={{ gap: 8 }}>
                <PayslipIconButton
                  icon="print"
                  label="Print"
                  href={`/api/hr/payroll/payslips/${viewDetail.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                />
                <PayslipIconButton
                  icon="download"
                  label="Download"
                  onClick={() => downloadOne(viewDetail.id, viewDetail.payslipNumber)}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PayslipPreview({ detail }) {
  const att = detail.attendance || {};
  const leave = detail.leave || {};
  const availed = leave.availed || {};
  const balance = leave.balance || {};
  const tax = detail.tax || {};
  const loan = detail.loan || {};
  const lines = detail.snapshot?.components || detail.components || [];

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <strong>BRIGHTGRID TECHNOLOGIES LLP</strong>
        <div>Pay Slip for the Month of {detail.monthLabel || detail.yearMonth}</div>
        <div className="muted mono">{detail.payslipNumber}</div>
      </div>
      <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td>Employee Code</td>
            <td>{detail.employeeNumber}</td>
            <td>UAN</td>
            <td>{detail.uan || '—'}</td>
          </tr>
          <tr>
            <td>Employee Name</td>
            <td>{detail.displayName}</td>
            <td>Department</td>
            <td>{detail.department || '—'}</td>
          </tr>
          <tr>
            <td>Designation</td>
            <td>{detail.designation || '—'}</td>
            <td>Date of Joining</td>
            <td>{detail.dateOfJoining || '—'}</td>
          </tr>
        </tbody>
      </table>
      <h4 className="section-title">Attendance</h4>
      <p className="muted">
        Payable {att.daysPayable ?? '—'} · Paid {att.daysPaid ?? '—'} · Arr {att.arrDays ?? 0} · LOP {att.lopDays ?? '—'} · Cum{' '}
        {att.cumDays ?? '—'}
      </p>
      <h4 className="section-title">Leave</h4>
      <p className="muted">
        Availed CL {availed.CL ?? 0} / EL {availed.EL ?? 0} / SL {availed.SL ?? 0} · Balance CL {balance.CL ?? 0} / EL {balance.EL ?? 0} / SL{' '}
        {balance.SL ?? 0}
      </p>
      <h4 className="section-title">Loan / Tax</h4>
      <p className="muted">
        Loan/Advance {formatMoney(loan.amount ?? 0)} · Taxable {tax.taxableIncome != null ? formatMoney(tax.taxableIncome) : '—'} · TDS{' '}
        {formatMoney(tax.tdsCurrentMonth ?? 0)} · Annual TDS {tax.annualTds != null ? formatMoney(tax.annualTds) : '—'}
      </p>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Cur. Month</th>
            <th>Arrears</th>
            <th>Deductions</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const isDed = (line.type || '').toUpperCase() === 'DEDUCTION';
            return (
              <tr key={line.code || line.name}>
                <td>{line.name}</td>
                <td>{isDed ? '—' : formatMoney(line.currentMonth ?? line.amount ?? 0)}</td>
                <td>{isDed ? '—' : formatMoney(line.arrears ?? 0)}</td>
                <td>{isDed ? formatMoney(line.deduction ?? line.amount ?? 0) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: 12 }}>
        <strong>Gross</strong> {formatMoney(detail.gross)} · <strong>Deductions</strong> {formatMoney(detail.totalDeductions)} ·{' '}
        <strong>Net</strong> {formatMoney(detail.net)}
      </p>
      <p className="muted">Amount in Words: {detail.amountInWords}</p>
      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Signature
        <br />
        This is a Computer Generated Pay Slip. Signature is Not Required.
      </p>
    </div>
  );
}

const REPORT_COMPANIES = WORK_GROUPS.map((g) => g.value);

function mergeReportCompanies(apiGroups, workGroup) {
  const byName = new Map();
  for (const g of apiGroups || []) {
    const key = String(g.workGroup || '').trim();
    if (!key) continue;
    const canonical = REPORT_COMPANIES.find((c) => c.toLowerCase() === key.toLowerCase());
    if (!canonical) continue;
    byName.set(canonical.toLowerCase(), { ...g, workGroup: canonical });
  }
  const all = REPORT_COMPANIES.map((name) => {
    const hit = byName.get(name.toLowerCase());
    return {
      workGroup: name,
      gross: hit?.gross ?? 0,
      deductions: hit?.deductions ?? 0,
      net: hit?.net ?? 0,
      slipCount: hit?.slipCount ?? 0,
      employeeCount: hit?.employeeCount ?? 0,
    };
  });
  const wg = normalizeWorkGroup(workGroup);
  if (!wg || wg === 'ALL') return all;
  return all.filter((g) => sameWorkGroup(g.workGroup, wg));
}

/** Per work-group company-expense totals for the expenses summary cards. */
function mergeExpenseCompanies(rows, workGroup) {
  const byName = new Map();
  for (const row of rows || []) {
    if (row.source !== 'COMPANY') continue;
    const key = String(row.workGroup || '').trim();
    if (!key) continue;
    const canonical = REPORT_COMPANIES.find((c) => c.toLowerCase() === key.toLowerCase());
    if (!canonical) continue;
    const prev = byName.get(canonical.toLowerCase()) || {
      workGroup: canonical,
      total: 0,
      entryCount: 0,
    };
    prev.total += Number(row.amount || 0);
    prev.entryCount += 1;
    byName.set(canonical.toLowerCase(), prev);
  }
  const all = REPORT_COMPANIES.map((name) => {
    const hit = byName.get(name.toLowerCase());
    return {
      workGroup: name,
      total: hit?.total ?? 0,
      entryCount: hit?.entryCount ?? 0,
    };
  });
  const wg = normalizeWorkGroup(workGroup);
  if (!wg || wg === 'ALL') return all;
  return all.filter((g) => sameWorkGroup(g.workGroup, wg));
}

export function PayrollReportsPage() {
  const navigate = useNavigate();
  const employeeRegisterRef = useRef(null);
  const [yearMonth, setYearMonth] = useState(currentMonth());
  const [workGroup, setWorkGroup] = useState('ALL');
  const [showEmployeeRegister, setShowEmployeeRegister] = useState(false);
  const [expenseType, setExpenseType] = useState('ALL');
  const [employeeQ, setEmployeeQ] = useState('');
  const [statusQ, setStatusQ] = useState('ALL');
  const [data, setData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [error, setError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');
  const reqIdRef = useRef(0);
  const expenseReqIdRef = useRef(0);

  async function load() {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError('');
    try {
      // Always load all companies for the month so company tiles stay complete;
      // employee register is filtered client-side by work-group tab.
      const next = await api(`/api/hr/payroll/reports?yearMonth=${encodeURIComponent(yearMonth)}`);
      if (reqId !== reqIdRef.current) return;
      setData(next);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setData(null);
      setError(extractError(err));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  async function loadExpenses() {
    const reqId = ++expenseReqIdRef.current;
    setExpenseLoading(true);
    setExpenseError('');
    try {
      // Load ALL work groups so expense company tiles stay complete;
      // cards / detail table filter client-side by the work-group tab.
      const params = new URLSearchParams({
        from: yearMonth,
        to: yearMonth,
        type: expenseType,
        workGroup: 'ALL',
      });
      const next = await api(`/api/hr/expenses/reports?${params}`);
      if (reqId !== expenseReqIdRef.current) return;
      setExpenseData(next);
    } catch (err) {
      if (reqId !== expenseReqIdRef.current) return;
      setExpenseData(null);
      setExpenseError(extractError(err));
    } finally {
      if (reqId === expenseReqIdRef.current) setExpenseLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [yearMonth]);

  useEffect(() => {
    loadExpenses();
  }, [yearMonth, expenseType]);

  const companies = useMemo(() => {
    const groups =
      Array.isArray(data?.companies) && data.companies.length
        ? data.companies
        : (data?.costReport || []).map((c) => ({
            workGroup: c.workGroup,
            gross: c.amount ?? 0,
            deductions: 0,
            net: c.amount ?? 0,
            slipCount: 0,
            employeeCount: 0,
          }));
    return mergeReportCompanies(groups, workGroup);
  }, [data, workGroup]);

  const registerRows = useMemo(() => {
    const scoped = filterByWorkGroup(data?.register || [], workGroup);
    const q = employeeQ.trim().toLowerCase();
    return scoped.filter((r) => {
      const status = r.status || 'GENERATED';
      if (statusQ === 'ALL') {
        if (String(status).toUpperCase() === 'CANCELLED') return false;
      } else if (status !== statusQ) {
        return false;
      }
      if (!q) return true;
      const hay = `${r.employeeNumber || ''} ${r.displayName || ''} ${r.department || ''} ${r.designation || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, workGroup, employeeQ, statusQ]);

  const periodLabel = useMemo(() => {
    try {
      const [y, m] = yearMonth.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return yearMonth;
    }
  }, [yearMonth]);

  const totals = useMemo(() => {
    if (workGroup === 'ALL' && data) {
      return {
        gross: data.totalGross ?? 0,
        deductions: data.totalDeductions ?? 0,
        net: data.totalNet ?? 0,
        slips: (data.register || []).filter((r) => (r.status || '').toUpperCase() !== 'CANCELLED').length,
        people: new Set(
          (data.register || [])
            .filter((r) => (r.status || '').toUpperCase() !== 'CANCELLED')
            .map((r) => r.employeeNumber || r.id)
        ).size,
      };
    }
    const gross = companies.reduce((s, c) => s + Number(c.gross || 0), 0);
    const deductions = companies.reduce((s, c) => s + Number(c.deductions || 0), 0);
    const net = companies.reduce((s, c) => s + Number(c.net || 0), 0);
    const slips = companies.reduce((s, c) => s + Number(c.slipCount || 0), 0);
    const people = companies.reduce((s, c) => s + Number(c.employeeCount || 0), 0);
    return { gross, deductions, net, slips, people };
  }, [data, companies, workGroup]);

  const expenseRowsAll = expenseData?.rows || [];

  const expenseRows = useMemo(() => {
    if (expenseType === 'EMPLOYEE_CLAIM') {
      return expenseRowsAll.filter((r) => r.source === 'EMPLOYEE_CLAIM');
    }
    if (expenseType === 'COMPANY') {
      return filterByWorkGroup(
        expenseRowsAll.filter((r) => r.source === 'COMPANY'),
        workGroup
      );
    }
    // ALL: keep org-wide employee claims + company rows for selected work group
    const claims = expenseRowsAll.filter((r) => r.source === 'EMPLOYEE_CLAIM');
    const company = filterByWorkGroup(
      expenseRowsAll.filter((r) => r.source === 'COMPANY'),
      workGroup
    );
    return [...claims, ...company];
  }, [expenseRowsAll, workGroup, expenseType]);

  const expenseCompanies = useMemo(
    () => mergeExpenseCompanies(expenseRowsAll, workGroup),
    [expenseRowsAll, workGroup]
  );

  const expenseClaimSummary = useMemo(() => {
    const claims = expenseRowsAll.filter((r) => r.source === 'EMPLOYEE_CLAIM');
    const claimed = claims.reduce((s, r) => s + Number(r.amount || 0), 0);
    const approved = claims
      .filter((r) => r.status === 'APPROVED' || r.status === 'PAID')
      .reduce((s, r) => s + Number(r.approvedAmount != null ? r.approvedAmount : r.amount || 0), 0);
    return { count: claims.length, claimed, approved };
  }, [expenseRowsAll]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    for (const row of expenseRows) {
      map[row.category] = (map[row.category] || 0) + Number(row.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenseRows]);

  function openCompanyEmployees(group) {
    setWorkGroup(normalizeWorkGroup(group));
    setShowEmployeeRegister(true);
    setEmployeeQ('');
    requestAnimationFrame(() => {
      employeeRegisterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function exportRegister() {
    const rows = registerRows;
    const isBgt = workGroup === 'BGT';
    if (isBgt) {
      downloadTableExcel(
        `BGT salary register · ${periodLabel}`,
        ['Slip', 'ID', 'Name', 'Designation', 'Gross (Net Salary)', 'Deductions', 'Net Payt of Salary', 'Credit', 'Status'],
        rows.map((r) => [
          r.payslipNumber,
          r.employeeNumber,
          r.displayName,
          r.designation || '',
          r.gross,
          r.totalDeductions,
          r.net,
          r.creditStatus || '',
          r.status || '',
        ]),
        `payroll-register-BGT-${yearMonth}.xls`
      );
      return;
    }
    const groupLabel = workGroup === 'ALL' ? 'all' : workGroup;
    downloadTableExcel(
      `Payroll register · ${periodLabel}`,
      ['Slip', 'ID', 'Name', 'Group', 'Gross', 'Deductions', 'Net', 'Credit', 'Status'],
      rows.map((r) => [
        r.payslipNumber,
        r.employeeNumber,
        r.displayName,
        r.workGroup,
        r.gross,
        r.totalDeductions,
        r.net,
        r.creditStatus || '',
        r.status || '',
      ]),
      `payroll-register-${groupLabel}-${yearMonth}.xls`
    );
  }

  function exportCompanySummary() {
    downloadTableExcel(
      `Company payment summary · ${periodLabel}`,
      ['Company', 'Employees', 'Slips', 'Gross', 'Deductions', 'Net'],
      companies.map((c) => [c.workGroup, c.employeeCount, c.slipCount, c.gross, c.deductions, c.net]),
      `payroll-companies-${yearMonth}.xls`
    );
  }

  function exportExpenses() {
    downloadTableExcel(
      `Expenses report · ${periodLabel}`,
      ['Type', 'Ref', 'Person / company', 'Work group', 'Category', 'Title', 'Spent', 'Amount', 'Approved', 'Status', 'Vendor'],
      expenseRows.map((row) => [
        row.source === 'COMPANY' ? 'Company expense' : 'Employee claim',
        row.number,
        row.displayName,
        row.workGroup || '',
        expenseCategoryLabel(row.category),
        row.title,
        row.spentOn,
        row.amount,
        row.approvedAmount ?? '',
        row.source === 'COMPANY' ? 'Recorded' : expenseStatusLabel(row.status),
        row.vendor || '',
      ]),
      `payroll-expenses-${yearMonth}.xls`
    );
  }

  function refreshAll() {
    load();
    loadExpenses();
  }

  const sourceHint =
    data?.source === 'RUNS'
      ? 'Totals from calculated payroll runs (payslips not generated yet).'
      : data?.source === 'PAYSLIPS'
        ? 'Totals from generated salary payment slips.'
        : null;

  return (
    <section className="payroll-reports" aria-label="Payroll payment reports">
      <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12 }}>
        <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
          <span>Month</span>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </label>
        <WorkGroupTabs value={workGroup} onChange={(g) => setWorkGroup(normalizeWorkGroup(g))} />
        <button className="btn" type="button" disabled={loading || expenseLoading} onClick={refreshAll}>
          Refresh
        </button>
      </div>

      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        Payment and expenses for <strong>{periodLabel}</strong>
        {workGroup !== 'ALL' ? (
          <>
            {' '}
            · <strong>{workGroup}</strong>
          </>
        ) : (
          ' · all companies'
        )}
        {sourceHint ? ` · ${sourceHint}` : ''}.{' '}
        <Link to="/hr/payroll/company-expenses">Manage company expenses</Link>
      </p>

      {error ? <p className="error-text">{error}</p> : null}
      {expenseError ? <p className="error-text">{expenseError}</p> : null}

      <div className="kpi-grid kpi-grid-5" style={{ marginBottom: 16 }}>
        <KpiCard label="Gross pay" value={loading && !data ? '…' : formatMoney(totals.gross)} />
        <KpiCard label="Deductions" value={loading && !data ? '…' : formatMoney(totals.deductions)} />
        <KpiCard label="Net payout" value={loading && !data ? '…' : formatMoney(totals.net)} />
        <KpiCard label="Employees" value={loading && !data ? '…' : totals.people} />
        <KpiCard label="Slips" value={loading && !data ? '…' : totals.slips} />
      </div>

      <div className="list-toolbar" style={{ marginBottom: 8 }}>
        <h3 className="section-title" style={{ margin: 0, flex: 1 }}>
          Company payment summary
        </h3>
        <button
          className="btn"
          type="button"
          onClick={exportCompanySummary}
          disabled={!companies.some((c) => Number(c.slipCount) > 0 || Number(c.net) > 0)}
        >
          Export companies
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Every company / work group for the selected month. Use <strong>View employees</strong> on a card to open
        individual payment slips below.
      </p>
      <div className="payroll-reports-company-grid">
        {companies.map((c) => {
          const active = sameWorkGroup(workGroup, c.workGroup);
          const hasData = Number(c.slipCount) > 0 || Number(c.net) > 0 || Number(c.employeeCount) > 0;
          return (
            <article
              key={c.workGroup}
              className={`payroll-reports-company-card${active && workGroup !== 'ALL' ? ' is-active' : ''}${!hasData ? ' is-empty' : ''}`}
            >
              <header className="payroll-reports-company-card__head">
                <h4>{c.workGroup}</h4>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!hasData}
                  onClick={() => openCompanyEmployees(c.workGroup)}
                >
                  View employees
                </button>
              </header>
              <div className="payroll-reports-company-card__net">
                {loading && !data ? '…' : formatMoney(c.net)}
              </div>
              <div className="payroll-reports-company-card__meta">
                <span>
                  Gross <strong>{loading && !data ? '…' : formatMoney(c.gross)}</strong>
                </span>
                <span>
                  Deductions <strong>{loading && !data ? '…' : formatMoney(c.deductions)}</strong>
                </span>
                <span>
                  People <strong>{loading && !data ? '…' : c.employeeCount || 0}</strong>
                </span>
                <span>
                  Slips <strong>{loading && !data ? '…' : c.slipCount || 0}</strong>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="section-title" style={{ marginTop: 20 }}>
        Company comparison
      </h3>
      <DataTable
        rows={companies}
        loading={loading}
        emptyTitle="No company totals"
        columns={[
          { key: 'workGroup', header: 'Company' },
          { key: 'employeeCount', header: 'Employees' },
          { key: 'slipCount', header: 'Slips' },
          { key: 'gross', header: 'Gross', render: (r) => formatMoney(r.gross) },
          { key: 'deductions', header: 'Deductions', render: (r) => formatMoney(r.deductions) },
          { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <button type="button" className="btn btn-sm" onClick={() => openCompanyEmployees(r.workGroup)}>
                Employees
              </button>
            ),
          },
        ]}
      />

      {workGroup === 'ALL' && (data?.componentReport || []).length > 0 ? (
        <>
          <h3 className="section-title" style={{ marginTop: 20 }}>
            Component totals
          </h3>
          <DataTable
            rows={data.componentReport}
            loading={loading}
            emptyTitle="No component totals"
            columns={[
              { key: 'code', header: 'Component' },
              { key: 'amount', header: 'Amount', render: (r) => formatMoney(r.amount) },
            ]}
          />
        </>
      ) : null}

      {showEmployeeRegister ? (
        <div ref={employeeRegisterRef} style={{ marginTop: 24 }}>
          <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <h3 className="section-title" style={{ margin: 0, flex: 1 }}>
              Individual payment reports
              {workGroup !== 'ALL' ? ` · ${workGroup}` : ''}
            </h3>
            <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
              <span>Search employee</span>
              <input
                type="search"
                value={employeeQ}
                onChange={(e) => setEmployeeQ(e.target.value)}
                placeholder="Name, ID, dept…"
              />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Slip status</span>
              <select value={statusQ} onChange={(e) => setStatusQ(e.target.value)}>
                <option value="ALL">Active</option>
                <option value="GENERATED">Generated</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <button className="btn btn-primary" type="button" onClick={exportRegister} disabled={!registerRows.length}>
              Export register
            </button>
            <button className="btn" type="button" onClick={() => setShowEmployeeRegister(false)}>
              Hide list
            </button>
          </div>
          {downloadMsg ? <p className="error-text">{downloadMsg}</p> : null}
          <p className="muted" style={{ marginTop: 0 }}>
            Every employee payment slip for the period. Hover an icon for Print or Download. Download saves a PDF.
            {workGroup === 'ALL' ? ' Filter by company tab above to narrow the list.' : ''}
          </p>
          <DataTable
            rows={registerRows}
            loading={loading}
            emptyTitle="No payment reports"
            emptyDescription="Save salary payouts or generate payslips for this month, then refresh."
            columns={[
              {
                key: 'payslipNumber',
                header: 'Slip #',
                render: (r) => <span className="mono">{r.payslipNumber}</span>,
              },
              { key: 'employeeNumber', header: 'ID', render: (r) => r.employeeNumber || '—' },
              { key: 'displayName', header: 'Employee' },
              {
                key: 'workGroup',
                header: 'Company',
                render: (r) => r.workGroup || '—',
              },
              {
                key: 'designation',
                header: 'Designation',
                render: (r) => r.designation || '—',
              },
              { key: 'gross', header: 'Gross', render: (r) => formatMoney(r.gross) },
              {
                key: 'totalDeductions',
                header: 'Deductions',
                render: (r) => formatMoney(r.totalDeductions),
              },
              { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
              {
                key: 'creditStatus',
                header: 'Credit',
                render: (r) =>
                  r.creditStatus ? <StatusBadge value={r.creditStatus} /> : <span className="muted">—</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <StatusBadge value={r.status || 'GENERATED'} />,
              },
              {
                key: 'actions',
                header: 'Report',
                render: (r) => (
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <PayslipIconButton
                      className="btn-ghost"
                      icon="print"
                      label="Print"
                      href={`/api/hr/payroll/payslips/${r.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                    />
                    <PayslipIconButton
                      className="btn-ghost"
                      icon="download"
                      label="Download"
                      onClick={() => {
                        setDownloadMsg('');
                        savePayslipPdf(r.id, r.payslipNumber).catch((err) => setDownloadMsg(extractError(err)));
                      }}
                    />
                  </span>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 28 }}>
        <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <h3 className="section-title" style={{ margin: 0, flex: 1 }}>
            Expenses summary
          </h3>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Type</span>
            <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)}>
              <option value="ALL">All</option>
              <option value="EMPLOYEE_CLAIM">Employee claims</option>
              <option value="COMPANY">Company expenses</option>
            </select>
          </label>
          <button className="btn" type="button" onClick={exportExpenses} disabled={!expenseRows.length}>
            Export expenses
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Employee claims (org-wide) and company expenses by work group for the selected month.{' '}
          <Link to="/hr/payroll/company-expenses">Manage company expenses</Link>
        </p>

        <div className="payroll-reports-company-grid">
          {expenseType !== 'COMPANY' ? (
            <article
              className={`payroll-reports-company-card${expenseClaimSummary.count === 0 ? ' is-empty' : ''}`}
            >
              <header className="payroll-reports-company-card__head">
                <h4>Employee claims</h4>
                <Link className="btn btn-sm" to="/hr/expenses">
                  Open claims
                </Link>
              </header>
              <div className="payroll-reports-company-card__net">
                {expenseLoading && !expenseData ? '…' : formatMoney(expenseClaimSummary.approved)}
              </div>
              <div className="payroll-reports-company-card__meta">
                <span>
                  Claimed{' '}
                  <strong>
                    {expenseLoading && !expenseData ? '…' : formatMoney(expenseClaimSummary.claimed)}
                  </strong>
                </span>
                <span>
                  Approved{' '}
                  <strong>
                    {expenseLoading && !expenseData ? '…' : formatMoney(expenseClaimSummary.approved)}
                  </strong>
                </span>
                <span>
                  Claims <strong>{expenseLoading && !expenseData ? '…' : expenseClaimSummary.count}</strong>
                </span>
                <span>
                  Scope <strong>All companies</strong>
                </span>
              </div>
            </article>
          ) : null}

          {expenseType !== 'EMPLOYEE_CLAIM'
            ? expenseCompanies.map((c) => {
                const active = sameWorkGroup(workGroup, c.workGroup);
                const hasData = Number(c.entryCount) > 0 || Number(c.total) > 0;
                return (
                  <article
                    key={c.workGroup}
                    className={`payroll-reports-company-card${active && workGroup !== 'ALL' ? ' is-active' : ''}${!hasData ? ' is-empty' : ''}`}
                  >
                    <header className="payroll-reports-company-card__head">
                      <h4>{c.workGroup}</h4>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setWorkGroup(normalizeWorkGroup(c.workGroup))}
                      >
                        Filter
                      </button>
                    </header>
                    <div className="payroll-reports-company-card__net">
                      {expenseLoading && !expenseData ? '…' : formatMoney(c.total)}
                    </div>
                    <div className="payroll-reports-company-card__meta">
                      <span>
                        Company <strong>{expenseLoading && !expenseData ? '…' : formatMoney(c.total)}</strong>
                      </span>
                      <span>
                        Entries <strong>{expenseLoading && !expenseData ? '…' : c.entryCount}</strong>
                      </span>
                      <span>
                        Type <strong>Company</strong>
                      </span>
                      <span>
                        Group <strong>{c.workGroup}</strong>
                      </span>
                    </div>
                  </article>
                );
              })
            : null}
        </div>

        {expenseByCategory.length ? (
          <p className="muted" style={{ marginTop: 12 }}>
            By category:{' '}
            {expenseByCategory
              .map(([name, amount]) => `${expenseCategoryLabel(name)} ${formatMoney(amount)}`)
              .join(' · ')}
          </p>
        ) : null}

        <h3 className="section-title" style={{ marginTop: 16 }}>
          Expense detail
        </h3>
        <DataTable
          rows={expenseRows}
          loading={expenseLoading}
          emptyTitle="No expenses this month"
          emptyDescription="Employee claims and company expenses with spend/submit dates in this month appear here."
          onRowClick={(row) => {
            if (row.source === 'EMPLOYEE_CLAIM') navigate(`/hr/expenses/${row.id}`);
            else navigate('/hr/payroll/company-expenses');
          }}
          columns={[
            {
              key: 'source',
              header: 'Type',
              render: (r) => (r.source === 'COMPANY' ? 'Company expense' : 'Employee claim'),
            },
            {
              key: 'number',
              header: 'Ref',
              render: (r) => <span className="mono">{r.number}</span>,
            },
            {
              key: 'displayName',
              header: 'Person / company',
              render: (r) => (
                <div className="cell-stack">
                  <div className="primary">{r.displayName}</div>
                  <div className="secondary">{r.title}</div>
                </div>
              ),
            },
            {
              key: 'workGroup',
              header: 'Company',
              render: (r) => r.workGroup || '—',
            },
            { key: 'category', header: 'Category', render: (r) => expenseCategoryLabel(r.category) },
            { key: 'spentOn', header: 'Spent', render: (r) => formatDate(r.spentOn) },
            { key: 'amount', header: 'Amount', render: (r) => formatMoney(r.amount) },
            {
              key: 'approvedAmount',
              header: 'Approved',
              render: (r) => (r.approvedAmount != null ? formatMoney(r.approvedAmount) : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) =>
                r.source === 'COMPANY' ? <StatusBadge value="RECORDED" /> : <StatusBadge value={r.status} />,
            },
          ]}
        />
      </div>
    </section>
  );
}

function defaultCreditSchedule() {
  return WORK_GROUPS.map((g) => ({
    workGroup: g.value,
    creditDayOfMonth: 5,
    active: true,
    remarks: '',
    creditDueToday: false,
    nextCreditDate: nextCreditDateForDay(5),
  }));
}

/** Next calendar date for a recurring day-of-month (1–28), Asia/Kolkata-ish local. */
function nextCreditDateForDay(dayOfMonth) {
  const day = Math.min(28, Math.max(1, Number(dayOfMonth) || 5));
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (now.getDate() > day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeScheduleRows(rows) {
  const byGroup = new Map(
    (Array.isArray(rows) ? rows : [])
      .filter((r) => r && r.workGroup)
      .map((r) => [r.workGroup, r])
  );
  return WORK_GROUPS.map((g) => {
    const row = byGroup.get(g.value);
    const day = Math.min(28, Math.max(1, Number(row?.creditDayOfMonth) || 5));
    return {
      workGroup: g.value,
      creditDayOfMonth: day,
      active: row?.active !== false,
      remarks: row?.remarks ?? '',
      creditDueToday: !!row?.creditDueToday,
      nextCreditDate: row?.nextCreditDate || nextCreditDateForDay(day),
    };
  });
}

export function PayrollSettingsPage() {
  const [settings, setSettings] = useState({});
  const [msg, setMsg] = useState('');
  const [schedule, setSchedule] = useState(() => defaultCreditSchedule());
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [emailLog, setEmailLog] = useState([]);
  const [emailLogError, setEmailLogError] = useState('');
  const [emailLogLoading, setEmailLogLoading] = useState(false);

  const initialYm = currentMonth();
  const [sendYear, setSendYear] = useState(Number(initialYm.slice(0, 4)));
  const [sendMonth, setSendMonth] = useState(initialYm.slice(5, 7));
  const sendYearMonth = `${sendYear}-${sendMonth}`;
  const sendYearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => y - 5 + i);
  }, []);
  const [sendResend, setSendResend] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [sendProgress, setSendProgress] = useState(null);
  const [sendSummaryOpen, setSendSummaryOpen] = useState(false);

  useEffect(() => {
    api('/api/hr/payroll/settings')
      .then(setSettings)
      .catch((err) => setMsg(extractError(err)));
  }, []);

  useEffect(() => {
    api('/api/hr/payroll/salary-credit-schedule')
      .then((rows) => setSchedule(normalizeScheduleRows(rows)))
      .catch((err) => {
        const status = err?.status;
        const detail = extractError(err);
        setScheduleMsg(
          status === 404
            ? 'Salary credit API not found (404). Restart the ERP backend so V51 endpoints load, then refresh.'
            : detail
        );
      });
  }, []);

  async function loadEmailLog() {
    setEmailLogLoading(true);
    setEmailLogError('');
    try {
      setEmailLog(await api('/api/hr/payroll/payslips/email/log?limit=100'));
    } catch (err) {
      setEmailLog([]);
      setEmailLogError(extractError(err));
    } finally {
      setEmailLogLoading(false);
    }
  }

  useEffect(() => {
    loadEmailLog();
  }, []);

  async function pollSendBatch(batchId) {
    setSendProgress({ batchId, total: 0, processed: 0, sent: 0, failed: 0, skipped: 0, pending: 0 });
    for (let i = 0; i < 120; i++) {
      try {
        const progress = await api(`/api/hr/payroll/payslips/email/batches/${batchId}`);
        setSendProgress(progress);
        if (progress.complete) {
          setSendSummaryOpen(true);
          await loadEmailLog();
          return;
        }
      } catch (err) {
        setSendMsg(extractError(err));
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function sendPayslipsForMonth() {
    setSendBusy(true);
    setSendMsg('');
    setSendProgress(null);
    setSendSummaryOpen(false);
    try {
      const result = await api(
        `/api/hr/payroll/payslips/email/month?yearMonth=${encodeURIComponent(sendYearMonth)}&resend=${sendResend ? 'true' : 'false'}`,
        { method: 'POST' }
      );
      setSendMsg(
        `Queued ${result.queued} of ${result.selected} (skipped ${result.skipped}).` +
          (result.batchId ? ` Batch ${String(result.batchId).slice(0, 8)}…` : '')
      );
      if (result.batchId) {
        await pollSendBatch(result.batchId);
      }
    } catch (err) {
      setSendMsg(extractError(err));
    } finally {
      setSendBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setMsg('');
    try {
      setSettings(await api('/api/hr/payroll/settings', { method: 'PUT', body: JSON.stringify(settings) }));
      setMsg('Settings saved');
    } catch (err) {
      setMsg(extractError(err));
    }
  }

  async function saveSchedule(event) {
    event.preventDefault();
    setScheduleMsg('');
    setScheduleBusy(true);
    try {
      const rows = schedule.length ? schedule : defaultCreditSchedule();
      const body = rows.map((row) => ({
        workGroup: row.workGroup,
        creditDayOfMonth: Math.min(28, Math.max(1, Number(row.creditDayOfMonth) || 5)),
        active: !!row.active,
        remarks: row.remarks || '',
        nextCreditDate: row.nextCreditDate || null,
      }));
      const saved = await api('/api/hr/payroll/salary-credit-schedule', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSchedule(normalizeScheduleRows(saved));
      setScheduleMsg('Salary credit schedule saved');
    } catch (err) {
      const status = err?.status;
      setScheduleMsg(
        status === 404
          ? 'Save failed (404). Restart the ERP backend so V51 salary-credit-schedule API is available.'
          : extractError(err)
      );
    } finally {
      setScheduleBusy(false);
    }
  }

  function updateScheduleRow(workGroup, patch) {
    setSchedule((prev) => {
      const base = prev.length ? prev : defaultCreditSchedule();
      return base.map((row) => {
        if (row.workGroup !== workGroup) return row;
        const next = { ...row, ...patch };
        if (patch.creditDayOfMonth != null) {
          const day = Math.min(28, Math.max(1, Number(patch.creditDayOfMonth) || 5));
          next.creditDayOfMonth = day;
          next.nextCreditDate = nextCreditDateForDay(day);
        }
        if (patch.nextCreditDate) {
          const parsed = String(patch.nextCreditDate).slice(8, 10);
          const day = Math.min(28, Math.max(1, Number(parsed) || next.creditDayOfMonth || 5));
          next.creditDayOfMonth = day;
          next.nextCreditDate = patch.nextCreditDate;
        }
        return next;
      });
    });
  }

  function field(key, label, opts = {}) {
    const { textarea, type = 'text', hint, boolean, span2 } = opts;
    const className = `field${span2 || textarea ? ' span-2' : ''}`;
    if (boolean) {
      const raw = String(settings[key] ?? '').trim().toLowerCase();
      const value =
        raw === 'true' || raw === '1' || raw === 'yes'
          ? 'true'
          : raw === 'false' || raw === '0' || raw === 'no'
            ? 'false'
            : '';
      return (
        <label className={className} key={key}>
          <span>{label || key}</span>
          <select
            value={value}
            onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {hint ? <span className="field-hint">{hint}</span> : null}
        </label>
      );
    }
    return (
      <label className={className} key={key}>
        <span>{label || key}</span>
        {textarea ? (
          <textarea
            rows={6}
            value={settings[key] ?? ''}
            onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
          />
        ) : (
          <input
            type={type}
            value={settings[key] ?? ''}
            onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
            placeholder={hint}
          />
        )}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </label>
    );
  }

  function formatWhen(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  const failedSkipped = (sendProgress?.items || []).filter((i) => i.status === 'FAILED' || i.status === 'SKIPPED');
  const smtpConfigured = !!(settings.smtp_host && String(settings.smtp_host).trim());
  const emailAllGroups = String(settings.email_all_work_groups || '').toLowerCase() === 'true';
  const sendMsgIsError =
    !!sendMsg &&
    (sendMsg.toLowerCase().includes('smtp') ||
      sendMsg.toLowerCase().includes('not configured') ||
      sendMsg.toLowerCase().includes('disabled') ||
      sendMsg.toLowerCase().includes('fail'));
  const sendPct =
    sendProgress && sendProgress.total > 0
      ? Math.min(100, Math.round((Number(sendProgress.processed || 0) / Number(sendProgress.total)) * 100))
      : sendProgress?.complete
        ? 100
        : 0;

  return (
    <div className="payroll-settings">
      {/* 1. Bulk email */}
      <section className="panel payroll-settings-section">
        <div className="panel-pad">
          <div className="payroll-settings-section__head">
            <div>
              <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
                Email salary slips
              </h3>
              <p className="muted payroll-settings-lead">
                One-click send for every eligible generated slip for the month (including Salary payout). Uses each
                employee&apos;s <strong>official email</strong> from Employee Master — not personal email. Missing
                addresses are skipped.
              </p>
            </div>
            <div className="payroll-settings-badges">
              <span className={`payroll-settings-badge${smtpConfigured ? ' is-ok' : ' is-warn'}`}>
                {smtpConfigured ? `SMTP · ${settings.smtp_host}` : 'SMTP not configured'}
              </span>
              <span className="payroll-settings-badge">
                {emailAllGroups ? 'All work groups' : 'BGT (On-Role) only'}
              </span>
            </div>
          </div>

          <div className="payroll-settings-send-bar">
            <label className="field">
              <span>Month</span>
              <select value={sendMonth} onChange={(e) => setSendMonth(e.target.value)} disabled={sendBusy}>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  return (
                    <option key={m} value={m}>
                      {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="field">
              <span>Year</span>
              <select value={sendYear} onChange={(e) => setSendYear(Number(e.target.value))} disabled={sendBusy}>
                {sendYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="field checkbox-field payroll-settings-resend">
              <input
                type="checkbox"
                checked={sendResend}
                onChange={(e) => setSendResend(e.target.checked)}
                disabled={sendBusy}
              />
              <span>Resend already-sent slips</span>
            </label>
            <div className="payroll-settings-send-actions">
              <button type="button" className="btn btn-primary" disabled={sendBusy} onClick={sendPayslipsForMonth}>
                {sendBusy ? 'Sending…' : `Send payslips · ${sendYearMonth}`}
              </button>
            </div>
          </div>

          {!smtpConfigured ? (
            <p className="form-error" style={{ marginTop: 12 }}>
              Configure SMTP host and credentials in Email delivery below before sending.
            </p>
          ) : null}

          {sendMsg ? (
            <p className={sendMsgIsError ? 'form-error' : 'muted'} style={{ marginTop: 12 }}>
              {sendMsg}
            </p>
          ) : null}

          {sendProgress && !sendProgress.complete ? (
            <div className="payroll-settings-progress" aria-live="polite">
              <div className="payroll-settings-progress__meta">
                <span>
                  Progress · {sendProgress.processed}/{sendProgress.total}
                </span>
                <span>{sendPct}%</span>
              </div>
              <div className="payroll-settings-progress__track" role="progressbar" aria-valuenow={sendPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="payroll-settings-progress__fill" style={{ width: `${sendPct}%` }} />
              </div>
              <div className="payroll-settings-progress__stats">
                <span>Sent {sendProgress.sent}</span>
                <span>Failed {sendProgress.failed}</span>
                <span>Skipped {sendProgress.skipped}</span>
                <span>Pending {sendProgress.pending}</span>
              </div>
            </div>
          ) : null}

          {sendSummaryOpen && sendProgress ? (
            <div className="payroll-settings-summary">
              <p className="payroll-settings-summary__title">
                Batch complete · Sent {sendProgress.sent} · Failed {sendProgress.failed} · Skipped{' '}
                {sendProgress.skipped}
              </p>
              {failedSkipped.length ? (
                <ul className="payroll-settings-summary__list">
                  {failedSkipped.map((item) => (
                    <li key={`${item.payslipId}-${item.status}`}>
                      <span className="mono">{item.employeeNumber}</span> {item.displayName}
                      {item.email ? ` · ${item.email}` : ''} — {item.status}
                      {item.detail ? `: ${item.detail}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No failures or skips.</p>
              )}
              <button type="button" className="btn" onClick={() => setSendSummaryOpen(false)}>
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Salary credit schedule */}
      <section className="panel payroll-settings-section">
        <form className="panel-pad" onSubmit={saveSchedule}>
          <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
            Salary credit schedule
          </h3>
          <p className="muted payroll-settings-lead">
            Recurring credit day (1–28) per work group. On that day, HR gets a bell notification if any employees are
            still Pending.
          </p>
          <div className="table-wrap">
            <table className="data-table payroll-settings-schedule">
              <thead>
                <tr>
                  <th>Work group</th>
                  <th>Credit day</th>
                  <th>Next credit date</th>
                  <th>Active</th>
                  <th>Remarks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.workGroup}>
                    <td>
                      <strong>{row.workGroup}</strong>
                      {row.creditDueToday ? (
                        <span className="payroll-settings-due">Due today</span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        className="input-sm"
                        value={row.creditDayOfMonth ?? 5}
                        onChange={(e) =>
                          updateScheduleRow(row.workGroup, {
                            creditDayOfMonth: Number(e.target.value),
                          })
                        }
                        style={{ width: 88 }}
                        aria-label={`Credit day for ${row.workGroup}`}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        className="input-sm"
                        value={row.nextCreditDate || nextCreditDateForDay(row.creditDayOfMonth)}
                        onChange={(e) =>
                          updateScheduleRow(row.workGroup, { nextCreditDate: e.target.value })
                        }
                        aria-label={`Next credit date for ${row.workGroup}`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!row.active}
                        onChange={(e) => updateScheduleRow(row.workGroup, { active: e.target.checked })}
                        aria-label={`Active for ${row.workGroup}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input-sm"
                        value={row.remarks ?? ''}
                        onChange={(e) => updateScheduleRow(row.workGroup, { remarks: e.target.value })}
                        placeholder="Optional"
                        style={{ minWidth: 140 }}
                      />
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {row.active ? `Every month on day ${row.creditDayOfMonth || 5}` : 'Disabled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" type="submit" disabled={scheduleBusy}>
              {scheduleBusy ? 'Saving…' : 'Save salary credit schedule'}
            </button>
            {scheduleMsg ? (
              <span
                className={scheduleMsg.toLowerCase().includes('saved') ? 'payroll-settings-ok' : 'muted'}
              >
                {scheduleMsg}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {/* 3–6. Settings form */}
      <form className="payroll-settings-form" onSubmit={save}>
        <section className="panel payroll-settings-section">
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              Company &amp; payslip branding
            </h3>
            <p className="muted payroll-settings-lead">
              Name, address, and logo shown on printed and emailed salary slips.
            </p>
            <div className="form-grid">
              {field('company_name', 'Company name')}
              {field('company_logo_url', 'Company logo URL', {
                hint: 'Default /branding/brightgrid-logo.png. Absolute http(s) URLs also work.',
              })}
              {field('company_address', 'Company address', {
                span2: true,
                hint: 'Shown under company name on payslips',
              })}
              {field('payslip_print_format', 'Print format reference', {
                hint: 'HTML_SNAPSHOT (PayslipHtmlRenderer)',
              })}
            </div>
          </div>
        </section>

        <section className="panel payroll-settings-section">
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              Email delivery (SMTP)
            </h3>
            <p className="muted payroll-settings-lead">
              Admin SMTP for payslip email. Password may also be set via env <code>PAYROLL_SMTP_PASSWORD</code>.
              Without a host, Send fails with a clear error (no fake success).
            </p>
            <div className="form-grid">
              {field('bgt_payslip_email_enabled', 'Enable payslip email', { boolean: true })}
              {field('auto_email_salary_slips', 'Auto-email after generate', {
                boolean: true,
                hint: 'When enabled, email after salary slip generation',
              })}
              {field('email_all_work_groups', 'Email all work groups', {
                boolean: true,
                hint: 'No = BGT (On-Role) only. Yes = every work group.',
              })}
              {field('smtp_host', 'SMTP host')}
              {field('smtp_port', 'SMTP port')}
              {field('smtp_username', 'SMTP username')}
              {field('smtp_password', 'SMTP password', {
                type: 'password',
                hint: 'Leave as ******** to keep existing password',
              })}
              {field('smtp_ssl', 'Use SSL', { boolean: true })}
              {field('smtp_starttls', 'Use STARTTLS', { boolean: true })}
              {field('smtp_from', 'Sender email')}
              {field('smtp_from_name', 'Sender display name')}
              {field('smtp_reply_to', 'Reply-To', { span2: true })}
            </div>
          </div>
        </section>

        <section className="panel payroll-settings-section">
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              Email templates
            </h3>
            <p className="muted payroll-settings-lead">
              Subject and body for bulk and automatic payslip emails. Placeholders:{' '}
              <code>{'{{employee_name}}'}</code> <code>{'{{employee_code}}'}</code> <code>{'{{month}}'}</code>{' '}
              <code>{'{{year}}'}</code> <code>{'{{company_name}}'}</code> <code>{'{{designation}}'}</code>{' '}
              <code>{'{{department}}'}</code>.
            </p>
            <div className="form-grid">
              {field('email_subject_template', 'Subject template', { span2: true })}
              {field('email_body_template', 'Body template', { textarea: true })}
            </div>
          </div>
        </section>

        <section className="panel payroll-settings-section">
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              Payroll rules
            </h3>
            <p className="muted payroll-settings-lead">
              Defaults for attendance-based pay, LOP, negative net, and leave entitlements.
            </p>
            <div className="form-grid">
              {field('attendance_based_default', 'Attendance-based default', { boolean: true })}
              {field('allow_negative_net', 'Allow negative net', { boolean: true })}
              {field('lop_prorate_earnings', 'LOP prorate earnings', { boolean: true })}
              {field('leave_entitlement_cl', 'CL entitlement')}
              {field('leave_entitlement_el', 'EL entitlement')}
              {field('leave_entitlement_sl', 'SL entitlement')}
            </div>
          </div>
        </section>

        <div className="panel payroll-settings-savebar">
          <div className="panel-pad form-actions">
            <button className="btn btn-primary" type="submit">
              Save settings
            </button>
            {msg ? (
              <span className={msg.toLowerCase().includes('saved') ? 'payroll-settings-ok' : 'muted'}>{msg}</span>
            ) : null}
          </div>
        </div>
      </form>

      {/* 7. Email log */}
      <section className="panel payroll-settings-section">
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <div className="payroll-settings-section__head">
            <div>
              <h3 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
                Payslip email log
              </h3>
              <p className="muted payroll-settings-lead">
                Recent entries from the payslip email audit log (last 100).
              </p>
            </div>
            <button type="button" className="btn" onClick={loadEmailLog} disabled={emailLogLoading}>
              {emailLogLoading ? 'Refreshing…' : 'Refresh log'}
            </button>
          </div>
        </div>
        <DataTable
          rows={emailLog}
          loading={emailLogLoading}
          error={emailLogError}
          onRetry={loadEmailLog}
          emptyTitle="No email log entries"
          columns={[
            { key: 'createdAt', header: 'When', render: (r) => formatWhen(r.createdAt || r.sentOn) },
            { key: 'employeeNumber', header: 'Code', render: (r) => r.employeeNumber || '—' },
            { key: 'displayName', header: 'Name', render: (r) => r.displayName || '—' },
            { key: 'email', header: 'Email', render: (r) => r.email || '—' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status || '—'} /> },
            { key: 'subject', header: 'Subject', render: (r) => r.subject || '—' },
            { key: 'errorMessage', header: 'Detail', render: (r) => r.errorMessage || '—' },
            { key: 'sentBy', header: 'By', render: (r) => r.sentBy || '—' },
            {
              key: 'batchId',
              header: 'Batch',
              render: (r) => (r.batchId ? String(r.batchId).slice(0, 8) : '—'),
            },
          ]}
        />
      </section>
    </div>
  );
}

export function MyPayslipsPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const { rows, error, loading, load } = useApiList('/api/hr/payroll/payslips/mine');
  const [downloadMsg, setDownloadMsg] = useState('');

  return (
    <>
      <PageHeader
        title="My payslips"
        description="Your salary slips for months processed in Salary payout. Hover an icon for View, Print, or Download. Download saves a PDF."
      />
      {downloadMsg ? <p className="error-text">{downloadMsg}</p> : null}
      {hr ? (
        <p className="muted">
          <Link to="/hr/payroll">Open payroll module</Link>
          {' · '}
          <Link to="/hr/payroll/payslips">All salary slips (HR)</Link>
        </p>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No payslips yet"
        emptyDescription="Slips appear after HR saves your monthly salary payout."
        columns={[
          { key: 'payslipNumber', header: 'Slip #', render: (r) => <span className="mono">{r.payslipNumber}</span> },
          { key: 'yearMonth', header: 'Month' },
          { key: 'workGroup', header: 'Group', render: (r) => r.workGroup || '—' },
          { key: 'gross', header: 'Gross', render: (r) => formatMoney(r.gross) },
          { key: 'net', header: 'Net', render: (r) => formatMoney(r.net) },
          {
            key: 'print',
            header: 'Actions',
            render: (r) => (
              <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <PayslipIconButton
                  className="btn-ghost"
                  icon="view"
                  label="View"
                  href={`/api/hr/payroll/payslips/${r.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                />
                <PayslipIconButton
                  className="btn-ghost"
                  icon="print"
                  label="Print"
                  href={`/api/hr/payroll/payslips/${r.id}/print`}
                  target="_blank"
                  rel="noreferrer"
                />
                <PayslipIconButton
                  className="btn-ghost"
                  icon="download"
                  label="Download"
                  onClick={() => {
                    setDownloadMsg('');
                    savePayslipPdf(r.id, r.payslipNumber).catch((err) => setDownloadMsg(extractError(err)));
                  }}
                />
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
