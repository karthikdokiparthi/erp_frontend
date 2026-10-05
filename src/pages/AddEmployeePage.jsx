import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { EMPLOYEE_COLUMNS } from './EmployeesPage';

const CONTRACT_COLUMNS = EMPLOYEE_COLUMNS.filter((c) => c.kind === 'EMPLOYEE');
const CONTRACT_GROUPS = CONTRACT_COLUMNS.map((c) => c.workGroup);

const emptyForm = {
  kind: 'STAFF',
  employeeNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  title: '',
  department: '',
  departmentId: '',
  designationId: '',
  deviceUserId: '',
  status: 'ACTIVE',
  hiredOn: '',
  workGroup: 'BGT',
  mobile: '',
  alternateMobile: '',
  personalEmail: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  bloodGroup: '',
  currentAddress: '',
  permanentAddress: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  dateOfConfirmation: '',
  employmentType: 'BGTEMP',
  salary: '',
  basic: '',
  hra: '',
  retentionAllowance: '',
};

function columnPath(kind, workGroup) {
  if (kind === 'STAFF') return '/hr/employees/bgt';
  const slug = String(workGroup || 'ruchitha').toLowerCase();
  return `/hr/employees/${slug}`;
}

function personToForm(person, kind) {
  return {
    ...emptyForm,
    kind,
    employeeNumber: person.employeeNumber || '',
    firstName: person.firstName || '',
    middleName: person.middleName || '',
    lastName: person.lastName || '',
    email: person.email || '',
    title: person.title || '',
    department: person.department || '',
    departmentId: person.departmentId || '',
    designationId: person.designationId || '',
    deviceUserId: person.deviceUserId || '',
    status: person.status || 'ACTIVE',
    hiredOn: person.hiredOn || '',
    workGroup: kind === 'STAFF' ? 'BGT' : person.workGroup || 'Ruchitha',
    mobile: person.mobile || '',
    alternateMobile: person.alternateMobile || '',
    personalEmail: person.personalEmail || '',
    dateOfBirth: person.dateOfBirth || '',
    gender: person.gender || '',
    maritalStatus: person.maritalStatus || '',
    bloodGroup: person.bloodGroup || '',
    currentAddress: person.currentAddress || '',
    permanentAddress: person.permanentAddress || '',
    city: person.city || '',
    state: person.state || '',
    country: person.country || '',
    pincode: person.pincode || '',
    emergencyContactName: person.emergencyContactName || '',
    emergencyContactPhone: person.emergencyContactPhone || '',
    dateOfConfirmation: person.dateOfConfirmation || '',
    employmentType: kind === 'EMPLOYEE' ? 'CONTRACTEMP' : 'BGTEMP',
  };
}

function buildPayload(form) {
  return {
    employeeNumber: form.employeeNumber,
    firstName: form.firstName,
    middleName: form.middleName || null,
    lastName: form.lastName,
    email: form.email || null,
    title: form.title || null,
    department: form.department,
    departmentId: form.departmentId || null,
    designationId: form.designationId || null,
    deviceUserId: form.deviceUserId || null,
    status: form.status,
    hiredOn: form.hiredOn || null,
    workGroup: form.kind === 'STAFF' ? 'BGT' : form.workGroup,
    mobile: form.mobile || null,
    alternateMobile: form.alternateMobile || null,
    personalEmail: form.personalEmail || null,
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender || null,
    maritalStatus: form.maritalStatus || null,
    bloodGroup: form.bloodGroup || null,
    currentAddress: form.currentAddress || null,
    permanentAddress: form.permanentAddress || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || null,
    pincode: form.pincode || null,
    emergencyContactName: form.emergencyContactName || null,
    emergencyContactPhone: form.emergencyContactPhone || null,
    dateOfConfirmation: form.dateOfConfirmation || null,
  };
}

export function AddEmployeePage() {
  const navigate = useNavigate();
  const { kind: routeKind, id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const editing = Boolean(editId);
  const resolvedKind =
    routeKind === 'employees' || routeKind === 'EMPLOYEE' || (!routeKind && searchParams.get('kind') === 'EMPLOYEE')
      ? 'EMPLOYEE'
      : 'STAFF';

  const [form, setForm] = useState(() => {
    const workGroupParam = searchParams.get('workGroup');
    const workGroup =
      resolvedKind === 'STAFF'
        ? 'BGT'
        : CONTRACT_GROUPS.includes(workGroupParam)
          ? workGroupParam
          : 'Ruchitha';
    return {
      ...emptyForm,
      kind: resolvedKind,
      workGroup,
      employmentType: resolvedKind === 'EMPLOYEE' ? 'CONTRACTEMP' : 'BGTEMP',
    };
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPerson, setLoadingPerson] = useState(editing);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadDepartments() {
      try {
        let rows = await api('/api/hr/organization/departments?activeOnly=true');
        if (!Array.isArray(rows) || rows.length === 0) {
          await api('/api/hr/organization/departments/ensure', { method: 'POST', body: '{}' });
          rows = await api('/api/hr/organization/departments?activeOnly=true');
        }
        if (!cancelled) {
          setDepartments(Array.isArray(rows) ? rows : []);
          if (!Array.isArray(rows) || rows.length === 0) {
            setError('No departments — run migrations / open Department Master');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDepartments([]);
          setError(extractError(err) || 'Failed to load departments');
        }
      }
    }
    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!form.departmentId) {
      setDesignations([]);
      return undefined;
    }
    api(`/api/hr/organization/designations?departmentId=${encodeURIComponent(form.departmentId)}`)
      .then((rows) => {
        if (!cancelled) {
          const list = rows || [];
          setDesignations(list.filter((d) => d.status === 'ACTIVE' || d.id === form.designationId));
        }
      })
      .catch(() => {
        if (!cancelled) setDesignations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.departmentId, form.designationId]);

  const activeDepartments = useMemo(() => {
    const list = (departments || []).filter(
      (d) => String(d.status || '').toUpperCase() === 'ACTIVE' || d.id === form.departmentId
    );
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
  }, [departments, form.departmentId]);

  useEffect(() => {
    if (editing) {
      return;
    }
    const next = searchParams.get('kind');
    const workGroupParam = searchParams.get('workGroup');
    if (next !== 'EMPLOYEE' && next !== 'STAFF') {
      return;
    }
    setForm((current) => ({
      ...current,
      kind: next,
      employmentType: next === 'EMPLOYEE' ? 'CONTRACTEMP' : 'BGTEMP',
      workGroup:
        next === 'STAFF'
          ? 'BGT'
          : CONTRACT_GROUPS.includes(workGroupParam)
            ? workGroupParam
            : current.workGroup && CONTRACT_GROUPS.includes(current.workGroup)
              ? current.workGroup
              : 'Ruchitha',
    }));
  }, [searchParams, editing]);

  useEffect(() => {
    if (!editing || !editId) {
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingPerson(true);
      setError('');
      try {
        const kind = resolvedKind;
        const person = await api(kind === 'STAFF' ? `/api/hr/staff/${editId}` : `/api/hr/employees/${editId}`);
        if (!cancelled) {
          setForm(personToForm(person, kind));
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractError(err));
        }
      } finally {
        if (!cancelled) {
          setLoadingPerson(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [editing, editId, resolvedKind]);

  const listPath = useMemo(() => columnPath(form.kind, form.workGroup), [form.kind, form.workGroup]);

  function update(field, value) {
    setForm((current) => {
      if (field === 'kind') {
        return {
          ...current,
          kind: value,
          employmentType: value === 'EMPLOYEE' ? 'CONTRACTEMP' : 'BGTEMP',
          workGroup: value === 'STAFF' ? 'BGT' : current.workGroup === 'BGT' ? 'Ruchitha' : current.workGroup,
        };
      }
      if (field === 'departmentId') {
        const dept = departments.find((d) => d.id === value);
        return {
          ...current,
          departmentId: value,
          department: dept?.name || '',
          designationId: '',
          title: '',
        };
      }
      if (field === 'designationId') {
        const desig = designations.find((d) => d.id === value);
        return {
          ...current,
          designationId: value,
          title: desig?.name || '',
        };
      }
      return { ...current, [field]: value };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = buildPayload(form);
      const base = form.kind === 'STAFF' ? '/api/hr/staff' : '/api/hr/employees';
      if (editing) {
        await api(`${base}/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        navigate(`/hr/people/${form.kind === 'STAFF' ? 'staff' : 'employees'}/${editId}`);
        return;
      }

      const created = await api(base, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const isContract = form.employmentType === 'CONTRACTEMP';
      const hasPay = Boolean(form.salary);
      if (hasPay) {
        await api('/api/hr/salary', {
          method: 'POST',
          body: JSON.stringify({
            personId: created.id,
            personKind: form.kind,
            employmentType: form.employmentType,
            salary: Number(form.salary),
            location: isContract ? form.workGroup || form.department || null : null,
          }),
        });
      }
      navigate(listPath);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loadingPerson) {
    return (
      <div className="panel">
        <div className="panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            Loading employee details…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <form className="panel-pad emp-form" onSubmit={handleSubmit}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {editing ? 'Update' : 'Add'} {form.kind === 'STAFF' ? 'On-Role' : 'Contract'} details
        </h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {editing
            ? 'Change any fields below and save. ID, email, and device ID must stay unique.'
            : 'On-Role people go under the BGT column. Contract people go under Ruchitha, Akhil, BSK, or Krystal.'}
        </p>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="form-grid">
          <label className="field">
            <span>Type</span>
            <select
              value={form.kind}
              disabled={editing}
              onChange={(event) => update('kind', event.target.value)}
            >
              <option value="STAFF">On-Role (BGT)</option>
              <option value="EMPLOYEE">Contract</option>
            </select>
          </label>
          <label className="field">
            <span>Column</span>
            {form.kind === 'STAFF' ? (
              <input value="BGT" readOnly />
            ) : (
              <select
                value={form.workGroup}
                onChange={(event) => update('workGroup', event.target.value)}
                required
              >
                {CONTRACT_COLUMNS.map((column) => (
                  <option key={column.slug} value={column.workGroup}>
                    {column.label}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="field">
            <span>{form.kind === 'STAFF' ? 'On-Role ID' : 'Contract ID'}</span>
            <input
              className="mono"
              value={form.employeeNumber}
              onChange={(event) => update('employeeNumber', event.target.value)}
              placeholder="BGT-1006"
              required
            />
          </label>
          <label className="field">
            <span>First name</span>
            <input
              value={form.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Middle name</span>
            <input value={form.middleName} onChange={(event) => update('middleName', event.target.value)} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              value={form.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>{form.kind === 'STAFF' ? 'Work email' : 'Work email (optional)'}</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder={form.kind === 'STAFF' ? 'name@brightgrid.in' : 'Optional'}
              required={form.kind === 'STAFF'}
            />
          </label>
          <label className="field">
            <span>Personal email</span>
            <input
              type="email"
              value={form.personalEmail}
              onChange={(event) => update('personalEmail', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Mobile</span>
            <input value={form.mobile} onChange={(event) => update('mobile', event.target.value)} />
          </label>
          <label className="field">
            <span>Alternate mobile</span>
            <input value={form.alternateMobile} onChange={(event) => update('alternateMobile', event.target.value)} />
          </label>
          <label className="field">
            <span>Date of birth</span>
            <input type="date" value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} />
          </label>
          <label className="field">
            <span>Gender</span>
            <select value={form.gender} onChange={(event) => update('gender', event.target.value)}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>
          <label className="field">
            <span>Marital status</span>
            <select value={form.maritalStatus} onChange={(event) => update('maritalStatus', event.target.value)}>
              <option value="">—</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Blood group</span>
            <input value={form.bloodGroup} onChange={(event) => update('bloodGroup', event.target.value)} />
          </label>
          <label className="field">
            <span>Department</span>
            <select
              value={form.departmentId}
              onChange={(event) => update('departmentId', event.target.value)}
              required
            >
              <option value="">Select department</option>
              {activeDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <small className="muted">
              <Link to="/hr/organization">Add / manage departments</Link>
            </small>
          </label>
          <label className="field">
            <span>Designation</span>
            <select
              value={form.designationId}
              onChange={(event) => update('designationId', event.target.value)}
              required
              disabled={!form.departmentId}
            >
              <option value="">{form.departmentId ? 'Select designation' : 'Select department first'}</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayLabel || (d.departmentName ? `${d.departmentName} – ${d.name}` : d.name)}
                </option>
              ))}
            </select>
            <small className="muted">
              <Link to="/hr/organization/designations">Add / manage designations</Link>
            </small>
          </label>
          <label className="field">
            <span>Device ID</span>
            <input
              className="mono"
              value={form.deviceUserId}
              onChange={(event) => update('deviceUserId', event.target.value)}
              placeholder="Biometric enroll id"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => update('status', event.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="field">
            <span>Date of joining</span>
            <input
              type="date"
              value={form.hiredOn}
              onChange={(event) => update('hiredOn', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Date of confirmation</span>
            <input
              type="date"
              value={form.dateOfConfirmation}
              onChange={(event) => update('dateOfConfirmation', event.target.value)}
            />
          </label>
          <label className="field span-2">
            <span>Current address</span>
            <input value={form.currentAddress} onChange={(event) => update('currentAddress', event.target.value)} />
          </label>
          <label className="field span-2">
            <span>Permanent address</span>
            <input value={form.permanentAddress} onChange={(event) => update('permanentAddress', event.target.value)} />
          </label>
          <label className="field">
            <span>City</span>
            <input value={form.city} onChange={(event) => update('city', event.target.value)} />
          </label>
          <label className="field">
            <span>State</span>
            <input value={form.state} onChange={(event) => update('state', event.target.value)} />
          </label>
          <label className="field">
            <span>Country</span>
            <input value={form.country} onChange={(event) => update('country', event.target.value)} />
          </label>
          <label className="field">
            <span>Pincode</span>
            <input value={form.pincode} onChange={(event) => update('pincode', event.target.value)} />
          </label>
          <label className="field">
            <span>Emergency contact name</span>
            <input
              value={form.emergencyContactName}
              onChange={(event) => update('emergencyContactName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Emergency contact phone</span>
            <input
              value={form.emergencyContactPhone}
              onChange={(event) => update('emergencyContactPhone', event.target.value)}
            />
          </label>
        </div>
        {!editing ? (
          <>
            <h2 className="section-title" style={{ marginTop: 22 }}>
              Pay (optional)
            </h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Leave blank to add the person first and set pay later on Payroll. On-Role CTC uses Basic as
              40% of CTC unless you set Basic later. Contract Salary must be one of the 12 structures.
            </p>
            <div className="form-grid">
              <label className="field">
                <span>Pay type</span>
                <select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)}>
                  <option value="BGTEMP">On-Role</option>
                  <option value="CONTRACTEMP">Contract</option>
                </select>
              </label>
              {form.employmentType === 'CONTRACTEMP' ? (
                <label className="field">
                  <span>Salary (₹)</span>
                  <select
                    className="mono"
                    value={form.salary}
                    onChange={(event) => update('salary', event.target.value)}
                  >
                    <option value="">Set later on Payroll</option>
                    {[16500, 17000, 18500, 19000, 19300, 19500, 20000, 22000, 23000, 24000, 25500, 27000].map((amount) => (
                      <option key={amount} value={amount}>
                        {amount}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>CTC per month (₹)</span>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salary}
                    onChange={(event) => update('salary', event.target.value)}
                    placeholder="16500"
                  />
                </label>
              )}
            </div>
          </>
        ) : null}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update details' : 'Save details'}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              navigate(
                editing
                  ? `/hr/people/${form.kind === 'STAFF' ? 'staff' : 'employees'}/${editId}`
                  : listPath
              )
            }
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
