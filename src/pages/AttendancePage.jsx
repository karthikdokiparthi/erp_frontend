import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { isQueuedSync, waitForAttendanceSyncJob } from '../api/attendanceSync';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatHours, formatTime, workHoursBetween } from '../utils/format';
import { downloadBinaryFromUrl } from '../utils/exportExcel';

function workHours(first, last) {
  return workHoursBetween(first, last);
}

const FULL_DAY_HOURS = 8;
const ATTENDANCE_ZONE = 'Asia/Kolkata';

/** Calendar date YYYY-MM-DD in Asia/Kolkata. */
function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Parse YYYY-MM-DD as UTC calendar parts (no local timezone shift). */
function parseYmd(ymd) {
  const [y, m, d] = String(ymd || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** Add months with LocalDate-like day clamping (e.g. 31 Jan + 1m → 28/29 Feb). */
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

/**
 * Period from selected start inclusive through same day-of-month next month exclusive.
 * Returns inclusive last day for labels/API `to`.
 * Example: 2026-09-15 → from 2026-09-15, toInclusive 2026-10-14.
 */
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

function eachDateInclusive(fromYmd, toYmd) {
  const dates = [];
  let cur = fromYmd;
  if (!cur || !toYmd) return dates;
  while (cur <= toYmd) {
    dates.push(cur);
    cur = addDaysYmd(cur, 1);
    if (dates.length > 400) break;
  }
  return dates;
}

function isEarlyLeaving(firstPunchAt, lastPunchAt) {
  if (!firstPunchAt || !lastPunchAt) return false;
  const first = new Date(firstPunchAt);
  const last = new Date(lastPunchAt);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return false;
  if (first.getTime() === last.getTime()) return false;
  const minutes = Math.max(0, Math.round((last - first) / 60000));
  // Flat 8h Present threshold — match backend AttendanceService.FULL_DAY_HOURS
  return minutes / 60 < FULL_DAY_HOURS;
}

function isSundayDate(yyyyMmDd) {
  if (!yyyyMmDd || yyyyMmDd.length < 10) return false;
  const [y, m, d] = yyyyMmDd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

function punchStatus(row, kind, date, companyHoliday) {
  if (kind === 'absent') {
    if (row?.status) {
      const code = String(row.status).toUpperCase();
      if (code === 'NOT_STARTED' || code === 'WEEK_OFF' || code === 'HOLIDAY' || code === 'ABSENT') {
        return code;
      }
    }
    if (companyHoliday) return 'HOLIDAY';
    return isSundayDate(date) ? 'WEEK_OFF' : 'ABSENT';
  }
  if (row?.status) {
    const code = String(row.status).toUpperCase();
    if (code === 'MISSING_PUNCH' && date === kolkataToday()) return 'WORKING';
    return code;
  }
  const first = row.firstPunchAt ? new Date(row.firstPunchAt) : null;
  const last = row.lastPunchAt ? new Date(row.lastPunchAt) : null;
  if (!first || Number.isNaN(first.getTime())) {
    if (companyHoliday) return 'HOLIDAY';
    return isSundayDate(date) ? 'WEEK_OFF' : 'ABSENT';
  }
  const missingPunch = !last || Number.isNaN(last.getTime()) || first.getTime() === last.getTime();
  if (missingPunch) return date === kolkataToday() ? 'WORKING' : 'MISSING_PUNCH';
  if (isEarlyLeaving(row.firstPunchAt, row.lastPunchAt)) return 'EARLY_LEAVING';
  return 'PRESENT';
}

function dailyRows(data) {
  const present = (data?.presentEmployees || []).map((row) => ({ ...row, _kind: 'present' }));
  const absent = (data?.absentEmployees || []).map((row) => ({ ...row, _kind: 'absent' }));
  return [...present, ...absent];
}

function statusLetter(status) {
  switch (String(status || '').toUpperCase()) {
    case 'ABSENT':
      return 'A';
    case 'NOT_STARTED':
      return '·';
    case 'MISSING_PUNCH':
      return 'MS';
    case 'PRESENT':
    case 'LATE':
      return 'P';
    case 'HALF_DAY':
    case 'EARLY_LEAVING':
      return 'E';
    case 'WEEK_OFF':
    case 'OFF':
      return 'W';
    case 'HOLIDAY':
      return 'H';
    case 'WORKING':
      return 'P';
    case 'CL':
    case 'SL':
    case 'EL':
    case 'ML':
    case 'PL':
    case 'OD':
    case 'C/OFF':
    case 'LWP':
    case 'UNPAID':
    case 'LEAVE':
      return String(status).toUpperCase();
    default:
      return '·';
  }
}

function statusCellClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'ABSENT':
      return 'is-absent';
    case 'NOT_STARTED':
      return 'is-empty';
    case 'MISSING_PUNCH':
      return 'is-missing-punch';
    case 'PRESENT':
    case 'LATE':
      return 'is-present';
    case 'HALF_DAY':
    case 'EARLY_LEAVING':
      return 'is-early';
    case 'WEEK_OFF':
    case 'OFF':
      return 'is-week-off';
    case 'HOLIDAY':
      return 'is-holiday';
    case 'WORKING':
      return 'is-present';
    case 'CL':
    case 'SL':
    case 'EL':
    case 'ML':
    case 'PL':
    case 'OD':
    case 'C/OFF':
    case 'LWP':
    case 'UNPAID':
    case 'LEAVE':
      return 'is-leave';
    default:
      return 'is-empty';
  }
}

function DayStatusCell({ day }) {
  if (!day || !day.status) {
    return <span className="attendance-day-cell is-empty">·</span>;
  }
  const title = [
    day.date,
    day.status,
    day.in ? `In ${formatTime(day.in)}` : null,
    day.out ? `Out ${formatTime(day.out)}` : null,
    day.hours != null ? `${formatHours(day.hours)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className={`attendance-day-cell ${statusCellClass(day.status)}`} title={title}>
      {statusLetter(day.status)}
    </span>
  );
}

function personFullName(person) {
  if (!person) return '';
  const fromParts = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return (person.fullName || person.displayName || fromParts).trim();
}

function mappingOptionLabel(emp, employees) {
  const name = emp.name || 'Unnamed employee';
  const duplicates = employees.filter((other) => (other.name || '').toLowerCase() === name.toLowerCase()).length > 1;
  const deviceHint = emp.deviceUserId ? ` · device ${emp.deviceUserId}` : '';
  if (duplicates && emp.department) {
    return `${name} (${emp.department})${deviceHint}`;
  }
  return `${name}${deviceHint}`;
}

function UnmatchedPunchesModal({
  isOpen,
  onClose,
  onSuccess,
  unmatchedCount = 0,
  unmatchedDeviceUserIds = [],
  unmatchedPunches = [],
}) {
  const [tab, setTab] = useState('mapping');
  const [employees, setEmployees] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedMap, setSelectedMap] = useState({});
  const [submittingId, setSubmittingId] = useState('');
  const [rematching, setRematching] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [staffList, employeeList, summaryList] = await Promise.all([
        api('/api/hr/staff').catch(() => []),
        api('/api/hr/employees').catch(() => []),
        api('/api/hr/attendance/unmatched').catch(() => []),
      ]);
      const staff = Array.isArray(staffList) ? staffList : [];
      const employeesList = Array.isArray(employeeList) ? employeeList : [];
      const combined = [
        ...staff.map((s) => ({
          id: s.id,
          name: personFullName(s),
          department: s.department,
          deviceUserId: s.deviceUserId,
        })),
        ...employeesList.map((e) => ({
          id: e.id,
          name: personFullName(e),
          department: e.department,
          deviceUserId: e.deviceUserId,
        })),
      ]
        .filter((person) => person.id && person.name)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      setEmployees(combined);
      setSummaries(Array.isArray(summaryList) ? summaryList : []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNotice('');
      setError('');
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  async function handleAssign(deviceUserId) {
    const employeeId = selectedMap[deviceUserId];
    if (!employeeId) {
      setError(`Please select an employee for Device User ID "${deviceUserId}".`);
      return;
    }
    setSubmittingId(deviceUserId);
    setError('');
    setNotice('');
    try {
      const res = await api('/api/hr/attendance/map-device-user', {
        method: 'POST',
        body: { deviceUserId, employeeId },
      });
      const emp = employees.find((e) => e.id === employeeId);
      const empName = emp?.name || res.employeeName || 'employee';
      setNotice(`Mapped Device User ID "${deviceUserId}" to ${empName}. Linked ${res.linkedPunches || 0} punch(es)!`);
      await loadData();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmittingId('');
    }
  }

  async function handleRematchAll() {
    setRematching(true);
    setError('');
    setNotice('');
    try {
      const res = await api('/api/hr/attendance/rematch', { method: 'POST' });
      setNotice(`Rematched ${res.linked || 0} punch(es) across all employees.`);
      await loadData();
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setRematching(false);
    }
  }

  const displayDeviceIds = Array.from(
    new Set([
      ...unmatchedDeviceUserIds,
      ...summaries.map((s) => s.deviceUserId),
    ])
  ).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Map Biometric Machine User IDs</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
              Assign machine User IDs from punches to employees by full name so attendance marks them Present.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 20px' }}>
          <button
            type="button"
            className={`btn-ghost${tab === 'mapping' ? ' is-active' : ''}`}
            style={{
              padding: '10px 14px',
              borderBottom: tab === 'mapping' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              fontWeight: 500,
            }}
            onClick={() => setTab('mapping')}
          >
            Map by Machine User ID ({displayDeviceIds.length})
          </button>
          <button
            type="button"
            className={`btn-ghost${tab === 'rawPunches' ? ' is-active' : ''}`}
            style={{
              padding: '10px 14px',
              borderBottom: tab === 'rawPunches' ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              fontWeight: 500,
            }}
            onClick={() => setTab('rawPunches')}
          >
            Today's Unmatched Punches ({unmatchedCount})
          </button>
        </div>

        <div className="modal-body">
          {error ? <div className="form-error">{error}</div> : null}
          {notice ? <div className="form-notice">{notice}</div> : null}

          {tab === 'mapping' ? (
            <div>
              {loading && !displayDeviceIds.length ? (
                <p className="muted">Loading machine user IDs and employee directory…</p>
              ) : displayDeviceIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ fontWeight: 500, color: 'var(--success-fg)' }}>✓ All punches are mapped to employees!</p>
                  <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
                    No unlinked biometric punches found in the system.
                  </p>
                </div>
              ) : (
                <>
                  <p className="muted" style={{ fontSize: '13px', marginBottom: 16 }}>
                    Select an employee by <strong>full name</strong> for each biometric machine User ID and click{' '}
                    <strong>Assign &amp; Link</strong>. Any punches for that User ID will be linked immediately.
                  </p>
                  {displayDeviceIds.map((devUserId) => {
                    const sum = summaries.find((s) => s.deviceUserId === devUserId);
                    const todayPunchesForId = (unmatchedPunches || []).filter((p) => p.deviceUserId === devUserId);
                    const punchCount = sum?.punchCount || todayPunchesForId.length || 1;
                    const latestTime = sum?.lastPunchAt || todayPunchesForId[todayPunchesForId.length - 1]?.punchedAt;
                    const isSaving = submittingId === devUserId;

                    return (
                      <div key={devUserId} className="unmatched-card">
                        <div style={{ minWidth: 200, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge badge-warning mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                              User ID: {devUserId}
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                              {punchCount} punch{punchCount === 1 ? '' : 'es'}
                            </span>
                          </div>
                          <div className="muted" style={{ fontSize: '12px', marginTop: 4 }}>
                            {latestTime ? `Last punch: ${formatTime(latestTime)}` : 'Recorded today'}
                            {sum?.method ? ` · ${sum.method}` : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1.5 }}>
                          <select
                            style={{ flex: 1, minWidth: 220, padding: '7px 10px', fontSize: '13px' }}
                            value={selectedMap[devUserId] || ''}
                            onChange={(e) =>
                              setSelectedMap((prev) => ({ ...prev, [devUserId]: e.target.value }))
                            }
                          >
                            <option value="">-- Select employee by full name --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {mappingOptionLabel(emp, employees)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!selectedMap[devUserId] || isSaving}
                            onClick={() => handleAssign(devUserId)}
                          >
                            {isSaving ? 'Assigning…' : 'Assign & Link'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <div>
              {unmatchedPunches.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  No unmatched punches for today.
                </p>
              ) : (
                <DataTable
                  rows={unmatchedPunches}
                  emptyTitle="No unmatched punches"
                  emptyDescription="All punches today are linked to employees."
                  columns={[
                    {
                      key: 'time',
                      header: 'Punch time',
                      render: (row) => formatTime(row.punchedAt),
                    },
                    {
                      key: 'deviceUserId',
                      header: 'Machine User ID',
                      render: (row) => (
                        <span className="mono badge badge-warning" style={{ fontSize: '13px' }}>
                          {row.deviceUserId}
                        </span>
                      ),
                    },
                    {
                      key: 'direction',
                      header: 'Note',
                      render: () => 'Punch',
                    },
                    {
                      key: 'method',
                      header: 'Method',
                      render: (row) => <StatusBadge value={row.method} />,
                    },
                    {
                      key: 'source',
                      header: 'Source',
                      render: (row) => row.source || 'DEVICE',
                    },
                  ]}
                />
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={handleRematchAll}
            disabled={rematching}
            title="Re-check all punches against current employee mappings"
          >
            {rematching ? 'Rematching…' : 'Rematch all punches'}
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttendancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = location.pathname.includes('/monthly') ? 'monthly' : 'daily';

  const ATTENDANCE_COLUMNS = [
    { id: 'ALL', label: 'All', source: 'all' },
    { id: 'BGT', label: 'BGT', source: 'api' },
    { id: 'Ruchitha', label: 'Ruchitha', source: 'excel' },
    { id: 'Akhil', label: 'Akhil', source: 'excel' },
    { id: 'BSK', label: 'BSK', source: 'excel' },
    { id: 'Krystal', label: 'Krystal', source: 'excel' },
  ];

  const initialGroup = (() => {
    const fromUrl = searchParams.get('workGroup');
    if (fromUrl && ATTENDANCE_COLUMNS.some((c) => c.id === fromUrl)) {
      return fromUrl;
    }
    return 'ALL';
  })();

  const [workGroup, setWorkGroupState] = useState(initialGroup);
  const [data, setData] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [device, setDevice] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => kolkataToday());
  const [periodStart, setPeriodStart] = useState(() => defaultPeriodStart());
  const [expandedId, setExpandedId] = useState('');
  const [exporting, setExporting] = useState('');
  const period = useMemo(() => periodBounds(periodStart), [periodStart]);
  const isViewingToday = selectedDate === kolkataToday();
  const isAll = workGroup === 'ALL';
  const isBgt = workGroup === 'BGT';
  const canSyncBio = isAll || isBgt;
  const canUploadExcel = isAll || (!isBgt && workGroup);
  const groupLabel = isAll ? 'ALL' : workGroup;
  const fileInputRef = useRef(null);

  function setWorkGroup(next) {
    setWorkGroupState(next);
    const params = new URLSearchParams(searchParams);
    if (!next || next === 'ALL') {
      params.delete('workGroup');
    } else {
      params.set('workGroup', next);
    }
    setSearchParams(params, { replace: true });
  }

  function setViewMode(next) {
    const path = next === 'monthly' ? '/hr/attendance/monthly' : '/hr/attendance/daily';
    const qs = workGroup && workGroup !== 'ALL' ? `?workGroup=${encodeURIComponent(workGroup)}` : '';
    navigate(`${path}${qs}`);
  }

  function withGroup(url) {
    if (isAll) {
      return url;
    }
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}workGroup=${encodeURIComponent(workGroup)}`;
  }

  async function loadBoard(date, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [board, health] = await Promise.all([
        api(withGroup(`/api/hr/attendance/daily?date=${encodeURIComponent(date)}`)),
        api('/api/hr/attendance/device').catch(() => null),
      ]);
      setData(board);
      if (health) {
        setDevice(health);
      }
    } catch (err) {
      if (!silent) {
        setError(extractError(err));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function loadMonthly(from, to, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const params = new URLSearchParams({ from, to });
      const [board, health] = await Promise.all([
        api(withGroup(`/api/hr/attendance/monthly?${params.toString()}`)),
        api('/api/hr/attendance/device').catch(() => null),
      ]);
      setMonthly(board);
      if (health) {
        setDevice(health);
      }
    } catch (err) {
      if (!silent) {
        setError(extractError(err));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  /** Load board from DB only — BioAPI PullLogs/GetPunchData run solely from Sync now / Sync period. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNotice('');
      setError('');
      setExpandedId('');
      try {
        if (viewMode === 'monthly') {
          await loadMonthly(period.from, period.to);
        } else {
          await loadBoard(selectedDate);
        }
      } catch {
        if (!cancelled) {
          // Error already surfaced.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, selectedDate, period.from, period.to, workGroup]);

  async function syncNow() {
    if (!canSyncBio) {
      setError('Use Upload IAS Excel for this column — BioAPI Sync is only for BGT / All.');
      return;
    }
    setSyncing(true);
    setError('');
    setNotice('');
    try {
      const today = kolkataToday();
      const from = viewMode === 'monthly' ? period.from : selectedDate;
      const to = today < from ? from : today;
      let run = await api(
        `/api/hr/attendance/sync?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { method: 'POST' },
      );
      if (isQueuedSync(run)) {
        setNotice(
          `Sync queued for ${formatPeriodLabel(from, to)}. A PC on the office network or VPN must be running the attendance link so it can read the local biometric server.`,
        );
        run = await waitForAttendanceSyncJob(run.id || run.jobId);
      }
      if (run?.status === 'ERROR') {
        setError(run.message || 'Sync failed');
        return;
      }
      const read = run?.punchesRead ?? run?.read ?? 0;
      const saved = run?.punchesSaved ?? run?.saved ?? 0;
      setNotice(
        `Sync finished for ${formatPeriodLabel(from, to)}: read ${read} punch(es), saved ${saved} new. Board refreshed.`,
      );
      if (viewMode === 'monthly') {
        await loadMonthly(period.from, period.to, { silent: true });
      } else {
        await loadBoard(selectedDate, { silent: true });
      }
    } catch (err) {
      if (err?.pending) {
        setNotice(err.message);
      } else {
        setError(extractError(err));
      }
    } finally {
      setSyncing(false);
    }
  }

  async function uploadIasExcel(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const importGroup = isAll ? 'ALL' : workGroup;
      body.append('workGroup', importGroup);
      const result = await api(
        `/api/hr/attendance/import-excel?workGroup=${encodeURIComponent(importGroup)}`,
        { method: 'POST', body },
      );
      setNotice(
        `Uploaded ${result.filename || 'Excel'} for ${result.workGroup}: ${result.rows} row(s), ${result.punchesSaved} new punch(es), ${result.peopleMatched} people matched` +
          (result.unmatchedRows ? `, ${result.unmatchedRows} row(s) unmatched by name/pay code` : '') +
          (result.fromDate ? ` · ${result.fromDate} → ${result.toDate}` : '') +
          '. Board uses the same 8h Present / Early (E) rules as BGT.',
      );
      if (viewMode === 'monthly') {
        await loadMonthly(period.from, period.to, { silent: true });
      } else {
        await loadBoard(selectedDate, { silent: true });
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleRematch() {
    setRematching(true);
    setError('');
    setNotice('');
    try {
      const res = await api('/api/hr/attendance/rematch', { method: 'POST' });
      setNotice(`Rematched ${res.linked || 0} punch(es) to employees.`);
      if (viewMode === 'monthly') {
        await loadMonthly(period.from, period.to, { silent: true });
      } else {
        await loadBoard(selectedDate, { silent: true });
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setRematching(false);
    }
  }

  async function downloadMonthlyExcel(person) {
    const from = monthly?.from || period.from;
    const to = monthly?.to || period.to;
    if (!from || !to) {
      return;
    }
    const params = new URLSearchParams({ from, to });
    if (!isAll) {
      params.set('workGroup', workGroup);
    }
    if (person?.employeeNumber) {
      params.set('employeeNumber', person.employeeNumber);
    } else if (person?.id) {
      params.set('employeeId', person.id);
    }
    const key = person ? person.id || person.employeeNumber : 'all';
    setExporting(key);
    setError('');
    try {
      const stamp = `${from}_${to}`;
      const fallback = person
        ? `${stamp} _Attendance Summary -${groupLabel}-${person.employeeNumber || 'person'}.xls`
        : `${stamp} _Attendance Summary -${groupLabel}.xls`;
      await downloadBinaryFromUrl(`/api/hr/attendance/monthly/export?${params.toString()}`, fallback);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setExporting('');
    }
  }

  const mockSource = ((viewMode === 'monthly' ? monthly?.provider : data?.provider) || device?.provider || '')
    .toLowerCase() === 'mock';
  const sourceLine = mockSource
    ? 'Source: MOCK (demo punches 1001/1002/1003). Real TimeWatch punches are not being read.'
    : isAll
      ? viewMode === 'monthly'
        ? 'All people · BGT from BioAPI Sync; contract columns from IAS Excel upload. Combined monthly board for the selected period.'
        : 'All people · BGT from BioAPI Sync; contract columns from IAS Excel upload. Combined daily board.'
      : isBgt
        ? viewMode === 'monthly'
          ? 'Column BGT · Source: TWAPI / BioAPI. Sync period pulls from the period start through today, then builds the monthly board from stored punches.'
          : 'Column BGT · Source: TWAPI / BioAPI. Sync now pulls from the selected date through today.'
        : `Column ${workGroup} · Source: IAS Excel upload (Machine Raw Punch Report). Upload stores punches and builds the same comparison board as BGT.`;
  const providerLabel = canSyncBio
    ? ((viewMode === 'monthly' ? monthly?.provider : data?.provider) || '').toLowerCase() === 'mock'
      ? 'mock (sample punches, not biometric)'
      : isAll
        ? ((viewMode === 'monthly' ? monthly?.provider : data?.provider) || 'timewatch') + ' + ias-excel'
        : ((viewMode === 'monthly' ? monthly?.provider : data?.provider) || 'timewatch') + ' (manual sync)'
    : 'ias-excel (upload)';
  const dayLabel = data?.date || selectedDate;
  const rangeFrom = monthly?.from || period.from;
  const rangeTo = monthly?.to || period.to;
  const monthLabel = formatPeriodLabel(rangeFrom, rangeTo);
  const boardLine =
    viewMode === 'monthly'
      ? monthly
        ? monthly.expected
          + ' employees · '
          + monthly.workingDays
          + ' working days (Sunday and company holidays not counted as absent'
          + (monthly.countedThrough ? `, through ${monthly.countedThrough}` : '')
          + '). Period '
          + monthLabel
          + ' (start date inclusive → same day next month exclusive). Day codes: P=present (≥8h worked; late IN still shows P — In-time / OT use punch times), E=early (<8h with completed IN/OUT), MS=missing punch, A=absent, ·=not started (before shift), W=week off, H=holiday, CL/SL/EL/ML/PL=approved leave. Last sync: '
          + (monthly.lastSyncAt ? formatTime(monthly.lastSyncAt) : 'not yet')
          + (monthly.lastSyncStatus ? ' (' + monthly.lastSyncStatus + ')' : '')
          + '. Provider: '
          + providerLabel
          + '.'
        : loading
          ? 'Loading monthly attendance…'
          : 'No monthly snapshot yet.'
      : data
        ? data.expected
          + ' employees, '
          + data.present
          + ' attend, '
          + data.absent
          + ' not attend on '
          + dayLabel
          + '. First punch = IN; last punch of the day = OUT. Status: Present (P) when worked ≥8h (even if OUT before shift end; late arrival still marks Present; In-time board uses on-time flag); Early (E) when completed IN/OUT is under 8h. Missing punch (MS) if only one punch (today with IN only is Working). Before shift start (+ grace) with no punch is Not started (not Absent). Company holiday with no punches is Holiday (H), not Absent. Last sync: '
          + (data.lastSyncAt ? formatTime(data.lastSyncAt) : 'not yet')
          + (data.lastSyncStatus ? ' (' + data.lastSyncStatus + ')' : '')
          + '. Provider: '
          + providerLabel
          + '.'
        : loading
          ? 'Loading attendance board…'
          : 'No attendance snapshot yet.';
  const deviceDayRows = Array.isArray(data?.deviceDayAttendance) ? data.deviceDayAttendance : [];
  /** Device punch mapping UI is for BioAPI / BGT (and All) only — not contract columns. */
  const showBiometricDeviceUi = isAll || isBgt;
  const showDeviceDayTable =
    showBiometricDeviceUi &&
    viewMode === 'daily' &&
    ((data?.unmatchedCount || 0) > 0 || deviceDayRows.some((row) => row && !row.mapped));

  const monthEmployees = monthly?.employees || [];
  const monthDayHeaders = useMemo(() => {
    const holidaySet = new Set(monthly?.holidays || []);
    const dates =
      monthly?.from && monthly?.to
        ? eachDateInclusive(monthly.from, monthly.to)
        : eachDateInclusive(period.from, period.to);
    return dates.map((date) => {
      const parts = parseYmd(date);
      return {
        day: parts?.d || Number(date.slice(8, 10)),
        sunday: isSundayDate(date),
        holiday: holidaySet.has(date),
        date,
      };
    });
  }, [monthly?.from, monthly?.to, monthly?.holidays, period.from, period.to]);

  const monthTotals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let early = 0;
    let hours = 0;
    for (const row of monthEmployees) {
      present += row.presentDays || 0;
      absent += row.absentDays || 0;
      early += row.earlyLeaveDays || 0;
      hours += Number(row.totalHours) || 0;
    }
    return { present, absent, early, hours: Math.round(hours * 100) / 100 };
  }, [monthEmployees]);

  const expandedRow = monthEmployees.find((row) => row.id === expandedId) || null;

  return (
    <>
      <PageHeader
        title={viewMode === 'monthly' ? 'Monthly attendance' : 'Daily attendance'}
        eyebrow="Attendance"
        description={
          mockSource
            ? 'MOCK sample punches are active — this is not the biometric machine. After ERP restarts with provider timewatch, Sync now calls TWAPI PullLogs then GetPunchData.'
            : isAll
              ? 'Combined board: BGT (BioAPI) and all contract groups together. Sync BioAPI for on-role staff; upload IAS Excel for contract punches.'
              : isBgt
                ? viewMode === 'monthly'
                  ? 'BGT (On-Role): board loads from DB. Click Sync period to pull BioAPI from the period start through today.'
                  : 'BGT (On-Role): board loads from DB. Click Sync now to pull BioAPI from the selected date through today. First punch = IN, last = OUT.'
                : `${workGroup} (Contract): upload an IAS Machine Raw Punch Report (.xlsx). Attendance is compared with the same board rules as BGT staff.`
        }
        actions={
          <div className="attendance-toolbar">
            <div className="attendance-view-toggle" role="tablist" aria-label="Attendance view">
              <button
                type="button"
                className={viewMode === 'daily' ? 'is-active' : ''}
                onClick={() => setViewMode('daily')}
              >
                Daily
              </button>
              <button
                type="button"
                className={viewMode === 'monthly' ? 'is-active' : ''}
                onClick={() => setViewMode('monthly')}
              >
                Monthly
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
                    onChange={(e) => {
                      const next = e.target.value || defaultPeriodStart();
                      setPeriodStart(next);
                      setExpandedId('');
                    }}
                    aria-label="Attendance period start date"
                  />
                </label>
                <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }} title="Inclusive start through same day next month exclusive">
                  {monthLabel}
                </span>
              </>
            ) : (
              <>
                <label className="attendance-date-field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    max={kolkataToday()}
                    onChange={(e) => {
                      const next = e.target.value || kolkataToday();
                      setSelectedDate(next);
                    }}
                    aria-label="Attendance date"
                  />
                </label>
                {!isViewingToday ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => setSelectedDate(kolkataToday())}
                  >
                    Today
                  </button>
                ) : null}
              </>
            )}
            <button className="btn btn-secondary" type="button" onClick={() => setShowMappingModal(true)}>
              Map Biometric Users
            </button>
            {canSyncBio ? (
              <button className="btn btn-primary" type="button" onClick={syncNow} disabled={syncing}>
                {syncing ? 'Syncing…' : viewMode === 'monthly' ? 'Sync period' : 'Sync now'}
              </button>
            ) : null}
            {canUploadExcel ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={(event) => uploadIasExcel(event.target.files?.[0])}
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : 'Upload IAS Excel'}
                </button>
              </>
            ) : null}
          </div>
        }
      />
      <div className="page-tabs attendance-group-tabs" role="tablist" aria-label="Attendance column filter">
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
      {notice ? <div className="form-notice">{notice}</div> : null}
      <p className={mockSource ? 'form-error' : 'muted'} style={{ marginTop: 4, marginBottom: 8 }}>
        {sourceLine}
      </p>
      {device ? (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Device: {device.name} ({device.model}) at {device.host}:{device.port}
          {device.reachable ? ' · reachable' : ' · not reachable from this PC'}. {device.message}
        </p>
      ) : null}

      {showBiometricDeviceUi && viewMode === 'daily' && data?.unmatchedCount > 0 ? (
        <div
          className="unmatched-banner"
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--warning)' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span>
                {data.unmatchedCount} unmatched punch{data.unmatchedCount === 1 ? '' : 'es'} on {dayLabel}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Machine User ID(s) for this day:{' '}
              <strong className="mono" style={{ color: 'var(--text)' }}>
                [{data.unmatchedDeviceUserIds?.join(', ')}]
              </strong>
              . Map those device User IDs to employees by full name so they appear on the attendance board. See device punches below.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleRematch}
              disabled={rematching}
              title="Try re-matching punches if you have already set User IDs on employees"
            >
              {rematching ? 'Rematching…' : 'Rematch punches'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowMappingModal(true)}
            >
              Map Biometric Users
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === 'daily' ? (
        <div className="kpi-grid kpi-grid-5">
          <KpiCard
            label="Total"
            value={data?.expected ?? '—'}
            hint={dayLabel ? `Active people · ${dayLabel}` : 'Active people'}
          />
          <KpiCard label="Present" value={data?.present ?? '—'} hint={`At least one punch on ${dayLabel}`} />
          <KpiCard
            label="Absent"
            value={data?.absent ?? '—'}
            hint={
              data?.companyHoliday
                ? `Company holiday · no-punch is H, not absent · ${dayLabel}`
                : `No punch on ${dayLabel}`
            }
          />
          <KpiCard
            label="On leave"
            value={data?.onLeave ?? '—'}
            hint={`Approved leave (CL/SL/EL/…) on ${dayLabel}`}
          />
          <KpiCard
            label="Unmatched"
            value={showBiometricDeviceUi ? (data?.unmatchedCount ?? 0) : '—'}
            hint={
              !showBiometricDeviceUi
                ? 'Device mapping is for BGT / All only'
                : data?.unmatchedCount
                  ? `${data.unmatchedDeviceUserIds?.length || 0} user ID(s) on ${dayLabel} · click to map`
                  : `All punches linked on ${dayLabel}`
            }
            onClick={
              showBiometricDeviceUi && data?.unmatchedCount
                ? () => setShowMappingModal(true)
                : undefined
            }
          />
        </div>
      ) : (
        <div className="kpi-grid kpi-grid-5">
          <KpiCard label="People" value={monthly?.expected ?? '—'} hint={`Active · ${monthLabel}`} />
          <KpiCard
            label="Working days"
            value={monthly?.workingDays ?? '—'}
            hint="Mon–Sat; Sunday and holidays not absent"
          />
          <KpiCard label="Present days" value={monthTotals.present || '—'} hint="Sum across staff (incl. E/MS)" />
          <KpiCard
            label="Absent / Early"
            value={`${monthTotals.absent || 0} / ${monthTotals.early || 0}`}
            hint="Absent excludes Sunday and holiday offs · Early = under 8h worked"
          />
          <KpiCard label="Total hours" value={monthTotals.hours ? formatHours(monthTotals.hours) : '—'} hint="Completed in/out days (H:MM)" />
        </div>
      )}

      <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>
        {boardLine}
      </p>

      {viewMode === 'daily' ? (
        <div className="panel">
          <div className="panel-pad" style={{ paddingBottom: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Daily attendance · {dayLabel}
            </h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {isViewingToday ? 'Showing today (Asia/Kolkata)' : 'Historical day (Asia/Kolkata)'}
            </span>
          </div>
          <DataTable
            rows={dailyRows(data)}
            loading={loading}
            emptyTitle="No attendance rows"
            emptyDescription="When the TimeWatch machine sends punches for this date, in/out and hours appear here."
            columns={[
              { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
              { key: 'name', header: 'Name' },
              { key: 'department', header: 'Department' },
              { key: 'firstPunchAt', header: 'In', render: (row) => formatTime(row.firstPunchAt) },
              { key: 'lastPunchAt', header: 'Out', render: (row) => formatTime(row.lastPunchAt) },
              {
                key: 'shiftName',
                header: 'Shift',
                render: (row) => row.shiftName || '—',
              },
              {
                key: 'hours',
                header: 'Hours',
                render: (row) => workHours(row.firstPunchAt, row.lastPunchAt),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <StatusBadge value={punchStatus(row, row._kind, dayLabel, data?.companyHoliday)} />,
              },
            ]}
          />
        </div>
      ) : (
        <div className="panel">
          <div className="panel-pad" style={{ paddingBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Monthly attendance · {monthLabel}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Click a row for day-level in/out detail
              </span>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => downloadMonthlyExcel()}
                disabled={loading || !monthEmployees.length || Boolean(exporting)}
              >
                {exporting === 'all' ? 'Downloading…' : 'Download Excel'}
              </button>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}
              >
                <span>Person</span>
                <select
                  value={expandedId}
                  onChange={(event) => setExpandedId(event.target.value)}
                  aria-label="Person for Excel download"
                  disabled={!monthEmployees.length}
                  style={{ minWidth: 180 }}
                >
                  <option value="">Select…</option>
                  {monthEmployees.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.employeeNumber} · {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => expandedRow && downloadMonthlyExcel(expandedRow)}
                disabled={!expandedRow || Boolean(exporting)}
              >
                {exporting && exporting !== 'all' ? 'Downloading…' : 'Download this person'}
              </button>
            </div>
          </div>
          <div className="panel-pad" style={{ paddingTop: 12 }}>
            {loading && !monthEmployees.length ? (
              <p className="muted">Loading monthly attendance…</p>
            ) : !monthEmployees.length ? (
              <p className="muted">No active employees to show for this period.</p>
            ) : (
              <div className="attendance-month-scroll">
                <table
                  className="attendance-month-table"
                  style={{ '--att-days': monthDayHeaders.length || 31 }}
                >
                  <colgroup>
                    <col className="att-col-id" />
                    <col className="att-col-name" />
                    <col className="att-col-present" />
                    <col className="att-col-absent" />
                    <col className="att-col-early" />
                    <col className="att-col-hours" />
                    {monthDayHeaders.map((header) => (
                      <col key={header.day} className="att-col-day" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="sticky-col sticky-id">ID</th>
                      <th className="sticky-col sticky-name">Name</th>
                      <th className="sticky-col sticky-present">Present</th>
                      <th className="sticky-col sticky-absent">Absent</th>
                      <th className="sticky-col sticky-early">Early</th>
                      <th className="sticky-col sticky-hours">Hours</th>
                      {monthDayHeaders.map((header) => (
                        <th
                          key={header.date || header.day}
                          className={`day-col${header.sunday ? ' is-sunday' : ''}${header.holiday ? ' is-holiday' : ''}`}
                          title={
                            header.holiday
                              ? `${header.date} · Company holiday`
                              : header.sunday
                                ? `${header.date} · Sunday`
                                : header.date
                          }
                        >
                          {header.day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthEmployees.map((row) => {
                      const daysByDate = new Map((row.days || []).map((day) => [day.date, day]));
                      return (
                        <tr
                          key={row.id}
                          className={expandedId === row.id ? 'is-expanded' : undefined}
                          onClick={() => setExpandedId((prev) => (prev === row.id ? '' : row.id))}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="sticky-col sticky-id">
                            <span className="mono">{row.employeeNumber}</span>
                          </td>
                          <td className="sticky-col sticky-name">
                            <div className="attendance-month-name" title={row.name}>
                              {row.name}
                            </div>
                            <div className="muted attendance-month-role" title={row.department || undefined}>
                              {row.department || '—'}
                            </div>
                          </td>
                          <td className="sticky-col sticky-present">{row.presentDays}</td>
                          <td className="sticky-col sticky-absent">{row.absentDays}</td>
                          <td className="sticky-col sticky-early">{row.earlyLeaveDays ?? 0}</td>
                          <td className="sticky-col sticky-hours">{formatHours(row.totalHours)}</td>
                          {monthDayHeaders.map((header) => (
                            <td key={header.date || header.day} className="day-col">
                              <DayStatusCell day={daysByDate.get(header.date)} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {expandedRow ? (
            <div className="panel-pad" style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>
                  {expandedRow.employeeNumber} · {expandedRow.name} · day detail
                </h3>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => downloadMonthlyExcel(expandedRow)}
                  disabled={Boolean(exporting)}
                >
                  {exporting && exporting !== 'all' ? 'Downloading…' : 'Download this person'}
                </button>
              </div>
              <DataTable
                rows={(expandedRow.days || []).filter((day) => day.status)}
                emptyTitle="No attendance days yet"
                emptyDescription="Days in this period (including Absent, Week off, and Holiday) appear here once loaded. Future dates are hidden."
                columns={[
                  { key: 'date', header: 'Date', render: (day) => <span className="mono">{day.date}</span> },
                  { key: 'in', header: 'In', render: (day) => (day.in ? formatTime(day.in) : '—') },
                  { key: 'out', header: 'Out', render: (day) => (day.out ? formatTime(day.out) : '—') },
                  { key: 'hours', header: 'Hours', render: (day) => formatHours(day.hours) },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (day) => <StatusBadge value={day.status} />,
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      )}

      {showDeviceDayTable ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-pad" style={{ paddingBottom: 0 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Device punches for {dayLabel}
            </h2>
            <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>
              Raw biometric UserIDs for this date (first punch = IN, last punch = OUT). Map a UserID to an ERP employee so they appear Present above.
            </p>
          </div>
          <DataTable
            rows={deviceDayRows}
            loading={loading}
            emptyTitle="No device punches"
            emptyDescription="Sync now to pull BioAPI punches for this date."
            columns={[
              {
                key: 'deviceUserId',
                header: 'Device UserID',
                render: (row) => <span className="mono">{row.deviceUserId}</span>,
              },
              {
                key: 'firstPunchAt',
                header: 'In',
                render: (row) => formatTime(row.firstPunchAt),
              },
              {
                key: 'lastPunchAt',
                header: 'Out',
                render: (row) => formatTime(row.lastPunchAt),
              },
              {
                key: 'punchCount',
                header: 'Punches',
                render: (row) => row.punchCount,
              },
              {
                key: 'hours',
                header: 'Hours',
                render: (row) => workHours(row.firstPunchAt, row.lastPunchAt),
              },
              {
                key: 'mapped',
                header: 'Mapping',
                render: (row) =>
                  row.mapped ? (
                    <span>{row.employeeName || 'Mapped'}</span>
                  ) : (
                    <StatusBadge value="UNMATCHED" />
                  ),
              },
            ]}
          />
        </div>
      ) : null}

      <UnmatchedPunchesModal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        onSuccess={() =>
          viewMode === 'monthly'
            ? loadMonthly(period.from, period.to, { silent: true })
            : loadBoard(selectedDate, { silent: true })
        }
        unmatchedCount={data?.unmatchedCount || 0}
        unmatchedDeviceUserIds={data?.unmatchedDeviceUserIds || []}
        unmatchedPunches={data?.unmatchedPunches || []}
      />
    </>
  );
}
