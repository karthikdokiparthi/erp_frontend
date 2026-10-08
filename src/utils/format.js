const ANONYMOUS_PRINCIPAL = /^(unknown|anonymous|anonymoususer)$/i;

function text(value) {
  return String(value || '').trim();
}

function isAnonymousPrincipal(value) {
  const principal = text(value);
  return !principal || ANONYMOUS_PRINCIPAL.test(principal);
}

/** Real OIDC display name. A missing or anonymous name is not a person. */
export function resolvedDisplayName(user) {
  if (!user || typeof user !== 'object') return '';
  const direct = text(user.name || user.displayName);
  if (direct && !isAnonymousPrincipal(direct)) return direct;
  const combined = [user.givenName || user.given_name, user.familyName || user.family_name]
    .map(text)
    .filter(Boolean)
    .join(' ')
    .trim();
  if (combined && !isAnonymousPrincipal(combined)) return combined;
  return '';
}

export function resolvedUsername(user) {
  if (!user || typeof user !== 'object') return '';
  const username = text(user.username || user.preferred_username || user.preferredUsername || user.userName);
  if (isAnonymousPrincipal(username)) return '';
  return username;
}

/** A 200 from /api/me is a session only when both principal and name are real. */
export function hasSignedInIdentity(user) {
  return Boolean(resolvedUsername(user) && resolvedDisplayName(user));
}

export function displayName(user) {
  return resolvedDisplayName(user);
}

export function initials(user) {
  if (!user) return '?';
  const first = (user.givenName || '').trim();
  const last = (user.familyName || '').trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  return (user.username || '?').slice(0, 2).toUpperCase();
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/**
 * Worked duration as H:MM using base-60 minutes.
 * Accepts decimal hours where the fraction is minutes/60 (e.g. 8.5 → 8:30), never base-100.
 */
export function formatHours(value) {
  if (value == null || value === '') return '—';
  const hours = Number(value);
  if (Number.isNaN(hours)) return '—';
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Duration between two timestamps as H:MM (base-60). */
export function workHoursBetween(first, last) {
  if (!first || !last) return '—';
  const start = new Date(first);
  const end = new Date(last);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function hasAssetsAccess(user) {
  if (!user) return false;
  if (user.assetsAccess) return true;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  return (
    roles.includes('SUPER_ADMIN') ||
    permissions.includes('ERP_ASSETS_MANAGE') ||
    roles.includes('IT_MANAGER') ||
    roles.includes('ELE_MANAGER') ||
    roles.includes('MECH_MANAGER') ||
    roles.includes('ELECTRICAL_MANAGER') ||
    roles.includes('MECHANICAL_MANAGER')
  );
}

export function departmentLabel(department) {
  const value = String(department || '').toUpperCase();
  if (value === 'IT') return 'IT';
  if (value === 'ELE' || value === 'ELECTRICAL') return 'Electrical';
  if (value === 'MECH' || value === 'MECHANICAL') return 'Mechanical';
  return department || '—';
}

export function assetTypeLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'DESKTOP') return 'Desktop';
  if (value === 'LAPTOP') return 'Laptop';
  if (value === 'PRINTER') return 'Printer';
  if (value === 'SWITCH') return 'Switch network';
  if (value === 'ROUTER') return 'Router';
  return type || '—';
}

export function assetActionLabel(action) {
  const value = String(action || '').toUpperCase();
  if (value === 'ASSIGN') return 'Assigned';
  if (value === 'RETURN') return 'Returned';
  if (value === 'TRANSFER') return 'Transferred';
  return action || '—';
}

export function assetMaintenanceKindLabel(kind) {
  const value = String(kind || '').toUpperCase();
  if (value === 'PREVENTIVE') return 'Preventive';
  if (value === 'CORRECTIVE') return 'Corrective';
  if (value === 'INSPECTION') return 'Inspection';
  return kind || '—';
}

export function assetAvailabilityLabel(value) {
  const key = String(value || '').toUpperCase();
  if (key === 'AVAILABLE') return 'Available';
  if (key === 'NOT_AVAILABLE') return 'Not available';
  return value || '—';
}

export function parseAssetCodeFromScan(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const code = url.searchParams.get('code');
    if (code) return code.trim();
  } catch {
    // not a URL
  }
  const query = text.match(/[?&]code=([^&\s]+)/i);
  if (query) {
    try {
      return decodeURIComponent(query[1]).trim();
    } catch {
      return query[1].trim();
    }
  }
  const labeled = text.match(/ASSET CODE:\s*([^\n]+)/i);
  if (labeled) {
    return labeled[1].trim();
  }
  const patterned = text.match(/\bBGT\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Z0-9]+\b/i);
  if (patterned) {
    return patterned[0].toUpperCase();
  }
  const first = text.split(/\s|\n/)[0];
  return first.replace(/\s/g, '/').toUpperCase();
}

export function formatInstalledOn(value) {
  const iso = toDateInputValue(value);
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function toDateInputValue(value) {
  if (value == null || value === '') {
    return '';
  }
  if (Array.isArray(value) && value.length >= 3) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`;
  }
  if (typeof value === 'object' && value.year != null && value.month != null && value.day != null) {
    return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
  }
  const text = String(value);
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function hasSuperAdmin(user) {
  if (!user) return false;
  if (user.superAdmin) return true;
  return (user.roles || []).some((role) => String(role).toUpperCase() === 'SUPER_ADMIN');
}

/** BGT Salary payout sheet (package + payout) — HR / Super HR / Super Admin. */
export function canEditBgtPackage(user) {
  if (!user) return false;
  if (user.canEditBgtPackage) return true;
  if (hasHrAccess(user)) return true;
  if (hasSuperAdmin(user)) return true;
  return (user.roles || []).some((role) => {
    const n = String(role || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (n === 'SUPER_ADMIN' || n === 'SUPER_HR' || n === 'SUPERHR') return true;
    if (n.includes('SUPER_HR') || n.includes('SUPERHR')) return true;
    if (n.includes('SUPER') && n.includes('ADMIN')) return true;
    if (n.includes('SUPER') && n.includes('HR')) return true;
    return false;
  });
}

export function canEditBgtSalarySheet(user) {
  return canEditBgtPackage(user);
}

export function hasHrAccess(user) {
  if (!user) return false;
  if (user.hrAccess) return true;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  return roles.includes('SUPER_ADMIN') || permissions.includes('ERP_HR_READ');
}

/** Attendance tab and attendance records. HR already includes this. */
export function hasAttendanceAccess(user) {
  if (!user) return false;
  if (hasHrAccess(user)) return true;
  const roles = user.roles || [];
  const permissions = user.permissions || [];
  return (
    roles.includes('ATTENDANCE') ||
    permissions.includes('ERP_ATTENDANCE_READ') ||
    permissions.includes('ERP_ATTENDANCE_WRITE')
  );
}

export function primaryRoleLabel(user) {
  if (!user) return 'User';
  if (hasSuperAdmin(user)) return 'Super Admin';
  if (hasHrAccess(user)) return 'HR';
  const roles = (user.roles || []).map((role) => String(role).toUpperCase());
  if (roles.includes('IT_MANAGER')) return 'IT Manager';
  if (roles.includes('ELE_MANAGER') || roles.includes('ELECTRICAL_MANAGER')) return 'Electrical';
  if (roles.includes('MECH_MANAGER') || roles.includes('MECHANICAL_MANAGER')) return 'Mechanical';
  if (roles.length) {
    return roles[0]
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return 'User';
}

export function directoryLabel(kind) {
  const value = String(kind || '').toUpperCase();
  if (value === 'CCIDP') return 'CCIDP employee';
  if (value === 'EMPLOYEE') return 'Contract';
  return 'On-Role';
}

export function payTypeLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'CONTRACTEMP' || value === 'CONTRACT' || value === 'EMPLOYEE') {
    return 'Contract';
  }
  if (value === 'BGTEMP' || value === 'BRIGHTGRID' || value === 'STAFF') {
    return 'On-Role';
  }
  return type || '—';
}

export function formatMoney(value) {
  if (value == null || value === '') {
    return '—';
  }
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function leaveTypeLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'CASUAL' || value === 'CL') return 'Casual (CL)';
  if (value === 'SICK' || value === 'SL') return 'Sick (SL)';
  if (value === 'EARNED' || value === 'EL' || value === 'ANNUAL') return 'Earned (EL)';
  if (value === 'MATERNITY' || value === 'ML') return 'Maternity (ML)';
  if (value === 'PATERNITY' || value === 'PL') return 'Paternity (PL)';
  if (value === 'UNPAID' || value === 'LWP') return 'Unpaid (LWP)';
  if (value === 'COMP_OFF' || value === 'C/OFF' || value === 'CO') return 'Comp off';
  if (value === 'OD') return 'On duty';
  return type || '—';
}

export function leaveStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'PENDING') return 'Pending';
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  if (value === 'CANCELLED') return 'Cancelled';
  return status || '—';
}

export function exitStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'DRAFT') return 'Draft';
  if (value === 'SUBMITTED') return 'Submitted';
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  if (value === 'WITHDRAWN') return 'Withdrawn';
  if (value === 'IN_NOTICE') return 'In notice';
  if (value === 'CLEARANCE') return 'Clearance';
  if (value === 'RELIEVED') return 'Relieved';
  if (value === 'CANCELLED') return 'Cancelled';
  return status || '—';
}

export function expenseStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'DRAFT') return 'Draft';
  if (value === 'SUBMITTED') return 'With HR';
  if (value === 'NEEDS_INFO') return 'Needs info';
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  if (value === 'WITHDRAWN') return 'Withdrawn';
  if (value === 'PAID') return 'Reimbursed';
  return status || '—';
}

export function expenseCategoryLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'TRAVEL') return 'Travel';
  if (value === 'FOOD') return 'Food / meals';
  if (value === 'LODGING') return 'Lodging';
  if (value === 'LOCAL_CONVEYANCE') return 'Local conveyance';
  if (value === 'MEDICAL') return 'Medical';
  if (value === 'OFFICE') return 'Office supplies';
  if (value === 'CLIENT') return 'Client / business';
  if (value === 'OTHER') return 'Other';
  return type || '—';
}

export function expensePaymentLabel(mode) {
  const value = String(mode || '').toUpperCase();
  if (value === 'PERSONAL') return 'Paid by employee';
  if (value === 'COMPANY_CARD') return 'Company card';
  if (value === 'ADVANCE') return 'Against advance';
  return mode || '—';
}

export function employmentTypeLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'ON_ROLE') return 'On-Role';
  if (value === 'CONTRACT') return 'Contract';
  if (value === 'INTERN') return 'Intern';
  return type || '—';
}

export function recruitmentSourceLabel(source) {
  const value = String(source || '').toUpperCase();
  if (value === 'REFERRAL') return 'Referral';
  if (value === 'PORTAL') return 'Career portal';
  if (value === 'LINKEDIN') return 'LinkedIn';
  if (value === 'AGENCY') return 'Agency';
  if (value === 'CAMPUS') return 'Campus';
  if (value === 'WALK_IN') return 'Walk-in';
  if (value === 'OTHER') return 'Other';
  return source || '—';
}

export function interviewTypeLabel(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'SCREENING') return 'Screening';
  if (value === 'TECHNICAL') return 'Technical';
  if (value === 'MANAGER') return 'Manager';
  if (value === 'HR') return 'HR';
  if (value === 'FINAL') return 'Final';
  if (value === 'OTHER') return 'Other';
  return type || '—';
}

export function interviewModeLabel(mode) {
  const value = String(mode || '').toUpperCase();
  if (value === 'IN_PERSON') return 'In person';
  if (value === 'VIDEO') return 'Video';
  if (value === 'PHONE') return 'Phone';
  return mode || '—';
}

export function exitReasonLabel(code) {
  const value = String(code || '').toUpperCase();
  if (value === 'BETTER_OPPORTUNITY') return 'Better opportunity';
  if (value === 'PERSONAL') return 'Personal';
  if (value === 'RELOCATION') return 'Relocation';
  if (value === 'HEALTH') return 'Health';
  if (value === 'EDUCATION') return 'Education';
  if (value === 'CONTRACT_END') return 'Contract end';
  if (value === 'OTHER') return 'Other';
  return code || '—';
}
