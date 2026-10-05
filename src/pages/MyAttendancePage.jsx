import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatHours, formatTime } from '../utils/format';

const ATTENDANCE_ZONE = 'Asia/Kolkata';

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function kolkataMonth() {
  return kolkataToday().slice(0, 7);
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
      return 'P';
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
      return 'is-present';
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

export function MyAttendancePage() {
  const [viewMode, setViewMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => kolkataToday());
  const [selectedMonth, setSelectedMonth] = useState(() => kolkataMonth());
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notLinked, setNotLinked] = useState(false);

  const loadDaily = useCallback(async (date) => {
    setLoading(true);
    setError('');
    setNotLinked(false);
    try {
      const data = await api(`/api/hr/attendance/me/daily?date=${encodeURIComponent(date)}`);
      setDaily(data);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        setNotLinked(true);
        setDaily(null);
        setError(extractError(err));
      } else {
        setError(extractError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonthly = useCallback(async (yearMonth) => {
    setLoading(true);
    setError('');
    setNotLinked(false);
    try {
      const data = await api(`/api/hr/attendance/me/monthly?yearMonth=${encodeURIComponent(yearMonth)}`);
      setMonthly(data);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        setNotLinked(true);
        setMonthly(null);
        setError(extractError(err));
      } else {
        setError(extractError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'daily') {
      loadDaily(selectedDate);
    } else {
      loadMonthly(selectedMonth);
    }
  }, [viewMode, selectedDate, selectedMonth, loadDaily, loadMonthly]);

  const person = viewMode === 'daily' ? daily : monthly?.employee;
  const monthDays = monthly?.employee?.days || [];
  const monthDayHeaders = useMemo(
    () => monthDays.map((day) => (day?.date ? day.date.slice(8, 10) : '')),
    [monthDays]
  );

  return (
    <>
      <PageHeader
        title="My attendance"
        description="Your punches and day status only. Linked when your CCIDP login email matches staff.email or employees.email (including contract biometric roster)."
      />

      <div className="page-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`page-tab${viewMode === 'daily' ? ' is-active' : ''}`}
          onClick={() => setViewMode('daily')}
        >
          Daily
        </button>
        <button
          type="button"
          className={`page-tab${viewMode === 'monthly' ? ' is-active' : ''}`}
          onClick={() => setViewMode('monthly')}
        >
          Monthly
        </button>
      </div>

      <div className="list-toolbar list-toolbar-split" style={{ marginBottom: 16 }}>
        {viewMode === 'daily' ? (
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        ) : (
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Asia/Kolkata · Status: P present · MS missing punch · E early · A absent · W week off · H holiday
        </p>
      </div>

      {error ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>
            {notLinked ? (
              <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                Open <Link to="/me">My profile</Link> to confirm your login email, then ask HR to match it on your employee record.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!notLinked && person ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad" style={{ paddingBottom: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline' }}>
              <strong>{person.name}</strong>
              <span className="mono muted">{person.employeeNumber}</span>
              {person.department ? <span className="muted">{person.department}</span> : null}
              {(daily?.kind || monthly?.kind) ? (
                <span className="badge">{daily?.kind || monthly?.kind}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === 'daily' && !notLinked ? (
        <>
          <div className="kpi-grid kpi-grid-4">
            <KpiCard
              label="Status"
              value={daily ? statusLetter(daily.status) : '—'}
              hint={daily?.status || (loading ? 'Loading…' : '—')}
            />
            <KpiCard label="In" value={daily?.in ? formatTime(daily.in) : '—'} />
            <KpiCard label="Out" value={daily?.out ? formatTime(daily.out) : '—'} />
            <KpiCard label="Hours" value={daily ? formatHours(daily.hours) : '—'} />
          </div>
          <div className="panel">
            <div className="panel-pad">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Day detail · {selectedDate}
              </h2>
              {loading && !daily ? (
                <p className="muted">Loading your attendance…</p>
              ) : daily ? (
                <DataTable
                  rows={[daily]}
                  loading={loading}
                  emptyTitle="No attendance for this day"
                  emptyDescription="When you punch in, in/out and hours appear here."
                  columns={[
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row) => (
                        <span className={`attendance-day-cell ${statusCellClass(row.status)}`}>
                          {statusLetter(row.status)}
                        </span>
                      ),
                    },
                    { key: 'in', header: 'In', render: (row) => (row.in ? formatTime(row.in) : '—') },
                    { key: 'out', header: 'Out', render: (row) => (row.out ? formatTime(row.out) : '—') },
                    { key: 'hours', header: 'Hours', render: (row) => formatHours(row.hours) },
                    {
                      key: 'fullStatus',
                      header: 'Code',
                      render: (row) => <StatusBadge value={row.status} />,
                    },
                  ]}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {viewMode === 'monthly' && !notLinked ? (
        <>
          <div className="kpi-grid kpi-grid-5">
            <KpiCard label="Working days" value={monthly?.employee?.workingDays ?? monthly?.workingDays ?? '—'} />
            <KpiCard label="Present" value={monthly?.employee?.presentDays ?? '—'} />
            <KpiCard label="Absent" value={monthly?.employee?.absentDays ?? '—'} />
            <KpiCard label="Early leave" value={monthly?.employee?.earlyLeaveDays ?? '—'} />
            <KpiCard label="Hours" value={monthly?.employee ? formatHours(monthly.employee.totalHours) : '—'} />
          </div>
          <div className="panel">
            <div className="panel-pad" style={{ paddingBottom: 0 }}>
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Monthly · {selectedMonth}
              </h2>
            </div>
            <div className="panel-pad" style={{ paddingTop: 12 }}>
              {loading && !monthly ? (
                <p className="muted">Loading your monthly attendance…</p>
              ) : !monthDays.length ? (
                <p className="muted">No days to show for this month.</p>
              ) : (
                <div className="attendance-month-scroll">
                  <table
                    className="attendance-month-table"
                    style={{ '--att-days': monthDayHeaders.length || 31 }}
                  >
                    <thead>
                      <tr>
                        <th className="sticky-col sticky-id">ID</th>
                        <th className="sticky-col sticky-name">Name</th>
                        <th className="sticky-col sticky-present">P</th>
                        <th className="sticky-col sticky-absent">A</th>
                        <th className="sticky-col sticky-early">E</th>
                        <th className="sticky-col sticky-hours">Hrs</th>
                        {monthDayHeaders.map((label, index) => (
                          <th key={`d-${label}-${index}`} className="day-col">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="sticky-col sticky-id mono">{monthly.employee.employeeNumber}</td>
                        <td className="sticky-col sticky-name">
                          <div className="attendance-month-name">{monthly.employee.name}</div>
                          {monthly.employee.department ? (
                            <div className="attendance-month-role">{monthly.employee.department}</div>
                          ) : null}
                        </td>
                        <td className="sticky-col sticky-present">{monthly.employee.presentDays}</td>
                        <td className="sticky-col sticky-absent">{monthly.employee.absentDays}</td>
                        <td className="sticky-col sticky-early">{monthly.employee.earlyLeaveDays}</td>
                        <td className="sticky-col sticky-hours">{formatHours(monthly.employee.totalHours)}</td>
                        {monthDays.map((day) => (
                          <td key={day.date} className="day-col">
                            <DayStatusCell day={day} />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {monthDays.length ? (
              <div className="panel-pad" style={{ paddingTop: 0 }}>
                <h3 className="section-title">Day list</h3>
                <DataTable
                  rows={monthDays.filter((day) => day.status)}
                  loading={loading}
                  emptyTitle="No day statuses yet"
                  emptyDescription="Past days with punches or absences appear here."
                  columns={[
                    { key: 'date', header: 'Date', render: (day) => <span className="mono">{day.date}</span> },
                    {
                      key: 'letter',
                      header: '',
                      render: (day) => <DayStatusCell day={day} />,
                    },
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
        </>
      ) : null}
    </>
  );
}
