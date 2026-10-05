const BADGE_LABELS = {
  EARLY_LEAVING: 'Early leaving',
  HALF_DAY: 'Early leaving',
  PRESENT: 'Present',
  LATE: 'Present',
  MISSING_PUNCH: 'Missing punch',
  ABSENT: 'Absent',
  NOT_STARTED: 'Not started',
  WEEK_OFF: 'Week off',
  HOLIDAY: 'Holiday',
  WORKING: 'Working',
  OFF: 'Off',
  ON_LEAVE: 'On leave',
  RECORDED: 'Recorded',
  NEEDS_INFO: 'Needs info',
  PAID: 'Reimbursed',
};

export function StatusBadge({ value }) {
  const key = String(value || '').toUpperCase().replace(/ /g, '_');
  const map = {
    PRESENT: 'badge-success',
    LATE: 'badge-success',
    EARLY_LEAVING: 'badge-warning',
    HALF_DAY: 'badge-warning',
    MISSING_PUNCH: 'badge-info',
    ABSENT: 'badge-neutral',
    NOT_STARTED: 'badge-neutral',
    WEEK_OFF: 'badge-neutral',
    HOLIDAY: 'badge-info',
    WORKING: 'badge-success',
    OFF: 'badge-neutral',
    ON_LEAVE: 'badge-warning',
    INACTIVE: 'badge-neutral',
    ACTIVE: 'badge-success',
    REACHABLE: 'badge-success',
    UNREACHABLE: 'badge-warning',
    CONFIGURED: 'badge-success',
    NOT_CONFIGURED: 'badge-neutral',
    FACE: 'badge-info',
    FINGER: 'badge-info',
    THUMB: 'badge-info',
    SUPER_ADMIN: 'badge-info',
    ADMIN: 'badge-info',
    'ON-ROLE': 'badge-info',
    CONTRACT: 'badge-neutral',
    CCIDP: 'badge-info',
    PENDING: 'badge-warning',
    CREDITED: 'badge-success',
    FAILED: 'badge-warning',
    ON_HOLD: 'badge-info',
    SUBMITTED: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-neutral',
    WITHDRAWN: 'badge-neutral',
    IN_NOTICE: 'badge-info',
    CLEARANCE: 'badge-warning',
    RELIEVED: 'badge-success',
    CANCELLED: 'badge-neutral',
    DONE: 'badge-success',
    NA: 'badge-neutral',
    'N/A': 'badge-neutral',
    CASUAL: 'badge-info',
    CL: 'badge-info',
    SICK: 'badge-warning',
    SL: 'badge-warning',
    EARNED: 'badge-success',
    EL: 'badge-success',
    UNPAID: 'badge-neutral',
    LWP: 'badge-neutral',
    ML: 'badge-info',
    MATERNITY: 'badge-info',
    PL: 'badge-info',
    PATERNITY: 'badge-info',
    FIXED: 'badge-success',
    NATIONAL: 'badge-success',
    OBSERVED: 'badge-success',
    OPTIONAL: 'badge-info',
    INFO: 'badge-neutral',
    SUNDAY: 'badge-neutral',
    SUNDAY_OCCASION: 'badge-neutral',
    RETIRED: 'badge-neutral',
    RECORDED: 'badge-info',
    PAID: 'badge-success',
    NEEDS_INFO: 'badge-warning',
    DRAFT: 'badge-neutral',
    GENERATED: 'badge-success',
  };
  return (
    <span className={`badge ${map[key] || 'badge-neutral'}`}>{BADGE_LABELS[key] || value || '—'}</span>
  );
}

export function KpiCard({ label, value, hint, onClick, active }) {
  const className = `kpi${onClick ? ' kpi-clickable' : ''}${active ? ' is-active' : ''}`;
  const inner = (
    <>
      <div className="label">{label}</div>
      <div className="value">{value ?? '—'}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}
