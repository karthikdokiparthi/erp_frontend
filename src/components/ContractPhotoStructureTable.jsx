import {
  CONTRACT_PHOTO_ACTUAL_COLS,
  CONTRACT_PHOTO_EARNED_COLS,
  CONTRACT_PHOTO_INVOICE_COLS,
  contractPhotoEarnedFormulas,
  contractPhotoEarnedHeaders,
  contractPhotoEarnedValues,
  contractPhotoInvoiceFormulas,
  contractPhotoInvoiceHeaders,
  contractPhotoInvoiceValues,
  contractPhotoStructureFormulas,
  contractPhotoStructureHeaders,
  contractPhotoStructureValues,
  previewContractStructure,
} from '../utils/contractSalaryPhoto';
import { formatMoney } from '../utils/format';

function PhotoStrip({ title, headers, values, formulas }) {
  return (
    <div className="table-wrap" style={{ marginBottom: 12 }}>
      {title ? (
        <h5 className="muted" style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>
          {title}
        </h5>
      ) : null}
      <table className="data-table payslip-paper">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {values.map((v, i) => (
              <td key={`v-${headers[i]}`} className="mono">
                {v}
              </td>
            ))}
          </tr>
          <tr>
            {formulas.map((f, i) => (
              <td key={`f-${headers[i]}`} className="muted" style={{ fontSize: 11 }}>
                {f}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Full Receipt Contract photo sheet (all 3 strips) for RUCHITHA/AKHIL/BSK/KRYSTAL-STD. */
export function ContractPhotoStructureTable({ lines, salary, title }) {
  const preview = previewContractStructure(lines, salary);
  return (
    <div style={{ marginBottom: 16 }}>
      {title ? (
        <h4 className="section-title" style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
          {title}
        </h4>
      ) : null}
      <PhotoStrip
        title="Identity / Actual"
        headers={contractPhotoStructureHeaders()}
        values={contractPhotoStructureValues(preview, formatMoney)}
        formulas={contractPhotoStructureFormulas(preview)}
      />
      <PhotoStrip
        title="Earned"
        headers={contractPhotoEarnedHeaders()}
        values={contractPhotoEarnedValues(preview, formatMoney, { structurePreview: true })}
        formulas={contractPhotoEarnedFormulas()}
      />
      <PhotoStrip
        title="Deductions / Invoice"
        headers={contractPhotoInvoiceHeaders()}
        values={contractPhotoInvoiceValues(preview, formatMoney, { structurePreview: true })}
        formulas={contractPhotoInvoiceFormulas()}
      />
      <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Receipt Contract photo ({CONTRACT_PHOTO_ACTUAL_COLS.length + CONTRACT_PHOTO_EARNED_COLS.length + CONTRACT_PHOTO_INVOICE_COLS.length}{' '}
        fields): every box from the handwritten register. Actual Basic/DA/Special come from the contract SP
        salary table on Calculate; earned/invoice columns fill on Processing Calculate (zeros OK until then).
        Edit structure lines below.
      </p>
    </div>
  );
}
