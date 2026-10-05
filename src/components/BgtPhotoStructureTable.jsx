import {
  BGT_PHOTO_STRUCTURE_COLS,
  photoStructureFormulas,
  photoStructureHeaders,
  photoStructureValues,
  previewBgtStructure,
} from '../utils/bgtSalaryPhoto';
import { formatMoney } from '../utils/format';

/** Photo-order CTC strip for BGT-STD / BGT structures (visible UI, not just API lines). */
export function BgtPhotoStructureTable({ lines, ctc, title }) {
  const preview = previewBgtStructure(lines, ctc);
  const headers = photoStructureHeaders();
  const values = photoStructureValues(preview, formatMoney);
  const formulas = photoStructureFormulas(preview);
  return (
    <div className="table-wrap" style={{ marginBottom: 16 }}>
      {title ? (
        <h4 className="section-title" style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
          {title}
        </h4>
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
      <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Photo order: {BGT_PHOTO_STRUCTURE_COLS.map((c) => c.header).join(' · ')} · CTC/mo · CTC/annum ·
        Monthly gross (excl. employer PF). CTC/annum and monthly gross are computed — edit lines in the table
        below.
      </p>
    </div>
  );
}
