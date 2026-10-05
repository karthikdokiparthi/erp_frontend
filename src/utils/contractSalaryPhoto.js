/** Photo-order Receipt Contract salary layout (structure + monthly payroll). */

export const CONTRACT_STD_CODES = ['RUCHITHA-STD', 'RUCH-STD', 'AKHIL-STD', 'BSK-STD', 'KRYSTAL-STD', 'KRY-STD'];

/** Full handwritten register — identity/actual row (photo top strip). */
export const CONTRACT_PHOTO_ACTUAL_COLS = [
  { key: 'serialNo', header: 'S NO', kind: 'meta' },
  { key: 'employeeId', header: 'Employee Id', kind: 'meta' },
  { key: 'employeeName', header: 'Employee Name', kind: 'meta' },
  { key: 'dateOfJoining', header: 'Date of Joining', kind: 'meta' },
  { code: 'CONTRACT_SALARY', header: 'SALARY', kind: 'money' },
  { code: 'ACTUAL_BASIC', header: 'Actual BASIC (50%)', kind: 'money', fallback: 'BASIC' },
  { code: 'ACTUAL_DA', header: 'Actual DA (50%)', kind: 'money', fallback: 'DA' },
  { code: 'ACTUAL_SPECIAL', header: 'Actual SPECIAL ALLOWANCE', kind: 'money', fallback: 'SPECIAL' },
  { code: 'ACTUAL_BONUS', header: 'Actual Bonus', kind: 'money', fallback: 'BONUS' },
  { code: 'ACTUAL_LWW', header: 'Actual LEAVE WITH WAGES', kind: 'money', fallback: 'LEAVE_WITH_WAGES' },
  { code: 'ACTUAL_GROSS', header: 'Actual Total Gross', kind: 'money' },
  { code: 'ACTUAL_DAYS', header: 'Actual Days', kind: 'number' },
  { code: 'PAID_DAYS', header: 'Paid Days', kind: 'number' },
];

/** Photo middle strip. */
export const CONTRACT_PHOTO_EARNED_COLS = [
  { code: 'ONE_DAY_ATTENDANCE', header: '1 Day Attendance', kind: 'money' },
  { code: 'OT_HOURS', header: 'OT Hours', kind: 'number' },
  { code: 'BASIC', header: 'Earned Basic', kind: 'money' },
  { code: 'DA', header: 'Earned DA', kind: 'money' },
  { code: 'SPECIAL', header: 'Earned Special Allowance', kind: 'money' },
  { code: 'BONUS', header: 'Earned Bonus/Arrears/Other Allowance', kind: 'money' },
  { code: 'LEAVE_WITH_WAGES', header: 'Earned Leave with Wages', kind: 'money' },
  { code: 'DAY_ALLOWANCE', header: 'Day Allowance', kind: 'money' },
  { code: 'OVERTIME', header: 'Overtime', kind: 'money' },
  { code: 'EARNED_GROSS', header: 'Earned Gross', kind: 'money' },
  { code: 'EPF_CUTOFF_EE', header: 'EPF Cut OFF Amount Employee', kind: 'money' },
  { code: 'PF_EE', header: 'Employee PF', kind: 'money' },
];

/** Photo bottom strip. */
export const CONTRACT_PHOTO_INVOICE_COLS = [
  { code: 'ESI_EE', header: 'Employee ESI', kind: 'money' },
  { code: 'PT', header: 'Professional Tax', kind: 'money' },
  { code: 'CANTEEN', header: 'Other/Canteen', kind: 'money' },
  { code: 'TOTAL_DEDUCTIONS', header: 'Total Deductions', kind: 'money' },
  { code: 'FINAL_NET_PAY', header: 'Final Net Pay', kind: 'money' },
  { code: 'EPF_CUTOFF_ER', header: 'EPF Cut OFF Amount Employer', kind: 'money' },
  { code: 'PF_ER', header: 'Employer PF', kind: 'money' },
  { code: 'ESI_ER', header: 'Employer ESI', kind: 'money' },
  { code: 'SERVICE_CHARGE', header: 'Service Charges', kind: 'money' },
  { code: 'INVOICE_GROSS', header: 'Total Gross', kind: 'money' },
  { code: 'GST', header: 'GST AMOUNT', kind: 'money' },
  { code: 'INVOICE_TOTAL', header: 'TOTAL INVOICE AMOUNT', kind: 'money' },
];

/** @deprecated Prefer CONTRACT_PHOTO_ACTUAL_COLS — kept for older imports. */
export const CONTRACT_PHOTO_STRUCTURE_COLS = [
  { code: 'BASIC', header: 'Actual BASIC (50%)' },
  { code: 'DA', header: 'Actual DA (50%)' },
  { code: 'SPECIAL', header: 'Actual SPECIAL ALLOWANCE' },
  { code: 'BONUS', header: 'Actual Bonus' },
  { code: 'LEAVE_WITH_WAGES', header: 'Actual LEAVE WITH WAGES' },
];

export const CONTRACT_PHOTO_MONTHLY_EARNING_COLS = CONTRACT_PHOTO_EARNED_COLS.filter((c) =>
  ['BASIC', 'DA', 'SPECIAL', 'BONUS', 'LEAVE_WITH_WAGES', 'DAY_ALLOWANCE', 'OVERTIME'].includes(c.code)
);

export const CONTRACT_PHOTO_MONTHLY_DEDUCTION_COLS = [
  { code: 'PF_EE', header: 'Employee PF' },
  { code: 'ESI_EE', header: 'Employee ESI' },
  { code: 'PT', header: 'Professional Tax' },
  { code: 'CANTEEN', header: 'Other/Canteen' },
];

export const CONTRACT_PHOTO_MONTHLY_INVOICE_COLS = [
  { code: 'PF_ER', header: 'Employer PF' },
  { code: 'ESI_ER', header: 'Employer ESI' },
  { code: 'SERVICE_CHARGE', header: 'Service Charges' },
  { code: 'INVOICE_GROSS', header: 'Total Gross' },
  { code: 'GST', header: 'GST AMOUNT' },
  { code: 'INVOICE_TOTAL', header: 'TOTAL INVOICE AMOUNT' },
];

/** Flat photo-order columns for Processing run table + Excel (all 37 fields). */
export const CONTRACT_PHOTO_REGISTER_COLS = [
  ...CONTRACT_PHOTO_ACTUAL_COLS,
  ...CONTRACT_PHOTO_EARNED_COLS,
  ...CONTRACT_PHOTO_INVOICE_COLS,
];

export function isContractStdCode(code) {
  const c = String(code || '').toUpperCase();
  return CONTRACT_STD_CODES.includes(c) || (c.endsWith('-STD') && c !== 'BGT-STD');
}

export function isContractWorkGroup(workGroup) {
  return ['Ruchitha', 'Akhil', 'BSK', 'Krystal'].includes(workGroup);
}

/** Client preview of Receipt Contract actuals from monthly Salary (default CTC). */
export function previewContractStructure(lines, salaryInput) {
  const salary = Number(salaryInput) || 0;
  const active = (lines || []).filter((l) => l.active !== false);
  const byCode = Object.fromEntries(
    active.map((l) => [String(l.componentCode || l.code || '').toUpperCase(), l])
  );
  const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const fixed = (code) => money(byCode[code]?.amount);
  const pctOfSalary = (code) => {
    const line = byCode[code];
    if (!line) return 0;
    if (line.calcType === 'PERCENTAGE' && line.percentageBase === 'CTC') {
      return money((salary * Number(line.percentageValue || 0)) / 100);
    }
    return money(line.amount);
  };
  // Prefer ACTUAL_* when present; else structure BASIC/DA/SPECIAL (V48 config).
  let basic = fixed('ACTUAL_BASIC') || pctOfSalary('BASIC') || fixed('BASIC');
  let da = fixed('ACTUAL_DA') || pctOfSalary('DA') || fixed('DA');
  let special = fixed('ACTUAL_SPECIAL') || fixed('SPECIAL');
  if (byCode.SPECIAL?.calcType === 'REMAINING_CTC' && !fixed('ACTUAL_SPECIAL')) {
    special = money(Math.max(salary - basic - da - fixed('BONUS') - fixed('LEAVE_WITH_WAGES'), 0));
  }
  const bonus = fixed('ACTUAL_BONUS') || fixed('BONUS');
  let lww = fixed('ACTUAL_LWW') || fixed('LEAVE_WITH_WAGES');
  if ((!byCode.ACTUAL_LWW || Number(byCode.ACTUAL_LWW.amount || 0) === 0) && (!byCode.LEAVE_WITH_WAGES || Number(byCode.LEAVE_WITH_WAGES.amount || 0) === 0)) {
    lww = money(Math.max(salary - basic - da - special - bonus, 0));
  }
  const actualGross = money(basic + da + special + bonus + lww);
  const oneDay = salary > 0 ? money(salary / 26) : 0;
  return {
    CONTRACT_SALARY: salary,
    ACTUAL_BASIC: basic,
    ACTUAL_DA: da,
    ACTUAL_SPECIAL: special,
    ACTUAL_BONUS: bonus,
    ACTUAL_LWW: lww,
    ACTUAL_GROSS: actualGross,
    ACTUAL_DAYS: 26,
    PAID_DAYS: 26,
    ONE_DAY_ATTENDANCE: oneDay,
    OT_HOURS: 0,
    // Structure lines BASIC/DA/SPECIAL are Actual config until Calculate overwrites run comps.
    BASIC: basic,
    DA: da,
    SPECIAL: special,
    BONUS: bonus,
    LEAVE_WITH_WAGES: lww,
    DAY_ALLOWANCE: fixed('DAY_ALLOWANCE'),
    OVERTIME: fixed('OVERTIME'),
    EARNED_GROSS: 0,
    EPF_CUTOFF_EE: fixed('EPF_CUTOFF_EE') || 15000,
    PF_EE: 0,
    ESI_EE: 0,
    PT: fixed('PT'),
    CANTEEN: fixed('CANTEEN'),
    TOTAL_DEDUCTIONS: 0,
    FINAL_NET_PAY: 0,
    EPF_CUTOFF_ER: fixed('EPF_CUTOFF_ER') || 15000,
    PF_ER: 0,
    ESI_ER: 0,
    SERVICE_CHARGE: 0,
    INVOICE_GROSS: 0,
    GST: 0,
    INVOICE_TOTAL: 0,
    salary,
    actualGross,
    byCode,
  };
}

export function contractPhotoStructureHeaders() {
  return CONTRACT_PHOTO_ACTUAL_COLS.map((c) => c.header);
}

export function contractPhotoStructureValues(preview, formatMoneyFn) {
  const fmt = formatMoneyFn || ((n) => n);
  return CONTRACT_PHOTO_ACTUAL_COLS.map((col) => {
    if (col.kind === 'meta') {
      if (col.key === 'serialNo') return '1';
      if (col.key === 'employeeId') return '—';
      if (col.key === 'employeeName') return 'Structure preview';
      if (col.key === 'dateOfJoining') return '—';
      return '—';
    }
    const v = preview[col.code];
    if (col.kind === 'number') return v ?? '—';
    return fmt(v ?? 0);
  });
}

export function contractPhotoStructureFormulas(preview) {
  return CONTRACT_PHOTO_ACTUAL_COLS.map((col) => {
    if (col.kind === 'meta') return 'From employee';
    if (col.code === 'CONTRACT_SALARY') return 'Monthly salary / CTC';
    if (col.code === 'ACTUAL_BASIC' || col.code === 'ACTUAL_DA') return 'From SP table (50% note on photo)';
    if (col.code === 'ACTUAL_SPECIAL') return 'From SP table / remainder';
    if (col.code === 'ACTUAL_BONUS') return 'Usually ₹0';
    if (col.code === 'ACTUAL_LWW') return 'Salary − Basic − DA − Special − Bonus';
    if (col.code === 'ACTUAL_GROSS') return 'Sum of actuals';
    if (col.code === 'ACTUAL_DAYS') return '26';
    if (col.code === 'PAID_DAYS') return 'From attendance / Calculate';
    return '—';
  });
}

export function contractPhotoEarnedHeaders() {
  return CONTRACT_PHOTO_EARNED_COLS.map((c) => c.header);
}

export function contractPhotoEarnedValues(preview, formatMoneyFn, options = {}) {
  const fmt = formatMoneyFn || ((n) => n);
  const structurePreview = options.structurePreview === true;
  return CONTRACT_PHOTO_EARNED_COLS.map((col) => {
    if (structurePreview) {
      if (col.code === 'ONE_DAY_ATTENDANCE') return fmt(preview.ONE_DAY_ATTENDANCE ?? 0);
      if (col.code === 'OT_HOURS') return 0;
      if (col.code === 'EPF_CUTOFF_EE') return fmt(preview.EPF_CUTOFF_EE ?? 15000);
      return fmt(0);
    }
    const v = preview[col.code];
    if (col.kind === 'number') return v ?? 0;
    return fmt(v ?? 0);
  });
}

export function contractPhotoEarnedFormulas() {
  return CONTRACT_PHOTO_EARNED_COLS.map((col) => {
    if (col.code === 'ONE_DAY_ATTENDANCE') return 'Salary / 26';
    if (col.code === 'OT_HOURS') return 'Input (0 if none)';
    if (col.code === 'BASIC') return 'Actual Basic × Paid Days / 26';
    if (col.code === 'DA') return 'Actual DA × Paid Days / 26';
    if (col.code === 'SPECIAL') return 'Actual Special × Paid Days / 26';
    if (col.code === 'BONUS') return 'Usually ₹0';
    if (col.code === 'LEAVE_WITH_WAGES') return 'Actual LWW × Paid Days / 26';
    if (col.code === 'DAY_ALLOWANCE') return 'Salary/26 × max(Paid−26,0)';
    if (col.code === 'OVERTIME') return '(Basic+DA)/26/8 × 2 × OT';
    if (col.code === 'EARNED_GROSS') return 'Sum of earned';
    if (col.code === 'EPF_CUTOFF_EE') return '₹15,000 ceiling';
    if (col.code === 'PF_EE') return '12% of PF wage (prorated)';
    return 'On Calculate';
  });
}

export function contractPhotoInvoiceHeaders() {
  return CONTRACT_PHOTO_INVOICE_COLS.map((c) => c.header);
}

export function contractPhotoInvoiceValues(preview, formatMoneyFn, options = {}) {
  const fmt = formatMoneyFn || ((n) => n);
  const structurePreview = options.structurePreview === true;
  return CONTRACT_PHOTO_INVOICE_COLS.map((col) => {
    if (structurePreview) {
      if (col.code === 'EPF_CUTOFF_ER') return fmt(preview.EPF_CUTOFF_ER ?? 15000);
      if (col.code === 'CANTEEN' || col.code === 'PT') return fmt(preview[col.code] ?? 0);
      return fmt(0);
    }
    return fmt(preview[col.code] ?? 0);
  });
}

export function contractPhotoInvoiceFormulas() {
  return CONTRACT_PHOTO_INVOICE_COLS.map((col) => {
    if (col.code === 'ESI_EE') return '0.75% if Actual Gross < 21k';
    if (col.code === 'PT') return 'TN slab on Actual Gross';
    if (col.code === 'CANTEEN') return 'Stored deduction';
    if (col.code === 'TOTAL_DEDUCTIONS') return 'PF + ESI + PT + Canteen';
    if (col.code === 'FINAL_NET_PAY') return 'Earned Gross − Deductions';
    if (col.code === 'EPF_CUTOFF_ER') return '₹15,000 ceiling';
    if (col.code === 'PF_ER') return '13% of PF wage (prorated)';
    if (col.code === 'ESI_ER') return '3.25% if ESI on';
    if (col.code === 'SERVICE_CHARGE') return '7% of earned gross';
    if (col.code === 'INVOICE_GROSS') return 'Earned + ER PF/ESI + Service';
    if (col.code === 'GST') return '18% of invoice gross';
    if (col.code === 'INVOICE_TOTAL') return 'Invoice gross + GST';
    return 'On Calculate';
  });
}

export function sortContractLinesPhotoOrder(lines) {
  const photoCodes = [
    'CONTRACT_SALARY',
    'ACTUAL_BASIC',
    'ACTUAL_DA',
    'ACTUAL_SPECIAL',
    'ACTUAL_BONUS',
    'ACTUAL_LWW',
    'ACTUAL_GROSS',
    'ACTUAL_DAYS',
    'PAID_DAYS',
    'ONE_DAY_ATTENDANCE',
    'OT_HOURS',
    'BASIC',
    'DA',
    'SPECIAL',
    'BONUS',
    'LEAVE_WITH_WAGES',
    'DAY_ALLOWANCE',
    'OVERTIME',
    'EARNED_GROSS',
    'EPF_CUTOFF_EE',
    'PF_EE',
    'ESI_EE',
    'CANTEEN',
    'PT',
    'TOTAL_DEDUCTIONS',
    'FINAL_NET_PAY',
    'EPF_CUTOFF_ER',
    'PF_ER',
    'ESI_ER',
    'SERVICE_CHARGE',
    'INVOICE_GROSS',
    'GST',
    'INVOICE_TOTAL',
  ];
  const list = [...(lines || [])];
  list.sort((a, b) => {
    const ca = String(a?.componentCode || a?.code || '').toUpperCase();
    const cb = String(b?.componentCode || b?.code || '').toUpperCase();
    const ia = photoCodes.indexOf(ca);
    const ib = photoCodes.indexOf(cb);
    if (ia >= 0 || ib >= 0) {
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    }
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
  return list;
}

/** Resolve a register cell value from a Processing run employee row. */
export function contractRegisterCell(row, col, index, formatMoneyFn) {
  const fmt = formatMoneyFn || ((n) => n);
  if (col.kind === 'meta') {
    if (col.key === 'serialNo') return index + 1;
    if (col.key === 'employeeId') return row.employeeNumber || '—';
    if (col.key === 'employeeName') return row.displayName || '—';
    if (col.key === 'dateOfJoining') return row.dateOfJoining || '—';
    return '—';
  }
  const comps = row.components || [];
  const hit = comps.find((c) => String(c.code || c.componentCode || '').toUpperCase() === col.code);
  let amount = hit?.amount;
  if ((amount == null || amount === '') && col.fallback) {
    const fb = comps.find((c) => String(c.code || '').toUpperCase() === col.fallback);
    amount = fb?.amount;
  }
  if (col.code === 'PAID_DAYS' && (amount == null || Number(amount) === 0) && row.payableDays != null) {
    amount = row.payableDays;
  }
  if (col.code === 'EARNED_GROSS' && (amount == null || Number(amount) === 0) && row.gross != null) {
    amount = row.gross;
  }
  if (col.code === 'TOTAL_DEDUCTIONS' && (amount == null || Number(amount) === 0) && row.totalDeductions != null) {
    amount = row.totalDeductions;
  }
  if (col.code === 'FINAL_NET_PAY' && (amount == null || Number(amount) === 0) && row.net != null) {
    amount = row.net;
  }
  if (col.kind === 'number') return amount ?? 0;
  return fmt(amount ?? 0);
}
