import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import {
  directoryLabel,
  exitReasonLabel,
  exitStatusLabel,
  formatDate,
  hasHrAccess,
} from '../utils/format';

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function plusDaysIso(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function countNoticeDays(lwd) {
  if (!lwd) return 0;
  const start = new Date(`${todayIso()}T00:00:00`);
  const end = new Date(`${lwd}T00:00:00`);
  if (Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end - start) / 86400000);
}

const REASONS = [
  ['BETTER_OPPORTUNITY', 'Better opportunity'],
  ['PERSONAL', 'Personal'],
  ['RELOCATION', 'Relocation'],
  ['HEALTH', 'Health'],
  ['EDUCATION', 'Education'],
  ['CONTRACT_END', 'Contract end'],
  ['OTHER', 'Other'],
];

export function ExitPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);

  return (
    <>
      <PageHeader
        title="Exit / Resign"
        description="Self-service resignation, HR approvals, notice, and clearance. Relieving letters are not generated yet."
      />
      <div className="page-tabs" role="tablist" aria-label="Exit / Resign">
        <NavLink to="/hr/exit" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Overview
        </NavLink>
        <NavLink to="/hr/exit/apply" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Apply resignation
        </NavLink>
        {hr ? (
          <NavLink to="/hr/exit/inbox" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
            Inbox
          </NavLink>
        ) : null}
        <NavLink to="/hr/exit/cases" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          {hr ? 'All cases' : 'My cases'}
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

export function ExitOverviewPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const scope = hr ? 'all' : 'mine';
  const [kpis, setKpis] = useState({ open: 0, inNotice: 0, pendingClearance: 0, completedThisMonth: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api(`/api/hr/exit/summary?scope=${scope}`);
        if (!cancelled) setKpis(data || {});
      } catch (err) {
        if (!cancelled) setError(extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="kpi-grid">
        <KpiCard label="Open resignations" value={loading ? '—' : kpis.open} hint="Submitted through clearance" />
        <KpiCard label="In notice period" value={loading ? '—' : kpis.inNotice} hint="Approved, last working day ahead" />
        <KpiCard label="Pending clearance" value={loading ? '—' : kpis.pendingClearance} hint="Department checklist open" />
        <KpiCard label="Completed this month" value={loading ? '—' : kpis.completedThisMonth} hint="Marked relieved" />
      </div>
      {!loading && !kpis.open && !kpis.completedThisMonth ? (
        <div className="panel">
          <div className="panel-pad">
            <h2>No exit cases yet</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {hr
                ? 'When someone applies, they appear in Inbox and All cases. Counts stay at zero until a real resignation is submitted.'
                : 'You have not applied. Use Apply resignation if you intend to leave.'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ExitApplyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(() => ({
    requestedLwd: plusDaysIso(30),
    reasonCode: '',
    reasonNotes: '',
    noticeAcknowledged: false,
  }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const profile = await api('/api/hr/exit/me');
        const options = await api('/api/leave/options').catch(() => ({ exitNoticeDays: 30 }));
        if (!cancelled) {
          setMe(profile);
          const days = options?.exitNoticeDays || 30;
          setForm((current) => ({ ...current, requestedLwd: plusDaysIso(days) }));
        }
      } catch (err) {
        if (!cancelled) setError(extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const noticeDays = countNoticeDays(form.requestedLwd);
  const canSubmit = Boolean(me?.ccidpUserId) && form.reasonCode && form.requestedLwd && form.noticeAcknowledged;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.reasonCode) {
      setError('Select a reason');
      return;
    }
    if (!form.noticeAcknowledged) {
      setError('Acknowledge the notice period');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const created = await api('/api/hr/exit', {
        method: 'POST',
        body: JSON.stringify({
          requestedLwd: form.requestedLwd,
          reasonCode: form.reasonCode,
          reasonNotes: form.reasonNotes || null,
          noticeAcknowledged: true,
        }),
      });
      navigate(`/hr/exit/cases/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        {loading ? <p className="muted">Loading your profile…</p> : null}
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
            <label className="field">
              <span>Directory</span>
              <input readOnly value={directoryLabel(me?.personKind)} />
            </label>
            <label className="field">
              <span>Notice (calendar days)</span>
              <input readOnly value={form.requestedLwd ? String(noticeDays) : '—'} />
            </label>
            <label className="field">
              <span>Requested last working day</span>
              <input
                type="date"
                required
                min={todayIso()}
                value={form.requestedLwd}
                onChange={(event) => update('requestedLwd', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Reason</span>
              <select required value={form.reasonCode} onChange={(event) => update('reasonCode', event.target.value)}>
                <option value="">Select a reason</option>
                {REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              <span>Notes</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={form.reasonNotes}
                onChange={(event) => update('reasonNotes', event.target.value)}
                placeholder="Optional context for HR"
              />
            </label>
            <label className="field span-2 checkbox-field">
              <input
                type="checkbox"
                checked={form.noticeAcknowledged}
                onChange={(event) => update('noticeAcknowledged', event.target.checked)}
              />
              <span>
                I understand notice ends on the requested last working day ({noticeDays} calendar day
                {noticeDays === 1 ? '' : 's'} from today). Company policy on serving notice still applies.
              </span>
            </label>
          </div>
          <p className="muted">
            {me?.personKind === 'CCIDP'
              ? 'No On-Role or Contract record matched this email. The case is still stored against your CCIDP login.'
              : me?.personKind === 'STAFF'
                ? 'Linked to On-Role (erp.staff) by email.'
                : me?.personKind === 'EMPLOYEE'
                  ? 'Linked to Contract (erp.employees) by email.'
                  : null}
          </p>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || loading || !canSubmit}>
              {saving ? 'Submitting…' : 'Submit resignation'}
            </button>
            <NavLink className="btn btn-ghost" to="/hr/exit/cases">
              View cases
            </NavLink>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExitInboxPage() {
  return (
    <ExitCaseTable
      scope="inbox"
      emptyTitle="No resignations waiting"
      emptyDescription="Submitted cases appear here for HR to approve or reject."
    />
  );
}

export function ExitCasesPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  return (
    <ExitCaseTable
      scope={hr ? 'all' : 'mine'}
      emptyTitle={hr ? 'No resignation cases' : 'You have not applied'}
      emptyDescription={hr ? 'Cases will list here after someone submits.' : 'Use Apply resignation to start a case.'}
    />
  );
}

function ExitCaseTable({ scope, emptyTitle, emptyDescription }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const list = await api(`/api/hr/exit?scope=${encodeURIComponent(scope)}`);
      setRows(list || []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scope]);

  return (
    <div className="panel">
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onRowClick={(row) => navigate(`/hr/exit/cases/${row.id}`)}
        columns={[
          {
            key: 'employeeNumber',
            header: 'Person',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.displayName}</div>
                <div className="secondary mono">{row.employeeNumber}</div>
              </div>
            ),
          },
          {
            key: 'personKind',
            header: 'Kind',
            render: (row) => <StatusBadge value={directoryLabel(row.personKind)} />,
          },
          {
            key: 'submittedAt',
            header: 'Submitted',
            render: (row) => formatDate(row.submittedAt),
          },
          {
            key: 'requestedLwd',
            header: 'Requested LWD',
            render: (row) => formatDate(row.requestedLwd),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge value={exitStatusLabel(row.status)} />,
          },
          {
            key: 'noticeEndsOn',
            header: 'Notice end',
            render: (row) => formatDate(row.noticeEndsOn),
          },
        ]}
      />
    </div>
  );
}

export function ExitCaseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [comment, setComment] = useState('');
  const [interview, setInterview] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/hr/exit/${id}`);
      setDetail(data);
      setInterview(data.exitInterviewNotes || '');
    } catch (err) {
      setError(extractError(err));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function post(path, body, label) {
    setBusy(label);
    setError('');
    try {
      const data = await api(`/api/hr/exit/${id}${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setDetail(data);
      setInterview(data.exitInterviewNotes || '');
      setComment('');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function saveInterview(event) {
    event.preventDefault();
    setBusy('interview');
    setError('');
    try {
      const data = await api(`/api/hr/exit/${id}/interview`, {
        method: 'PUT',
        body: JSON.stringify({ notes: interview || null }),
      });
      setDetail(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function updateItem(item, status) {
    setBusy(item.id);
    setError('');
    try {
      const data = await api(`/api/hr/exit/${id}/clearance/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes: item.notes || null }),
      });
      setDetail(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  const pendingClearance = useMemo(
    () => (detail?.clearance || []).filter((item) => item.status === 'PENDING').length,
    [detail]
  );

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-pad">
          <p className="muted">Loading case…</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="panel">
        <div className="panel-pad">
          {error ? <p className="form-error">{error}</p> : <p className="muted">Case not found.</p>}
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/exit/cases')}>
            Back to cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="panel">
        <div className="panel-pad">
          <div className="list-toolbar list-toolbar-split">
            <div>
              <h2 style={{ margin: 0 }}>{detail.displayName}</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                {detail.employeeNumber}
                {detail.email ? ` · ${detail.email}` : ''} · {directoryLabel(detail.personKind)}
              </p>
            </div>
            <StatusBadge value={exitStatusLabel(detail.status)} />
          </div>
          <ol className="exit-timeline">
            {(detail.timeline || []).map((event) => (
              <li key={event.key} className={event.done ? 'is-done' : ''}>
                <span className="exit-timeline-dot" />
                <div>
                  <strong>{event.label}</strong>
                  <div className="muted">{event.at ? formatDate(event.at) : 'Not yet'}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Requested last working day</span>
              <input readOnly value={formatDate(detail.requestedLwd)} />
            </label>
            <label className="field">
              <span>Notice end</span>
              <input readOnly value={formatDate(detail.noticeEndsOn)} />
            </label>
            <label className="field">
              <span>Notice days</span>
              <input readOnly value={String(detail.noticeDays)} />
            </label>
            <label className="field">
              <span>Reason</span>
              <input readOnly value={exitReasonLabel(detail.reasonCode)} />
            </label>
            <label className="field span-2">
              <span>Notes</span>
              <textarea readOnly rows={2} value={detail.reasonNotes || ''} />
            </label>
          </div>
          {detail.decisionNote ? <p className="muted">HR comment: {detail.decisionNote}</p> : null}
          <div className="form-actions">
            {detail.status === 'SUBMITTED' && detail.mine ? (
              <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => post('/withdraw', null, 'withdraw')}>
                {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}
              </button>
            ) : null}
            {hr && detail.status === 'SUBMITTED' ? (
              <>
                <label className="field" style={{ minWidth: 240, flex: 1 }}>
                  <span>Decision comment</span>
                  <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required to reject" />
                </label>
                <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/approve', { note: comment || null }, 'approve')}>
                  Approve
                </button>
                <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => post('/reject', { note: comment }, 'reject')}>
                  Reject
                </button>
              </>
            ) : null}
            {hr && (detail.status === 'IN_NOTICE' || detail.status === 'APPROVED') ? (
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/start-clearance', null, 'clearance')}>
                Start clearance
              </button>
            ) : null}
            {hr && detail.status === 'CLEARANCE' ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={Boolean(busy) || pendingClearance > 0}
                onClick={() => post('/relieve', null, 'relieve')}
              >
                Mark relieved
              </button>
            ) : null}
            {hr && !['RELIEVED', 'CANCELLED', 'WITHDRAWN', 'REJECTED'].includes(detail.status) ? (
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/cancel', { note: comment || null }, 'cancel')}>
                Cancel case
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2>Clearance checklist</h2>
          <p className="muted">IT, Access/ID, Finance, HR handover, and payroll cutoff. Mark Done or N/A — do not invent extra people.</p>
          <ul className="clearance-list">
            {(detail.clearance || []).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted">{item.departmentCode}</div>
                </div>
                <StatusBadge value={item.status === 'NA' ? 'N/A' : item.status} />
                {hr && ['APPROVED', 'IN_NOTICE', 'CLEARANCE'].includes(detail.status) ? (
                  <div className="row-actions">
                    <button className="btn btn-sm" type="button" disabled={Boolean(busy)} onClick={() => updateItem(item, 'DONE')}>
                      Done
                    </button>
                    <button className="btn btn-sm btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => updateItem(item, 'NA')}>
                      N/A
                    </button>
                    <button className="btn btn-sm btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => updateItem(item, 'PENDING')}>
                      Reset
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2>Asset handover</h2>
          {detail.assignedAssets?.length ? (
            <DataTable
              rows={detail.assignedAssets}
              columns={[
                { key: 'assetCode', header: 'Code', render: (row) => <span className="mono">{row.assetCode}</span> },
                { key: 'department', header: 'Dept' },
                { key: 'brand', header: 'Brand' },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'location', header: 'Location', render: (row) => row.location || '—' },
              ]}
              emptyTitle="No assigned assets"
              emptyDescription="Nothing in the company asset register for this username."
            />
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              No company assets assigned to username {detail.subjectUsername || '—'} in the asset register. Use the IT
              checklist item for any return outside that register.
            </p>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2>Exit interview</h2>
          {hr ? (
            <form onSubmit={saveInterview}>
              <label className="field span-2">
                <span>HR notes</span>
                <textarea rows={4} maxLength={4000} value={interview} onChange={(event) => setInterview(event.target.value)} />
              </label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={busy === 'interview'}>
                  {busy === 'interview' ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </form>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              {detail.exitInterviewNotes || 'HR has not recorded interview notes.'}
            </p>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2>Letters</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            Relieving letter: {detail.relievingLetter?.status === 'GENERATE_LATER' ? 'Generate later' : 'Not issued'} —{' '}
            {detail.relievingLetter?.message}
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Experience letter: {detail.experienceLetter?.status === 'GENERATE_LATER' ? 'Generate later' : 'Not issued'} —{' '}
            {detail.experienceLetter?.message}
          </p>
        </div>
      </div>
    </>
  );
}
