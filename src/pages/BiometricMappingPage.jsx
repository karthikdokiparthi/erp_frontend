import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { EMPLOYEE_COLUMNS } from './EmployeesPage';

/** Contract directory columns — shared with All employees (not a separate hardcoded list). */
const CONTRACT_COLUMNS = EMPLOYEE_COLUMNS.filter((c) => c.kind === 'EMPLOYEE');

const emptyFilters = {
  q: '',
  workGroup: '',
  linkStatus: '',
};

const emptyForm = {
  kind: 'STAFF',
  employeeNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  department: '',
  title: '',
  deviceUserId: '',
  status: 'ACTIVE',
  workGroup: 'BGT',
};

function personApiBase(personKind) {
  return personKind === 'STAFF' ? '/api/hr/staff' : '/api/hr/employees';
}

function displayName(row) {
  return [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim() || '—';
}

function isLinked(deviceUserId) {
  return Boolean(deviceUserId && String(deviceUserId).trim());
}

function rowToForm(row) {
  const kind = row.personKind === 'STAFF' ? 'STAFF' : 'EMPLOYEE';
  const defaultContract = CONTRACT_COLUMNS[0]?.workGroup || 'Ruchitha';
  return {
    kind,
    employeeNumber: row.employeeNumber || '',
    firstName: row.firstName || '',
    lastName: row.lastName || '',
    email: row.email || '',
    department: row.department || '',
    title: row.title || '',
    deviceUserId: row.deviceUserId || '',
    status: row.status || 'ACTIVE',
    workGroup: kind === 'STAFF' ? 'BGT' : row.workGroup || defaultContract,
  };
}

function buildPayload(form, existing) {
  const base = existing
    ? {
        employeeNumber: existing.employeeNumber || null,
        firstName: existing.firstName,
        middleName: existing.middleName || null,
        lastName: existing.lastName,
        email: existing.email || null,
        title: existing.title || null,
        department: existing.department || null,
        status: existing.status || 'ACTIVE',
        deviceUserId: existing.deviceUserId || null,
        hiredOn: existing.hiredOn || null,
        workGroup: existing.workGroup || null,
        mobile: existing.mobile || null,
        alternateMobile: existing.alternateMobile || null,
        personalEmail: existing.personalEmail || null,
        dateOfBirth: existing.dateOfBirth || null,
        gender: existing.gender || null,
        maritalStatus: existing.maritalStatus || null,
        bloodGroup: existing.bloodGroup || null,
        currentAddress: existing.currentAddress || null,
        permanentAddress: existing.permanentAddress || null,
        city: existing.city || null,
        state: existing.state || null,
        country: existing.country || null,
        pincode: existing.pincode || null,
        emergencyContactName: existing.emergencyContactName || null,
        emergencyContactPhone: existing.emergencyContactPhone || null,
        dateOfConfirmation: existing.dateOfConfirmation || null,
        employmentCategory: existing.employmentCategory || null,
        salutation: existing.salutation || null,
        photoUrl: existing.photoUrl || null,
        companyName: existing.companyName || null,
        branchId: existing.branchId || null,
        grade: existing.grade || null,
        costCenter: existing.costCenter || null,
        shiftId: existing.shiftId || null,
        probationMonths: existing.probationMonths ?? null,
        workLocation: existing.workLocation || null,
        officialMobile: existing.officialMobile || null,
        badgeNumber: existing.badgeNumber || null,
        loginId: existing.loginId || null,
        currentHouse: existing.currentHouse || null,
        currentStreet: existing.currentStreet || null,
        currentDistrict: existing.currentDistrict || null,
        permanentHouse: existing.permanentHouse || null,
        permanentStreet: existing.permanentStreet || null,
        permanentCity: existing.permanentCity || null,
        permanentDistrict: existing.permanentDistrict || null,
        permanentState: existing.permanentState || null,
        permanentCountry: existing.permanentCountry || null,
        permanentPin: existing.permanentPin || null,
        emergencyContactRelationship: existing.emergencyContactRelationship || null,
        fatherName: existing.fatherName || null,
        motherName: existing.motherName || null,
        spouseName: existing.spouseName || null,
        nationality: existing.nationality || null,
        religion: existing.religion || null,
        aadhaar: existing.aadhaar || null,
        panNumber: existing.panNumber || null,
        passportNumber: existing.passportNumber || null,
        drivingLicence: existing.drivingLicence || null,
        educationalQualification: existing.educationalQualification || null,
        technicalSkills: existing.technicalSkills || null,
        certifications: existing.certifications || null,
        previousExperience: existing.previousExperience || null,
        weeklyOff: existing.weeklyOff || null,
      }
    : {};

  return {
    ...base,
    employeeNumber: form.employeeNumber || null,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email || null,
    department: String(form.department || '').trim() || null,
    title: String(form.title || '').trim() || null,
    departmentId: null,
    designationId: null,
    deviceUserId: form.deviceUserId || null,
    status: form.status || 'ACTIVE',
    workGroup: form.kind === 'STAFF' ? 'BGT' : form.workGroup,
  };
}

export function BiometricMappingPage() {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.q) params.set('q', applied.q);
    if (applied.workGroup) params.set('workGroup', applied.workGroup);
    const qs = params.toString();
    return `/api/hr/people${qs ? `?${qs}` : ''}`;
  }, [applied.q, applied.workGroup]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const list = await api(path);
      const people = Array.isArray(list) ? list : [];
      setRows(people);
      const nextDrafts = {};
      people.forEach((row) => {
        nextDrafts[row.id] = row.deviceUserId || '';
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  const visibleRows = useMemo(() => {
    if (!applied.linkStatus) return rows;
    const wantLinked = applied.linkStatus === 'linked';
    return rows.filter((row) => isLinked(row.deviceUserId) === wantLinked);
  }, [rows, applied.linkStatus]);

  const linkedCount = useMemo(() => rows.filter((row) => isLinked(row.deviceUserId)).length, [rows]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyFilters(event) {
    event?.preventDefault?.();
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
  }

  function updateDraft(id, value) {
    setDrafts((current) => ({ ...current, [id]: value }));
  }

  function isDirty(row) {
    return String(drafts[row.id] ?? '').trim() !== String(row.deviceUserId || '').trim();
  }

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'kind') {
        const defaultContract = CONTRACT_COLUMNS[0]?.workGroup || 'Ruchitha';
        next.workGroup =
          value === 'STAFF' ? 'BGT' : current.workGroup === 'BGT' ? defaultContract : current.workGroup;
      }
      return next;
    });
  }

  function openAdd() {
    setEditingRow(null);
    setForm({ ...emptyForm });
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingRow(row);
    setForm(rowToForm(row));
    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (formSaving) return;
    setModalOpen(false);
    setEditingRow(null);
    setFormError('');
  }

  async function linkPunches(personId, deviceUserId) {
    const trimmed = String(deviceUserId || '').trim();
    if (!trimmed) return 0;
    const res = await api('/api/hr/attendance/map-device-user', {
      method: 'POST',
      body: JSON.stringify({ deviceUserId: trimmed, employeeId: personId }),
    });
    return res?.linkedPunches ?? 0;
  }

  async function handleSaveDeviceId(row) {
    const nextId = String(drafts[row.id] ?? '').trim();
    const previous = String(row.deviceUserId || '').trim();
    if (nextId === previous) return;

    setSavingId(row.id);
    setError('');
    setNotice('');
    try {
      if (nextId) {
        const linked = await linkPunches(row.id, nextId);
        setRows((current) =>
          current.map((item) => (item.id === row.id ? { ...item, deviceUserId: nextId } : item))
        );
        setDrafts((current) => ({ ...current, [row.id]: nextId }));
        setNotice(
          `Saved biometric ID ${nextId} for ${displayName(row)}${linked ? ` · linked ${linked} punch(es)` : ''}.`
        );
      } else {
        await api(`${personApiBase(row.personKind)}/${row.id}/device-user`, {
          method: 'PATCH',
          body: JSON.stringify({ deviceUserId: '' }),
        });
        setRows((current) =>
          current.map((item) => (item.id === row.id ? { ...item, deviceUserId: null } : item))
        );
        setDrafts((current) => ({ ...current, [row.id]: '' }));
        setNotice(`Cleared biometric ID for ${displayName(row)}.`);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSavingId('');
    }
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    const department = String(form.department || '').trim();
    const title = String(form.title || '').trim();
    if (!department) {
      setFormError('Department is required.');
      return;
    }
    if (!title) {
      setFormError('Designation is required.');
      return;
    }
    setFormSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = buildPayload({ ...form, department, title }, editingRow);
      const base = personApiBase(form.kind);
      let saved;
      if (editingRow) {
        saved = await api(`${base}/${editingRow.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        saved = await api(base, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const personId = saved?.id || editingRow?.id;
      const deviceUserId = String(payload.deviceUserId || '').trim();
      let linked = 0;
      if (personId && deviceUserId) {
        linked = await linkPunches(personId, deviceUserId);
      }

      setModalOpen(false);
      setEditingRow(null);
      await load();
      const label = [payload.firstName, payload.lastName].filter(Boolean).join(' ');
      setNotice(
        editingRow
          ? `Updated ${label || 'person'}${linked ? ` · linked ${linked} punch(es)` : ''}.`
          : `Added ${label || 'person'} to biometric roster${linked ? ` · linked ${linked} punch(es)` : ''}.`
      );
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Biometric"
        description="Simple employee details attached to TimeWatch / BioAPI (staff + contract). Full HR profile stays in Employee Master."
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={openAdd}>
              Add biometric employee
            </button>
            <Link className="btn" to="/hr/attendance/devices">
              Biometric devices
            </Link>
          </>
        }
      />

      <div className="kpi-grid" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="label">Roster</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="kpi">
          <div className="label">Linked</div>
          <div className="value">{linkedCount}</div>
        </div>
        <div className="kpi">
          <div className="label">Not linked</div>
          <div className="value">{Math.max(0, rows.length - linkedCount)}</div>
        </div>
      </div>

      <form className="panel" onSubmit={applyFilters} style={{ marginBottom: 12 }}>
        <div className="panel-pad form-grid">
          <label className="field">
            <span>Search</span>
            <input
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
              placeholder="Code, name, or device user ID"
            />
          </label>
          <label className="field">
            <span>Work group</span>
            <select value={filters.workGroup} onChange={(e) => updateFilter('workGroup', e.target.value)}>
              <option value="">All</option>
              {EMPLOYEE_COLUMNS.map((column) => (
                <option key={column.slug} value={column.workGroup}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Link status</span>
            <select value={filters.linkStatus} onChange={(e) => updateFilter('linkStatus', e.target.value)}>
              <option value="">All</option>
              <option value="linked">Linked</option>
              <option value="not_linked">Not linked</option>
            </select>
          </label>
          <div className="form-actions" style={{ alignItems: 'end' }}>
            <button className="btn btn-primary" type="submit">
              Apply
            </button>
            <button className="btn" type="button" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>
      </form>

      {notice ? <div className="form-notice" style={{ marginBottom: 12 }}>{notice}</div> : null}

      <div className="panel">
        <DataTable
          rows={visibleRows}
          loading={loading}
          error={error}
          onRetry={load}
          emptyTitle="No biometric employees yet"
          emptyDescription="Add a simple employee record here (code, name, device User ID). Employee Master remains separate."
          columns={[
            {
              key: 'employeeNumber',
              header: 'Code',
              render: (row) => <span className="mono">{row.employeeNumber || '—'}</span>,
            },
            {
              key: 'name',
              header: 'Name',
              render: (row) => (
                <div className="cell-stack">
                  <div className="primary">{displayName(row)}</div>
                  <div className="secondary">{row.personKind === 'STAFF' ? 'On-Role' : 'Contract'}</div>
                </div>
              ),
            },
            {
              key: 'workGroup',
              header: 'Work Group',
              render: (row) => row.workGroup || (row.personKind === 'STAFF' ? 'BGT' : '—'),
            },
            { key: 'department', header: 'Department', render: (row) => row.department || '—' },
            { key: 'title', header: 'Designation', render: (row) => row.title || '—' },
            {
              key: 'email',
              header: 'Email',
              render: (row) =>
                row.email ? <span className="mono">{row.email}</span> : <span className="muted">—</span>,
            },
            {
              key: 'deviceUserId',
              header: 'Device User ID',
              render: (row) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="mono"
                    value={drafts[row.id] ?? ''}
                    onChange={(e) => updateDraft(row.id, e.target.value)}
                    placeholder="e.g. 16"
                    style={{ maxWidth: 120 }}
                    aria-label={`Device user ID for ${displayName(row)}`}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    disabled={savingId === row.id || !isDirty(row)}
                    onClick={() => handleSaveDeviceId(row)}
                  >
                    {savingId === row.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ),
            },
            {
              key: 'linkStatus',
              header: 'Status',
              render: (row) =>
                isLinked(row.deviceUserId) ? (
                  <span className="badge badge-success">Linked</span>
                ) : (
                  <span className="badge badge-warning">Not linked</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <button className="btn btn-sm" type="button" onClick={() => openEdit(row)}>
                  Edit
                </button>
              ),
            },
          ]}
        />
      </div>

      {modalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="modal-dialog" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingRow ? 'Edit biometric employee' : 'Add biometric employee'}
              </h3>
              <button className="btn btn-sm" type="button" onClick={closeModal} disabled={formSaving}>
                Close
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                <p className="muted" style={{ marginTop: 0 }}>
                  Simple roster for BioAPI — code, name, email, department, designation, and device User ID.
                  Contract email is optional; when set to the same address as the CCIDP login, punches show under My attendance.
                  Department and designation are free text here.
                </p>
                {formError ? <div className="form-error" style={{ marginBottom: 12 }}>{formError}</div> : null}
                <div className="form-grid">
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={form.kind}
                      onChange={(e) => updateForm('kind', e.target.value)}
                      disabled={Boolean(editingRow)}
                      required
                    >
                      <option value="STAFF">On-Role (BGT)</option>
                      <option value="EMPLOYEE">Contract</option>
                    </select>
                  </label>
                  {form.kind === 'EMPLOYEE' ? (
                    <label className="field">
                      <span>Work group</span>
                      <select
                        value={form.workGroup}
                        onChange={(e) => updateForm('workGroup', e.target.value)}
                        required
                      >
                        {CONTRACT_COLUMNS.map((column) => (
                          <option key={column.slug} value={column.workGroup}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="field">
                      <span>Work group</span>
                      <input value="BGT" readOnly />
                    </label>
                  )}
                  <label className="field">
                    <span>Employee code</span>
                    <input
                      className="mono"
                      value={form.employeeNumber}
                      onChange={(e) => updateForm('employeeNumber', e.target.value)}
                      placeholder="Leave blank to auto-generate"
                    />
                  </label>
                  <label className="field">
                    <span>Device User ID</span>
                    <input
                      className="mono"
                      value={form.deviceUserId}
                      onChange={(e) => updateForm('deviceUserId', e.target.value)}
                      placeholder="TimeWatch UserID e.g. 16"
                    />
                  </label>
                  <label className="field">
                    <span>First name</span>
                    <input
                      value={form.firstName}
                      onChange={(e) => updateForm('firstName', e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <input
                      value={form.lastName}
                      onChange={(e) => updateForm('lastName', e.target.value)}
                      required
                    />
                  </label>
                  <label className="field span-2">
                    <span>
                      {form.kind === 'STAFF' ? 'Email' : 'Email (optional)'}
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      placeholder={
                        form.kind === 'STAFF'
                          ? 'name@brightgrid.in'
                          : 'Same as CCIDP login — enables My attendance'
                      }
                      required={form.kind === 'STAFF'}
                    />
                  </label>
                  <label className="field">
                    <span>Department</span>
                    <input
                      value={form.department}
                      onChange={(e) => updateForm('department', e.target.value)}
                      placeholder="e.g. Operations"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Designation</span>
                    <input
                      value={form.title}
                      onChange={(e) => updateForm('title', e.target.value)}
                      placeholder="e.g. Technician"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                      <option value="ACTIVE">Active</option>
                      <option value="ON_LEAVE">On leave</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="modal-footer" style={{ gap: 8 }}>
                <button className="btn" type="button" onClick={closeModal} disabled={formSaving}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={formSaving}>
                  {formSaving ? 'Saving…' : editingRow ? 'Save changes' : 'Add to roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
