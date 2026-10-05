import { useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatHours, formatTime } from '../utils/format';

const FULL_DAY_HOURS = 8;
const ATTENDANCE_ZONE = 'Asia/Kolkata';

const ATTENDANCE_COLUMNS = [
  { id: 'ALL', label: 'All' },
  { id: 'BGT', label: 'BGT' },
  { id: 'Ruchitha', label: 'Ruchitha' },
  { id: 'Akhil', label: 'Akhil' },
  { id: 'BSK', label: 'BSK' },
  { id: 'Krystal', label: 'Krystal' },
];

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseYmd(ymd) {
  const [y, m, d] = String(ymd || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function addMonthsYmd(ymd, months) {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  const target = new Date(Date.UTC(parts.y, parts.m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(parts.d, lastDay);
  const result = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
  return result.toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  const result = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return result.toISOString().slice(0, 10);
}

function periodBounds(startYmd) {
  const from = startYmd || kolkataToday();
  const toExclusive = addMonthsYmd(from, 1);
  const toInclusive = addDaysYmd(toExclusive, -1);
  return { from, to: toInclusive, toExclusive };
}

function formatPeriodLabel(fromYmd, toYmd) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const fromParts = parseYmd(fromYmd);
  const toParts = parseYmd(toYmd);
  if (!fromParts || !toParts) return fromYmd || '';
  const fromLabel = fmt.format(new Date(Date.UTC(fromParts.y, fromParts.m - 1, fromParts.d)));
  const toLabel = fmt.format(new Date(Date.UTC(toParts.y, toParts.m - 1, toParts.d)));
  return `${fromLabel} – ${toLabel}`;
}

/** Default period start: current BGT-style payroll window (26th → 25th). */
function defaultPeriodStart() {
  const today = kolkataToday();
  const parts = parseYmd(today);
  if (!parts) return today;
  if (parts.d >= 26) {
    return `${parts.y}-${String(parts.m).padStart(2, '0')}-26`;
  }
  const prev = addMonthsYmd(`${parts.y}-${String(parts.m).padStart(2, '0')}-01`, -1);
  const prevParts = parseYmd(prev);
  return `${prevParts.y}-${String(prevParts.m).padStart(2, '0')}-26`;
}

function roundHours(value) {
  return Math.round(Number(value) * 100) / 100;
}

function overtimeFromHours(hours) {
  if (hours == null || hours <= FULL_DAY_HOURS) return null;
  return roundHours(hours - FULL_DAY_HOURS);
}

/** Aggregate monthly board into people with OT days (hours above 8). */
function monthlyOvertimeRows(board) {
  const employees = board?.employees || [];
  const rows = [];
  for (const emp of employees) {
    let overtimeHours = 0;
    let overtimeDays = 0;
    let totalHours = 0;
    for (const day of emp.days || []) {
      if (day?.hours == null) continue;
      totalHours += day.hours;
      const extra = overtimeFromHours(day.hours);
      if (extra != null) {
        overtimeHours += extra;
        overtimeDays += 1;
      }
    }
    if (overtimeDays > 0) {
      rows.push({
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        name: emp.name,
        department: emp.department,
        presentDays: emp.presentDays,
        overtimeDays,
        overtimeHours: roundHours(overtimeHours),
        totalHours: roundHours(totalHours),
      });
    }
  }
  rows.sort((a, b) => (b.overtimeHours || 0) - (a.overtimeHours || 0));
  return rows;
}

const KIND = {
  intime: {
    title: 'In time',
    description: 'People whose first punch is at or before their assigned shift start (+ grace) and whose day is Present or still Working.',
    key: 'inTime',
    hint: 'On-time IN + Present / Working',
  },
  early: {
    title: 'Early leaving',
    description: 'People with a completed IN/OUT pair under 8 worked hours (Early / E). Working ≥8h is Present even if OUT before shift end — those people are not listed here. A single punch is Missing punch or Working, not early leave.',
    key: 'earlyLeaving',
    hint: 'Hours under 8 (Early / E)',
  },
  overtime: {
    title: 'Overtime',
    description: 'People who worked more than their scheduled shift hours on the selected date. Extra hours = worked hours minus shift length.',
    key: 'overtime',
    hint: 'Hours above scheduled shift',
  },
};

export function InTimePage() {
  return <AttendanceExceptionsPage kind="intime" />;
}

export function EarlyLeavingPage() {
  return <AttendanceExceptionsPage kind="early" />;
}

export function OvertimePage() {
  return <OvertimeBoardPage />;
}

function withWorkGroup(url, workGroup) {
  if (!workGroup || workGroup === 'ALL') {
    return `${url}${url.includes('?') ? '&' : '?'}workGroup=ALL`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}workGroup=${encodeURIComponent(workGroup)}`;
}

function OvertimeBoardPage() {
  const [viewMode, setViewMode] = useState('daily');
  const [workGroup, setWorkGroup] = useState('ALL');
  const [date, setDate] = useState(() => kolkataToday());
  const [periodStart, setPeriodStart] = useState(() => defaultPeriodStart());
  const [dailyData, setDailyData] = useState(null);
  const [monthlyBoard, setMonthlyBoard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => periodBounds(periodStart), [periodStart]);
  const periodLabel = formatPeriodLabel(period.from, period.to);
  const groupLabel = workGroup === 'ALL' ? 'All companies' : workGroup;

  async function loadDaily(selected, group) {
    setLoading(true);
    setError('');
    try {
      const url = withWorkGroup(
        `/api/hr/attendance/exceptions?date=${encodeURIComponent(selected)}`,
        group,
      );
      setDailyData(await api(url));
      setMonthlyBoard(null);
    } catch (err) {
      setDailyData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthly(from, to, group) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to });
      const board = await api(withWorkGroup(`/api/hr/attendance/monthly?${params.toString()}`, group));
      setMonthlyBoard(board);
      setDailyData(null);
    } catch (err) {
      setMonthlyBoard(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode === 'monthly') {
      loadMonthly(period.from, period.to, workGroup);
    } else {
      loadDaily(date, workGroup);
    }
  }, [viewMode, date, period.from, period.to, workGroup]);

  const dailyRows = dailyData?.overtime || [];
  const monthlyRows = useMemo(() => monthlyOvertimeRows(monthlyBoard), [monthlyBoard]);
  const totalOtHours = useMemo(
    () => roundHours(monthlyRows.reduce((sum, row) => sum + (row.overtimeHours || 0), 0)),
    [monthlyRows],
  );

  const shiftLabel = dailyData?.shift
    ? `${dailyData.shift.name} ${dailyData.shift.startTime?.slice(0, 5) || ''}–${dailyData.shift.endTime?.slice(0, 5) || ''}`
    : 'Office 09:15–18:00';

  const dailyColumns = useMemo(
    () => [
      { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'in', header: 'In', render: (row) => formatTime(row.in) },
      { key: 'out', header: 'Out', render: (row) => formatTime(row.out) },
      { key: 'hours', header: 'Hours', render: (row) => formatHours(row.hours) },
      { key: 'overtimeHours', header: 'OT hours', render: (row) => formatHours(row.overtimeHours) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'shiftName', header: 'Shift' },
    ],
    [],
  );

  const monthlyColumns = useMemo(
    () => [
      { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'presentDays', header: 'Present days' },
      { key: 'overtimeDays', header: 'OT days' },
      { key: 'overtimeHours', header: 'OT hours', render: (row) => formatHours(row.overtimeHours) },
      { key: 'totalHours', header: 'Total hours', render: (row) => formatHours(row.totalHours) },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Overtime"
        description={
          viewMode === 'monthly'
            ? `People with more than their scheduled shift hours on any day in the period. OT hours = sum of (worked − scheduled shift) across days. Showing ${groupLabel}.`
            : `People who worked more than their scheduled shift hours on the selected date. Extra hours = worked hours minus shift length. Showing ${groupLabel}.`
        }
        actions={
          <div className="attendance-toolbar">
            <div className="attendance-view-toggle" role="tablist" aria-label="Overtime view">
              <button
                type="button"
                className={viewMode === 'daily' ? 'is-active' : ''}
                onClick={() => setViewMode('daily')}
              >
                Daily overtime
              </button>
              <button
                type="button"
                className={viewMode === 'monthly' ? 'is-active' : ''}
                onClick={() => setViewMode('monthly')}
              >
                Monthly overtime
              </button>
            </div>
            {viewMode === 'monthly' ? (
              <>
                <label className="attendance-date-field">
                  <span>Period start</span>
                  <input
                    type="date"
                    value={periodStart}
                    max={kolkataToday()}
                    onChange={(event) => setPeriodStart(event.target.value || defaultPeriodStart())}
                    aria-label="Overtime period start date"
                  />
                </label>
                <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
                  {periodLabel}
                </span>
              </>
            ) : (
              <label className="attendance-date-field">
                <span>Date</span>
                <input
                  type="date"
                  value={date}
                  max={kolkataToday()}
                  onChange={(event) => setDate(event.target.value || kolkataToday())}
                  aria-label="Overtime date"
                />
              </label>
            )}
          </div>
        }
      />

      <div className="page-tabs attendance-group-tabs" role="tablist" aria-label="Overtime company filter">
        {ATTENDANCE_COLUMNS.map((column) => (
          <button
            key={column.id}
            type="button"
            role="tab"
            className={`page-tab${workGroup === column.id ? ' is-active' : ''}`}
            onClick={() => setWorkGroup(column.id)}
          >
            {column.label}
          </button>
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {viewMode === 'daily' ? (
        <>
          <div className="kpi-grid kpi-grid-3">
            <KpiCard
              label="Overtime"
              value={loading ? '—' : dailyRows.length}
              hint={`Above scheduled shift · ${dailyData?.date || date}`}
            />
            <KpiCard label="Default shift" value={shiftLabel} hint="Assigned shift used when set per person" />
            <KpiCard
              label="Grace"
              value={dailyData?.shift?.graceMinutes ?? 0}
              hint="Minutes after start still counted as in time"
            />
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <DataTable
              rows={dailyRows}
              loading={loading}
              emptyTitle="No overtime rows"
              emptyDescription="This list uses the same punches and regularization overlay as the daily board — not sample people."
              columns={dailyColumns}
            />
          </div>
        </>
      ) : (
        <>
          <div className="kpi-grid kpi-grid-3">
            <KpiCard
              label="People with OT"
              value={loading ? '—' : monthlyRows.length}
              hint={`${groupLabel} · ${periodLabel}`}
            />
            <KpiCard
              label="Total OT hours"
              value={loading ? '—' : formatHours(totalOtHours)}
              hint="Sum of daily OT (hours − 8)"
            />
            <KpiCard
              label="Working days"
              value={loading ? '—' : monthlyBoard?.workingDays ?? '—'}
              hint={`Period ${monthlyBoard?.from || period.from} → ${monthlyBoard?.to || period.to}`}
            />
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <DataTable
              rows={monthlyRows}
              loading={loading}
              emptyTitle="No monthly overtime rows"
              emptyDescription="No one in this company filter worked more than 8 hours on any day in the selected period. Sync Daily/Monthly attendance if punches look missing."
              columns={monthlyColumns}
            />
          </div>
        </>
      )}
    </>
  );
}

function AttendanceExceptionsPage({ kind }) {
  const meta = KIND[kind];
  const [date, setDate] = useState(() => kolkataToday());
  const [workGroup, setWorkGroup] = useState('ALL');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const groupLabel = workGroup === 'ALL' ? 'All companies' : workGroup;

  async function load(selected, group) {
    setLoading(true);
    setError('');
    try {
      setData(await api(withWorkGroup(`/api/hr/attendance/exceptions?date=${encodeURIComponent(selected)}`, group)));
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date, workGroup);
  }, [date, workGroup]);

  const rows = data?.[meta.key] || [];
  const shiftLabel = data?.shift
    ? `${data.shift.name} ${data.shift.startTime?.slice(0, 5) || ''}–${data.shift.endTime?.slice(0, 5) || ''}`
    : 'Office 09:15–18:00';

  const columns = useMemo(() => {
    const base = [
      { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'in', header: 'In', render: (row) => formatTime(row.in) },
      { key: 'out', header: 'Out', render: (row) => formatTime(row.out) },
      { key: 'hours', header: 'Hours', render: (row) => formatHours(row.hours) },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'shiftName', header: 'Shift' },
    ];
    if (kind === 'overtime') {
      base.splice(6, 0, {
        key: 'overtimeHours',
        header: 'OT hours',
        render: (row) => formatHours(row.overtimeHours),
      });
    }
    return base;
  }, [kind]);

  return (
    <>
      <PageHeader
        title={meta.title}
        description={`${meta.description} Showing ${groupLabel}.`}
        actions={
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Date</span>
            <input
              type="date"
              value={date}
              max={kolkataToday()}
              onChange={(event) => setDate(event.target.value || kolkataToday())}
              aria-label={`${meta.title} date`}
            />
          </label>
        }
      />
      <div className="page-tabs attendance-group-tabs" role="tablist" aria-label={`${meta.title} company filter`}>
        {ATTENDANCE_COLUMNS.map((column) => (
          <button
            key={column.id}
            type="button"
            role="tab"
            className={`page-tab${workGroup === column.id ? ' is-active' : ''}`}
            onClick={() => setWorkGroup(column.id)}
          >
            {column.label}
          </button>
        ))}
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="kpi-grid kpi-grid-3">
        <KpiCard label={meta.title} value={loading ? '—' : rows.length} hint={`${meta.hint} · ${data?.date || date}`} />
        <KpiCard label="Default shift" value={shiftLabel} hint="Assigned shift used when set per person" />
        <KpiCard
          label="Grace"
          value={data?.shift?.graceMinutes ?? 0}
          hint="Minutes after start still counted as in time"
        />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <DataTable
          rows={rows}
          loading={loading}
          emptyTitle={`No ${meta.title.toLowerCase()} rows`}
          emptyDescription="This list uses the same punches and regularization overlay as the daily board — not sample people."
          columns={columns}
        />
      </div>
    </>
  );
}
