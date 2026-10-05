import { apiUrl } from '../api/client';
import { assetTypeLabel, departmentLabel, formatInstalledOn } from './format';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value) {
  return `<Cell><Data ss:Type="String">${escapeXml(value == null || value === '' ? '' : value)}</Data></Cell>`;
}

const COLUMNS = [
  ['Asset code', (row) => row.assetCode],
  ['Department', (row) => departmentLabel(row.department)],
  ['Type', (row) => assetTypeLabel(row.assetType)],
  ['Make / brand', (row) => row.brand],
  ['Monitor serial number', (row) => row.monitorSerial],
  ['CPU serial number', (row) => row.cpuSerial],
  ['Mouse serial number', (row) => row.mouseSerial],
  ['Ethernet to USB adapter', (row) => row.ethernetUsbAdapter],
  ['Serial number', (row) => row.serialNumber],
  ['Model number', (row) => row.modelNumber],
  ['Ports', (row) => row.ports],
  ['Username', (row) => row.assignedUsername],
  ['User ID', (row) => row.assignedUserId],
  ['Location', (row) => row.location],
  ['Supplier', (row) => row.supplier],
  ['Installed date', (row) => (row.installedOn ? formatInstalledOn(row.installedOn) : '')],
  ['Status', (row) => row.status],
  ['Invoice / document', (row) => row.documentFileName],
];

function downloadSpreadsheet(sheetName, rows, filename) {
  const body = rows.map((row) => `<Row>${row.map((value) => cell(value)).join('')}</Row>`).join('');
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>${body}</Table>
  </Worksheet>
</Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseContentDispositionFilename(header) {
  if (!header) return '';
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf) {
    try {
      return decodeURIComponent(utf[1].replace(/"/g, '').trim());
    } catch {
      return utf[1].replace(/"/g, '').trim();
    }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(header);
  return ascii ? ascii[1].trim() : '';
}

export async function downloadBinaryFromUrl(path, fallbackFilename) {
  const response = await fetch(apiUrl(path), { credentials: 'include' });
  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // keep status message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get('Content-Disposition')) || fallbackFilename;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return filename;
}

export function downloadTableExcel(sheetName, headers, bodyRows, filename) {
  downloadSpreadsheet(sheetName, [headers, ...(bodyRows || [])], filename);
}

export function downloadAssetsExcel(rows, filename = 'BGT-company-assets.xls') {
  const header = COLUMNS.map(([label]) => label);
  const body = (rows || []).map((row) => COLUMNS.map(([, read]) => read(row)));
  downloadSpreadsheet('Assets', [header, ...body], filename);
}

function formatAuditDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB');
}

function auditConditionLabel(value) {
  const key = String(value || '').toUpperCase();
  if (key === 'GOOD') return 'Good';
  if (key === 'FAIR') return 'Fair';
  if (key === 'DAMAGED') return 'Damaged';
  if (key === 'UNDER_REPAIR') return 'Under Repair';
  return '';
}

export function downloadAssetAuditExcel(audit, filename) {
  const headers = [
    'Asset Code',
    'Asset Name',
    'Serial No.',
    'Expected Location',
    'Actual Location',
    'Available',
    'Condition',
    'Auditor',
    'Audit Date',
    'Remarks',
  ];
  const body = (audit?.lines || []).map((row) => [
    row.assetCode,
    row.assetName,
    row.serialNumber,
    row.expectedLocation,
    row.actualLocation,
    row.availability === 'AVAILABLE' ? 'YES' : row.availability === 'NOT_AVAILABLE' ? 'NO' : '',
    auditConditionLabel(row.condition),
    row.auditedBy,
    formatAuditDate(row.auditAt),
    row.remarks,
  ]);
  const stamp = (audit?.auditMonth || '').slice(0, 7) || 'audit';
  downloadTableExcel(audit?.title || 'Asset Audit', headers, body, filename || `BGT-asset-audit-${stamp}.xls`);
}

export function downloadOnRolePayslipExcel(sheet, options = {}) {
  const month = options.month || '';
  const name = sheet?.employeeName || 'On-Role';
  const money = (value) => (value == null || value === '' ? '' : String(value));
  downloadSpreadsheet(
    'On-Role',
    [
      [
        'SI No.',
        'Name of Employee',
        'Designation',
        'Location',
        'Basic (40% of CTC)',
        'Retention Allowance',
        'HRA',
        'Flexi Benefits',
        'PF (15%)',
        'Bonus (25%)',
        'LTA (8.33%)',
        'CTC Per Month',
        'CTC Per Annum',
        'Monthly Gross Salary',
      ],
      [
        options.siNo ?? 1,
        sheet.employeeName,
        sheet.designation,
        sheet.location,
        money(sheet.basic),
        money(sheet.retentionAllowance),
        money(sheet.hra),
        money(sheet.flexiBenefits),
        money(sheet.pf),
        money(sheet.bonus),
        money(sheet.lta),
        money(sheet.ctcPerMonth),
        money(sheet.ctcPerAnnum),
        money(sheet.monthlyGrossSalary),
      ],
      [
        'No of Days',
        'LOPs',
        'Present in Days',
        'Basic',
        'Retention Allowance',
        'HRA',
        'Flexi Benefits',
        'Net Salary',
        'Less : Employee PF',
        'Less : PT',
        'Less : TDS',
        'LUNCH',
        'Net Payt of Salary',
      ],
      [
        sheet.noOfDays,
        sheet.lops,
        sheet.presentInDays,
        money(sheet.earnedBasic),
        money(sheet.earnedRetentionAllowance),
        money(sheet.earnedHra),
        money(sheet.earnedFlexiBenefits),
        money(sheet.netSalary),
        money(sheet.employeePf),
        money(sheet.professionalTax),
        money(sheet.tds),
        money(sheet.lunch),
        money(sheet.netPaytOfSalary),
      ],
      ['On-Role', month, name],
    ],
    options.filename || `BGT-onrole-payslip-${month || 'month'}.xls`
  );
}

export function downloadContractPayslipExcel(sheet, options = {}) {
  const month = options.month || '';
  const name = sheet?.employeeName || 'Contract';
  const money = (value) => (value == null || value === '' ? '' : String(value));
  downloadSpreadsheet(
    'Contract',
    [
      [
        'S NO',
        'Employee Id',
        'Employee Name',
        'Date of Joining',
        'SALARY',
        'Actual BASIC',
        'Actual DA',
        'Actual SPECIAL ALLOWANCE',
        'Actual Bonus',
        'Actual LEAVE WITH WAGES',
        'Actual Total Gross',
        'Actual Days',
        'Paid Days',
      ],
      [
        options.siNo ?? sheet.serialNo ?? 1,
        sheet.employeeId,
        sheet.employeeName,
        sheet.dateOfJoining,
        money(sheet.salary),
        money(sheet.actualBasic),
        money(sheet.actualDa),
        money(sheet.actualSpecialAllowance),
        money(sheet.actualBonus),
        money(sheet.actualLeaveWithWages),
        money(sheet.actualTotalGross),
        sheet.actualDays,
        sheet.paidDays,
      ],
      [
        '1 Day Attendance',
        'OT Hours',
        'Earned Basic',
        'Earned DA',
        'Earned Special Allowance',
        'Earned Bonus/Arrears/Other Allowance',
        'Earned Leave with Wages',
        'Day Allowance',
        'Overtime',
        'Earned Gross',
        'EPF Cut OFF Amount Employee',
        'Employee PF',
      ],
      [
        money(sheet.oneDayAttendance),
        sheet.otHours,
        money(sheet.earnedBasic),
        money(sheet.earnedDa),
        money(sheet.earnedSpecialAllowance),
        money(sheet.earnedBonusOther),
        money(sheet.earnedLeaveWithWages),
        money(sheet.dayAllowance),
        money(sheet.overtime),
        money(sheet.earnedGross),
        money(sheet.epfCutoffEmployee),
        money(sheet.employeePf),
      ],
      [
        'Employee ESI',
        'Professional Tax',
        'Other/Canteen',
        'Total Deductions',
        'Final Net Pay',
        'EPF Cut OFF Amount Employer',
        'Employer PF',
        'Employer ESI',
        'Service Charges',
        'Total Gross',
        'GST AMOUNT',
        'TOTAL INVOICE AMOUNT',
      ],
      [
        money(sheet.employeeEsi),
        money(sheet.professionalTax),
        money(sheet.otherCanteen),
        money(sheet.totalDeductions),
        money(sheet.finalNetPay),
        money(sheet.epfCutoffEmployer),
        money(sheet.employerPf),
        money(sheet.employerEsi),
        money(sheet.serviceCharges),
        money(sheet.invoiceTotalGross),
        money(sheet.gstAmount),
        money(sheet.totalInvoiceAmount),
      ],
      ['Contract', month, name],
    ],
    options.filename || `BGT-contract-payslip-${month || 'month'}.xls`
  );
}
