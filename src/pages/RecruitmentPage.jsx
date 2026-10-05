import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import {
  employmentTypeLabel,
  formatDate,
  formatMoney,
  formatTime,
  interviewModeLabel,
  interviewTypeLabel,
  recruitmentSourceLabel,
} from '../utils/format';

const EMPLOYMENT = [
  ['ON_ROLE', 'On-Role'],
  ['CONTRACT', 'Contract'],
  ['INTERN', 'Intern'],
];

const SOURCES = [
  ['REFERRAL', 'Referral'],
  ['PORTAL', 'Career portal'],
  ['LINKEDIN', 'LinkedIn'],
  ['AGENCY', 'Agency'],
  ['CAMPUS', 'Campus'],
  ['WALK_IN', 'Walk-in'],
  ['OTHER', 'Other'],
];

const CANDIDATE_STATUSES = [
  ['NEW', 'New'],
  ['SCREENING', 'Screening'],
  ['INTERVIEW', 'Interview'],
  ['OFFER', 'Offer'],
  ['HIRED', 'Hired'],
  ['REJECTED', 'Rejected'],
  ['WITHDRAWN', 'Withdrawn'],
  ['ON_HOLD', 'On hold'],
];

const INTERVIEW_TYPES = [
  ['SCREENING', 'Screening'],
  ['TECHNICAL', 'Technical'],
  ['MANAGER', 'Manager'],
  ['HR', 'HR'],
  ['FINAL', 'Final'],
  ['OTHER', 'Other'],
];

const INTERVIEW_MODES = [
  ['IN_PERSON', 'In person'],
  ['VIDEO', 'Video'],
  ['PHONE', 'Phone'],
];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function localDateTimeValue(daysAhead = 1, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toOffsetIso(local) {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTime(value) {
  if (!value) return '—';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

function setField(setter) {
  return (key) => (event) => setter((prev) => ({ ...prev, [key]: event.target.value }));
}

function PersonCell({ primary, secondary }) {
  return (
    <div className="cell-stack">
      <div className="primary">{primary}</div>
      {secondary ? <div className="secondary">{secondary}</div> : null}
    </div>
  );
}

export function RecruitmentPage() {
  return (
    <>
      <PageHeader
        title="Recruitment"
        description="Hire with a clear pipeline: approve the headcount, publish the opening, screen candidates, run interviews, then issue the offer."
      />
      <div className="page-tabs" role="tablist" aria-label="Recruitment">
        <NavLink to="/hr/recruitment" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Requisitions
        </NavLink>
        <NavLink
          to="/hr/recruitment/openings"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Openings
        </NavLink>
        <NavLink
          to="/hr/recruitment/candidates"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Candidates
        </NavLink>
        <NavLink
          to="/hr/recruitment/interviews"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Interviews
        </NavLink>
        <NavLink
          to="/hr/recruitment/offers"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Offers
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

function DashboardStrip({ dash, loading }) {
  return (
    <div className="kpi-grid kpi-grid-6" style={{ marginBottom: 16 }}>
      <KpiCard label="Pending requisitions" value={loading ? '…' : dash?.pendingReqs} />
      <KpiCard label="Open jobs" value={loading ? '…' : dash?.openJobs} />
      <KpiCard label="Active candidates" value={loading ? '…' : dash?.activeCandidates} />
      <KpiCard label="Interviews scheduled" value={loading ? '…' : dash?.scheduledInterviews} />
      <KpiCard label="Open offers" value={loading ? '…' : dash?.openOffers} />
      <KpiCard label="Hired" value={loading ? '…' : dash?.hired} />
    </div>
  );
}

function useDashboard() {
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setDash(await api('/api/hr/recruitment/dashboard'));
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { dash, loading, reload: load };
}

export function RequisitionsPage() {
  const navigate = useNavigate();
  const { dash, loading: dashLoading, reload: reloadDash } = useDashboard();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api('/api/hr/recruitment/requisitions'));
      reloadDash();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <DashboardStrip dash={dash} loading={dashLoading} />
      <div className="list-toolbar list-toolbar-split">
        <p className="muted" style={{ margin: 0 }}>
          Request headcount first. Approved requisitions can become published openings.
        </p>
        <div className="toolbar-actions">
          <button className="btn btn-primary" type="button" onClick={() => navigate('/hr/recruitment/requisitions/new')}>
            New requisition
          </button>
        </div>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No requisitions yet"
        emptyDescription="Create a requisition when a team needs to hire."
        onRowClick={(row) => navigate(`/hr/recruitment/requisitions/${row.id}`)}
        columns={[
          { key: 'reqNumber', header: 'Req', render: (row) => <span className="mono">{row.reqNumber}</span> },
          {
            key: 'title',
            header: 'Role',
            render: (row) => <PersonCell primary={row.title} secondary={`${row.department} · ${employmentTypeLabel(row.employmentType)}`} />,
          },
          { key: 'headcount', header: 'HC' },
          { key: 'location', header: 'Location', render: (row) => row.location || '—' },
          { key: 'requestedBy', header: 'Requested by', render: (row) => row.requestedBy || '—' },
          { key: 'requestedAt', header: 'Requested', render: (row) => formatDate(row.requestedAt) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function RequisitionFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    department: '',
    employmentType: 'ON_ROLE',
    headcount: '1',
    location: '',
    justification: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const on = setField(setForm);

  async function save(submit) {
    setBusy(submit ? 'submit' : 'save');
    setError('');
    try {
      const created = await api('/api/hr/recruitment/requisitions', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          department: form.department.trim(),
          employmentType: form.employmentType,
          headcount: Number(form.headcount) || 1,
          location: form.location.trim() || null,
          justification: form.justification.trim() || null,
          submit,
        }),
      });
      navigate(`/hr/recruitment/requisitions/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          New job requisition
        </h2>
        <p className="muted">Capture the role, headcount, and business case. Submit for HR approval when ready.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Job title</span>
            <input value={form.title} onChange={on('title')} placeholder="e.g. Senior Embedded Engineer" />
          </label>
          <label className="field">
            <span>Department</span>
            <input value={form.department} onChange={on('department')} placeholder="e.g. R&D" />
          </label>
          <label className="field">
            <span>Employment type</span>
            <select value={form.employmentType} onChange={on('employmentType')}>
              {EMPLOYMENT.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Headcount</span>
            <input type="number" min="1" value={form.headcount} onChange={on('headcount')} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={on('location')} placeholder="e.g. Visakhapatnam" />
          </label>
          <label className="field field-span-2">
            <span>Business justification</span>
            <textarea rows={4} value={form.justification} onChange={on('justification')} placeholder="Why this hire is needed now" />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment')} disabled={Boolean(busy)}>
            Cancel
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => save(false)} disabled={Boolean(busy)}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button className="btn btn-primary" type="button" onClick={() => save(true)} disabled={Boolean(busy)}>
            {busy === 'submit' ? 'Submitting…' : 'Save & submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RequisitionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/hr/recruitment/requisitions/${id}`);
      setRow(data);
      setNote(data.decisionNote || '');
      setEdit({
        title: data.title || '',
        department: data.department || '',
        employmentType: data.employmentType || 'ON_ROLE',
        headcount: String(data.headcount || 1),
        location: data.location || '',
        justification: data.justification || '',
      });
    } catch (err) {
      setError(extractError(err));
      setRow(null);
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
      setRow(
        await api(`/api/hr/recruitment/requisitions/${id}${path}`, {
          method: 'POST',
          body: body ? JSON.stringify(body) : undefined,
        })
      );
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function saveDraft() {
    setBusy('save');
    setError('');
    try {
      setRow(
        await api(`/api/hr/recruitment/requisitions/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: edit.title.trim(),
            department: edit.department.trim(),
            employmentType: edit.employmentType,
            headcount: Number(edit.headcount) || 1,
            location: edit.location.trim() || null,
            justification: edit.justification.trim() || null,
          }),
        })
      );
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading requisition…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  const draft = row.status === 'DRAFT';
  const submitted = row.status === 'SUBMITTED';
  const approved = row.status === 'APPROVED';
  const on = setField(setEdit);

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.reqNumber}</span>
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.title} · {row.department} · {employmentTypeLabel(row.employmentType)}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        {draft && edit ? (
          <div className="form-grid">
            <label className="field">
              <span>Job title</span>
              <input value={edit.title} onChange={on('title')} />
            </label>
            <label className="field">
              <span>Department</span>
              <input value={edit.department} onChange={on('department')} />
            </label>
            <label className="field">
              <span>Employment type</span>
              <select value={edit.employmentType} onChange={on('employmentType')}>
                {EMPLOYMENT.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Headcount</span>
              <input type="number" min="1" value={edit.headcount} onChange={on('headcount')} />
            </label>
            <label className="field">
              <span>Location</span>
              <input value={edit.location} onChange={on('location')} />
            </label>
            <label className="field field-span-2">
              <span>Justification</span>
              <textarea rows={4} value={edit.justification} onChange={on('justification')} />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>Headcount</span>
              <input readOnly value={row.headcount} />
            </label>
            <label className="field">
              <span>Location</span>
              <input readOnly value={row.location || '—'} />
            </label>
            <label className="field">
              <span>Requested by</span>
              <input readOnly value={row.requestedBy || '—'} />
            </label>
            <label className="field">
              <span>Requested on</span>
              <input readOnly value={formatDateTime(row.requestedAt)} />
            </label>
            <label className="field field-span-2">
              <span>Justification</span>
              <textarea readOnly rows={3} value={row.justification || ''} />
            </label>
            {row.decidedAt ? (
              <>
                <label className="field">
                  <span>Decided</span>
                  <input readOnly value={`${formatDateTime(row.decidedAt)} · ${row.decidedBy || ''}`} />
                </label>
                <label className="field field-span-2">
                  <span>Decision note</span>
                  <textarea readOnly rows={2} value={row.decisionNote || ''} />
                </label>
              </>
            ) : null}
          </div>
        )}

        {(submitted || approved) && (
          <label className="field" style={{ marginTop: 16, display: 'block' }}>
            <span>Decision note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the requester" />
          </label>
        )}

        <div className="toolbar-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment')}>
            Back
          </button>
          {draft ? (
            <>
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={saveDraft}>
                {busy === 'save' ? 'Saving…' : 'Save changes'}
              </button>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/submit', null, 'submit')}>
                {busy === 'submit' ? 'Submitting…' : 'Submit for approval'}
              </button>
            </>
          ) : null}
          {submitted ? (
            <>
              <button
                className="btn btn-primary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/approve', { note }, 'approve')}
              >
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/reject', { note }, 'reject')}
              >
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          ) : null}
          {approved ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate(`/hr/recruitment/openings/new?requisitionId=${row.id}`)}
            >
              Create opening
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OpeningsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : '';
      setRows(await api(`/api/hr/recruitment/openings${q}`));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions">
          <label className="field" style={{ margin: 0, minWidth: 160 }}>
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On hold</option>
              <option value="FILLED">Filled</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" type="button" onClick={() => navigate('/hr/recruitment/openings/new')}>
            New opening
          </button>
        </div>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No job openings"
        emptyDescription="Publish an opening from an approved requisition to start attracting candidates."
        onRowClick={(row) => navigate(`/hr/recruitment/openings/${row.id}`)}
        columns={[
          { key: 'openingNumber', header: 'Job', render: (row) => <span className="mono">{row.openingNumber}</span> },
          {
            key: 'title',
            header: 'Title',
            render: (row) => <PersonCell primary={row.title} secondary={`${row.department} · ${employmentTypeLabel(row.employmentType)}`} />,
          },
          { key: 'openings', header: 'Slots' },
          { key: 'hired', header: 'Hired' },
          { key: 'location', header: 'Location', render: (row) => row.location || '—' },
          { key: 'publishedAt', header: 'Published', render: (row) => formatDate(row.publishedAt) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function OpeningFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [reqs, setReqs] = useState([]);
  const [form, setForm] = useState({
    requisitionId: params.get('requisitionId') || '',
    title: '',
    department: '',
    employmentType: 'ON_ROLE',
    location: '',
    openings: '1',
    description: '',
    requirements: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const on = setField(setForm);

  useEffect(() => {
    (async () => {
      try {
        const all = await api('/api/hr/recruitment/requisitions');
        const approved = (all || []).filter((r) => r.status === 'APPROVED');
        setReqs(approved);
        const pre = params.get('requisitionId');
        const match = approved.find((r) => r.id === pre) || approved[0];
        if (match) {
          setForm((prev) => ({
            ...prev,
            requisitionId: match.id,
            title: prev.title || match.title,
            department: prev.department || match.department,
            employmentType: match.employmentType || prev.employmentType,
            location: prev.location || match.location || '',
            openings: prev.openings || String(match.headcount || 1),
          }));
        }
      } catch (err) {
        setError(extractError(err));
      }
    })();
  }, [params]);

  function applyReq(id) {
    const match = reqs.find((r) => r.id === id);
    setForm((prev) => ({
      ...prev,
      requisitionId: id,
      title: match?.title || prev.title,
      department: match?.department || prev.department,
      employmentType: match?.employmentType || prev.employmentType,
      location: match?.location || prev.location,
      openings: String(match?.headcount || prev.openings || 1),
    }));
  }

  async function save(publish) {
    setBusy(publish ? 'publish' : 'save');
    setError('');
    try {
      const created = await api('/api/hr/recruitment/openings', {
        method: 'POST',
        body: JSON.stringify({
          requisitionId: form.requisitionId || null,
          title: form.title.trim(),
          department: form.department.trim(),
          employmentType: form.employmentType,
          location: form.location.trim() || null,
          openings: Number(form.openings) || 1,
          description: form.description.trim() || null,
          requirements: form.requirements.trim() || null,
          publish,
        }),
      });
      navigate(`/hr/recruitment/openings/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          New job opening
        </h2>
        <p className="muted">Link an approved requisition, write the JD, then publish when ready to accept applications.</p>
        {error ? <p className="form-error">{error}</p> : null}
        {!reqs.length ? (
          <p className="form-error">Approve at least one requisition before creating an opening.</p>
        ) : null}
        <div className="form-grid">
          <label className="field field-span-2">
            <span>Approved requisition</span>
            <select
              value={form.requisitionId}
              onChange={(e) => applyReq(e.target.value)}
              disabled={!reqs.length}
            >
              <option value="">Select requisition</option>
              {reqs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reqNumber} — {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Job title</span>
            <input value={form.title} onChange={on('title')} />
          </label>
          <label className="field">
            <span>Department</span>
            <input value={form.department} onChange={on('department')} />
          </label>
          <label className="field">
            <span>Employment type</span>
            <select value={form.employmentType} onChange={on('employmentType')}>
              {EMPLOYMENT.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Openings</span>
            <input type="number" min="1" value={form.openings} onChange={on('openings')} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={on('location')} />
          </label>
          <label className="field field-span-2">
            <span>Job description</span>
            <textarea rows={4} value={form.description} onChange={on('description')} />
          </label>
          <label className="field field-span-2">
            <span>Requirements</span>
            <textarea rows={4} value={form.requirements} onChange={on('requirements')} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment/openings')}>
            Cancel
          </button>
          <button className="btn btn-ghost" type="button" disabled={Boolean(busy) || !reqs.length} onClick={() => save(false)}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button className="btn btn-primary" type="button" disabled={Boolean(busy) || !reqs.length} onClick={() => save(true)}>
            {busy === 'publish' ? 'Publishing…' : 'Publish opening'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OpeningDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRow(await api(`/api/hr/recruitment/openings/${id}`));
    } catch (err) {
      setError(extractError(err));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function post(path, label) {
    setBusy(label);
    setError('');
    try {
      await api(`/api/hr/recruitment/openings/${id}${path}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading opening…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.openingNumber}</span>
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.title} · {row.department} · {employmentTypeLabel(row.employmentType)}
              {row.requisitionNumber ? ` · ${row.requisitionNumber}` : ''}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Slots</span>
            <input readOnly value={row.openings} />
          </label>
          <label className="field">
            <span>Location</span>
            <input readOnly value={row.location || '—'} />
          </label>
          <label className="field">
            <span>Published</span>
            <input readOnly value={formatDateTime(row.publishedAt)} />
          </label>
          <label className="field field-span-2">
            <span>Description</span>
            <textarea readOnly rows={3} value={row.description || ''} />
          </label>
          <label className="field field-span-2">
            <span>Requirements</span>
            <textarea readOnly rows={3} value={row.requirements || ''} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment/openings')}>
            Back
          </button>
          {row.status === 'DRAFT' || row.status === 'ON_HOLD' ? (
            <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/publish', 'publish')}>
              {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          ) : null}
          {row.status === 'OPEN' ? (
            <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/hold', 'hold')}>
              {busy === 'hold' ? 'Holding…' : 'Put on hold'}
            </button>
          ) : null}
          {row.status === 'OPEN' || row.status === 'ON_HOLD' || row.status === 'DRAFT' ? (
            <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/close', 'close')}>
              {busy === 'close' ? 'Closing…' : 'Close'}
            </button>
          ) : null}
          {(row.status === 'OPEN' || row.status === 'ON_HOLD') && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate(`/hr/recruitment/candidates/new?openingId=${row.id}`)}
            >
              Add candidate
            </button>
          )}
        </div>

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Candidates on this opening
        </h3>
        <DataTable
          rows={row.candidates || []}
          emptyTitle="No candidates yet"
          emptyDescription="Add applicants once the opening is live."
          onRowClick={(c) => navigate(`/hr/recruitment/candidates/${c.id}`)}
          columns={[
            { key: 'candidateNumber', header: 'ID', render: (c) => <span className="mono">{c.candidateNumber}</span> },
            { key: 'displayName', header: 'Name', render: (c) => <PersonCell primary={c.displayName} secondary={c.email} /> },
            { key: 'source', header: 'Source', render: (c) => recruitmentSourceLabel(c.source) },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge value={c.status} /> },
          ]}
        />
      </div>
    </div>
  );
}

export function CandidatesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [openingId, setOpeningId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (openingId) qs.set('openingId', openingId);
      if (status) qs.set('status', status);
      const q = qs.toString() ? `?${qs}` : '';
      const [list, jobs] = await Promise.all([
        api(`/api/hr/recruitment/candidates${q}`),
        api('/api/hr/recruitment/openings'),
      ]);
      setRows(list);
      setOpenings(jobs || []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [openingId, status]);

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <select value={openingId} onChange={(e) => setOpeningId(e.target.value)}>
            <option value="">All openings</option>
            {openings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.openingNumber} — {o.title}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {CANDIDATE_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" type="button" onClick={() => navigate('/hr/recruitment/candidates/new')}>
            Add candidate
          </button>
        </div>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No candidates"
        emptyDescription="Add applicants against an open job and attach resumes."
        onRowClick={(row) => navigate(`/hr/recruitment/candidates/${row.id}`)}
        columns={[
          { key: 'candidateNumber', header: 'ID', render: (row) => <span className="mono">{row.candidateNumber}</span> },
          {
            key: 'displayName',
            header: 'Candidate',
            render: (row) => <PersonCell primary={row.displayName} secondary={row.email} />,
          },
          {
            key: 'openingTitle',
            header: 'Opening',
            render: (row) => <PersonCell primary={row.openingTitle || '—'} secondary={row.openingNumber} />,
          },
          { key: 'source', header: 'Source', render: (row) => recruitmentSourceLabel(row.source) },
          { key: 'experienceYears', header: 'Exp', render: (row) => (row.experienceYears != null ? `${row.experienceYears}y` : '—') },
          { key: 'resumes', header: 'CV' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function CandidateFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [openings, setOpenings] = useState([]);
  const [form, setForm] = useState({
    openingId: params.get('openingId') || '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'PORTAL',
    experienceYears: '',
    currentCompany: '',
    currentTitle: '',
    expectedCtc: '',
    noticeDays: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const on = setField(setForm);

  useEffect(() => {
    (async () => {
      try {
        const jobs = (await api('/api/hr/recruitment/openings')) || [];
        const usable = jobs.filter((j) => j.status === 'OPEN' || j.status === 'ON_HOLD' || j.status === 'DRAFT');
        setOpenings(usable.length ? usable : jobs);
        if (!form.openingId && (usable[0] || jobs[0])) {
          setForm((prev) => ({ ...prev, openingId: (usable[0] || jobs[0]).id }));
        }
      } catch (err) {
        setError(extractError(err));
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const created = await api('/api/hr/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify({
          openingId: form.openingId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          source: form.source,
          experienceYears: form.experienceYears === '' ? null : Number(form.experienceYears),
          currentCompany: form.currentCompany.trim() || null,
          currentTitle: form.currentTitle.trim() || null,
          expectedCtc: form.expectedCtc === '' ? null : Number(form.expectedCtc),
          noticeDays: form.noticeDays === '' ? null : Number(form.noticeDays),
          notes: form.notes.trim() || null,
        }),
      });
      navigate(`/hr/recruitment/candidates/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Add candidate
        </h2>
        <p className="muted">Capture contact details and source. Attach the resume on the next screen.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field field-span-2">
            <span>Job opening</span>
            <select value={form.openingId} onChange={on('openingId')}>
              <option value="">Select opening</option>
              {openings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.openingNumber} — {o.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>First name</span>
            <input value={form.firstName} onChange={on('firstName')} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input value={form.lastName} onChange={on('lastName')} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={on('email')} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={on('phone')} />
          </label>
          <label className="field">
            <span>Source</span>
            <select value={form.source} onChange={on('source')}>
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Experience (years)</span>
            <input type="number" step="0.1" min="0" value={form.experienceYears} onChange={on('experienceYears')} />
          </label>
          <label className="field">
            <span>Current company</span>
            <input value={form.currentCompany} onChange={on('currentCompany')} />
          </label>
          <label className="field">
            <span>Current title</span>
            <input value={form.currentTitle} onChange={on('currentTitle')} />
          </label>
          <label className="field">
            <span>Expected CTC</span>
            <input type="number" min="0" value={form.expectedCtc} onChange={on('expectedCtc')} />
          </label>
          <label className="field">
            <span>Notice (days)</span>
            <input type="number" min="0" value={form.noticeDays} onChange={on('noticeDays')} />
          </label>
          <label className="field field-span-2">
            <span>Notes</span>
            <textarea rows={3} value={form.notes} onChange={on('notes')} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment/candidates')}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save candidate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('NEW');
  const [notes, setNotes] = useState('');
  const [interview, setInterview] = useState({
    roundNo: '1',
    interviewType: 'TECHNICAL',
    scheduledAt: localDateTimeValue(),
    durationMinutes: '60',
    mode: 'VIDEO',
    locationOrLink: '',
    interviewer: '',
  });
  const [offer, setOffer] = useState({
    offeredCtc: '',
    joiningOn: todayIso(),
    validUntil: '',
    notes: '',
  });
  const onInterview = setField(setInterview);
  const onOffer = setField(setOffer);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/hr/recruitment/candidates/${id}`);
      setRow(data);
      setStatus(data.status || 'NEW');
      setNotes(data.notes || '');
    } catch (err) {
      setError(extractError(err));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateStatus() {
    setBusy('status');
    setError('');
    try {
      await api(`/api/hr/recruitment/candidates/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function uploadResume(file) {
    if (!file) return;
    setBusy('upload');
    setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      setRow(await api(`/api/hr/recruitment/candidates/${id}/resumes`, { method: 'POST', body: data }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function downloadResume(resume) {
    const response = await fetch(`/api/hr/recruitment/candidates/${id}/resumes/${resume.id}`, { credentials: 'include' });
    if (!response.ok) {
      setError('Could not download that resume');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resume.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function scheduleInterview() {
    setBusy('interview');
    setError('');
    try {
      await api('/api/hr/recruitment/interviews', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: id,
          roundNo: Number(interview.roundNo) || 1,
          interviewType: interview.interviewType,
          scheduledAt: toOffsetIso(interview.scheduledAt),
          durationMinutes: Number(interview.durationMinutes) || 60,
          mode: interview.mode,
          locationOrLink: interview.locationOrLink.trim() || null,
          interviewer: interview.interviewer.trim() || null,
        }),
      });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function createOffer(send) {
    setBusy(send ? 'sendOffer' : 'offer');
    setError('');
    try {
      const created = await api('/api/hr/recruitment/offers', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: id,
          offeredCtc: Number(offer.offeredCtc),
          joiningOn: offer.joiningOn || null,
          validUntil: offer.validUntil || null,
          notes: offer.notes.trim() || null,
          send,
        }),
      });
      navigate(`/hr/recruitment/offers/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading candidate…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.candidateNumber}</span> · {row.displayName}
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.openingTitle} ({row.openingNumber}) · {recruitmentSourceLabel(row.source)}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input readOnly value={row.email || ''} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input readOnly value={row.phone || '—'} />
          </label>
          <label className="field">
            <span>Experience</span>
            <input readOnly value={row.experienceYears != null ? `${row.experienceYears} years` : '—'} />
          </label>
          <label className="field">
            <span>Expected CTC</span>
            <input readOnly value={formatMoney(row.expectedCtc)} />
          </label>
          <label className="field">
            <span>Current role</span>
            <input readOnly value={[row.currentTitle, row.currentCompany].filter(Boolean).join(' @ ') || '—'} />
          </label>
          <label className="field">
            <span>Notice</span>
            <input readOnly value={row.noticeDays != null ? `${row.noticeDays} days` : '—'} />
          </label>
        </div>

        <h3 className="section-title" style={{ marginTop: 24 }}>
          Pipeline status
        </h3>
        <div className="form-grid">
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {CANDIDATE_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field field-span-2">
            <span>Notes</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={updateStatus}>
            {busy === 'status' ? 'Updating…' : 'Update status'}
          </button>
        </div>

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Resumes
        </h3>
        <div className="toolbar-actions" style={{ marginBottom: 12 }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            {busy === 'upload' ? 'Uploading…' : 'Upload resume'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              hidden
              disabled={Boolean(busy)}
              onChange={(e) => {
                uploadResume(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <DataTable
          rows={row.resumes || []}
          emptyTitle="No resume attached"
          emptyDescription="Upload PDF or Word resume (max 10 MB)."
          columns={[
            { key: 'fileName', header: 'File' },
            { key: 'uploadedBy', header: 'By', render: (r) => r.uploadedBy || '—' },
            { key: 'uploadedAt', header: 'Uploaded', render: (r) => formatDateTime(r.uploadedAt) },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <button className="btn btn-ghost" type="button" onClick={(e) => { e.stopPropagation(); downloadResume(r); }}>
                  Download
                </button>
              ),
            },
          ]}
        />

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Schedule interview
        </h3>
        <div className="form-grid">
          <label className="field">
            <span>Round</span>
            <input type="number" min="1" value={interview.roundNo} onChange={onInterview('roundNo')} />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={interview.interviewType} onChange={onInterview('interviewType')}>
              {INTERVIEW_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>When</span>
            <input type="datetime-local" value={interview.scheduledAt} onChange={onInterview('scheduledAt')} />
          </label>
          <label className="field">
            <span>Duration (min)</span>
            <input type="number" min="15" step="15" value={interview.durationMinutes} onChange={onInterview('durationMinutes')} />
          </label>
          <label className="field">
            <span>Mode</span>
            <select value={interview.mode} onChange={onInterview('mode')}>
              {INTERVIEW_MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Interviewer</span>
            <input value={interview.interviewer} onChange={onInterview('interviewer')} />
          </label>
          <label className="field field-span-2">
            <span>Location / link</span>
            <input value={interview.locationOrLink} onChange={onInterview('locationOrLink')} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={scheduleInterview}>
            {busy === 'interview' ? 'Scheduling…' : 'Schedule interview'}
          </button>
        </div>

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Interviews
        </h3>
        <DataTable
          rows={row.interviews || []}
          emptyTitle="No interviews yet"
          emptyDescription="Schedule the first round above."
          columns={[
            { key: 'roundNo', header: 'Round' },
            { key: 'interviewType', header: 'Type', render: (r) => interviewTypeLabel(r.interviewType) },
            { key: 'scheduledAt', header: 'When', render: (r) => formatDateTime(r.scheduledAt) },
            { key: 'mode', header: 'Mode', render: (r) => interviewModeLabel(r.mode) },
            { key: 'interviewer', header: 'Interviewer', render: (r) => r.interviewer || '—' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          ]}
        />

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Create offer
        </h3>
        <div className="form-grid">
          <label className="field">
            <span>Offered CTC</span>
            <input type="number" min="1" value={offer.offeredCtc} onChange={onOffer('offeredCtc')} />
          </label>
          <label className="field">
            <span>Joining date</span>
            <input type="date" value={offer.joiningOn} onChange={onOffer('joiningOn')} />
          </label>
          <label className="field">
            <span>Valid until</span>
            <input type="date" value={offer.validUntil} onChange={onOffer('validUntil')} />
          </label>
          <label className="field field-span-2">
            <span>Notes</span>
            <textarea rows={2} value={offer.notes} onChange={onOffer('notes')} />
          </label>
        </div>
        <div className="toolbar-actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => createOffer(false)}>
            {busy === 'offer' ? 'Saving…' : 'Save draft offer'}
          </button>
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => createOffer(true)}>
            {busy === 'sendOffer' ? 'Sending…' : 'Create & send offer'}
          </button>
        </div>

        <h3 className="section-title" style={{ marginTop: 28 }}>
          Offers
        </h3>
        <DataTable
          rows={row.offers || []}
          emptyTitle="No offers yet"
          emptyDescription="Create an offer when the candidate clears interviews."
          onRowClick={(o) => navigate(`/hr/recruitment/offers/${o.id}`)}
          columns={[
            { key: 'offerNumber', header: 'Offer', render: (o) => <span className="mono">{o.offerNumber}</span> },
            { key: 'offeredCtc', header: 'CTC', render: (o) => formatMoney(o.offeredCtc) },
            { key: 'joiningOn', header: 'Join', render: (o) => formatDate(o.joiningOn) },
            { key: 'status', header: 'Status', render: (o) => <StatusBadge value={o.status} /> },
          ]}
        />

        <div className="toolbar-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment/candidates')}>
            Back to candidates
          </button>
        </div>
      </div>
    </div>
  );
}

export function InterviewsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [when, setWhen] = useState('upcoming');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ id: '', feedback: '', rating: '4' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const q = when ? `?when=${encodeURIComponent(when)}` : '';
      setRows(await api(`/api/hr/recruitment/interviews${q}`));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [when]);

  async function complete() {
    if (!feedback.id) return;
    setBusy('complete');
    setError('');
    try {
      await api(`/api/hr/recruitment/interviews/${feedback.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          feedback: feedback.feedback.trim() || null,
          rating: feedback.rating === '' ? null : Number(feedback.rating),
        }),
      });
      setFeedback({ id: '', feedback: '', rating: '4' });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function cancel(id) {
    setBusy(id);
    setError('');
    try {
      await api(`/api/hr/recruitment/interviews/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions">
          <select value={when} onChange={(e) => setWhen(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="today">Today</option>
            <option value="">All</option>
          </select>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Complete rounds with rating and feedback, or cancel if the slot slips.
        </p>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <DataTable
        rows={rows}
        loading={loading}
        onRetry={load}
        emptyTitle="No interviews in this view"
        emptyDescription="Schedule interviews from a candidate profile."
        columns={[
          {
            key: 'candidateName',
            header: 'Candidate',
            render: (row) => (
              <button
                type="button"
                className="linkish"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                onClick={() => navigate(`/hr/recruitment/candidates/${row.candidateId}`)}
              >
                <PersonCell primary={row.candidateName} secondary={row.candidateNumber} />
              </button>
            ),
          },
          { key: 'openingTitle', header: 'Opening', render: (row) => row.openingTitle || '—' },
          { key: 'roundNo', header: 'Rnd' },
          { key: 'interviewType', header: 'Type', render: (row) => interviewTypeLabel(row.interviewType) },
          { key: 'scheduledAt', header: 'When', render: (row) => formatDateTime(row.scheduledAt) },
          { key: 'mode', header: 'Mode', render: (row) => interviewModeLabel(row.mode) },
          { key: 'interviewer', header: 'Interviewer', render: (row) => row.interviewer || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          {
            key: 'actions',
            header: '',
            render: (row) =>
              row.status === 'SCHEDULED' ? (
                <div className="toolbar-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setFeedback({ id: row.id, feedback: '', rating: '4' })}
                  >
                    Complete
                  </button>
                  <button className="btn btn-ghost" type="button" disabled={busy === row.id} onClick={() => cancel(row.id)}>
                    Cancel
                  </button>
                </div>
              ) : (
                row.rating != null ? `${row.rating}/5` : '—'
              ),
          },
        ]}
      />
      {feedback.id ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-pad">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Complete interview
            </h3>
            <div className="form-grid">
              <label className="field">
                <span>Rating (1–5)</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={feedback.rating}
                  onChange={(e) => setFeedback((p) => ({ ...p, rating: e.target.value }))}
                />
              </label>
              <label className="field field-span-2">
                <span>Feedback</span>
                <textarea
                  rows={3}
                  value={feedback.feedback}
                  onChange={(e) => setFeedback((p) => ({ ...p, feedback: e.target.value }))}
                />
              </label>
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setFeedback({ id: '', feedback: '', rating: '4' })}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={complete}>
                {busy === 'complete' ? 'Saving…' : 'Mark completed'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function OffersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api('/api/hr/recruitment/offers'));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DataTable
      rows={rows}
      loading={loading}
      error={error}
      onRetry={load}
      emptyTitle="No offers yet"
      emptyDescription="Create offers from a candidate who has cleared interviews."
      onRowClick={(row) => navigate(`/hr/recruitment/offers/${row.id}`)}
      columns={[
        { key: 'offerNumber', header: 'Offer', render: (row) => <span className="mono">{row.offerNumber}</span> },
        {
          key: 'candidateName',
          header: 'Candidate',
          render: (row) => <PersonCell primary={row.candidateName} secondary={row.candidateNumber} />,
        },
        { key: 'openingTitle', header: 'Opening', render: (row) => row.openingTitle || '—' },
        { key: 'offeredCtc', header: 'CTC', render: (row) => formatMoney(row.offeredCtc) },
        { key: 'joiningOn', header: 'Join', render: (row) => formatDate(row.joiningOn) },
        { key: 'validUntil', header: 'Valid until', render: (row) => formatDate(row.validUntil) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
      ]}
    />
  );
}

export function OfferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/hr/recruitment/offers/${id}`);
      setRow(data);
      setNote(data.decisionNote || '');
    } catch (err) {
      setError(extractError(err));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function post(path, label) {
    setBusy(label);
    setError('');
    try {
      setRow(
        await api(`/api/hr/recruitment/offers/${id}${path}`, {
          method: 'POST',
          body: JSON.stringify({ note }),
        })
      );
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading offer…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.offerNumber}</span>
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.candidateName} · {row.openingTitle}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Offered CTC</span>
            <input readOnly value={formatMoney(row.offeredCtc)} />
          </label>
          <label className="field">
            <span>Joining date</span>
            <input readOnly value={formatDate(row.joiningOn)} />
          </label>
          <label className="field">
            <span>Valid until</span>
            <input readOnly value={formatDate(row.validUntil)} />
          </label>
          <label className="field">
            <span>Created</span>
            <input readOnly value={formatDateTime(row.createdAt)} />
          </label>
          <label className="field field-span-2">
            <span>Notes</span>
            <textarea readOnly rows={2} value={row.notes || ''} />
          </label>
        </div>
        {(row.status === 'DRAFT' || row.status === 'SENT') && (
          <label className="field" style={{ display: 'block', marginTop: 12 }}>
            <span>Decision note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        )}
        <div className="toolbar-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/recruitment/offers')}>
            Back
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => navigate(`/hr/recruitment/candidates/${row.candidateId}`)}
          >
            Open candidate
          </button>
          {row.status === 'DRAFT' ? (
            <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/send', 'send')}>
              {busy === 'send' ? 'Sending…' : 'Send offer'}
            </button>
          ) : null}
          {row.status === 'SENT' ? (
            <>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/accept', 'accept')}>
                {busy === 'accept' ? 'Saving…' : 'Mark accepted'}
              </button>
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/decline', 'decline')}>
                {busy === 'decline' ? 'Saving…' : 'Mark declined'}
              </button>
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/withdraw', 'withdraw')}>
                {busy === 'withdraw' ? 'Saving…' : 'Withdraw'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
