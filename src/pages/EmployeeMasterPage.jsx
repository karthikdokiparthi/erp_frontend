import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { directoryLabel, formatMoney } from '../utils/format';

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'identity', label: 'Identity' },
  { id: 'address', label: 'Address' },
  { id: 'employment', label: 'Employment' },
  { id: 'bank', label: 'Bank' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'education', label: 'Education' },
  { id: 'experience', label: 'Experience' },
  { id: 'documents', label: 'Documents' },
  { id: 'biometric', label: 'Biometric' },
  { id: 'leave', label: 'Leave config' },
];

const TYPES = [
  ['PERMANENT', 'Permanent'],
  ['CONTRACT', 'Contract'],
  ['TEMPORARY', 'Temporary'],
  ['INTERN', 'Intern'],
  ['CONSULTANT', 'Consultant'],
];

const STATUSES = [
  ['ACTIVE', 'Active'],
  ['PROBATION', 'Probation'],
  ['NOTICE_PERIOD', 'Notice Period'],
  ['ON_LEAVE', 'On leave'],
  ['RESIGNED', 'Resigned'],
  ['TERMINATED', 'Terminated'],
  ['INACTIVE', 'Inactive'],
];

const DOC_TYPES = [
  ['AADHAAR', 'Aadhaar'],
  ['PAN', 'PAN'],
  ['PASSPORT', 'Passport'],
  ['RESUME', 'Resume'],
  ['PHOTO', 'Photo'],
  ['EDUCATION', 'Education'],
  ['EXPERIENCE', 'Experience'],
  ['OFFER', 'Offer'],
  ['APPOINTMENT', 'Appointment'],
  ['JOINING', 'Joining'],
  ['BANK_PROOF', 'Bank proof'],
  ['ADDRESS_PROOF', 'Address proof'],
  ['OTHER', 'Other'],
];

const CONTRACT_GROUPS = ['Ruchitha', 'Akhil', 'BSK', 'Krystal'];
const WEEKLY = ['Sunday', 'Saturday', 'Sunday + Saturday', 'Friday'];

function displayPersonName(...parts) {
  const raw = parts.filter(Boolean).join(' ').trim();
  if (!raw) return '—';
  if (raw === raw.toUpperCase() && /[A-Z]/.test(raw)) {
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

function blankAddress() {
  return { line1: '', line2: '', city: '', state: '', country: 'India', pin: '' };
}

function s(value) {
  return value == null ? '' : String(value);
}

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function seedEmploymentKind(seed) {
  if (seed.employmentKind === 'CONTRACT' || seed.employmentKind === 'ON_ROLE') return seed.employmentKind;
  if (seed.personKind === 'EMPLOYEE') return 'CONTRACT';
  if (CONTRACT_GROUPS.includes(seed.workGroup) || seed.employmentType === 'CONTRACT') return 'CONTRACT';
  return 'ON_ROLE';
}

function emptyProfile(seed = {}) {
  const employmentKind = seedEmploymentKind(seed);
  const contract = employmentKind === 'CONTRACT';
  return {
    personId: null,
    personKind: null,
    employmentKind,
    employeeNumber: '',
    firstName: '',
    middleName: '',
    lastName: '',
    revealIdentity: true,
    loginNote: 'Login via company SSO (work email). This ERP does not store a local password.',
    personal: {
      photoUrl: '',
      dateOfBirth: '',
      gender: '',
      bloodGroup: '',
      maritalStatus: '',
      nationality: 'Indian',
      personalEmail: '',
      mobile: '',
      alternateMobile: '',
    },
    identity: {
      aadhaar: '', pan: '', passport: '', drivingLicense: '', uan: '', pfNumber: '', esicNumber: '',
    },
    currentAddress: blankAddress(),
    permanentAddress: blankAddress(),
    permanentSameAsCurrent: false,
    employment: {
      hiredOn: '',
      employmentType: seed.employmentType || 'PERMANENT',
      employmentStatus: 'ACTIVE',
      departmentId: '',
      designationId: '',
      department: '',
      title: '',
      jobRole: '',
      grade: '',
      reportingManagerId: '',
      reportingManagerKind: '',
      hrManagerId: '',
      hrManagerKind: '',
      branchId: '',
      shiftId: '',
      workEmail: '',
      workPhone: '',
      workLocation: '',
      workGroup: contract
        ? (CONTRACT_GROUPS.includes(seed.workGroup) ? seed.workGroup : '')
        : 'BGT',
      probationStart: '',
      probationEnd: '',
      confirmationDate: '',
      dateOfLeaving: '',
      reasonForLeaving: '',
    },
    bank: { bankName: '', accountHolder: '', accountNumber: '', ifsc: '', branch: '', accountType: '' },
    salary: { managedInPayroll: true, basic: null, monthlySalary: null, payrollPath: '/hr/payroll' },
    emergencyContacts: [],
    education: [],
    experience: [],
    documents: [],
    biometric: { deviceUserId: '', enrolled: false, link: '/hr/employees/biometric' },
    leave: { leaveGroup: '', weeklyOff: 'Sunday', shiftId: '', notes: '' },
    legacyExperienceNote: '',
  };
}

function hydrate(profile) {
  const base = emptyProfile();
  if (!profile) return base;
  const personal = profile.personal || {};
  const identity = profile.identity || {};
  const employment = profile.employment || {};
  const bank = profile.bank || {};
  const leave = profile.leave || {};
  return {
    ...base,
    personId: profile.personId,
    personKind: profile.personKind,
    employmentKind: profile.personKind === 'EMPLOYEE' ? 'CONTRACT' : 'ON_ROLE',
    employeeNumber: s(profile.employeeNumber),
    firstName: s(profile.firstName),
    middleName: s(profile.middleName),
    lastName: s(profile.lastName),
    revealIdentity: profile.revealIdentity !== false,
    loginNote: profile.loginNote || base.loginNote,
    personal: {
      photoUrl: s(personal.photoUrl),
      dateOfBirth: dateOnly(personal.dateOfBirth),
      gender: s(personal.gender),
      bloodGroup: s(personal.bloodGroup),
      maritalStatus: s(personal.maritalStatus),
      nationality: s(personal.nationality) || 'Indian',
      personalEmail: s(personal.personalEmail),
      mobile: s(personal.mobile),
      alternateMobile: s(personal.alternateMobile),
    },
    identity: {
      aadhaar: s(identity.aadhaar),
      pan: s(identity.pan),
      passport: s(identity.passport),
      drivingLicense: s(identity.drivingLicense),
      uan: s(identity.uan),
      pfNumber: s(identity.pfNumber),
      esicNumber: s(identity.esicNumber),
    },
    currentAddress: { ...blankAddress(), ...(profile.currentAddress || {}) },
    permanentAddress: { ...blankAddress(), ...(profile.permanentAddress || {}) },
    permanentSameAsCurrent: Boolean(profile.permanentSameAsCurrent),
    employment: {
      ...base.employment,
      ...employment,
      hiredOn: dateOnly(employment.hiredOn),
      probationStart: dateOnly(employment.probationStart),
      probationEnd: dateOnly(employment.probationEnd),
      confirmationDate: dateOnly(employment.confirmationDate),
      dateOfLeaving: dateOnly(employment.dateOfLeaving),
      departmentId: s(employment.departmentId),
      designationId: s(employment.designationId),
      reportingManagerId: s(employment.reportingManagerId),
      reportingManagerKind: s(employment.reportingManagerKind),
      hrManagerId: s(employment.hrManagerId),
      hrManagerKind: s(employment.hrManagerKind),
      branchId: s(employment.branchId),
      shiftId: s(employment.shiftId),
      jobRole: s(employment.jobRole),
      grade: s(employment.grade),
      workEmail: s(employment.workEmail),
      workPhone: s(employment.workPhone),
      workLocation: s(employment.workLocation),
      workGroup: s(employment.workGroup) || base.employment.workGroup,
      reasonForLeaving: s(employment.reasonForLeaving),
      employmentType: s(employment.employmentType) || 'PERMANENT',
      employmentStatus: s(employment.employmentStatus) || 'ACTIVE',
    },
    bank: {
      bankName: s(bank.bankName),
      accountHolder: s(bank.accountHolder),
      accountNumber: s(bank.accountNumber),
      ifsc: s(bank.ifsc),
      branch: s(bank.branch),
      accountType: s(bank.accountType),
    },
    salary: profile.salary || base.salary,
    emergencyContacts: (profile.emergencyContacts || []).map((row) => ({
      id: row.id, name: s(row.name), relationship: s(row.relationship), mobile: s(row.mobile),
      alternateMobile: s(row.alternateMobile), email: s(row.email), address: s(row.address),
    })),
    education: (profile.education || []).map((row) => ({
      id: row.id, qualification: s(row.qualification), institution: s(row.institution),
      boardUniversity: s(row.boardUniversity), yearCompleted: row.yearCompleted ?? '', score: s(row.score),
    })),
    experience: (profile.experience || []).map((row) => ({
      id: row.id, company: s(row.company), designation: s(row.designation), employmentType: s(row.employmentType),
      joiningDate: dateOnly(row.joiningDate), relievingDate: dateOnly(row.relievingDate),
      experienceText: s(row.experienceText), lastSalary: row.lastSalary ?? '', reason: s(row.reason),
      certificateAvailable: Boolean(row.certificateAvailable), certificateFileName: s(row.certificateFileName),
    })),
    documents: profile.documents || [],
    biometric: profile.biometric || base.biometric,
    leave: {
      leaveGroup: s(leave.leaveGroup),
      weeklyOff: s(leave.weeklyOff) || 'Sunday',
      shiftId: s(leave.shiftId || employment.shiftId),
      notes: s(leave.notes),
      shiftName: s(leave.shiftName),
    },
    legacyExperienceNote: s(profile.legacyExperienceNote),
  };
}

function nil(value) {
  return value == null || String(value).trim() === '' ? null : String(value).trim();
}

function toPayload(draft) {
  const addr = (row) => ({
    line1: nil(row.line1),
    line2: nil(row.line2),
    city: nil(row.city),
    state: nil(row.state),
    country: nil(row.country),
    pin: nil(row.pin),
  });
  const employment = draft.employment;
  return {
    employmentKind: draft.employmentKind === 'CONTRACT' ? 'CONTRACT' : 'ON_ROLE',
    employeeNumber: nil(draft.employeeNumber),
    firstName: draft.firstName,
    middleName: nil(draft.middleName),
    lastName: draft.lastName,
    personal: {
      photoUrl: draft.personal.photoUrl || '',
      dateOfBirth: nil(draft.personal.dateOfBirth),
      gender: nil(draft.personal.gender),
      bloodGroup: nil(draft.personal.bloodGroup),
      maritalStatus: nil(draft.personal.maritalStatus),
      nationality: nil(draft.personal.nationality),
      personalEmail: nil(draft.personal.personalEmail),
      mobile: nil(draft.personal.mobile),
      alternateMobile: nil(draft.personal.alternateMobile),
    },
    identity: {
      aadhaar: draft.identity.aadhaar ?? '',
      pan: draft.identity.pan ?? '',
      passport: draft.identity.passport ?? '',
      drivingLicense: draft.identity.drivingLicense ?? '',
      uan: draft.identity.uan ?? '',
      pfNumber: draft.identity.pfNumber ?? '',
      esicNumber: draft.identity.esicNumber ?? '',
    },
    currentAddress: addr(draft.currentAddress),
    permanentAddress: draft.permanentSameAsCurrent ? addr(draft.currentAddress) : addr(draft.permanentAddress),
    permanentSameAsCurrent: Boolean(draft.permanentSameAsCurrent),
    employment: {
      hiredOn: nil(employment.hiredOn),
      employmentType: employment.employmentType,
      employmentStatus: employment.employmentStatus,
      departmentId: nil(employment.departmentId),
      designationId: nil(employment.designationId),
      department: nil(employment.department),
      title: nil(employment.title),
      jobRole: nil(employment.jobRole),
      grade: nil(employment.grade),
      reportingManagerId: nil(employment.reportingManagerId),
      reportingManagerKind: nil(employment.reportingManagerKind),
      hrManagerId: nil(employment.hrManagerId),
      hrManagerKind: nil(employment.hrManagerKind),
      branchId: nil(employment.branchId),
      shiftId: nil(employment.shiftId),
      workEmail: nil(employment.workEmail),
      workPhone: nil(employment.workPhone),
      workLocation: nil(employment.workLocation),
      workGroup: draft.employmentKind === 'CONTRACT' ? nil(employment.workGroup) : 'BGT',
      probationStart: nil(employment.probationStart),
      probationEnd: nil(employment.probationEnd),
      confirmationDate: nil(employment.confirmationDate),
      dateOfLeaving: nil(employment.dateOfLeaving),
      reasonForLeaving: nil(employment.reasonForLeaving),
    },
    bank: {
      bankName: nil(draft.bank.bankName),
      accountHolder: nil(draft.bank.accountHolder),
      accountNumber: draft.bank.accountNumber ?? '',
      ifsc: nil(draft.bank.ifsc),
      branch: nil(draft.bank.branch),
      accountType: nil(draft.bank.accountType),
    },
    emergencyContacts: draft.emergencyContacts.map((row) => ({
      id: row.id || null,
      name: nil(row.name),
      relationship: nil(row.relationship),
      mobile: nil(row.mobile),
      alternateMobile: nil(row.alternateMobile),
      email: nil(row.email),
      address: nil(row.address),
    })),
    education: draft.education.map((row) => ({
      id: row.id || null,
      qualification: nil(row.qualification),
      institution: nil(row.institution),
      boardUniversity: nil(row.boardUniversity),
      yearCompleted: row.yearCompleted === '' || row.yearCompleted == null ? null : Number(row.yearCompleted),
      score: nil(row.score),
    })),
    experience: draft.experience.map((row) => ({
      id: row.id || null,
      company: nil(row.company),
      designation: nil(row.designation),
      employmentType: nil(row.employmentType),
      joiningDate: nil(row.joiningDate),
      relievingDate: nil(row.relievingDate),
      experienceText: nil(row.experienceText),
      lastSalary: row.lastSalary === '' || row.lastSalary == null ? null : Number(row.lastSalary),
      reason: nil(row.reason),
    })),
    documents: (draft.documents || []).filter((row) => row.id).map((row) => ({
      id: row.id,
      docType: row.docType,
      title: row.title,
      verificationStatus: row.verificationStatus,
    })),
    leave: {
      leaveGroup: nil(draft.leave.leaveGroup),
      weeklyOff: nil(draft.leave.weeklyOff),
      shiftId: nil(draft.leave.shiftId || employment.shiftId),
      notes: nil(draft.leave.notes),
    },
  };
}

export function EmployeeMasterPage() {
  const [searchParams] = useSearchParams();
  const openedQuery = useRef(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [docType, setDocType] = useState('RESUME');
  const [docTitle, setDocTitle] = useState('');
  const [org, setOrg] = useState({ branches: [], departments: [], designations: [], shifts: [] });

  async function loadList() {
    const data = await api('/api/hr/employee-master');
    setRows(Array.isArray(data) ? data : []);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadList();
      } catch (err) {
        if (!cancelled) setError(extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      async function safe(path) {
        try { return await api(path); } catch { return null; }
      }
      let [branches, departments, designations, shifts] = await Promise.all([
        safe('/api/hr/organization/branches'),
        safe('/api/hr/organization/departments?activeOnly=true'),
        safe('/api/hr/organization/designations'),
        safe('/api/hr/attendance/shifts'),
      ]);
      if ((!departments || departments.length === 0)) {
        try {
          await api('/api/hr/organization/departments/ensure', { method: 'POST', body: '{}' });
          departments = await api('/api/hr/organization/departments?activeOnly=true');
        } catch { /* keep empty */ }
      }
      if (!cancelled) {
        setOrg({
          branches: Array.isArray(branches) ? branches : [],
          departments: Array.isArray(departments) ? departments : [],
          designations: Array.isArray(designations) ? designations : [],
          shifts: Array.isArray(shifts?.shifts) ? shifts.shifts : [],
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (!needle) return true;
      const name = `${row.firstName || ''} ${row.middleName || ''} ${row.lastName || ''}`.toLowerCase();
      return name.includes(needle) || String(row.employeeNumber || '').toLowerCase().includes(needle);
    });
  }, [rows, query, statusFilter]);

  const designations = useMemo(() => {
    const all = org.designations || [];
    const deptId = draft?.employment?.departmentId;
    if (!deptId) return all.filter((d) => d.status !== 'INACTIVE');
    return all.filter((d) => d.departmentId === deptId && d.status !== 'INACTIVE');
  }, [org.designations, draft?.employment?.departmentId]);

  async function openPerson(kind, id) {
    setSaving(true);
    setError('');
    setNotice('');
    setPhotoFile(null);
    setPhotoPreview('');
    try {
      const profile = await api(`/api/hr/employee-master/${kind}/${id}`);
      setDraft(hydrate(profile));
      setTab('personal');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function startNew(seed = {}) {
    setError('');
    setNotice('');
    setPhotoFile(null);
    setPhotoPreview('');
    const next = emptyProfile(seed);
    try {
      const code = await api('/api/hr/people/next-code');
      next.employeeNumber = code.employeeNumber || '';
    } catch { /* code allocated on save */ }
    setDraft(next);
    setTab('personal');
  }

  useEffect(() => {
    if (loading || openedQuery.current) return;
    const kind = searchParams.get('kind');
    const id = searchParams.get('id');
    if (kind && id) {
      openedQuery.current = true;
      openPerson(kind, id);
      return;
    }
    if (searchParams.get('new') === '1') {
      openedQuery.current = true;
      const type = (searchParams.get('employmentType') || 'PERMANENT').toUpperCase();
      startNew({ employmentType: type, workGroup: searchParams.get('workGroup') || undefined });
    }
  }, [loading, searchParams]);

  function patch(section, key, value) {
    setDraft((current) => {
      if (!current) return current;
      if (!section) return { ...current, [key]: value };
      return { ...current, [section]: { ...current[section], [key]: value } };
    });
  }

  function setManager(sectionKey, kindKey, value) {
    const [kind, id] = value ? value.split(':') : ['', ''];
    setDraft((current) => ({
      ...current,
      employment: { ...current.employment, [sectionKey]: id || '', [kindKey]: kind || '' },
    }));
  }

  function updateRow(listName, index, key, value) {
    setDraft((current) => {
      const list = current[listName].map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...current, [listName]: list };
    });
  }

  function setEmploymentKind(next) {
    setDraft((current) => {
      if (!current || current.personId) return current;
      return {
        ...current,
        employmentKind: next,
        employment: {
          ...current.employment,
          workGroup: next === 'ON_ROLE' ? 'BGT' : '',
        },
      };
    });
  }

  async function persist() {
    if (!draft) return null;
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      throw new Error('First name and last name are required');
    }
    if (draft.employmentKind !== 'ON_ROLE' && draft.employmentKind !== 'CONTRACT') {
      throw new Error('Employment kind is required');
    }
    if (draft.employmentKind === 'CONTRACT' && !CONTRACT_GROUPS.includes(draft.employment.workGroup)) {
      throw new Error('Select a contract company');
    }
    const isNew = !draft.personId;
    const saved = await api(
      isNew ? '/api/hr/employee-master' : `/api/hr/employee-master/${draft.personKind}/${draft.personId}`,
      { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(toPayload(draft)) },
    );
    let next = saved;
    if (photoFile) {
      const body = new FormData();
      body.append('file', photoFile);
      next = await api(`/api/hr/employee-master/${saved.personKind}/${saved.personId}/photo`, { method: 'POST', body });
      setPhotoFile(null);
      setPhotoPreview('');
    }
    setDraft(hydrate(next));
    await loadList();
    return next;
  }

  async function handleSave(andNext) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await persist();
      setNotice('Employee saved.');
      if (andNext) {
        const index = TABS.findIndex((item) => item.id === tab);
        if (index >= 0 && index < TABS.length - 1) setTab(TABS[index + 1].id);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setError('');
    setNotice('');
    setPhotoFile(null);
    setPhotoPreview('');
    if (!draft?.personId) {
      setDraft(null);
      return;
    }
    await openPerson(draft.personKind, draft.personId);
  }

  async function handleDelete() {
    if (!draft?.personId) return;
    if (!window.confirm(`Mark ${draft.employeeNumber || 'this employee'} inactive?`)) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/hr/people/${draft.personKind}/${draft.personId}`, { method: 'DELETE' });
      setDraft(null);
      await loadList();
      setNotice('Employee marked inactive.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(file) {
    if (!draft?.personId) {
      setError('Save the employee before uploading documents.');
      return;
    }
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('docType', docType);
      if (docTitle.trim()) body.append('title', docTitle.trim());
      const row = await api(`/api/hr/employee-master/${draft.personKind}/${draft.personId}/documents`, {
        method: 'POST',
        body,
      });
      setDraft((current) => ({ ...current, documents: [row, ...(current.documents || [])] }));
      setDocTitle('');
      setNotice('Document uploaded.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeDocument(docId) {
    if (!draft?.personId || !window.confirm('Remove this document?')) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/hr/employee-master/${draft.personKind}/${draft.personId}/documents/${docId}`, { method: 'DELETE' });
      setDraft((current) => ({ ...current, documents: current.documents.filter((row) => row.id !== docId) }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function downloadFile(path, filename) {
    try {
      const response = await fetch(path, { credentials: 'include' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || 'download';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractError(err));
    }
  }

  async function uploadCertificate(experienceId, file) {
    if (!draft?.personId || !experienceId || !file) {
      setError('Save the experience row before attaching a certificate.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const profile = await api(
        `/api/hr/employee-master/${draft.personKind}/${draft.personId}/experience/${experienceId}/certificate`,
        { method: 'POST', body },
      );
      setDraft(hydrate(profile));
      setNotice('Certificate uploaded.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const editing = Boolean(draft);
  const name = draft
    ? (draft.firstName || draft.lastName ? displayPersonName(draft.firstName, draft.lastName) : 'New employee')
    : 'Employee details';
  const lockedIdentity = draft && draft.revealIdentity === false;
  const photoSrc = photoPreview || draft?.personal?.photoUrl || '';

  return (
    <div className="emp-master-page">
      <PageHeader
        title="Employee Master"
        eyebrow="Employee Management"
        description="Registration for On-Role and Contract people. Attendance, payroll, and biometric stay on the existing staff and employee records."
      />

      <div className="emp-master-toolbar panel">
        <div className="emp-master-toolbar__actions btn-row">
          <button type="button" className="btn btn-primary" onClick={() => startNew()} disabled={saving}>New</button>
          <button type="button" className="btn" onClick={handleDelete} disabled={saving || !draft?.personId}>Delete</button>
          <button type="button" className="btn" onClick={() => loadList().catch((err) => setError(extractError(err)))} disabled={saving}>Refresh</button>
        </div>
        <div className="emp-master-toolbar__filters">
          <input className="emp-master-search" placeholder="Search code / name…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {error ? <p className="form-error emp-master-alert" role="alert">{error}</p> : null}
      {notice ? <p className="form-notice emp-master-alert" role="status">{notice}</p> : null}

      <div className="split-2 emp-master-split">
        <section className="panel emp-master-list" aria-label="Employee directory">
          <div className="emp-master-list-head">
            <h2 className="section-title">Employees</h2>
            <span className="emp-master-count">{loading ? '…' : visible.length}</span>
          </div>
          <div className="emp-master-list-body">
            {loading ? <div className="emp-master-list-state muted">Loading directory…</div> : null}
            {!loading && !visible.length ? <div className="emp-master-list-state muted">No employees match.</div> : null}
            <ul className="emp-master-directory">
              {visible.map((row) => {
                const active = draft?.personId === row.id && draft?.personKind === row.personKind;
                return (
                  <li key={`${row.personKind}-${row.id}`}>
                    <button type="button" className={`emp-master-row${active ? ' is-selected' : ''}`} onClick={() => openPerson(row.personKind, row.id)}>
                      <div className="emp-master-row__top">
                        <span className="emp-master-code mono">{row.employeeNumber}</span>
                        <StatusBadge value={row.status} />
                      </div>
                      <span className="emp-master-name">{displayPersonName(row.firstName, row.lastName)}</span>
                      <div className="emp-master-row__meta">
                        <StatusBadge value={directoryLabel(row.personKind)} />
                        {row.department ? <span className="emp-master-row__dept">{row.department}</span> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="panel emp-master-editor" aria-label="Employee registration">
          <div className="emp-master-editor-pad">
            {!editing ? <p className="muted">Select an employee or click New.</p> : (
              <>
                <div className="emp-master-editor-head">
                  <div>
                    <h2>{name}</h2>
                    <p className="muted emp-master-editor-sub">
                      {draft.personId
                        ? `${draft.employeeNumber} · ${directoryLabel(draft.personKind)}`
                        : 'New record — On-Role is saved under BGT. Contract is saved under the company you pick.'}
                    </p>
                  </div>
                  <div className="badge-row">
                    <span className="badge badge-neutral">{TYPES.find((item) => item[0] === draft.employment.employmentType)?.[1] || draft.employment.employmentType}</span>
                    <StatusBadge value={draft.employment.employmentStatus} />
                  </div>
                </div>

                <div className="profile-tabs emp-master-tabs" role="tablist">
                  {TABS.map((item) => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`profile-tab${tab === item.id ? ' is-active' : ''}`} onClick={() => setTab(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>

                {tab === 'personal' ? (
                  <div className="emp-master-card">
                    <div className="emp-kind-stack">
                      <Field label="Employment kind" hint={draft.personId ? 'Saved records stay on this master so attendance and payroll links do not move.' : 'Required. On-Role uses the BGT staff record. Contract uses the contract record.'}>
                        <select value={draft.employmentKind} disabled={Boolean(draft.personId)} onChange={(e) => setEmploymentKind(e.target.value)}>
                          <option value="ON_ROLE">On-Role</option>
                          <option value="CONTRACT">Contract</option>
                        </select>
                      </Field>
                      <Field label="Company" hint={draft.employmentKind === 'ON_ROLE' ? 'On-Role is BGT only.' : 'Pick one contract company.'}>
                        <select
                          value={draft.employment.workGroup}
                          disabled={draft.employmentKind === 'ON_ROLE'}
                          onChange={(e) => patch('employment', 'workGroup', e.target.value)}
                        >
                          {draft.employmentKind === 'CONTRACT' ? <option value="">Select company</option> : null}
                          {(draft.employmentKind === 'CONTRACT' ? CONTRACT_GROUPS : ['BGT']).map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="emp-master-photo-row">
                      {photoSrc ? <img className="emp-master-photo" src={photoSrc} alt="" /> : <div className="emp-master-photo emp-master-photo--empty">Photo</div>}
                      <div className="form-grid">
                        <Field label="Employee code">
                          <input value={draft.employeeNumber} onChange={(e) => patch(null, 'employeeNumber', e.target.value)} />
                        </Field>
                        <Field label="First name">
                          <input value={draft.firstName} onChange={(e) => patch(null, 'firstName', e.target.value)} required />
                        </Field>
                        <Field label="Middle name">
                          <input value={draft.middleName} onChange={(e) => patch(null, 'middleName', e.target.value)} />
                        </Field>
                        <Field label="Last name">
                          <input value={draft.lastName} onChange={(e) => patch(null, 'lastName', e.target.value)} required />
                        </Field>
                        <Field label="Profile photo" hint="Image upload, or paste an image URL">
                          <input type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            setPhotoFile(file || null);
                            setPhotoPreview(file ? URL.createObjectURL(file) : '');
                          }} />
                          <input placeholder="https://…" value={draft.personal.photoUrl.startsWith('/api/') ? '' : draft.personal.photoUrl} onChange={(e) => patch('personal', 'photoUrl', e.target.value)} />
                        </Field>
                        <Field label="Date of birth"><input type="date" value={draft.personal.dateOfBirth} onChange={(e) => patch('personal', 'dateOfBirth', e.target.value)} /></Field>
                        <Field label="Gender">
                          <select value={draft.personal.gender} onChange={(e) => patch('personal', 'gender', e.target.value)}>
                            <option value="">Select</option>
                            {['Male', 'Female', 'Other', 'Prefer not to say'].map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                        <Field label="Blood group">
                          <select value={draft.personal.bloodGroup} onChange={(e) => patch('personal', 'bloodGroup', e.target.value)}>
                            <option value="">Select</option>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                        <Field label="Marital status">
                          <select value={draft.personal.maritalStatus} onChange={(e) => patch('personal', 'maritalStatus', e.target.value)}>
                            <option value="">Select</option>
                            {['Single', 'Married', 'Divorced', 'Widowed', 'Other'].map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                        <Field label="Nationality"><input value={draft.personal.nationality} onChange={(e) => patch('personal', 'nationality', e.target.value)} /></Field>
                        <Field label="Personal email"><input type="email" value={draft.personal.personalEmail} onChange={(e) => patch('personal', 'personalEmail', e.target.value)} /></Field>
                        <Field label="Mobile"><input value={draft.personal.mobile} onChange={(e) => patch('personal', 'mobile', e.target.value)} /></Field>
                        <Field label="Alternate mobile"><input value={draft.personal.alternateMobile} onChange={(e) => patch('personal', 'alternateMobile', e.target.value)} /></Field>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === 'identity' ? (
                  <div className="emp-master-card">
                    <p className="muted emp-master-card-lead">
                      {lockedIdentity
                        ? 'Aadhaar and PAN are masked. Only HR can view the full numbers.'
                        : 'Full Aadhaar and PAN are visible to HR. They are not written to application logs.'}
                    </p>
                    <div className="form-grid">
                      <Field label="Aadhaar"><input value={draft.identity.aadhaar} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'aadhaar', e.target.value)} placeholder="12 digits" /></Field>
                      <Field label="PAN"><input value={draft.identity.pan} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'pan', e.target.value)} placeholder="ABCDE1234F" /></Field>
                      <Field label="Passport"><input value={draft.identity.passport} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'passport', e.target.value)} /></Field>
                      <Field label="Driving license"><input value={draft.identity.drivingLicense} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'drivingLicense', e.target.value)} /></Field>
                      <Field label="UAN"><input value={draft.identity.uan} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'uan', e.target.value)} /></Field>
                      <Field label="PF number"><input value={draft.identity.pfNumber} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'pfNumber', e.target.value)} /></Field>
                      <Field label="ESIC"><input value={draft.identity.esicNumber} readOnly={lockedIdentity} onChange={(e) => patch('identity', 'esicNumber', e.target.value)} /></Field>
                    </div>
                  </div>
                ) : null}

                {tab === 'address' ? (
                  <div className="emp-master-card">
                    <h3 className="section-title">Current address</h3>
                    <AddressFields value={draft.currentAddress} onChange={(key, value) => patch('currentAddress', key, value)} />
                    <label className="check-row">
                      <input type="checkbox" checked={draft.permanentSameAsCurrent} onChange={(e) => patch(null, 'permanentSameAsCurrent', e.target.checked)} />
                      Permanent same as current
                    </label>
                    <h3 className="section-title">Permanent address</h3>
                    <AddressFields
                      value={draft.permanentSameAsCurrent ? draft.currentAddress : draft.permanentAddress}
                      disabled={draft.permanentSameAsCurrent}
                      onChange={(key, value) => patch('permanentAddress', key, value)}
                    />
                  </div>
                ) : null}

                {tab === 'employment' ? (
                  <div className="emp-master-card">
                    <p className="muted emp-master-card-lead">{draft.loginNote}</p>
                    <p className="muted">Company is chosen on the Personal tab. On-Role is BGT. Contract is Ruchitha, Akhil, BSK, or Krystal.</p>
                    <div className="form-grid">
                      <Field label="Date of joining"><input type="date" value={draft.employment.hiredOn} onChange={(e) => patch('employment', 'hiredOn', e.target.value)} /></Field>
                      <Field label="Employment type">
                        <select value={draft.employment.employmentType} onChange={(e) => patch('employment', 'employmentType', e.target.value)}>
                          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select value={draft.employment.employmentStatus} onChange={(e) => patch('employment', 'employmentStatus', e.target.value)}>
                          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </Field>
                      <Field label="Department">
                        <select value={draft.employment.departmentId} onChange={(e) => {
                          const dept = org.departments.find((item) => item.id === e.target.value);
                          setDraft((current) => ({
                            ...current,
                            employment: {
                              ...current.employment,
                              departmentId: e.target.value,
                              department: dept?.name || '',
                              designationId: '',
                            },
                          }));
                        }}>
                          <option value="">Select</option>
                          {org.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Designation">
                        <select value={draft.employment.designationId} onChange={(e) => patch('employment', 'designationId', e.target.value)}>
                          <option value="">Select</option>
                          {designations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Job role"><input value={draft.employment.jobRole} onChange={(e) => patch('employment', 'jobRole', e.target.value)} /></Field>
                      <Field label="Grade"><input value={draft.employment.grade} onChange={(e) => patch('employment', 'grade', e.target.value)} /></Field>
                      <Field label="Reporting manager">
                        <PersonSelect rows={rows} value={`${draft.employment.reportingManagerKind}:${draft.employment.reportingManagerId}`} selfId={draft.personId} onChange={(value) => setManager('reportingManagerId', 'reportingManagerKind', value)} />
                      </Field>
                      <Field label="HR manager">
                        <PersonSelect rows={rows} value={`${draft.employment.hrManagerKind}:${draft.employment.hrManagerId}`} selfId={draft.personId} onChange={(value) => setManager('hrManagerId', 'hrManagerKind', value)} />
                      </Field>
                      <Field label="Branch / location">
                        <select value={draft.employment.branchId} onChange={(e) => patch('employment', 'branchId', e.target.value)}>
                          <option value="">Select</option>
                          {org.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Work location"><input value={draft.employment.workLocation} onChange={(e) => patch('employment', 'workLocation', e.target.value)} /></Field>
                      <Field label="Work shift">
                        <select value={draft.employment.shiftId} onChange={(e) => {
                          patch('employment', 'shiftId', e.target.value);
                          patch('leave', 'shiftId', e.target.value);
                        }}>
                          <option value="">Select</option>
                          {org.shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Work email"><input type="email" value={draft.employment.workEmail} onChange={(e) => patch('employment', 'workEmail', e.target.value)} /></Field>
                      <Field label="Work phone"><input value={draft.employment.workPhone} onChange={(e) => patch('employment', 'workPhone', e.target.value)} /></Field>
                      <Field label="Probation start"><input type="date" value={draft.employment.probationStart} onChange={(e) => patch('employment', 'probationStart', e.target.value)} /></Field>
                      <Field label="Probation end"><input type="date" value={draft.employment.probationEnd} onChange={(e) => patch('employment', 'probationEnd', e.target.value)} /></Field>
                      <Field label="Confirmation date"><input type="date" value={draft.employment.confirmationDate} onChange={(e) => patch('employment', 'confirmationDate', e.target.value)} /></Field>
                      <Field label="Date of leaving"><input type="date" value={draft.employment.dateOfLeaving} onChange={(e) => patch('employment', 'dateOfLeaving', e.target.value)} /></Field>
                      <Field label="Reason for leaving"><input value={draft.employment.reasonForLeaving} onChange={(e) => patch('employment', 'reasonForLeaving', e.target.value)} /></Field>
                    </div>
                  </div>
                ) : null}

                {tab === 'bank' ? (
                  <div className="emp-master-card">
                    <p className="muted emp-master-card-lead">
                      Salary is managed in Payroll
                      {draft.salary?.payrollPath ? <> · <Link to={draft.salary.payrollPath}>Open payroll</Link></> : null}
                      {draft.salary?.basic != null ? ` · Basic ${formatMoney(draft.salary.basic)}` : ''}
                      {draft.salary?.monthlySalary != null ? ` · Package ${formatMoney(draft.salary.monthlySalary)}` : ''}
                    </p>
                    <div className="form-grid">
                      <Field label="Bank name"><input value={draft.bank.bankName} onChange={(e) => patch('bank', 'bankName', e.target.value)} /></Field>
                      <Field label="Account holder"><input value={draft.bank.accountHolder} onChange={(e) => patch('bank', 'accountHolder', e.target.value)} /></Field>
                      <Field label="Account number" hint={lockedIdentity ? 'Masked' : 'Stored in full for HR'}>
                        <input value={draft.bank.accountNumber} readOnly={lockedIdentity} onChange={(e) => patch('bank', 'accountNumber', e.target.value)} />
                      </Field>
                      <Field label="IFSC"><input value={draft.bank.ifsc} onChange={(e) => patch('bank', 'ifsc', e.target.value.toUpperCase())} /></Field>
                      <Field label="Branch"><input value={draft.bank.branch} onChange={(e) => patch('bank', 'branch', e.target.value)} /></Field>
                      <Field label="Account type">
                        <select value={draft.bank.accountType} onChange={(e) => patch('bank', 'accountType', e.target.value)}>
                          <option value="">Select</option>
                          {['Savings', 'Current', 'Salary'].map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                ) : null}

                {tab === 'emergency' ? (
                  <RepeatSection
                    rows={draft.emergencyContacts}
                    addLabel="Add contact"
                    onAdd={() => setDraft((current) => ({ ...current, emergencyContacts: [...current.emergencyContacts, { name: '', relationship: '', mobile: '', alternateMobile: '', email: '', address: '' }] }))}
                    onRemove={(index) => setDraft((current) => ({ ...current, emergencyContacts: current.emergencyContacts.filter((_, i) => i !== index) }))}
                    render={(row, index) => (
                      <div className="form-grid">
                        <Field label="Name"><input value={row.name} onChange={(e) => updateRow('emergencyContacts', index, 'name', e.target.value)} /></Field>
                        <Field label="Relationship"><input value={row.relationship} onChange={(e) => updateRow('emergencyContacts', index, 'relationship', e.target.value)} /></Field>
                        <Field label="Mobile"><input value={row.mobile} onChange={(e) => updateRow('emergencyContacts', index, 'mobile', e.target.value)} /></Field>
                        <Field label="Alternate"><input value={row.alternateMobile} onChange={(e) => updateRow('emergencyContacts', index, 'alternateMobile', e.target.value)} /></Field>
                        <Field label="Email"><input value={row.email} onChange={(e) => updateRow('emergencyContacts', index, 'email', e.target.value)} /></Field>
                        <Field label="Address"><input value={row.address} onChange={(e) => updateRow('emergencyContacts', index, 'address', e.target.value)} /></Field>
                      </div>
                    )}
                  />
                ) : null}

                {tab === 'education' ? (
                  <RepeatSection
                    rows={draft.education}
                    addLabel="Add education"
                    onAdd={() => setDraft((current) => ({ ...current, education: [...current.education, { qualification: '', institution: '', boardUniversity: '', yearCompleted: '', score: '' }] }))}
                    onRemove={(index) => setDraft((current) => ({ ...current, education: current.education.filter((_, i) => i !== index) }))}
                    render={(row, index) => (
                      <div className="form-grid">
                        <Field label="Qualification"><input value={row.qualification} onChange={(e) => updateRow('education', index, 'qualification', e.target.value)} /></Field>
                        <Field label="Institution"><input value={row.institution} onChange={(e) => updateRow('education', index, 'institution', e.target.value)} /></Field>
                        <Field label="Board / university"><input value={row.boardUniversity} onChange={(e) => updateRow('education', index, 'boardUniversity', e.target.value)} /></Field>
                        <Field label="Year"><input value={row.yearCompleted} onChange={(e) => updateRow('education', index, 'yearCompleted', e.target.value)} /></Field>
                        <Field label="Percentage / CGPA"><input value={row.score} onChange={(e) => updateRow('education', index, 'score', e.target.value)} /></Field>
                      </div>
                    )}
                  />
                ) : null}

                {tab === 'experience' ? (
                  <div className="emp-master-card-stack">
                    {draft.legacyExperienceNote && !draft.experience.length ? (
                      <p className="muted">Previous free-text experience is still on the person record and is kept until you add structured rows.</p>
                    ) : null}
                    <RepeatSection
                      rows={draft.experience}
                      addLabel="Add experience"
                      onAdd={() => setDraft((current) => ({
                        ...current,
                        experience: [...current.experience, { company: '', designation: '', employmentType: '', joiningDate: '', relievingDate: '', experienceText: '', lastSalary: '', reason: '' }],
                      }))}
                      onRemove={(index) => setDraft((current) => ({ ...current, experience: current.experience.filter((_, i) => i !== index) }))}
                      render={(row, index) => (
                        <div className="form-grid">
                          <Field label="Company"><input value={row.company} onChange={(e) => updateRow('experience', index, 'company', e.target.value)} /></Field>
                          <Field label="Designation"><input value={row.designation} onChange={(e) => updateRow('experience', index, 'designation', e.target.value)} /></Field>
                          <Field label="Type"><input value={row.employmentType} onChange={(e) => updateRow('experience', index, 'employmentType', e.target.value)} /></Field>
                          <Field label="Joining"><input type="date" value={row.joiningDate} onChange={(e) => updateRow('experience', index, 'joiningDate', e.target.value)} /></Field>
                          <Field label="Relieving"><input type="date" value={row.relievingDate} onChange={(e) => updateRow('experience', index, 'relievingDate', e.target.value)} /></Field>
                          <Field label="Experience"><input value={row.experienceText} onChange={(e) => updateRow('experience', index, 'experienceText', e.target.value)} placeholder="2 years 4 months" /></Field>
                          <Field label="Last salary"><input value={row.lastSalary} onChange={(e) => updateRow('experience', index, 'lastSalary', e.target.value)} /></Field>
                          <Field label="Reason"><input value={row.reason} onChange={(e) => updateRow('experience', index, 'reason', e.target.value)} /></Field>
                          <Field label="Certificate" hint={row.id ? 'Optional upload' : 'Save the employee first'}>
                            <input type="file" disabled={!row.id} onChange={(e) => uploadCertificate(row.id, e.target.files?.[0])} />
                            {row.certificateAvailable ? (
                              <button type="button" className="btn btn-sm" onClick={() => downloadFile(`/api/hr/employee-master/${draft.personKind}/${draft.personId}/experience/${row.id}/certificate`, row.certificateFileName || 'certificate')}>
                                Download
                              </button>
                            ) : null}
                          </Field>
                        </div>
                      )}
                    />
                  </div>
                ) : null}

                {tab === 'documents' ? (
                  <div className="emp-master-card">
                    <div className="form-grid">
                      <Field label="Type">
                        <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                          {DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </Field>
                      <Field label="Title"><input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} /></Field>
                      <Field label="File" hint={draft.personId ? 'PDF, image, or Word. Sensitive files are limited to HR.' : 'Save the employee first'}>
                        <input type="file" disabled={!draft.personId} onChange={(e) => uploadDocument(e.target.files?.[0])} />
                      </Field>
                    </div>
                    <p className="muted">Verification status is stored when you Save. Sensitive downloads are limited to HR.</p>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Type</th><th>Title</th><th>Uploaded</th><th>By</th><th>Verification</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(draft.documents || []).map((row) => (
                            <tr key={row.id}>
                              <td>{row.docType}</td>
                              <td>{row.title}</td>
                              <td>{row.uploadedAt ? String(row.uploadedAt).slice(0, 10) : '—'}</td>
                              <td>{row.uploadedBy || '—'}</td>
                              <td>
                                <select value={row.verificationStatus || 'PENDING'} onChange={(e) => {
                                  const verificationStatus = e.target.value;
                                  setDraft((current) => ({
                                    ...current,
                                    documents: current.documents.map((item) => item.id === row.id ? { ...item, verificationStatus } : item),
                                  }));
                                }}>
                                  <option value="PENDING">Pending</option>
                                  <option value="VERIFIED">Verified</option>
                                  <option value="REJECTED">Rejected</option>
                                </select>
                              </td>
                              <td className="btn-row">
                                {row.downloadAllowed ? (
                                  <button type="button" className="btn btn-sm" onClick={() => downloadFile(`/api/hr/employee-master/${draft.personKind}/${draft.personId}/documents/${row.id}/file`, row.fileName)}>Download</button>
                                ) : <span className="muted">HR only</span>}
                                <button type="button" className="btn btn-sm" onClick={() => removeDocument(row.id)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                          {!draft.documents?.length ? <tr><td colSpan={6} className="muted">No documents yet.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {tab === 'biometric' ? (
                  <div className="emp-master-card">
                    <p className="muted emp-master-card-lead">Read-only link to the existing TimeWatch mapping. Enrollment and sync stay on the Biometric page.</p>
                    <div className="form-grid">
                      <Field label="Device user ID"><input readOnly value={draft.biometric?.deviceUserId || ''} /></Field>
                      <Field label="Enrollment"><input readOnly value={draft.biometric?.enrolled ? 'Linked' : 'Not enrolled'} /></Field>
                    </div>
                    <p><Link to={draft.biometric?.link || '/hr/employees/biometric'}>Open Biometric</Link></p>
                  </div>
                ) : null}

                {tab === 'leave' ? (
                  <div className="emp-master-card">
                    <p className="muted emp-master-card-lead">Leave group is stored on this profile. Weekly off and shift also update the existing attendance shift fields.</p>
                    <div className="form-grid">
                      <Field label="Leave group"><input value={draft.leave.leaveGroup} onChange={(e) => patch('leave', 'leaveGroup', e.target.value)} placeholder="General" /></Field>
                      <Field label="Weekly off">
                        <select value={draft.leave.weeklyOff} onChange={(e) => patch('leave', 'weeklyOff', e.target.value)}>
                          {WEEKLY.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="Work shift">
                        <select value={draft.leave.shiftId} onChange={(e) => {
                          patch('leave', 'shiftId', e.target.value);
                          patch('employment', 'shiftId', e.target.value);
                        }}>
                          <option value="">Select</option>
                          {org.shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Notes"><input value={draft.leave.notes} onChange={(e) => patch('leave', 'notes', e.target.value)} /></Field>
                    </div>
                  </div>
                ) : null}

                <div className="emp-master-actions">
                  <button type="button" className="btn" onClick={handleCancel} disabled={saving}>Cancel</button>
                  <button type="button" className="btn" onClick={() => handleSave(true)} disabled={saving}>{saving ? 'Saving…' : 'Save & Next'}</button>
                  <button type="button" className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

function AddressFields({ value, onChange, disabled }) {
  return (
    <div className="form-grid">
      <Field label="Line 1"><input disabled={disabled} value={value.line1 || ''} onChange={(e) => onChange('line1', e.target.value)} /></Field>
      <Field label="Line 2"><input disabled={disabled} value={value.line2 || ''} onChange={(e) => onChange('line2', e.target.value)} /></Field>
      <Field label="City"><input disabled={disabled} value={value.city || ''} onChange={(e) => onChange('city', e.target.value)} /></Field>
      <Field label="State"><input disabled={disabled} value={value.state || ''} onChange={(e) => onChange('state', e.target.value)} /></Field>
      <Field label="Country"><input disabled={disabled} value={value.country || ''} onChange={(e) => onChange('country', e.target.value)} /></Field>
      <Field label="PIN"><input disabled={disabled} value={value.pin || ''} onChange={(e) => onChange('pin', e.target.value)} /></Field>
    </div>
  );
}

function PersonSelect({ rows, value, selfId, onChange }) {
  const current = value && value !== ':' ? value : '';
  return (
    <select value={current} onChange={(e) => onChange(e.target.value)}>
      <option value="">None</option>
      {rows.filter((row) => row.id !== selfId).map((row) => (
        <option key={`${row.personKind}-${row.id}`} value={`${row.personKind}:${row.id}`}>
          {row.employeeNumber} · {displayPersonName(row.firstName, row.lastName)}
        </option>
      ))}
    </select>
  );
}

function RepeatSection({ rows, addLabel, onAdd, onRemove, render }) {
  return (
    <div className="emp-master-card-stack">
      {rows.map((row, index) => (
        <div className="emp-master-card" key={row.id || `new-${index}`}>
          <div className="emp-master-repeat-head">
            <span className="muted">#{index + 1}</span>
            <button type="button" className="btn btn-sm" onClick={() => onRemove(index)}>Remove</button>
          </div>
          {render(row, index)}
        </div>
      ))}
      {!rows.length ? <p className="muted">None yet.</p> : null}
      <button type="button" className="btn" onClick={onAdd}>{addLabel}</button>
    </div>
  );
}
