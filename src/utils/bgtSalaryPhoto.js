/** Photo-order BGT On-Role / BGT-STD salary layout (structure + monthly payroll). */

export const BGT_PHOTO_STRUCTURE_COLS = [
  { code: 'BASIC', header: 'Basic (40% of CTC)' },
  { code: 'RETENTION', header: 'Retention Allowance' },
  { code: 'HRA', header: 'HRA' },
  { code: 'FLEXI', header: 'Flexi Benefits' },
  { code: 'PF_ER', header: 'PF (15%)' },
  { code: 'BONUS', header: 'Bonus (25%)' },
  { code: 'LEAVE_TRAVEL', header: 'LTA (8.33%)' },
];

export const BGT_PHOTO_MONTHLY_EARNING_COLS = [
  { code: 'BASIC', header: 'Basic' },
  { code: 'RETENTION', header: 'Retention Allowance' },
  { code: 'HRA', header: 'HRA' },
  { code: 'FLEXI', header: 'Flexi Benefits' },
];

export const BGT_PHOTO_MONTHLY_DEDUCTION_COLS = [
  { code: 'PF_EE', header: 'Less : Employee PF' },
  { code: 'PT', header: 'Less : PT' },
  { code: 'TDS', header: 'Less : TDS' },
  { code: 'CANTEEN', header: 'LUNCH' },
];

export function lineCode(line) {
  return String(line?.componentCode || line?.code || '').toUpperCase();
}

export function compAmt(components, code) {
  const needle = String(code || '').toUpperCase();
  const hit = (components || []).find(
    (c) => String(c.code || c.componentCode || '').toUpperCase() === needle
  );
  return hit?.amount ?? 0;
}

export function formulaLabel(line) {
  if (!line) return '—';
  if (line.calcType === 'PERCENTAGE') {
    const pct = line.percentageValue != null ? Number(line.percentageValue) : '';
    return `${pct}% of ${line.percentageBase || '—'}`;
  }
  if (line.calcType === 'REMAINING_CTC') return 'Remaining CTC';
  if (line.calcType === 'FIXED' && Number(line.amount || 0) === 0) return 'Fixed (set on line)';
  return line.amount != null ? String(line.amount) : '—';
}

/** Client-side preview of BGT structure amounts from CTC (mirrors engine; display only). */
export function previewBgtStructure(lines, ctcInput) {
  const ctc = Number(ctcInput) || 0;
  const active = (lines || []).filter((l) => l.active !== false);
  const byCode = Object.fromEntries(active.map((l) => [lineCode(l), l]));
  const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
  let basic = 0;
  const basicLine = byCode.BASIC;
  if (basicLine?.calcType === 'PERCENTAGE' && basicLine.percentageBase === 'CTC') {
    basic = money((ctc * Number(basicLine.percentageValue || 0)) / 100);
  } else if (basicLine) {
    basic = money(basicLine.amount);
  }
  const pctOfBasic = (code) => {
    const line = byCode[code];
    if (!line) return 0;
    if (line.calcType === 'PERCENTAGE' && line.percentageBase === 'BASIC') {
      return money((basic * Number(line.percentageValue || 0)) / 100);
    }
    return money(line.amount);
  };
  const retention = pctOfBasic('RETENTION') || money(byCode.RETENTION?.amount);
  const hra = pctOfBasic('HRA') || money(byCode.HRA?.amount);
  const bonus = pctOfBasic('BONUS');
  const lta = pctOfBasic('LEAVE_TRAVEL');
  const pfEr = pctOfBasic('PF_ER');
  const used = basic + retention + hra + bonus + lta + pfEr;
  const flexi =
    byCode.FLEXI?.calcType === 'REMAINING_CTC'
      ? money(Math.max(ctc - used, 0))
      : money(byCode.FLEXI?.amount);
  const amounts = {
    BASIC: basic,
    RETENTION: retention,
    HRA: hra,
    FLEXI: flexi,
    PF_ER: pfEr,
    BONUS: bonus,
    LEAVE_TRAVEL: lta,
  };
  return {
    ...amounts,
    basic,
    retention,
    hra,
    flexi,
    pfEr,
    bonus,
    lta,
    monthlyGross: money(basic + retention + hra + flexi + bonus + lta),
    ctcMonth: ctc,
    ctcAnnum: money(ctc * 12),
    byCode,
  };
}

export function photoStructureHeaders() {
  return [
    ...BGT_PHOTO_STRUCTURE_COLS.map((c) => c.header),
    'CTC Per Month',
    'CTC Per Annum',
    'Monthly Gross Salary',
  ];
}

export function photoStructureValues(preview, formatMoneyFn) {
  const fmt = formatMoneyFn || ((n) => n);
  return [
    ...BGT_PHOTO_STRUCTURE_COLS.map((c) => fmt(preview[c.code] ?? 0)),
    fmt(preview.ctcMonth),
    fmt(preview.ctcAnnum),
    fmt(preview.monthlyGross),
  ];
}

export function photoStructureFormulas(preview) {
  return [
    ...BGT_PHOTO_STRUCTURE_COLS.map((c) => formulaLabel(preview.byCode?.[c.code])),
    'CTC',
    'CTC × 12',
    'Excl. employer PF',
  ];
}

/** Earnings lines in photo order, then remaining active lines. */
export function sortLinesPhotoOrder(lines) {
  const photoCodes = BGT_PHOTO_STRUCTURE_COLS.map((c) => c.code);
  const list = [...(lines || [])];
  list.sort((a, b) => {
    const ca = lineCode(a);
    const cb = lineCode(b);
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
