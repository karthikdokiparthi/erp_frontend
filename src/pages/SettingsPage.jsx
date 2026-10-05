import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';

const ALL_LEAVE_TYPES = [
  ['CASUAL', 'Casual (CL)'],
  ['SICK', 'Sick (SL)'],
  ['EARNED', 'Earned (EL)'],
  ['UNPAID', 'Unpaid (LWP)'],
  ['ML', 'Maternity (ML)'],
  ['PL', 'Paternity (PL)'],
];

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow="Settings"
        description="Super Admin only. Company profile and ERP workflow live here. Users, roles, and passwords stay in CCIDP."
      />
      <div className="page-tabs" role="tablist" aria-label="Settings">
        <NavLink to="/hr/settings" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Company
        </NavLink>
        <NavLink to="/hr/settings/users" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Users
        </NavLink>
        <NavLink to="/hr/settings/roles" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Roles
        </NavLink>
        <NavLink to="/hr/settings/workflow" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Workflow
        </NavLink>
        <NavLink
          to="/hr/settings/notifications"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Notifications
        </NavLink>
        <NavLink to="/hr/settings/system" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          System
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

function useSettingsResource(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api(path));
    } catch (err) {
      setData(null);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  async function save(body) {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      setData(await api(path, { method: 'PUT', body: JSON.stringify(body) }));
      setSaved(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return { data, setData, error, loading, saving, saved, load, save };
}

export function CompanySettingsPage() {
  const { data, setData, error, loading, saving, saved, load, save } = useSettingsResource('/api/hr/settings/company');

  function update(field, value) {
    setData((current) => ({ ...current, [field]: value }));
  }

  if (loading && !data) {
    return <p className="muted">Loading company profile…</p>;
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="muted">Saved.</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(data);
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Legal name</span>
              <input required value={data?.legalName || ''} onChange={(event) => update('legalName', event.target.value)} />
            </label>
            <label className="field">
              <span>Trade name</span>
              <input required value={data?.tradeName || ''} onChange={(event) => update('tradeName', event.target.value)} />
            </label>
            <label className="field">
              <span>GSTIN</span>
              <input value={data?.gstin || ''} onChange={(event) => update('gstin', event.target.value)} />
            </label>
            <label className="field">
              <span>PAN</span>
              <input value={data?.pan || ''} onChange={(event) => update('pan', event.target.value)} />
            </label>
            <label className="field">
              <span>CIN</span>
              <input value={data?.cin || ''} onChange={(event) => update('cin', event.target.value)} />
            </label>
            <label className="field">
              <span>Website</span>
              <input value={data?.website || ''} onChange={(event) => update('website', event.target.value)} />
            </label>
            <label className="field span-2">
              <span>Address</span>
              <input value={data?.addressLine || ''} onChange={(event) => update('addressLine', event.target.value)} />
            </label>
            <label className="field">
              <span>City</span>
              <input value={data?.city || ''} onChange={(event) => update('city', event.target.value)} />
            </label>
            <label className="field">
              <span>State</span>
              <input value={data?.stateName || ''} onChange={(event) => update('stateName', event.target.value)} />
            </label>
            <label className="field">
              <span>PIN</span>
              <input value={data?.pincode || ''} onChange={(event) => update('pincode', event.target.value)} />
            </label>
            <label className="field">
              <span>Country</span>
              <input value={data?.country || ''} onChange={(event) => update('country', event.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={data?.phone || ''} onChange={(event) => update('phone', event.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={data?.email || ''} onChange={(event) => update('email', event.target.value)} />
            </label>
            <label className="field span-2">
              <span>Applies to</span>
              <input value={data?.appliesTo || ''} onChange={(event) => update('appliesTo', event.target.value)} />
            </label>
            <label className="field">
              <span>HR contact</span>
              <input value={data?.hrContactName || ''} onChange={(event) => update('hrContactName', event.target.value)} />
            </label>
            <label className="field">
              <span>HR title</span>
              <input value={data?.hrContactTitle || ''} onChange={(event) => update('hrContactTitle', event.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save company'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SettingsUsersPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows((await api('/api/hr/settings/users')) || []);
    } catch (err) {
      setRows([]);
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.displayName} ${row.username} ${row.email} ${(row.roles || []).join(' ')}`.toLowerCase().includes(needle)
    );
  }, [rows, needle]);

  return (
    <div className="panel">
      <div className="panel-pad" style={{ paddingBottom: 0 }}>
        <div className="list-toolbar list-toolbar-split">
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>
            CCIDP users
          </h2>
          <label className="field" style={{ marginBottom: 0, minWidth: 240 }}>
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, username, role" />
          </label>
        </div>
        <p className="muted">Logins and passwords are in CCIDP at :8080. ERP only reads this directory.</p>
      </div>
      <DataTable
        rows={filtered}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No CCIDP users"
        emptyDescription="Sign-in users appear after they exist in the CCIDP users table."
        columns={[
          {
            key: 'displayName',
            header: 'Name',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.displayName}</div>
                <div className="secondary">{row.email}</div>
              </div>
            ),
          },
          { key: 'username', header: 'Username', render: (row) => <span className="mono">{row.username}</span> },
          { key: 'accountType', header: 'Account' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          {
            key: 'roles',
            header: 'CCIDP roles',
            render: (row) => (row.roles?.length ? row.roles.join(', ') : '—'),
          },
        ]}
      />
    </div>
  );
}

export function SettingsRolesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api('/api/hr/settings/roles'));
    } catch (err) {
      setData(null);
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
      {error ? <p className="form-error">{error}</p> : null}
      <p className="muted">{data?.note}</p>
      <div className="panel">
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            How ERP uses CCIDP
          </h2>
        </div>
        <DataTable
          rows={data?.erpUsage || []}
          rowKey="name"
          loading={loading}
          emptyTitle="No ERP role map"
          columns={[
            { key: 'name', header: 'Name', render: (row) => <span className="mono">{row.name}</span> },
            { key: 'kind', header: 'Kind' },
            { key: 'usedFor', header: 'Used for' },
          ]}
        />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            CCIDP roles
          </h2>
        </div>
        <DataTable
          rows={data?.roles || []}
          rowKey="name"
          loading={loading}
          onRetry={load}
          emptyTitle="No roles in CCIDP"
          emptyDescription="public.roles is empty or not readable."
          columns={[
            { key: 'name', header: 'Role', render: (row) => <span className="mono">{row.name}</span> },
            { key: 'description', header: 'Description', render: (row) => row.description || '—' },
          ]}
        />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            CCIDP permissions
          </h2>
        </div>
        <DataTable
          rows={data?.permissions || []}
          rowKey="name"
          loading={loading}
          emptyTitle="No permissions in CCIDP"
          columns={[
            { key: 'name', header: 'Permission', render: (row) => <span className="mono">{row.name}</span> },
            { key: 'description', header: 'Description', render: (row) => row.description || '—' },
          ]}
        />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Role → permission
          </h2>
        </div>
        <DataTable
          rows={(data?.assignments || []).map((row) => ({ ...row, id: `${row.role}:${row.permission}` }))}
          loading={loading}
          emptyTitle="No role-permission links"
          columns={[
            { key: 'role', header: 'Role' },
            { key: 'permission', header: 'Permission' },
          ]}
        />
      </div>
    </>
  );
}

export function SettingsWorkflowPage() {
  const { data, setData, error, loading, saving, saved, load, save } = useSettingsResource('/api/hr/settings/workflow');
  const selected = new Set(data?.leaveTypes || []);

  function toggleType(type) {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setData((current) => ({ ...current, leaveTypes: [...next] }));
  }

  return (
    <div className="panel">
      <div className="panel-pad">
        {loading && !data ? <p className="muted">Loading workflow…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="muted">Saved. New leave requests use these types.</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save({
              leaveTypes: (data?.leaveTypes || []).join(','),
              leaveRequiresRecipient: Boolean(data?.leaveRequiresRecipient),
              leaveApproverMustDiffer: Boolean(data?.leaveApproverMustDiffer),
              exitNoticeDays: Number(data?.exitNoticeDays || 0),
              exitRequiresHr: Boolean(data?.exitRequiresHr),
            });
          }}
        >
          <p className="muted">Leave types offered on Apply leave.</p>
          <div className="form-grid">
            {ALL_LEAVE_TYPES.map(([value, label]) => (
              <label key={value} className="field">
                <span>
                  <input type="checkbox" checked={selected.has(value)} onChange={() => toggleType(value)} /> {label}
                </span>
              </label>
            ))}
            <label className="field span-2">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(data?.leaveRequiresRecipient)}
                  onChange={(event) => setData((current) => ({ ...current, leaveRequiresRecipient: event.target.checked }))}
                />{' '}
                Leave request must be sent to a reviewer
              </span>
            </label>
            <label className="field span-2">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(data?.leaveApproverMustDiffer)}
                  onChange={(event) =>
                    setData((current) => ({ ...current, leaveApproverMustDiffer: event.target.checked }))
                  }
                />{' '}
                Reviewer cannot be the applicant
              </span>
            </label>
            <label className="field">
              <span>Default exit notice (days)</span>
              <input
                type="number"
                min={0}
                max={365}
                value={data?.exitNoticeDays ?? 30}
                onChange={(event) => setData((current) => ({ ...current, exitNoticeDays: Number(event.target.value) }))}
              />
            </label>
            <label className="field">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(data?.exitRequiresHr)}
                  onChange={(event) => setData((current) => ({ ...current, exitRequiresHr: event.target.checked }))}
                />{' '}
                Exit still needs HR after the reviewer
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save workflow'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={load}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SettingsNotificationsPage() {
  const { data, setData, error, loading, saving, saved, load, save } = useSettingsResource(
    '/api/hr/settings/notifications'
  );

  return (
    <div className="panel">
      <div className="panel-pad">
        {loading && !data ? <p className="muted">Loading notification settings…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="muted">Saved. The bell uses this refresh interval after reload.</p> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save({
              notifyOnApply: Boolean(data?.notifyOnApply),
              notifyOnDecision: Boolean(data?.notifyOnDecision),
              bellPollSeconds: Number(data?.bellPollSeconds || 20),
            });
          }}
        >
          <p className="muted">In-app leave bell only. ERP does not send email yet.</p>
          <div className="form-grid">
            <label className="field span-2">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(data?.notifyOnApply)}
                  onChange={(event) => setData((current) => ({ ...current, notifyOnApply: event.target.checked }))}
                />{' '}
                Notify the reviewer when leave is applied
              </span>
            </label>
            <label className="field span-2">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(data?.notifyOnDecision)}
                  onChange={(event) => setData((current) => ({ ...current, notifyOnDecision: event.target.checked }))}
                />{' '}
                Notify the applicant when leave is approved or rejected
              </span>
            </label>
            <label className="field">
              <span>Bell refresh (seconds)</span>
              <input
                type="number"
                min={5}
                max={300}
                value={data?.bellPollSeconds ?? 20}
                onChange={(event) => setData((current) => ({ ...current, bellPollSeconds: Number(event.target.value) }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save notifications'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={load}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SettingsSystemPage() {
  const { data, setData, error, loading, saving, saved, load, save } = useSettingsResource('/api/hr/settings/system');

  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="panel">
        <div className="panel-pad">
          {loading && !data ? <p className="muted">Loading system configuration…</p> : null}
          {saved ? <p className="muted">Saved environment label and timezone.</p> : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save({ environmentLabel: data?.environmentLabel, timezone: data?.timezone });
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Environment label</span>
                <input
                  value={data?.environmentLabel || ''}
                  onChange={(event) => setData((current) => ({ ...current, environmentLabel: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Timezone</span>
                <input
                  value={data?.timezone || ''}
                  onChange={(event) => setData((current) => ({ ...current, timezone: event.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={load}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Runtime (application.yml)
          </h2>
          <p className="muted">These values are not edited here. Change the server config and restart the API.</p>
          <div className="form-grid">
            <label className="field">
              <span>CCIDP issuer</span>
              <input readOnly value={data?.oauth?.issuer || ''} />
            </label>
            <label className="field">
              <span>OAuth client</span>
              <input readOnly value={data?.oauth?.clientId || ''} />
            </label>
            <label className="field span-2">
              <span>Redirect URI</span>
              <input readOnly value={data?.oauth?.redirectUri || ''} />
            </label>
            <label className="field">
              <span>API port</span>
              <input readOnly value={data?.apiPort ?? ''} />
            </label>
            <label className="field">
              <span>Session cookie</span>
              <input readOnly value={data?.sessionCookie || ''} />
            </label>
            <label className="field">
              <span>Attendance provider</span>
              <input
                readOnly
                value={
                  data?.attendance?.provider === 'mock'
                    ? 'mock (sample punches — not biometric)'
                    : data?.attendance?.provider
                      ? data.attendance.provider + ' (live TWAPI)'
                      : ''
                }
              />
            </label>
            <label className="field">
              <span>Device</span>
              <input
                readOnly
                value={
                  data?.attendance
                    ? `${data.attendance.deviceName} · ${data.attendance.host}:${data.attendance.port}`
                    : ''
                }
              />
            </label>
            <label className="field">
              <span>Attendance zone</span>
              <input readOnly value={data?.attendance?.zone || ''} />
            </label>
            <label className="field">
              <span>Sync interval (ms)</span>
              <input readOnly value={data?.attendance?.syncIntervalMs ?? ''} />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
