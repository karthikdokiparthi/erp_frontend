import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, extractError } from '../api/client';
import { formatMoney } from '../utils/format';

const COMPANIES = ['BGT', 'Ruchitha', 'Akhil', 'BSK', 'Krystal'];

const EMPTY_GROUP = {
  gross: 0,
  deductions: 0,
  net: 0,
  slipCount: 0,
  employeeCount: 0,
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function mergeGroups(apiGroups) {
  const byName = new Map();
  for (const g of apiGroups || []) {
    const key = String(g.workGroup || '').trim();
    if (!key) continue;
    // Canonical company keys only — ignore unknown / blank buckets so tiles never mix.
    const canonical = COMPANIES.find((c) => c.toLowerCase() === key.toLowerCase());
    if (!canonical) continue;
    byName.set(canonical.toLowerCase(), { ...g, workGroup: canonical });
  }
  return COMPANIES.map((name) => {
    const hit = byName.get(name.toLowerCase());
    return {
      workGroup: name,
      gross: hit?.gross ?? 0,
      deductions: hit?.deductions ?? 0,
      net: hit?.net ?? 0,
      slipCount: hit?.slipCount ?? 0,
      employeeCount: hit?.employeeCount ?? 0,
    };
  });
}

/**
 * Separate month payout totals per work group (BGT, Ruchitha, Akhil, BSK, Krystal) + overall total.
 * Used on Payroll → Dashboard only.
 */
export function MonthPayoutByGroup({
  yearMonth: controlledYearMonth,
  onYearMonthChange,
  showToolbar = true,
  loading: externalLoading,
}) {
  const [internalYearMonth, setInternalYearMonth] = useState(currentMonth());
  const yearMonth = controlledYearMonth ?? internalYearMonth;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  const load = useCallback(async (ym) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError('');
    try {
      const next = await api(`/api/hr/payroll/dashboard/payouts?yearMonth=${encodeURIComponent(ym)}`);
      if (reqId !== reqIdRef.current) return;
      setData(next);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setData(null);
      setError(extractError(err));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(yearMonth);
  }, [yearMonth, load]);

  function setYearMonth(ym) {
    if (onYearMonthChange) onYearMonthChange(ym);
    else setInternalYearMonth(ym);
  }

  const groups = useMemo(
    () => (data ? mergeGroups(data.groups) : COMPANIES.map((name) => ({ workGroup: name, ...EMPTY_GROUP }))),
    [data]
  );
  const busy = loading || externalLoading;
  const showPlaceholder = busy && !data;

  return (
    <section className="payroll-payout-section" aria-label="Month payout by company">
      {showToolbar ? (
        <div className="list-toolbar list-toolbar-split">
          <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
            <span>Month</span>
            <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
          </label>
          <button className="btn" type="button" disabled={busy} onClick={() => load(yearMonth)}>
            Refresh
          </button>
        </div>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      <h3 className="section-title" style={{ marginTop: showToolbar ? 8 : 0 }}>
        Month payout by company
      </h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        One tile per company — net payout for the selected month.
      </p>

      <div className="payroll-payout-grid">
        {groups.map((g) => (
          <article key={g.workGroup} className="payroll-payout-tile">
            <div className="payroll-payout-tile__name">{g.workGroup}</div>
            <div className="payroll-payout-tile__metric-label">Month net payout</div>
            <div className="payroll-payout-tile__net">{showPlaceholder ? '…' : formatMoney(g.net)}</div>
            <div className="payroll-payout-tile__meta">
              <div>
                <span className="payroll-payout-tile__meta-label">Gross</span>
                <span className="payroll-payout-tile__meta-value">
                  {showPlaceholder ? '…' : formatMoney(g.gross)}
                </span>
              </div>
              <div>
                <span className="payroll-payout-tile__meta-label">Deductions</span>
                <span className="payroll-payout-tile__meta-value">
                  {showPlaceholder ? '…' : formatMoney(g.deductions)}
                </span>
              </div>
              <div>
                <span className="payroll-payout-tile__meta-label">People</span>
                <span className="payroll-payout-tile__meta-value">
                  {showPlaceholder ? '…' : g.employeeCount || 0}
                </span>
              </div>
              <div>
                <span className="payroll-payout-tile__meta-label">Slips</span>
                <span className="payroll-payout-tile__meta-value">
                  {showPlaceholder ? '…' : g.slipCount || 0}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="payroll-payout-total" role="status">
        <div className="payroll-payout-total__label">All companies</div>
        <div className="payroll-payout-total__values">
          <div>
            <span className="payroll-payout-tile__meta-label">Total net</span>
            <span className="payroll-payout-total__net">
              {showPlaceholder ? '…' : formatMoney(data?.totalNet)}
            </span>
          </div>
          <div className="payroll-payout-total__side">
            <span>
              Gross {showPlaceholder ? '…' : formatMoney(data?.totalGross)}
            </span>
            <span>
              Deductions {showPlaceholder ? '…' : formatMoney(data?.totalDeductions)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
