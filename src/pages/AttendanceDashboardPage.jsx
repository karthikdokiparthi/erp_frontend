import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { KpiCard } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatTime } from '../utils/format';

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
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function withWorkGroup(url, workGroup) {
  if (!workGroup || workGroup === 'ALL') {
    return `${url}${url.includes('?') ? '&' : '?'}workGroup=ALL`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}workGroup=${encodeURIComponent(workGroup)}`;
}

export function AttendanceDashboardPage() {
  const [workGroup, setWorkGroup] = useState('ALL');
  const [data, setData] = useState(null);
  const [device, setDevice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [board, health] = await Promise.all([
          api(withWorkGroup('/api/hr/attendance/dashboard', workGroup)),
          api('/api/hr/attendance/device').catch(() => null),
        ]);
        if (!cancelled) {
          setData(board);
          setDevice(health);
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workGroup]);

  const day = data?.date || kolkataToday();
  const groupLabel = workGroup === 'ALL' ? 'All companies' : workGroup;
  const isContract = !['ALL', 'BGT'].includes(workGroup);
  const dailyLink =
    workGroup === 'ALL'
      ? '/hr/attendance/daily'
      : `/hr/attendance/daily?workGroup=${encodeURIComponent(workGroup)}`;
  const monthlyLink =
    workGroup === 'ALL'
      ? '/hr/attendance/monthly'
      : `/hr/attendance/monthly?workGroup=${encodeURIComponent(workGroup)}`;

  return (
    <>
      <PageHeader
        title="Attendance dashboard"
        eyebrow="Attendance"
        description={
          isContract
            ? `Today’s snapshot for ${groupLabel} from IAS Excel punches (Asia/Kolkata), evaluated against each person’s shift. Upload Excel on Daily/Monthly — BioAPI Sync is BGT only.`
            : `Today’s snapshot for ${groupLabel} from stored punches (Asia/Kolkata), evaluated against each person’s shift. Sync BioAPI on Daily/Monthly for BGT; upload IAS Excel for contract columns.`
        }
      />

      <div className="page-tabs attendance-group-tabs" role="tablist" aria-label="Attendance company filter">
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
      {device && !isContract ? (
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Device: {device.name} ({device.model}) · last sync {data?.lastSyncAt ? formatTime(data.lastSyncAt) : 'not yet'}
          {data?.lastSyncStatus ? ` (${data.lastSyncStatus})` : ''}.
        </p>
      ) : null}
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="People" value={loading ? '—' : data?.expected ?? '—'} hint={`${groupLabel} · ${day}`} />
        <KpiCard label="Present" value={loading ? '—' : data?.present ?? '—'} hint="At least one punch or approved overlay" />
        <KpiCard
          label="Absent"
          value={loading ? '—' : data?.absent ?? '—'}
          hint={data?.companyHoliday ? 'Company holiday · no-punch is H' : 'No punch on a working day'}
        />
        <KpiCard
          label="On leave"
          value={loading ? '—' : data?.onLeave ?? 0}
          hint="Approved leave (CL/SL/EL/…)"
        />
        <KpiCard
          label="Pending regularizations"
          value={loading ? '—' : data?.pendingRegularizations ?? 0}
          hint="Awaiting approve / reject"
        />
      </div>
      <div className="kpi-grid kpi-grid-3" style={{ marginTop: 12 }}>
        <KpiCard label="In time" value={loading ? '—' : data?.inTimeCount ?? 0} hint="IN at or before assigned shift start + grace" />
        <KpiCard label="Early leaving" value={loading ? '—' : data?.earlyLeavingCount ?? 0} hint="Under 8 worked hours (E)" />
        <KpiCard label="Overtime" value={loading ? '—' : data?.overtimeCount ?? 0} hint="Worked more than scheduled shift hours" />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Shortcuts
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link className="btn btn-primary" to={dailyLink}>
              Daily attendance
            </Link>
            <Link className="btn btn-secondary" to={monthlyLink}>
              Monthly attendance
            </Link>
            <Link className="btn" to="/hr/attendance/late">
              In time
            </Link>
            <Link className="btn" to="/hr/attendance/early">
              Early leaving
            </Link>
            <Link className="btn" to="/hr/attendance/overtime">
              Overtime
            </Link>
            <Link className="btn" to="/hr/attendance/regularization">
              Regularization
            </Link>
            <Link className="btn" to="/hr/attendance/shifts">
              Shift management
            </Link>
            <Link className="btn" to="/hr/attendance/devices">
              Biometric devices
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
