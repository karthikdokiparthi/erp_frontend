import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { downloadBinaryFromUrl } from '../utils/exportExcel';
import { DataTable } from '../components/DataTable';
import { PayslipIconButton } from '../components/PayslipActionIcon';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import {
  assetTypeLabel,
  departmentLabel,
  formatDate,
  formatHours,
  formatMoney,
  formatTime,
  initials,
  payTypeLabel,
} from '../utils/format';
import { BgtPhotoStructureTable } from '../components/BgtPhotoStructureTable';
import { formulaLabel, lineCode, sortLinesPhotoOrder } from '../utils/bgtSalaryPhoto';

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'documents', label: 'Documents' },
  { id: 'assets', label: 'Assets' },
  { id: 'performance', label: 'Performance' },
  { id: 'history', label: 'History' },
];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYear() {
  return new Date().getFullYear();
}

function personToDraft(person) {
  return {
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
    workGroup: person.workGroup || '',
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
  };
}

export function EmployeeProfilePage() {
  const { kind, id } = useParams();
  const staff = kind === 'staff' || kind === 'STAFF';
  const [person, setPerson] = useState(null);
  const [draft, setDraft] = useState(null);
  const [modules, setModules] = useState(null);
  const [monthDays, setMonthDays] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('personal');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [deviceUserInput, setDeviceUserInput] = useState('');
  const [savingDeviceUser, setSavingDeviceUser] = useState(false);
  const [deviceUserNotice, setDeviceUserNotice] = useState('');
  const [docForm, setDocForm] = useState({ title: '', docType: 'OTHER', fileName: '', notes: '' });
  const [savingDoc, setSavingDoc] = useState(false);
  const [emailingSlip, setEmailingSlip] = useState('');
  const [assignedStructure, setAssignedStructure] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  const base = useMemo(
    () => (staff ? `/api/hr/staff/${id}` : `/api/hr/employees/${id}`),
    [staff, id]
  );

  useEffect(() => {
    setTab('personal');
  }, [id, staff]);

  useEffect(() => {
    const structureId = modules?.payroll?.assignment?.structureId;
    if (!structureId) {
      setAssignedStructure(null);
      return;
    }
    let cancelled = false;
    api(`/api/hr/payroll/structures/${structureId}`)
      .then((s) => {
        if (!cancelled) setAssignedStructure(s);
      })
      .catch(() => {
        if (!cancelled) setAssignedStructure(null);
      });
    return () => {
      cancelled = true;
    };
  }, [modules?.payroll?.assignment?.structureId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Load person first so Personal/Employment stay usable if modules fail.
        const data = await api(base);
        if (cancelled) return;
        setPerson(data);
        setDraft(personToDraft(data));
        setDeviceUserInput(data?.deviceUserId || '');

        const [related, monthly] = await Promise.all([
          api(`${base}/modules?month=${encodeURIComponent(month)}&year=${year}`).catch((err) => {
            if (!cancelled) setError(extractError(err));
            return null;
          }),
          api(`/api/hr/attendance/monthly?yearMonth=${encodeURIComponent(month)}`).catch(() => null),
        ]);
        if (!cancelled) {
          setModules(related);
          const personRow = (monthly?.employees || []).find((row) => row.id === id);
          setMonthDays((personRow?.days || []).filter((day) => day.status));
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractError(err));
          setPerson(null);
          setDraft(null);
          setModules(null);
          setMonthDays([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [base, id, month, year]);

  useEffect(() => {
    let cancelled = false;
    async function loadDepartments() {
      try {
        let list = await api('/api/hr/organization/departments?activeOnly=true');
        if (!Array.isArray(list) || list.length === 0) {
          await api('/api/hr/organization/departments/ensure', { method: 'POST', body: '{}' });
          list = await api('/api/hr/organization/departments?activeOnly=true');
        }
        if (!cancelled) setDepartments(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    }
    loadDepartments();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const departmentId = draft?.departmentId;
    if (!departmentId) {
      setDesignations([]);
      return undefined;
    }
    api(`/api/hr/organization/designations?departmentId=${encodeURIComponent(departmentId)}`)
      .then((list) => {
        if (!cancelled) {
          const rows = Array.isArray(list) ? list : [];
          setDesignations(rows.filter((d) => d.status === 'ACTIVE' || d.id === draft?.designationId));
        }
      })
      .catch(() => {
        if (!cancelled) setDesignations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft?.departmentId, draft?.designationId]);

  const activeDepartments = useMemo(() => {
    const list = (departments || []).filter(
      (d) => String(d.status || 'ACTIVE').toUpperCase() === 'ACTIVE' || d.id === draft?.departmentId
    );
    return [...list].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
  }, [departments, draft?.departmentId]);

  const name = person ? `${person.firstName} ${person.lastName}`.trim() : 'Employee';
  const directory = staff ? 'On-Role' : 'Contract';
  const attendance = modules?.attendance;
  const leave = modules?.leave;
  const payroll = modules?.payroll;
  const slip = payroll?.slip;
  const assets = modules?.assets || [];
  const history = modules?.history || [];
  const transfers = modules?.transfers || [];
  const promotions = modules?.promotions || [];
  const documents = modules?.documents || [];

  function updateDraft(field, value) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      if (field === 'departmentId') {
        const dept = departments.find((d) => d.id === value);
        next.department = dept?.name || '';
        next.designationId = '';
        next.title = '';
      }
      if (field === 'designationId') {
        const desig = designations.find((d) => d.id === value);
        next.title = desig?.name || '';
      }
      return next;
    });
  }

  async function handleSaveDetails() {
    if (!draft || !person) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...draft,
        email: draft.email || null,
        title: draft.title || null,
        department: draft.department || null,
        departmentId: draft.departmentId || null,
        designationId: draft.designationId || null,
        deviceUserId: draft.deviceUserId || null,
        hiredOn: draft.hiredOn || null,
        workGroup: staff ? 'BGT' : draft.workGroup || person.workGroup,
        middleName: draft.middleName || null,
        mobile: draft.mobile || null,
        alternateMobile: draft.alternateMobile || null,
        personalEmail: draft.personalEmail || null,
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender || null,
        maritalStatus: draft.maritalStatus || null,
        bloodGroup: draft.bloodGroup || null,
        currentAddress: draft.currentAddress || null,
        permanentAddress: draft.permanentAddress || null,
        city: draft.city || null,
        state: draft.state || null,
        country: draft.country || null,
        pincode: draft.pincode || null,
        emergencyContactName: draft.emergencyContactName || null,
        emergencyContactPhone: draft.emergencyContactPhone || null,
        dateOfConfirmation: draft.dateOfConfirmation || null,
      };
      const updated = await api(base, { method: 'PUT', body: JSON.stringify(payload) });
      setPerson(updated);
      setDraft(personToDraft(updated));
      setDeviceUserInput(updated.deviceUserId || '');
      setNotice('Details saved.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDeviceUser() {
    if (!deviceUserInput.trim()) return;
    setSavingDeviceUser(true);
    setError('');
    setDeviceUserNotice('');
    try {
      const res = await api('/api/hr/attendance/map-device-user', {
        method: 'POST',
        body: JSON.stringify({ deviceUserId: deviceUserInput.trim(), employeeId: id }),
      });
      setPerson((prev) => ({ ...prev, deviceUserId: deviceUserInput.trim() }));
      setDraft((prev) => (prev ? { ...prev, deviceUserId: deviceUserInput.trim() } : prev));
      setDeviceUserNotice(`Biometric Machine User ID saved! Linked ${res.linkedPunches || 0} punch(es).`);
      const related = await api(`${base}/modules?month=${encodeURIComponent(month)}&year=${year}`).catch(() => null);
      if (related) setModules(related);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSavingDeviceUser(false);
    }
  }

  async function handleAddDocument(event) {
    event.preventDefault();
    if (!docForm.title.trim()) return;
    setSavingDoc(true);
    setError('');
    try {
      await api(`${base}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          title: docForm.title.trim(),
          docType: docForm.docType || 'OTHER',
          fileName: docForm.fileName || null,
          notes: docForm.notes || null,
          storagePath: null,
        }),
      });
      setDocForm({ title: '', docType: 'OTHER', fileName: '', notes: '' });
      const related = await api(`${base}/modules?month=${encodeURIComponent(month)}&year=${year}`);
      setModules(related);
      setNotice('Document metadata saved.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleResendPayslip(payslipId) {
    setEmailingSlip(payslipId);
    setError('');
    try {
      await api(`/api/hr/payroll/payslips/${payslipId}/email?resend=true`, { method: 'POST' });
      setNotice('Payslip email queued.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setEmailingSlip('');
    }
  }

  return (
    <>
      <PageHeader
        title="Employee Profile"
        description={`${directory} record. Each tab shows this person’s data without leaving the profile.`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {person ? (
              <button className="btn btn-primary" type="button" disabled={saving || !draft} onClick={handleSaveDetails}>
                {saving ? 'Saving…' : 'Update details'}
              </button>
            ) : null}
            <Link className="btn" to="/hr/employees">
              All employees
            </Link>
          </div>
        }
      />
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="muted" style={{ color: 'var(--success-fg)' }}>{notice}</p> : null}
      {loading && !person ? <p className="muted">Loading profile…</p> : null}
      {person && draft ? (
        <>
          <div className="panel profile-hero">
            <div className="panel-pad profile-hero-inner">
              <div className="avatar avatar-lg">{initials({ givenName: person.firstName, familyName: person.lastName })}</div>
              <div>
                <h2 className="section-title" style={{ marginTop: 0 }}>
                  {name}
                </h2>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Employee ID: <span className="mono">{person.employeeNumber}</span>
                  {' · '}
                  Column: {person.workGroup || (staff ? 'BGT' : '—')}
                  {' · '}
                  Department: {person.department || '—'}
                  {' · '}
                  Designation: {person.title || '—'}
                  {' · '}
                  Status: <StatusBadge value={person.status} />
                </p>
              </div>
            </div>
          </div>
          <div className="page-tabs profile-page-tabs" role="tablist" aria-label="Employee profile">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className={`page-tab${tab === item.id ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="panel profile-tab-panel">
            <div className="panel-pad">
              {tab === 'personal' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Personal information
                  </h2>
                  <div className="form-grid">
                    <label className="field">
                      <span>First name</span>
                      <input value={draft.firstName} onChange={(e) => updateDraft('firstName', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Middle name</span>
                      <input value={draft.middleName} onChange={(e) => updateDraft('middleName', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Last name</span>
                      <input value={draft.lastName} onChange={(e) => updateDraft('lastName', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Work email</span>
                      <input value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Personal email</span>
                      <input value={draft.personalEmail} onChange={(e) => updateDraft('personalEmail', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Mobile</span>
                      <input value={draft.mobile} onChange={(e) => updateDraft('mobile', e.target.value)} placeholder="Primary mobile" />
                    </label>
                    <label className="field">
                      <span>Alternate mobile</span>
                      <input value={draft.alternateMobile} onChange={(e) => updateDraft('alternateMobile', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Date of birth</span>
                      <input type="date" value={draft.dateOfBirth} onChange={(e) => updateDraft('dateOfBirth', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Gender</span>
                      <select value={draft.gender} onChange={(e) => updateDraft('gender', e.target.value)}>
                        <option value="">—</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Marital status</span>
                      <select value={draft.maritalStatus} onChange={(e) => updateDraft('maritalStatus', e.target.value)}>
                        <option value="">—</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Blood group</span>
                      <input value={draft.bloodGroup} onChange={(e) => updateDraft('bloodGroup', e.target.value)} placeholder="e.g. O+" />
                    </label>
                    <label className="field span-2">
                      <span>Current address</span>
                      <input value={draft.currentAddress} onChange={(e) => updateDraft('currentAddress', e.target.value)} />
                    </label>
                    <label className="field span-2">
                      <span>Permanent address</span>
                      <input value={draft.permanentAddress} onChange={(e) => updateDraft('permanentAddress', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>City</span>
                      <input value={draft.city} onChange={(e) => updateDraft('city', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>State</span>
                      <input value={draft.state} onChange={(e) => updateDraft('state', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Country</span>
                      <input value={draft.country} onChange={(e) => updateDraft('country', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Pincode</span>
                      <input value={draft.pincode} onChange={(e) => updateDraft('pincode', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Emergency contact name</span>
                      <input value={draft.emergencyContactName} onChange={(e) => updateDraft('emergencyContactName', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Emergency contact phone</span>
                      <input value={draft.emergencyContactPhone} onChange={(e) => updateDraft('emergencyContactPhone', e.target.value)} />
                    </label>
                  </div>
                  <div className="form-actions" style={{ marginTop: 16 }}>
                    <button className="btn btn-primary" type="button" disabled={saving} onClick={handleSaveDetails}>
                      {saving ? 'Saving…' : 'Save personal details'}
                    </button>
                    <Link className="btn" to={`/hr/employees/edit/${staff ? 'staff' : 'employees'}/${id}`}>
                      Open full edit form
                    </Link>
                  </div>
                </>
              ) : null}
              {tab === 'employment' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Employment
                  </h2>
                  <div className="form-grid">
                    <label className="field">
                      <span>Employee ID</span>
                      <input
                        className="mono"
                        value={draft.employeeNumber}
                        onChange={(e) => updateDraft('employeeNumber', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Employment type</span>
                      <input readOnly value={directory} />
                    </label>
                    <label className="field">
                      <span>Work group / column</span>
                      {staff ? (
                        <input readOnly value="BGT" />
                      ) : (
                        <select value={draft.workGroup} onChange={(e) => updateDraft('workGroup', e.target.value)}>
                          {['Ruchitha', 'Akhil', 'BSK', 'Krystal'].map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                    <label className="field">
                      <span>Department</span>
                      <select
                        value={draft.departmentId}
                        onChange={(e) => updateDraft('departmentId', e.target.value)}
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
                        value={draft.designationId}
                        onChange={(e) => updateDraft('designationId', e.target.value)}
                        disabled={!draft.departmentId}
                      >
                        <option value="">
                          {draft.departmentId ? 'Select designation' : 'Select department first'}
                        </option>
                        {designations.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.displayLabel || d.name}
                          </option>
                        ))}
                      </select>
                      <small className="muted">
                        <Link to="/hr/organization/designations">Add / manage designations</Link>
                      </small>
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select value={draft.status} onChange={(e) => updateDraft('status', e.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_LEAVE">On leave</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Date of joining</span>
                      <input type="date" value={draft.hiredOn} onChange={(e) => updateDraft('hiredOn', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Date of confirmation</span>
                      <input
                        type="date"
                        value={draft.dateOfConfirmation}
                        onChange={(e) => updateDraft('dateOfConfirmation', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Reporting manager</span>
                      <input readOnly value={person.reportingManagerName || 'Not set in org chart'} />
                    </label>
                    <label className="field">
                      <span>Biometric Machine User ID</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className="mono"
                          value={deviceUserInput}
                          onChange={(e) => setDeviceUserInput(e.target.value)}
                          placeholder="e.g. 16"
                          style={{ maxWidth: 180 }}
                        />
                        <button
                          className="btn btn-sm btn-primary"
                          type="button"
                          disabled={savingDeviceUser || deviceUserInput.trim() === (person.deviceUserId || '')}
                          onClick={handleSaveDeviceUser}
                        >
                          {savingDeviceUser ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      {deviceUserNotice ? (
                        <small style={{ color: 'var(--success-fg)', marginTop: 4, display: 'block' }}>
                          ✓ {deviceUserNotice}
                        </small>
                      ) : (
                        <small className="muted" style={{ marginTop: 4, display: 'block' }}>
                          Machine ID on biometric device (e.g. 16). Links past &amp; future punches.
                        </small>
                      )}
                    </label>
                  </div>
                  <div className="form-actions" style={{ marginTop: 16 }}>
                    <button className="btn btn-primary" type="button" disabled={saving} onClick={handleSaveDetails}>
                      {saving ? 'Saving…' : 'Save employment details'}
                    </button>
                  </div>
                </>
              ) : null}
              {tab === 'attendance' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Attendance
                  </h2>
                  <div className="list-toolbar list-toolbar-split">
                    <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                      <span>Month</span>
                      <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                    </label>
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Reloads when you change the month — no live auto-refresh.
                    </p>
                  </div>
                  <div className={`kpi-grid ${staff ? 'kpi-grid-5' : 'kpi-grid-4'}`}>
                    <KpiCard label="Working days" value={attendance?.workingDays} hint={attendance ? `${attendance.from} to ${attendance.to}` : undefined} />
                    <KpiCard label="Present" value={attendance?.summary?.presentDays} />
                    <KpiCard label="Leave" value={attendance?.summary?.leaveDays} />
                    <KpiCard label="Absent" value={attendance?.summary?.absentDays} />
                    {staff ? <KpiCard label="Punches" value={attendance?.punches?.length} /> : null}
                  </div>
                  <h3 className="section-title" style={{ marginTop: 8 }}>
                    Daily attendance
                  </h3>
                  <DataTable
                    rows={monthDays}
                    loading={loading}
                    emptyTitle="No attendance days this month"
                    emptyDescription="Absent, week off, holiday, and present days for this person appear here. Sync monthly attendance if the list is empty."
                    columns={[
                      { key: 'date', header: 'Date', render: (day) => <span className="mono">{day.date}</span> },
                      { key: 'in', header: 'In', render: (day) => (day.in ? formatTime(day.in) : '—') },
                      { key: 'out', header: 'Out', render: (day) => (day.out ? formatTime(day.out) : '—') },
                      {
                        key: 'hours',
                        header: 'Hours',
                        render: (day) => formatHours(day.hours),
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        render: (day) => <StatusBadge value={day.status} />,
                      },
                    ]}
                  />
                  {staff ? (
                    <>
                      <h3 className="section-title" style={{ marginTop: 20 }}>
                        Punch log
                      </h3>
                      <DataTable
                        rows={attendance?.punches || []}
                        loading={loading}
                        emptyTitle="No punches this month"
                        emptyDescription="When this person punches on the TimeWatch machine, those times appear here."
                        columns={[
                          { key: 'punchedAt', header: 'Date', render: (row) => formatDate(row.punchedAt) },
                          { key: 'time', header: 'Time', render: (row) => formatTime(row.punchedAt) },
                          { key: 'method', header: 'Method', render: (row) => <StatusBadge value={row.method} /> },
                          { key: 'source', header: 'Source' },
                        ]}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {tab === 'leave' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Leave
                  </h2>
                  <div className="list-toolbar list-toolbar-split">
                    <label className="field" style={{ marginBottom: 0, minWidth: 120 }}>
                      <span>Year</span>
                      <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                        {[currentYear(), currentYear() - 1, currentYear() - 2].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="kpi-grid kpi-grid-5">
                    <KpiCard label="Requests" value={leave?.total} />
                    <KpiCard label="Pending" value={leave?.pending} />
                    <KpiCard label="Approved" value={leave?.approved} />
                    <KpiCard label="Approved days" value={leave?.approvedDays} />
                    <KpiCard label="Year" value={leave?.year} />
                  </div>
                  <DataTable
                    rows={leave?.rows || []}
                    loading={loading}
                    emptyTitle="No leave this year"
                    emptyDescription="Leave applied under this employee ID or matching CCIDP email is listed here."
                    columns={[
                      { key: 'leaveType', header: 'Type', render: (row) => <StatusBadge value={row.leaveType} /> },
                      { key: 'startOn', header: 'From', render: (row) => formatDate(row.startOn) },
                      { key: 'endOn', header: 'To', render: (row) => formatDate(row.endOn) },
                      { key: 'days', header: 'Days' },
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                      { key: 'recipientName', header: 'Approver' },
                    ]}
                  />
                </>
              ) : null}
              {tab === 'payroll' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Payroll
                  </h2>
                  {payroll?.assignment ? (
                    <p className="muted" style={{ marginTop: 0 }}>
                      Structure: <strong>{payroll.assignment.structureName || payroll.assignment.structureCode || '—'}</strong>
                      {payroll.assignment.effectiveFrom ? ` · from ${formatDate(payroll.assignment.effectiveFrom)}` : ''}
                      {payroll.assignment.ctcOverride != null
                        ? ` · CTC override ${formatMoney(payroll.assignment.ctcOverride)}`
                        : payroll.assignment.effectiveCtc != null
                          ? ` · CTC ${formatMoney(payroll.assignment.effectiveCtc)}`
                          : ''}
                    </p>
                  ) : null}
                  {assignedStructure ? (
                    <div style={{ marginBottom: 16 }}>
                      {(assignedStructure.workGroup === 'BGT' ||
                        String(assignedStructure.code || '').toUpperCase() === 'BGT-STD') && (
                        <BgtPhotoStructureTable
                          lines={assignedStructure.lines}
                          ctc={
                            Number(payroll?.assignment?.effectiveCtc) ||
                            Number(payroll?.assignment?.ctcOverride) ||
                            Number(assignedStructure.defaultCtc) ||
                            0
                          }
                          title={`${assignedStructure.code} · photo CTC order`}
                        />
                      )}
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Name</th>
                              <th>Formula / %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortLinesPhotoOrder(assignedStructure.lines || []).map((line) => (
                              <tr key={line.id || lineCode(line)}>
                                <td className="mono">{lineCode(line)}</td>
                                <td>{line.componentName || '—'}</td>
                                <td>{formulaLabel(line)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                  {payroll?.profile ? (
                    <div className="form-grid" style={{ marginBottom: 16 }}>
                      <label className="field">
                        <span>Bank</span>
                        <input readOnly value={payroll.profile.bankName || '—'} />
                      </label>
                      <label className="field">
                        <span>Account</span>
                        <input readOnly className="mono" value={payroll.profile.bankAccount || '—'} />
                      </label>
                      <label className="field">
                        <span>IFSC</span>
                        <input readOnly className="mono" value={payroll.profile.ifsc || '—'} />
                      </label>
                      <label className="field">
                        <span>PAN</span>
                        <input readOnly className="mono" value={payroll.profile.pan || '—'} />
                      </label>
                      <label className="field">
                        <span>UAN</span>
                        <input readOnly className="mono" value={payroll.profile.uan || '—'} />
                      </label>
                      <label className="field">
                        <span>ESI</span>
                        <input readOnly className="mono" value={payroll.profile.esiNumber || '—'} />
                      </label>
                    </div>
                  ) : null}
                  {payroll?.paySet && slip ? (
                    <>
                      <div className="kpi-grid kpi-grid-5">
                        <KpiCard label="Pay type" value={payTypeLabel(slip.employmentType)} />
                        <KpiCard label="Gross" value={formatMoney(slip.gross)} />
                        <KpiCard label="Net" value={formatMoney(slip.net)} />
                        <KpiCard label="Month" value={payroll.month} />
                        <KpiCard
                          label="Present days"
                          value={payroll.period?.presentInDays ?? payroll.period?.noOfDays}
                        />
                      </div>
                      <div className="form-grid">
                        <div>
                          <h3 className="section-title">Earnings</h3>
                          {(slip.earnings || []).map((line) => (
                            <p key={line.label} className="muted" style={{ marginBottom: 6 }}>
                              {line.label}: <span className="mono">{formatMoney(line.amount)}</span>
                            </p>
                          ))}
                        </div>
                        <div>
                          <h3 className="section-title">Deductions</h3>
                          {(slip.deductions || []).map((line) => (
                            <p key={line.label} className="muted" style={{ marginBottom: 6 }}>
                              {line.label}: <span className="mono">{formatMoney(line.amount)}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                  <h3 className="section-title" style={{ marginTop: 16 }}>
                    Salary slips
                  </h3>
                  <DataTable
                    rows={payroll?.payslips || []}
                    loading={loading}
                    emptyTitle="No payroll payslips"
                    emptyDescription="Payslips from the payroll module appear here once a run is posted for this person."
                    columns={[
                      { key: 'payslipNumber', header: 'Slip #', render: (row) => <span className="mono">{row.payslipNumber}</span> },
                      { key: 'yearMonth', header: 'Month', render: (row) => <span className="mono">{row.yearMonth}</span> },
                      { key: 'gross', header: 'Gross', render: (row) => formatMoney(row.gross) },
                      { key: 'net', header: 'Net', render: (row) => formatMoney(row.net) },
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                      {
                        key: 'actions',
                        header: '',
                        render: (row) => (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <PayslipIconButton
                              className="btn-ghost"
                              icon="view"
                              label="View"
                              href={`/api/hr/payroll/payslips/${row.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                            />
                            <PayslipIconButton
                              className="btn-ghost"
                              icon="print"
                              label="Print"
                              href={`/api/hr/payroll/payslips/${row.id}/print`}
                              target="_blank"
                              rel="noreferrer"
                            />
                            <PayslipIconButton
                              className="btn-ghost"
                              icon="download"
                              label="Download"
                              onClick={() => {
                                const raw = String(row.payslipNumber || 'SalarySlip').replace(/\.html?$/i, '');
                                const fallback = raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
                                downloadBinaryFromUrl(`/api/hr/payroll/payslips/${row.id}/download`, fallback).catch((err) =>
                                  setError(extractError(err))
                                );
                              }}
                            />
                            <PayslipIconButton
                              className="btn-ghost"
                              icon="mail"
                              label="Email"
                              disabled={emailingSlip === row.id}
                              onClick={() => handleResendPayslip(row.id)}
                            />
                          </div>
                        ),
                      },
                    ]}
                  />
                  {!payroll?.paySet && !(payroll?.payslips || []).length ? (
                    <EmptyState
                      title="Pay is not set"
                      description="This person has no salary master or payroll assignment yet. Set pay from Payroll when you are ready."
                    />
                  ) : null}
                </>
              ) : null}
              {tab === 'documents' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Documents
                  </h2>
                  <form className="form-grid" onSubmit={handleAddDocument} style={{ marginBottom: 16 }}>
                    <label className="field">
                      <span>Title</span>
                      <input
                        value={docForm.title}
                        onChange={(e) => setDocForm((c) => ({ ...c, title: e.target.value }))}
                        placeholder="Offer letter"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Type</span>
                      <select value={docForm.docType} onChange={(e) => setDocForm((c) => ({ ...c, docType: e.target.value }))}>
                        <option value="OTHER">Other</option>
                        <option value="ID_PROOF">ID proof</option>
                        <option value="ADDRESS_PROOF">Address proof</option>
                        <option value="OFFER">Offer / contract</option>
                        <option value="CERTIFICATE">Certificate</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>File name (stub)</span>
                      <input
                        value={docForm.fileName}
                        onChange={(e) => setDocForm((c) => ({ ...c, fileName: e.target.value }))}
                        placeholder="optional reference"
                      />
                    </label>
                    <label className="field">
                      <span>Notes</span>
                      <input value={docForm.notes} onChange={(e) => setDocForm((c) => ({ ...c, notes: e.target.value }))} />
                    </label>
                    <div className="form-actions" style={{ alignItems: 'end' }}>
                      <button className="btn btn-primary" type="submit" disabled={savingDoc}>
                        {savingDoc ? 'Saving…' : 'Add document'}
                      </button>
                    </div>
                  </form>
                  <DataTable
                    rows={documents}
                    loading={loading}
                    emptyTitle="No documents yet"
                    emptyDescription="Add document metadata here. File upload storage can be wired later."
                    columns={[
                      { key: 'docType', header: 'Type', render: (row) => <StatusBadge value={row.docType} /> },
                      { key: 'title', header: 'Title' },
                      { key: 'fileName', header: 'File' },
                      { key: 'uploadedAt', header: 'Uploaded', render: (row) => formatDate(row.uploadedAt) },
                      { key: 'uploadedBy', header: 'By' },
                    ]}
                  />
                </>
              ) : null}
              {tab === 'assets' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Assets
                  </h2>
                  <DataTable
                    rows={assets}
                    loading={loading}
                    emptyTitle="No assets assigned"
                    emptyDescription="Assets assigned to this employee ID, email, or name appear here."
                    columns={[
                      { key: 'assetCode', header: 'Code', render: (row) => <span className="mono">{row.assetCode}</span> },
                      { key: 'assetType', header: 'Type', render: (row) => assetTypeLabel(row.assetType) },
                      { key: 'department', header: 'Department', render: (row) => departmentLabel(row.department) },
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                      { key: 'location', header: 'Location' },
                    ]}
                  />
                </>
              ) : null}
              {tab === 'performance' ? (
                <EmptyState
                  title="Performance is not built yet"
                  description="Goals, KPI, and appraisals are not stored. This tab stays on the profile."
                />
              ) : null}
              {tab === 'history' ? (
                <>
                  <h2 className="section-title" style={{ marginTop: 0 }}>
                    Transfers
                  </h2>
                  <DataTable
                    rows={transfers}
                    loading={loading}
                    emptyTitle="No transfers"
                    emptyDescription="Org transfers for this person appear here."
                    columns={[
                      { key: 'transferNumber', header: 'No.', render: (row) => <span className="mono">{row.transferNumber}</span> },
                      { key: 'fromDepartment', header: 'From dept' },
                      { key: 'toDepartment', header: 'To dept' },
                      { key: 'effectiveOn', header: 'Effective', render: (row) => formatDate(row.effectiveOn) },
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                    ]}
                  />
                  <h2 className="section-title" style={{ marginTop: 20 }}>
                    Promotions
                  </h2>
                  <DataTable
                    rows={promotions}
                    loading={loading}
                    emptyTitle="No promotions"
                    emptyDescription="Org promotions for this person appear here."
                    columns={[
                      { key: 'promotionNumber', header: 'No.', render: (row) => <span className="mono">{row.promotionNumber}</span> },
                      { key: 'fromTitle', header: 'From' },
                      { key: 'toTitle', header: 'To' },
                      { key: 'effectiveOn', header: 'Effective', render: (row) => formatDate(row.effectiveOn) },
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                    ]}
                  />
                  <h2 className="section-title" style={{ marginTop: 20 }}>
                    Exit / Resign
                  </h2>
                  <DataTable
                    rows={history}
                    loading={loading}
                    emptyTitle="No exit history"
                    emptyDescription="Resignation and clearance cases for this person appear here."
                    columns={[
                      { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                      { key: 'submittedAt', header: 'Submitted', render: (row) => formatDate(row.submittedAt) },
                      { key: 'requestedLwd', header: 'Last working day', render: (row) => formatDate(row.requestedLwd) },
                      { key: 'noticeEndsOn', header: 'Notice ends', render: (row) => formatDate(row.noticeEndsOn) },
                      { key: 'reasonCode', header: 'Reason' },
                    ]}
                  />
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
