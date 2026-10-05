import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatDate, hasHrAccess, leaveStatusLabel, leaveTypeLabel } from '../utils/format';

const emptyForm = {
  personId: '',
  recipientId: '',
  recipient2Id: '',
  leaveType: 'CASUAL',
  startOn: '',
  endOn: '',
  reason: '',
};

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function countDays(startOn, endOn) {
  if (!startOn || !endOn) return 0;
  const start = new Date(`${startOn}T00:00:00`);
  const end = new Date(`${endOn}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  return Math.round((end - start) / 86400000) + 1;
}

function currentYear() {
  return new Date().getFullYear();
}

function yearFromSearch(searchParams) {
  const raw = Number(searchParams.get('year'));
  return Number.isFinite(raw) && raw >= 2000 && raw <= 2100 ? raw : currentYear();
}

function daysLabel(count) {
  return `${count} day${count === 1 ? '' : 's'}`;
}

export function LeavePage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const location = useLocation();
  const dashboardTab = location.pathname === '/leave' || location.pathname.startsWith('/leave/people/');

  return (
    <>
      <PageHeader
        title="Leave info"
        eyebrow="Leave"
        description="Apply leave, approve requests assigned to you, and see yearly days taken."
      />
      <div className="page-tabs" role="tablist" aria-label="Leave info">
        <NavLink to="/leave" end role="tab" className={() => `page-tab${dashboardTab ? ' is-active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink
          to="/leave/apply"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Apply leave
        </NavLink>
        <NavLink
          to="/leave/inbox"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Leave approval
        </NavLink>
        <NavLink
          to="/leave/my-requests"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          My requests
        </NavLink>
        {hr ? (
          <NavLink
            to="/leave/requests"
            role="tab"
            className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
          >
            All requests
          </NavLink>
        ) : null}
        <NavLink
          to="/leave/holidays"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Holiday calendar
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

export function LeaveDashboardPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = yearFromSearch(searchParams);
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(selectedYear) {
    setLoading(true);
    setError('');
    try {
      setData(await api(`/api/leave/dashboard?year=${encodeURIComponent(selectedYear)}`));
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year);
  }, [year]);

  const years = data?.years?.length ? data.years : [year];
  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = data?.rows || [];
    if (!needle) return list;
    return list.filter((row) => {
      const hay = `${row.displayName || ''} ${row.username || ''} ${row.email || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [data, needle]);

  function setYear(nextYear) {
    setSearchParams({ year: String(nextYear) });
  }

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="People"
          value={loading ? '—' : data?.people ?? 0}
          hint={hr ? 'Active CCIDP users this year' : 'You, plus people who sent leave to you'}
        />
        <KpiCard
          label="Took leave"
          value={loading ? '—' : data?.peopleWhoTookLeave ?? 0}
          hint="People with approved days in this year"
        />
        <KpiCard
          label="Days taken"
          value={loading ? '—' : data?.takenDays ?? 0}
          hint="Approved leave days overlapping this year"
        />
        <KpiCard label="Pending days" value={loading ? '—' : data?.pendingDays ?? 0} hint="Waiting for a decision" />
      </div>
      <div className="panel">
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <div className="list-toolbar list-toolbar-split">
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>
              {hr ? `${year} leave by person` : `${year} leave`}
            </h2>
            <div className="toolbar-actions">
              <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
                <span>Year</span>
                <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ marginBottom: 0, minWidth: 220 }}>
                <span>Search</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, username, email"
                />
              </label>
            </div>
          </div>
          <p className="muted">
            {hr
              ? 'Approved days in this calendar year. Click a person to see every request.'
              : 'Your year, plus people who assigned a leave request to you. Click a row for that person’s requests.'}
          </p>
        </div>
        <DataTable
          rows={rows}
          rowKey="personId"
          loading={loading}
          error={error}
          onRetry={() => load(year)}
          emptyTitle={hr ? 'No people to show' : 'No leave year yet'}
          emptyDescription={
            hr
              ? 'Active CCIDP users appear here even if they took no leave.'
              : 'Apply leave, or wait until someone sends a request to you for approval.'
          }
          onRowClick={(row) => navigate(`/leave/people/${row.personId}?year=${year}`)}
          columns={[
            {
              key: 'displayName',
              header: 'Person',
              render: (row) => (
                <div className="cell-stack">
                  <div className="primary">{row.displayName}</div>
                  <div className="secondary">{row.email || row.username}</div>
                </div>
              ),
            },
            { key: 'username', header: 'Username', render: (row) => <span className="mono">{row.username}</span> },
            {
              key: 'relation',
              header: 'Visible as',
              render: (row) =>
                row.mine ? 'You' : row.assignedToYou ? 'Assigned to you' : hr ? 'Employee' : '—',
            },
            {
              key: 'takenDays',
              header: 'Taken',
              render: (row) => daysLabel(row.takenDays),
            },
            {
              key: 'pendingDays',
              header: 'Pending',
              render: (row) => daysLabel(row.pendingDays),
            },
            { key: 'casualDays', header: 'Casual' },
            { key: 'sickDays', header: 'Sick' },
            { key: 'earnedDays', header: 'Earned' },
            { key: 'unpaidDays', header: 'Unpaid' },
            {
              key: 'requestCount',
              header: 'Requests',
              render: (row) => row.requestCount,
            },
          ]}
        />
      </div>
    </>
  );
}

export function LeavePersonYearPage() {
  const { personId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = yearFromSearch(searchParams);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(selectedYear) {
    setLoading(true);
    setError('');
    try {
      setData(
        await api(`/api/leave/dashboard/${encodeURIComponent(personId)}?year=${encodeURIComponent(selectedYear)}`)
      );
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year);
  }, [personId, year]);

  const years = data?.years?.length ? data.years : [year];
  const person = data?.person;
  const requests = data?.requests || [];

  return (
    <>
      <div className="list-toolbar list-toolbar-split" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
            {person?.displayName || 'Leave year'}
          </h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            {person ? `${person.username}${person.email ? ` · ${person.email}` : ''}` : 'Loading person…'}
          </p>
        </div>
        <div className="toolbar-actions">
          <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
            <span>Year</span>
            <select value={year} onChange={(event) => setSearchParams({ year: event.target.value })}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <NavLink className="btn btn-ghost" to={`/leave?year=${year}`}>
            Back to dashboard
          </NavLink>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="kpi-grid">
        <KpiCard label="Days taken" value={loading ? '—' : person?.takenDays ?? 0} hint="Approved days in this year" />
        <KpiCard label="Pending" value={loading ? '—' : person?.pendingDays ?? 0} hint="Not decided yet" />
        <KpiCard label="Casual" value={loading ? '—' : person?.casualDays ?? 0} hint="Approved" />
        <KpiCard label="Sick" value={loading ? '—' : person?.sickDays ?? 0} hint="Approved" />
        <KpiCard label="Earned" value={loading ? '—' : person?.earnedDays ?? 0} hint="Approved" />
        <KpiCard label="Unpaid" value={loading ? '—' : person?.unpaidDays ?? 0} hint="Approved" />
      </div>
      <div className="panel">
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Requests in {year}
          </h2>
          <p className="muted">
            {person?.assignedToYou
              ? `Requests this person sent to you in ${year}. Approve them from Leave approval.`
              : `Dates that overlap this year. Day count is the overlap, not the full span if it crosses years.`}
          </p>
        </div>
        <DataTable
          rows={requests}
          loading={loading}
          error={error}
          onRetry={() => load(year)}
          emptyTitle="No leave in this year"
          emptyDescription="This person has no leave requests overlapping the selected year."
          columns={[
            {
              key: 'leaveType',
              header: 'Type',
              render: (row) => <StatusBadge value={leaveTypeLabel(row.leaveType)} />,
            },
            {
              key: 'dates',
              header: 'Dates',
              render: (row) => (
                <div className="cell-stack">
                  <div className="primary">
                    {formatDate(row.startOn)} – {formatDate(row.endOn)}
                  </div>
                  <div className="secondary">
                    {daysLabel(row.daysInYear)} in {year}
                    {row.days !== row.daysInYear ? ` · ${daysLabel(row.days)} total` : ''}
                  </div>
                </div>
              ),
            },
            { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusBadge value={leaveStatusLabel(row.status)} />,
            },
            {
              key: 'recipientName',
              header: 'Approvers',
              render: (row) => {
                const first = row.recipientName || row.recipientUsername;
                const second = row.recipient2Name || row.recipient2Username;
                if (!first && !second) return '—';
                return (
                  <div className="cell-stack">
                    <div className="primary">{first || '—'}</div>
                    {second ? <div className="secondary">+ {second}</div> : null}
                  </div>
                );
              },
            },
            {
              key: 'decidedBy',
              header: 'Decided by',
              render: (row) => row.decidedBy || '—',
            },
          ]}
        />
      </div>
    </>
  );
}

export function LeaveApplyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState(['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'ML', 'PL']);
  const [form, setForm] = useState(() => ({ ...emptyForm, startOn: todayIso(), endOn: todayIso() }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [profile, directory, options] = await Promise.all([
        api('/api/leave/me'),
        api('/api/leave/people'),
        api('/api/leave/options').catch(() => ({ leaveTypes: ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'ML', 'PL'] })),
      ]);
      setMe(profile);
      setPeople(directory || []);
      setLeaveTypes(options?.leaveTypes?.length ? options.leaveTypes : ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'ML', 'PL']);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (leaveTypes.length && !leaveTypes.includes(form.leaveType)) {
      setForm((current) => ({ ...current, leaveType: leaveTypes[0] }));
    }
  }, [leaveTypes, form.leaveType]);

  const days = countDays(form.startOn, form.endOn);
  const canSubmit = Boolean(me?.personId) && Boolean(form.recipientId);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.recipientId) {
      setError('Select Approver 1 for this leave request');
      return;
    }
    if (form.recipient2Id && form.recipient2Id === form.recipientId) {
      setError('Approver 2 must be different from Approver 1');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api('/api/leave', {
        method: 'POST',
        body: JSON.stringify({
          personId: hr && form.personId ? form.personId : null,
          personKind: 'CCIDP',
          recipientId: form.recipientId,
          recipient2Id: form.recipient2Id || null,
          leaveType: form.leaveType,
          startOn: form.startOn,
          endOn: form.endOn,
          reason: form.reason || null,
        }),
      });
      navigate('/leave/my-requests');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        {loading ? <p className="muted">Loading CCIDP users…</p> : null}
        {!loading && me?.message ? <p className="form-error">{me.message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field span-2">
              <span>Applicant</span>
              <input
                readOnly
                value={
                  me?.displayName
                    ? `${me.displayName} (${me.employeeNumber}${me.email ? ` · ${me.email}` : ''})`
                    : user?.username || '—'
                }
              />
            </label>
            <label className="field span-2">
              <span>Approver 1 (required)</span>
              <select
                required
                value={form.recipientId}
                onChange={(event) => update('recipientId', event.target.value)}
                disabled={loading || !people.length}
              >
                <option value="">{people.length ? 'Select a CCIDP user' : 'No other CCIDP users found'}</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName} — {person.username}
                    {person.email ? ` (${person.email})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              <span>Approver 2 (optional)</span>
              <select
                value={form.recipient2Id}
                onChange={(event) => update('recipient2Id', event.target.value)}
                disabled={loading || !people.length}
              >
                <option value="">None — one approver is enough</option>
                {people
                  .filter((person) => person.id !== form.recipientId)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName} — {person.username}
                      {person.email ? ` (${person.email})` : ''}
                    </option>
                  ))}
              </select>
              <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Both are notified. Any one nominated approver can approve or reject while pending.
              </span>
            </label>
            {hr ? (
              <label className="field span-2">
                <span>Or apply for another CCIDP employee</span>
                <select value={form.personId} onChange={(event) => update('personId', event.target.value)}>
                  <option value="">Myself</option>
                  {people
                    .filter((person) => person.accountType === 'EMPLOYEE')
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.displayName} — {person.username}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>Leave type</span>
              <select value={form.leaveType} onChange={(event) => update('leaveType', event.target.value)}>
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {leaveTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Days</span>
              <input readOnly value={days || '—'} />
            </label>
            <label className="field">
              <span>From</span>
              <input type="date" required value={form.startOn} onChange={(event) => update('startOn', event.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="date" required value={form.endOn} onChange={(event) => update('endOn', event.target.value)} />
            </label>
            <label className="field span-2">
              <span>Reason</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.reason}
                onChange={(event) => update('reason', event.target.value)}
                placeholder="Optional note for the reviewer"
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || loading || !canSubmit}>
              {saving ? 'Submitting…' : 'Submit leave request'}
            </button>
            <NavLink className="btn btn-ghost" to="/leave/my-requests">
              My requests
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeaveInboxPage() {
  return (
    <LeaveRequestTable
      scope="inbox"
      emptyTitle="No leave sent to you"
      emptyDescription="When someone sends you a leave request, it appears here and in the bell."
    />
  );
}

export function LeaveMyRequestsPage() {
  return (
    <LeaveRequestTable
      scope="mine"
      emptyTitle="You have not applied yet"
      emptyDescription="Use Apply leave to send a request. Track status here and cancel while it is still pending."
    />
  );
}

export function LeaveRequestsPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  if (!hr) {
    return <Navigate to="/leave/my-requests" replace />;
  }
  return (
    <LeaveRequestTable
      scope="all"
      emptyTitle="No leave requests"
      emptyDescription="Every leave request in the company appears here for HR."
    />
  );
}

function LeaveRequestTable({ scope, emptyTitle, emptyDescription }) {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = `scope=${encodeURIComponent(scope)}`;
      const [list, counts] = await Promise.all([api(`/api/leave?${query}`), api(`/api/leave/summary?${query}`)]);
      setRows(list || []);
      setSummary(counts || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scope]);

  const pending = useMemo(() => rows.filter((row) => row.status === 'PENDING').length, [rows]);
  const ownView = scope === 'mine';

  async function decide(id, action) {
    setBusyId(id);
    setError('');
    try {
      await api(`/api/leave/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <div className="kpi-grid kpi-grid-3">
        <KpiCard
          label="Pending"
          value={loading ? '—' : summary.pending}
          hint={scope === 'inbox' ? 'Waiting for you' : ownView ? 'Waiting for approval' : 'Waiting for a decision'}
        />
        <KpiCard label="Approved" value={loading ? '—' : summary.approved} hint="Confirmed leave" />
        <KpiCard label="Rejected" value={loading ? '—' : summary.rejected} hint="Not granted" />
      </div>
      <div className="panel">
        {ownView ? (
          <div className="panel-pad" style={{ paddingBottom: 0 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Your leave applications. You can cancel a request while it is still pending.
            </p>
          </div>
        ) : null}
        <DataTable
          rows={rows}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          columns={[
            ...(ownView
              ? []
              : [
                  {
                    key: 'employeeNumber',
                    header: 'Applicant',
                    render: (row) => <span className="mono">{row.employeeNumber}</span>,
                  },
                  {
                    key: 'displayName',
                    header: 'Name',
                    render: (row) => (
                      <div className="cell-stack">
                        <div className="primary">{row.displayName}</div>
                        <div className="secondary">{row.mine ? 'Your request' : 'From this person'}</div>
                      </div>
                    ),
                  },
                ]),
            {
              key: 'recipientName',
              header: ownView ? 'Approvers' : 'Approvers',
              render: (row) => {
                const first = row.recipientName || row.recipientUsername;
                const second = row.recipient2Name || row.recipient2Username;
                if (!first && !second) return '—';
                return (
                  <div className="cell-stack">
                    <div className="primary">{first || '—'}</div>
                    {second ? <div className="secondary">+ {second}</div> : null}
                  </div>
                );
              },
            },
            {
              key: 'leaveType',
              header: 'Type',
              render: (row) => <StatusBadge value={leaveTypeLabel(row.leaveType)} />,
            },
            {
              key: 'dates',
              header: 'Dates',
              render: (row) => (
                <div className="cell-stack">
                  <div className="primary">
                    {formatDate(row.startOn)} – {formatDate(row.endOn)}
                  </div>
                  <div className="secondary">
                    {row.days} day{row.days === 1 ? '' : 's'}
                  </div>
                </div>
              ),
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (row) => row.reason || '—',
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusBadge value={leaveStatusLabel(row.status)} />,
            },
            {
              key: 'actions',
              header: '',
              render: (row) =>
                row.status !== 'PENDING' ? (
                  <span className="muted">{row.decidedBy || '—'}</span>
                ) : scope === 'inbox' || (scope === 'all' && (row.forYou || hr)) ? (
                  <div className="row-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => decide(row.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => decide(row.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                ) : row.mine || ownView ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => decide(row.id, 'cancel')}
                  >
                    Cancel
                  </button>
                ) : (
                  <span className="muted">—</span>
                ),
            },
          ]}
        />
      </div>
      {!loading && pending ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {ownView
            ? `${pending} pending request${pending === 1 ? '' : 's'} waiting for approval.`
            : `${pending} pending request${pending === 1 ? '' : 's'}.`}
        </p>
      ) : null}
    </>
  );
}

function holidayKindLabel(kind) {
  if (kind === 'FIXED') return 'Observed';
  if (kind === 'OPTIONAL') return 'Optional';
  if (kind === 'INFO') return 'Sunday';
  return kind || '—';
}

function HolidaySection({ title, hint, rows, loading, error, onRetry }) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-pad" style={{ paddingBottom: 0 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        {hint ? <p className="muted">{hint}</p> : null}
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyTitle="Nothing in this list"
        emptyDescription="Nothing is stored for this year."
        columns={[
          { key: 'sortOrder', header: '#', render: (row) => row.sortOrder },
          { key: 'name', header: 'Holiday', render: (row) => <span className="primary">{row.name}</span> },
          {
            key: 'holidayOn',
            header: 'Date',
            render: (row) => (row.floating ? 'No fixed date' : formatDate(row.holidayOn)),
          },
          {
            key: 'weekday',
            header: 'Day',
            render: (row) => row.weekday || '—',
          },
          {
            key: 'kind',
            header: 'Kind',
            render: (row) => <StatusBadge value={holidayKindLabel(row.kind)} />,
          },
          {
            key: 'observed',
            header: 'Office',
            render: (row) => (row.observed ? 'Company off' : row.kind === 'INFO' ? 'Not a weekday off' : 'Not auto off'),
          },
        ]}
      />
    </div>
  );
}

export function LeaveHolidaysPage() {
  const [year, setYear] = useState(2026);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(selectedYear) {
    setLoading(true);
    setError('');
    try {
      const calendar = await api(`/api/leave/holidays?year=${encodeURIComponent(selectedYear)}`);
      setData(calendar);
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(year);
  }, [year]);

  const years = data?.years?.length ? data.years : [year];

  return (
    <>
      <div className="kpi-grid kpi-grid-3">
        <KpiCard
          label="Observed holidays"
          value={loading ? '—' : data?.fixedCount ?? '—'}
          hint="National / festival days the company observes"
        />
        <KpiCard
          label="Optional (choose one)"
          value={loading ? '—' : data?.optionalCount ?? '—'}
          hint="One day per employee per year from this list"
        />
        <KpiCard
          label="Sunday occasions"
          value={loading ? '—' : data?.infoCount ?? '—'}
          hint="Shown for information; not a paid weekday holiday"
        />
      </div>
      <div className="panel">
        <div className="panel-pad">
          <div className="form-grid">
            <label className="field">
              <span>Year</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              <span>Applies to</span>
              <input readOnly value={data?.appliesTo || 'Corporate Office and Factory Raviryal, Telangana'} />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {loading ? <p className="muted">Loading holiday calendar…</p> : null}
          {!loading && data ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {data.title}. Authorized by {data.authorizedTitle} {data.authorizedBy}. {data.optionalPolicy}
            </p>
          ) : null}
        </div>
      </div>
      <HolidaySection
        title="National / Festival Holidays"
        hint="Fixed company-observed holidays for this year."
        rows={data?.national || []}
        loading={loading}
        error={error}
        onRetry={() => load(year)}
      />
      <HolidaySection
        title="Optional Holidays"
        hint="Employees may avail one day from this list. Birthday and marriage anniversary are floating — ERP does not record which optional day someone chose yet."
        rows={data?.optional || []}
        loading={loading}
        error={error}
        onRetry={() => load(year)}
      />
      <HolidaySection
        title="Festival / Occasion falling on Sunday"
        hint="Listed on the circular. Sunday is not counted as a weekday off."
        rows={data?.sundayOccasions || []}
        loading={loading}
        error={error}
        onRetry={() => load(year)}
      />
    </>
  );
}
