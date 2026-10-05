import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { directoryLabel, formatDate } from '../utils/format';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function PersonCell({ primary, secondary }) {
  return (
    <div className="cell-stack">
      <div className="primary">{primary}</div>
      {secondary ? <div className="secondary">{secondary}</div> : null}
    </div>
  );
}

function setField(setter) {
  return (key) => (event) => setter((prev) => ({ ...prev, [key]: event.target.value }));
}

function useLoad(path) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api(path));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return { rows, error, loading, load, setRows };
}

export function OrganizationPage() {
  return (
    <>
      <PageHeader
        title="Organization"
        eyebrow="Organization"
        description="Department, designation, branch, and location masters. Assign managers, and process transfers and promotions with HR approval."
      />
      <div className="page-tabs" role="tablist" aria-label="Organization">
        <NavLink to="/hr/organization" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          Department Master
        </NavLink>
        <NavLink
          to="/hr/organization/designations"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Designation Master
        </NavLink>
        <NavLink
          to="/hr/organization/branches"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Branches
        </NavLink>
        <NavLink
          to="/hr/organization/locations"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Locations
        </NavLink>
        <NavLink
          to="/hr/organization/reporting"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Reporting
        </NavLink>
        <NavLink
          to="/hr/organization/transfers"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Transfers
        </NavLink>
        <NavLink
          to="/hr/organization/promotions"
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Promotions
        </NavLink>
      </div>
      <Outlet />
    </>
  );
}

function DashboardStrip() {
  const [dash, setDash] = useState(null);
  useEffect(() => {
    api('/api/hr/organization/dashboard').then(setDash).catch(() => setDash(null));
  }, []);
  return (
    <div className="kpi-grid kpi-grid-6" style={{ marginBottom: 16 }}>
      <KpiCard label="Departments" value={dash?.departments} />
      <KpiCard label="Designations" value={dash?.designations} />
      <KpiCard label="Branches" value={dash?.branches} />
      <KpiCard label="Locations" value={dash?.locations} />
      <KpiCard label="With manager" value={dash?.withManager} hint={`${dash?.withoutManager ?? '—'} without manager`} />
      <KpiCard label="Pending HR" value={dash ? dash.pendingTransfers + dash.pendingPromotions : undefined} />
    </div>
  );
}

function MasterForm({ title, form, setForm, onSave, onCancel, busy, error, extraFields }) {
  const on = setField(setForm);
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Code</span>
            <input value={form.code} onChange={on('code')} placeholder="e.g. RND" />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={on('name')} />
          </label>
          {extraFields ? extraFields(form, on) : null}
          <label className="field field-span-2">
            <span>Description</span>
            <textarea rows={2} value={form.description} onChange={on('description')} />
          </label>
          {form.id ? (
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={on('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="toolbar-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onSave}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DepartmentsPage() {
  const { rows, error, loading, load } = useLoad('/api/hr/organization/departments?activeOnly=false');
  const { rows: people } = useLoad('/api/hr/organization/people');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.code, row.name, row.description, row.headPersonName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, search]);

  function openNew() {
    setForm({
      id: '',
      code: '',
      name: '',
      description: '',
      parentId: '',
      headPersonKey: '',
      status: 'ACTIVE',
    });
    setFormError('');
  }

  function openEdit(row) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      parentId: row.parentId || '',
      headPersonKey: row.headPersonId ? `${row.headPersonKind}:${row.headPersonId}` : '',
      status: row.status || 'ACTIVE',
    });
    setFormError('');
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      let headPersonKind = null;
      let headPersonId = null;
      if (form.headPersonKey) {
        const [kind, id] = form.headPersonKey.split(':');
        headPersonKind = kind;
        headPersonId = id;
      }
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        parentId: form.parentId || null,
        status: form.status,
        headPersonKind,
        headPersonId,
      };
      if (form.id) {
        await api(`/api/hr/organization/departments/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/hr/organization/departments', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row) {
    const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api(`/api/hr/organization/departments/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: row.code,
          name: row.name,
          description: row.description || null,
          parentId: row.parentId || null,
          status: next,
          headPersonKind: row.headPersonKind || null,
          headPersonId: row.headPersonId || null,
        }),
      });
      await load();
    } catch (err) {
      setFormError(extractError(err));
    }
  }

  return (
    <>
      <DashboardStrip />
      <div className="list-toolbar list-toolbar-split">
        <label className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <span>Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, name, head" />
        </label>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          Add department
        </button>
      </div>
      {formError && !form ? <p className="form-error">{formError}</p> : null}
      {form ? (
        <MasterForm
          title={form.id ? 'Edit department' : 'New department'}
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setForm(null)}
          busy={busy}
          error={formError}
          extraFields={(f, on) => (
            <>
              <label className="field">
                <span>Parent department</span>
                <select value={f.parentId} onChange={on('parentId')}>
                  <option value="">None</option>
                  {rows.filter((r) => r.id !== f.id).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Department head</span>
                <select value={f.headPersonKey} onChange={on('headPersonKey')}>
                  <option value="">None</option>
                  {people.map((p) => (
                    <option key={`${p.personKind}:${p.personId}`} value={`${p.personKind}:${p.personId}`}>
                      {p.displayName} · {p.employeeNumber}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        />
      ) : null}
      <DataTable
        rows={visible}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No departments"
        emptyDescription="Use Add department — HR can create any department; these are not fixed constants."
        onRowClick={openEdit}
        columns={[
          { key: 'code', header: 'Code', render: (row) => <span className="mono">{row.code}</span> },
          { key: 'name', header: 'Department', render: (row) => <PersonCell primary={row.name} secondary={row.parentName} /> },
          { key: 'headPersonName', header: 'Head', render: (row) => row.headPersonName || '—' },
          { key: 'peopleCount', header: 'People' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus(row);
                }}
              >
                {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            ),
          },
        ]}
      />
    </>
  );
}

export function DesignationsPage() {
  const { rows, error, loading, load } = useLoad('/api/hr/organization/designations');
  const { rows: departments } = useLoad('/api/hr/organization/departments?activeOnly=false');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (deptFilter && row.departmentId !== deptFilter) return false;
      if (!needle) return true;
      return [row.code, row.name, row.departmentName, row.displayLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, deptFilter]);

  function openNew() {
    setForm({
      id: '',
      code: '',
      name: '',
      description: '',
      parentId: deptFilter || '',
      gradeLevel: '',
      status: 'ACTIVE',
    });
    setFormError('');
  }

  function openEdit(row) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      parentId: row.departmentId || '',
      gradeLevel: row.gradeLevel != null ? String(row.gradeLevel) : '',
      status: row.status || 'ACTIVE',
    });
    setFormError('');
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        parentId: form.parentId || null,
        gradeLevel: form.gradeLevel === '' ? null : Number(form.gradeLevel),
        status: form.status,
      };
      if (form.id) {
        await api(`/api/hr/organization/designations/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/hr/organization/designations', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(row) {
    try {
      await api(`/api/hr/organization/designations/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: row.code,
          name: row.name,
          description: row.description || null,
          parentId: row.departmentId || null,
          gradeLevel: row.gradeLevel,
          status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }),
      });
      await load();
    } catch (err) {
      setFormError(extractError(err));
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <div className="toolbar-actions" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, name, department" />
          </label>
          <label className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <span>Department</span>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          Add designation
        </button>
      </div>
      {formError && !form ? <p className="form-error">{formError}</p> : null}
      {form ? (
        <MasterForm
          title={form.id ? 'Edit designation' : 'New designation'}
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setForm(null)}
          busy={busy}
          error={formError}
          extraFields={(f, on) => (
            <>
              <label className="field">
                <span>Department</span>
                <select value={f.parentId} onChange={on('parentId')} required>
                  <option value="">Select department</option>
                  {departments.filter((d) => d.status === 'ACTIVE' || d.id === f.parentId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Grade level</span>
                <input type="number" min="1" max="20" value={f.gradeLevel} onChange={on('gradeLevel')} />
              </label>
            </>
          )}
        />
      ) : null}
      <DataTable
        rows={visible}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No designations"
        emptyDescription="Use Add designation — link a job title to a department HR manages."
        onRowClick={openEdit}
        columns={[
          { key: 'code', header: 'Code', render: (row) => <span className="mono">{row.code}</span> },
          {
            key: 'name',
            header: 'Designation',
            render: (row) => <PersonCell primary={row.displayLabel || row.name} secondary={row.departmentName} />,
          },
          { key: 'gradeLevel', header: 'Grade', render: (row) => row.gradeLevel ?? '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStatus(row);
                }}
              >
                {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            ),
          },
        ]}
      />
    </>
  );
}

export function BranchesPage() {
  const { rows, error, loading, load } = useLoad('/api/hr/organization/branches');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function openNew() {
    setForm({ id: '', code: '', name: '', city: '', state: '', address: '', description: '', status: 'ACTIVE' });
    setFormError('');
  }

  function openEdit(row) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      city: row.city || '',
      state: row.state || '',
      address: row.address || '',
      description: '',
      status: row.status || 'ACTIVE',
    });
    setFormError('');
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
        status: form.status,
      };
      if (form.id) {
        await api(`/api/hr/organization/branches/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/hr/organization/branches', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <p className="muted" style={{ margin: 0 }}>
          Branches group locations and transfer destinations.
        </p>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          Add branch
        </button>
      </div>
      {form ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              {form.id ? 'Edit branch' : 'New branch'}
            </h2>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="form-grid">
              <label className="field">
                <span>Code</span>
                <input value={form.code} onChange={setField(setForm)('code')} />
              </label>
              <label className="field">
                <span>Name</span>
                <input value={form.name} onChange={setField(setForm)('name')} />
              </label>
              <label className="field">
                <span>City</span>
                <input value={form.city} onChange={setField(setForm)('city')} />
              </label>
              <label className="field">
                <span>State</span>
                <input value={form.state} onChange={setField(setForm)('state')} />
              </label>
              <label className="field field-span-2">
                <span>Address</span>
                <textarea rows={2} value={form.address} onChange={setField(setForm)('address')} />
              </label>
              {form.id ? (
                <label className="field">
                  <span>Status</span>
                  <select value={form.status} onChange={setField(setForm)('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No branches"
        emptyDescription="Add head office and plant branches."
        onRowClick={openEdit}
        columns={[
          { key: 'code', header: 'Code', render: (row) => <span className="mono">{row.code}</span> },
          { key: 'name', header: 'Branch', render: (row) => <PersonCell primary={row.name} secondary={[row.city, row.state].filter(Boolean).join(', ')} /> },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function LocationsPage() {
  const { rows, error, loading, load } = useLoad('/api/hr/organization/locations');
  const { rows: branches } = useLoad('/api/hr/organization/branches');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function openNew() {
    setForm({ id: '', code: '', name: '', branchId: branches[0]?.id || '', address: '', status: 'ACTIVE' });
    setFormError('');
  }

  function openEdit(row) {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      branchId: row.branchId || '',
      address: row.address || '',
      status: row.status || 'ACTIVE',
    });
    setFormError('');
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        branchId: form.branchId || null,
        address: form.address.trim() || null,
        status: form.status,
      };
      if (form.id) {
        await api(`/api/hr/organization/locations/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/hr/organization/locations', { method: 'POST', body: JSON.stringify(body) });
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <p className="muted" style={{ margin: 0 }}>
          Locations sit under branches — used for transfers and asset placement.
        </p>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          Add location
        </button>
      </div>
      {form ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              {form.id ? 'Edit location' : 'New location'}
            </h2>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="form-grid">
              <label className="field">
                <span>Code</span>
                <input value={form.code} onChange={setField(setForm)('code')} />
              </label>
              <label className="field">
                <span>Name</span>
                <input value={form.name} onChange={setField(setForm)('name')} />
              </label>
              <label className="field">
                <span>Branch</span>
                <select value={form.branchId} onChange={setField(setForm)('branchId')}>
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-span-2">
                <span>Address</span>
                <textarea rows={2} value={form.address} onChange={setField(setForm)('address')} />
              </label>
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No locations"
        emptyDescription="Add floor or site locations under a branch."
        onRowClick={openEdit}
        columns={[
          { key: 'code', header: 'Code', render: (row) => <span className="mono">{row.code}</span> },
          { key: 'name', header: 'Location', render: (row) => <PersonCell primary={row.name} secondary={row.branchName} /> },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function ReportingPage() {
  const { rows, error, loading, load } = useLoad('/api/hr/organization/reporting');
  const { rows: people } = useLoad('/api/hr/organization/people');
  const [form, setForm] = useState({ personKey: '', managerKey: '', effectiveFrom: todayIso(), notes: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const options = useMemo(
    () =>
      people.map((p) => ({
        key: `${p.personKind}:${p.personId}`,
        label: `${p.employeeNumber} · ${p.displayName} (${directoryLabel(p.personKind)})`,
        kind: p.personKind,
        id: p.personId,
      })),
    [people]
  );

  function pick(key) {
    const match = options.find((o) => o.key === key);
    return match ? { personKind: match.kind, personId: match.id } : null;
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      const person = pick(form.personKey);
      const manager = pick(form.managerKey);
      if (!person || !manager) {
        setFormError('Choose both employee and manager');
        return;
      }
      await api('/api/hr/organization/reporting', {
        method: 'POST',
        body: JSON.stringify({
          personKind: person.personKind,
          personId: person.personId,
          managerKind: manager.personKind,
          managerId: manager.personId,
          effectiveFrom: form.effectiveFrom,
          notes: form.notes.trim() || null,
        }),
      });
      setForm({ personKey: '', managerKey: '', effectiveFrom: todayIso(), notes: '' });
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await api(`/api/hr/organization/reporting/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Assign manager
          </h2>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="form-grid">
            <label className="field">
              <span>Employee</span>
              <select value={form.personKey} onChange={setField(setForm)('personKey')}>
                <option value="">Select person</option>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reports to</span>
              <select value={form.managerKey} onChange={setField(setForm)('managerKey')}>
                <option value="">Select manager</option>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Effective from</span>
              <input type="date" value={form.effectiveFrom} onChange={setField(setForm)('effectiveFrom')} />
            </label>
            <label className="field">
              <span>Notes</span>
              <input value={form.notes} onChange={setField(setForm)('notes')} />
            </label>
          </div>
          <div className="toolbar-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save reporting line'}
            </button>
          </div>
        </div>
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No reporting lines"
        emptyDescription="Assign who reports to whom."
        columns={[
          {
            key: 'personName',
            header: 'Employee',
            render: (row) => <PersonCell primary={row.personName} secondary={`${row.personNumber} · ${row.department}`} />,
          },
          {
            key: 'managerName',
            header: 'Manager',
            render: (row) => <PersonCell primary={row.managerName} secondary={row.managerNumber} />,
          },
          { key: 'effectiveFrom', header: 'From', render: (row) => formatDate(row.effectiveFrom) },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => remove(row.id)}>
                Remove
              </button>
            ),
          },
        ]}
      />
    </>
  );
}

function personOptions(people) {
  return people.map((p) => ({
    key: `${p.personKind}:${p.personId}`,
    label: `${p.employeeNumber} · ${p.displayName}`,
    kind: p.personKind,
    id: p.personId,
    department: p.department,
    title: p.title,
  }));
}

export function TransfersPage() {
  const navigate = useNavigate();
  const { rows, error, loading, load } = useLoad('/api/hr/organization/transfers');
  const { rows: people } = useLoad('/api/hr/organization/people');
  const { rows: departments } = useLoad('/api/hr/organization/departments');
  const { rows: branches } = useLoad('/api/hr/organization/branches');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ personKey: '', toDepartment: '', toBranchId: '', toTitle: '', effectiveOn: todayIso(), reason: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const options = useMemo(() => personOptions(people), [people]);

  async function create(submit) {
    setBusy(true);
    setFormError('');
    try {
      const person = options.find((o) => o.key === form.personKey);
      if (!person) {
        setFormError('Choose an employee');
        return;
      }
      const created = await api('/api/hr/organization/transfers', {
        method: 'POST',
        body: JSON.stringify({
          personKind: person.kind,
          personId: person.id,
          toDepartment: form.toDepartment.trim(),
          toBranchId: form.toBranchId || null,
          toTitle: form.toTitle.trim() || null,
          effectiveOn: form.effectiveOn,
          reason: form.reason.trim() || null,
          submit,
        }),
      });
      setShowForm(false);
      navigate(`/hr/organization/transfers/${created.id}`);
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <p className="muted" style={{ margin: 0 }}>
          Transfer department, branch, or title. HR approval updates the person record.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
          New transfer
        </button>
      </div>
      {showForm ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              New transfer
            </h2>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="form-grid">
              <label className="field field-span-2">
                <span>Employee</span>
                <select value={form.personKey} onChange={setField(setForm)('personKey')}>
                  <option value="">Select person</option>
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label} · {o.department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>To department</span>
                <select value={form.toDepartment} onChange={setField(setForm)('toDepartment')}>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>To branch</span>
                <select value={form.toBranchId} onChange={setField(setForm)('toBranchId')}>
                  <option value="">Optional</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>New title</span>
                <input value={form.toTitle} onChange={setField(setForm)('toTitle')} placeholder="Optional" />
              </label>
              <label className="field">
                <span>Effective on</span>
                <input type="date" value={form.effectiveOn} onChange={setField(setForm)('effectiveOn')} />
              </label>
              <label className="field field-span-2">
                <span>Reason</span>
                <textarea rows={2} value={form.reason} onChange={setField(setForm)('reason')} />
              </label>
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => create(false)}>
                Save draft
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => create(true)}>
                Submit to HR
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No transfers"
        emptyDescription="Create a transfer when someone moves department or site."
        onRowClick={(row) => navigate(`/hr/organization/transfers/${row.id}`)}
        columns={[
          { key: 'transferNumber', header: 'Case', render: (row) => <span className="mono">{row.transferNumber}</span> },
          { key: 'personName', header: 'Person', render: (row) => <PersonCell primary={row.personName} secondary={row.personNumber} /> },
          { key: 'fromDepartment', header: 'From', render: (row) => row.fromDepartment || '—' },
          { key: 'toDepartment', header: 'To' },
          { key: 'effectiveOn', header: 'Effective', render: (row) => formatDate(row.effectiveOn) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function TransferDetailPage() {
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
      const data = await api(`/api/hr/organization/transfers/${id}`);
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
      setRow(await api(`/api/hr/organization/transfers/${id}${path}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading transfer…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.transferNumber}</span>
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.personName} · {row.fromDepartment || '—'} → {row.toDepartment}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Effective</span>
            <input readOnly value={formatDate(row.effectiveOn)} />
          </label>
          <label className="field">
            <span>Branch</span>
            <input readOnly value={row.toBranchName || '—'} />
          </label>
          <label className="field">
            <span>New title</span>
            <input readOnly value={row.toTitle || '—'} />
          </label>
          <label className="field field-span-2">
            <span>Reason</span>
            <textarea readOnly rows={2} value={row.reason || ''} />
          </label>
        </div>
        {row.status === 'SUBMITTED' ? (
          <label className="field" style={{ display: 'block', marginTop: 12 }}>
            <span>Decision note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        ) : null}
        <div className="toolbar-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/organization/transfers')}>
            Back
          </button>
          {row.status === 'DRAFT' ? (
            <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/submit', 'submit')}>
              {busy === 'submit' ? 'Submitting…' : 'Submit'}
            </button>
          ) : null}
          {row.status === 'SUBMITTED' ? (
            <>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/approve', 'approve')}>
                {busy === 'approve' ? 'Approving…' : 'Approve & apply'}
              </button>
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/reject', 'reject')}>
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PromotionsPage() {
  const navigate = useNavigate();
  const { rows, error, loading, load } = useLoad('/api/hr/organization/promotions');
  const { rows: people } = useLoad('/api/hr/organization/people');
  const { rows: designations } = useLoad('/api/hr/organization/designations');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ personKey: '', toTitle: '', toDesignationId: '', effectiveOn: todayIso(), reason: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const options = useMemo(() => personOptions(people), [people]);

  async function create(submit) {
    setBusy(true);
    setFormError('');
    try {
      const person = options.find((o) => o.key === form.personKey);
      if (!person) {
        setFormError('Choose an employee');
        return;
      }
      const created = await api('/api/hr/organization/promotions', {
        method: 'POST',
        body: JSON.stringify({
          personKind: person.kind,
          personId: person.id,
          toTitle: form.toTitle.trim(),
          toDesignationId: form.toDesignationId || null,
          effectiveOn: form.effectiveOn,
          reason: form.reason.trim() || null,
          submit,
        }),
      });
      setShowForm(false);
      navigate(`/hr/organization/promotions/${created.id}`);
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="list-toolbar list-toolbar-split">
        <p className="muted" style={{ margin: 0 }}>
          Promote title or designation. Approval updates the person profile.
        </p>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
          New promotion
        </button>
      </div>
      {showForm ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              New promotion
            </h2>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="form-grid">
              <label className="field field-span-2">
                <span>Employee</span>
                <select value={form.personKey} onChange={setField(setForm)('personKey')}>
                  <option value="">Select person</option>
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label} · {o.title || o.department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>New title</span>
                <input value={form.toTitle} onChange={setField(setForm)('toTitle')} />
              </label>
              <label className="field">
                <span>Designation</span>
                <select value={form.toDesignationId} onChange={setField(setForm)('toDesignationId')}>
                  <option value="">Optional master</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Effective on</span>
                <input type="date" value={form.effectiveOn} onChange={setField(setForm)('effectiveOn')} />
              </label>
              <label className="field field-span-2">
                <span>Reason</span>
                <textarea rows={2} value={form.reason} onChange={setField(setForm)('reason')} />
              </label>
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => create(false)}>
                Save draft
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => create(true)}>
                Submit to HR
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No promotions"
        emptyDescription="Record title upgrades and career moves."
        onRowClick={(row) => navigate(`/hr/organization/promotions/${row.id}`)}
        columns={[
          { key: 'promotionNumber', header: 'Case', render: (row) => <span className="mono">{row.promotionNumber}</span> },
          { key: 'personName', header: 'Person', render: (row) => <PersonCell primary={row.personName} secondary={row.fromTitle} /> },
          { key: 'toTitle', header: 'New title' },
          { key: 'toDesignationName', header: 'Designation', render: (row) => row.toDesignationName || '—' },
          { key: 'effectiveOn', header: 'Effective', render: (row) => formatDate(row.effectiveOn) },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
        ]}
      />
    </>
  );
}

export function PromotionDetailPage() {
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
      const data = await api(`/api/hr/organization/promotions/${id}`);
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
      setRow(await api(`/api/hr/organization/promotions/${id}${path}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  if (loading && !row) return <p className="muted">Loading promotion…</p>;
  if (!row) return error ? <p className="form-error">{error}</p> : null;

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              <span className="mono">{row.promotionNumber}</span>
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {row.personName} · {row.fromTitle || '—'} → {row.toTitle}
            </p>
          </div>
          <StatusBadge value={row.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Designation</span>
            <input readOnly value={row.toDesignationName || '—'} />
          </label>
          <label className="field">
            <span>Effective</span>
            <input readOnly value={formatDate(row.effectiveOn)} />
          </label>
          <label className="field field-span-2">
            <span>Reason</span>
            <textarea readOnly rows={2} value={row.reason || ''} />
          </label>
        </div>
        {row.status === 'SUBMITTED' ? (
          <label className="field" style={{ display: 'block', marginTop: 12 }}>
            <span>Decision note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        ) : null}
        <div className="toolbar-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/organization/promotions')}>
            Back
          </button>
          {row.status === 'DRAFT' ? (
            <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/submit', 'submit')}>
              {busy === 'submit' ? 'Submitting…' : 'Submit'}
            </button>
          ) : null}
          {row.status === 'SUBMITTED' ? (
            <>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/approve', 'approve')}>
                {busy === 'approve' ? 'Approving…' : 'Approve & apply'}
              </button>
              <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/reject', 'reject')}>
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
