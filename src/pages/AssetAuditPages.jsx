import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { QrScanner } from '../components/QrScanner';
import { ScanResultPopup } from '../components/ScanResultPopup';
import { openLiveCamera, stopStream } from '../utils/camera';
import { downloadAssetAuditExcel } from '../utils/exportExcel';
import { assetTypeLabel, departmentLabel, parseAssetCodeFromScan } from '../utils/format';

function useLoad(path) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows((await api(path)) || []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return { rows, error, setError, loading, load };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value) {
  if (!value) return '—';
  const [year, month] = String(value).slice(0, 7).split('-');
  if (!year || !month) return value;
  return new Date(`${year}-${month}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export function AssetAuditPage() {
  const audits = useLoad('/api/assets/audits');
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    department: '',
    location: '',
    auditMonth: currentMonth(),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    audits.setError('');
    setSaving(true);
    try {
      const created = await api('/api/assets/audits', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title || null,
          department: form.department || null,
          location: form.location || null,
          auditMonth: form.auditMonth,
          notes: form.notes || null,
        }),
      });
      navigate(`/assets/audit/${created.id}`);
    } catch (err) {
      audits.setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="asset-page">
      <PageHeader
        title="Asset Audit"
        description="Create a monthly audit session, scan each asset QR on a phone, record available / not available and condition, then export Excel. History stays in ERP — Excel is the report, not the register."
      />
      {audits.error ? <p className="form-error">{audits.error}</p> : null}
      <div className="split-2 asset-split asset-split-form-first">
        <div className="panel">
          <DataTable
            stacked
            rows={audits.rows}
            loading={audits.loading}
            error=""
            onRowClick={(row) => navigate(`/assets/audit/${row.id}`)}
            emptyTitle="No audit sessions"
            emptyDescription="Start a monthly session. Active assets are added as pending lines."
            columns={[
              { key: 'title', header: 'Session' },
              { key: 'auditMonth', header: 'Month', render: (row) => monthLabel(row.auditMonth) },
              { key: 'location', header: 'Location', render: (row) => row.location || '—' },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'progress',
                header: 'Progress',
                render: (row) => `${row.progress?.audited || 0}/${row.progress?.total || 0} (${row.progress?.completionPercent || 0}%)`,
              },
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              New monthly session
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field">
                  <span>Audit month</span>
                  <input required type="month" value={form.auditMonth} onChange={(event) => update('auditMonth', event.target.value)} />
                </label>
                <label className="field">
                  <span>Department</span>
                  <select value={form.department} onChange={(event) => update('department', event.target.value)}>
                    <option value="">All my departments</option>
                    <option value="IT">IT</option>
                    <option value="ELE">Electrical</option>
                    <option value="MECH">Mechanical</option>
                  </select>
                </label>
                <label className="field span-2">
                  <span>Location</span>
                  <input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Hyderabad - IT Room" />
                </label>
                <label className="field span-2">
                  <span>Title (optional)</span>
                  <input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="August 2026 Asset Audit" />
                </label>
                <label className="field span-2">
                  <span>Notes</span>
                  <input value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Start audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetAuditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState(null);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({
    availability: 'AVAILABLE',
    availabilityReason: 'MISSING',
    condition: 'GOOD',
    actualLocation: '',
    remarks: '',
    rescan: false,
  });
  const [photo, setPhoto] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [liveStream, setLiveStream] = useState(null);
  const [scanAlert, setScanAlert] = useState(null);

  const load = useCallback(async (options = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    setError('');
    try {
      setAudit(await api(`/api/assets/audits/${id}`));
    } catch (err) {
      setError(extractError(err));
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [id, load]);

  function applyLookup(result, options = {}) {
    const line = result.line;
    setLookup(result);
    setSelectedId(line.id);
    setForm({
      availability: line.audited ? line.availability : 'AVAILABLE',
      availabilityReason: line.availabilityReason || 'MISSING',
      condition: line.condition && line.condition !== 'PENDING' ? line.condition : 'GOOD',
      actualLocation: line.actualLocation || line.expectedLocation || '',
      remarks: line.remarks || '',
      rescan: false,
    });
    setPhoto(null);
    if (!options.keepScanner) {
      stopStream(liveStream);
      setLiveStream(null);
      setScanOpen(false);
    }
    setNotice(
      result.alreadyAudited
        ? `${line.assetCode} was already audited. Tick Rescan only if you need to replace it.`
        : `${line.assetCode} loaded. Submit audit to save, or change availability first.`
    );
  }

  const lookupCode = useCallback(async (raw, options = {}) => {
    const parsed = parseAssetCodeFromScan(raw);
    if (!parsed) {
      setError('No asset code in that QR');
      setScanAlert({
        kind: 'fail',
        title: 'Scan failed',
        message: 'No asset code in that QR. Hold the sticker inside the square and try again.',
      });
      return;
    }
    setCode(parsed);
    setError('');
    setSaving(true);
    try {
      const result = await api(`/api/assets/audits/${id}/lookup?code=${encodeURIComponent(parsed)}`);
      const line = result.line;
      if (options.record && !result.alreadyAudited) {
        const saved = await api(`/api/assets/audits/${id}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            assetId: line.assetId,
            availability: 'AVAILABLE',
            condition: 'GOOD',
            actualLocation: line.expectedLocation || line.actualLocation || audit?.location || null,
            remarks: null,
            rescan: false,
          }),
        });
        setNotice(`${saved.assetCode} recorded as Available. Scan the next QR, or tap the row to change it.`);
        setScanAlert({
          kind: 'ok',
          title: 'Scan successful',
          code: saved.assetCode,
          message: 'Recorded as Available. Point at the next sticker.',
        });
        setSelectedId(saved.id);
        setLookup({
          line: { ...line, ...saved, audited: true },
          alreadyAudited: true,
        });
        setForm({
          availability: saved.availability || 'AVAILABLE',
          availabilityReason: 'MISSING',
          condition: saved.condition && saved.condition !== 'PENDING' ? saved.condition : 'GOOD',
          actualLocation: saved.actualLocation || line.expectedLocation || '',
          remarks: saved.remarks || '',
          rescan: false,
        });
        setPhoto(null);
        await load({ silent: true });
        return;
      }
      if (options.record && result.alreadyAudited) {
        setScanAlert({
          kind: 'warn',
          title: 'Already audited',
          code: line.assetCode,
          message: 'This asset is already in this session. Scan the next QR, or tap the row to change it.',
        });
      }
      applyLookup(result, { keepScanner: Boolean(options.record) });
    } catch (err) {
      setLookup(null);
      const message = extractError(err);
      setError(message);
      setScanAlert({
        kind: 'fail',
        title: 'Scan failed',
        code: parsed,
        message,
      });
    } finally {
      setSaving(false);
    }
  }, [id, load, audit?.location]);

  async function toggleScanner() {
    if (scanOpen) {
      stopStream(liveStream);
      setLiveStream(null);
      setScanOpen(false);
      return;
    }
    setError('');
    setNotice('Opening live scanner…');
    try {
      const stream = await openLiveCamera();
      setLiveStream(stream);
      setNotice('Point the camera at the asset QR.');
    } catch {
      setLiveStream(null);
      setNotice('');
    }
    setScanOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!lookup?.line) return;
    if (lookup.alreadyAudited && !form.rescan) {
      setError('Tick Rescan to replace the previous result for this asset.');
      return;
    }
    if (form.availability === 'NOT_AVAILABLE' && form.availabilityReason === 'OTHER' && !String(form.remarks || '').trim()) {
      setError('Remarks are required when the reason is Other.');
      return;
    }
    if (form.availability === 'AVAILABLE' && form.condition === 'DAMAGED' && !photo && !lookup.line.photoFileName) {
      setError('A photograph is required for damaged assets.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const saved = await api(`/api/assets/audits/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          assetId: lookup.line.assetId,
          availability: form.availability,
          availabilityReason: form.availability === 'NOT_AVAILABLE' ? form.availabilityReason : null,
          condition: form.availability === 'AVAILABLE' ? form.condition : null,
          actualLocation: form.actualLocation || null,
          remarks: form.remarks || null,
          rescan: lookup.alreadyAudited ? true : false,
        }),
      });
      if (photo) {
        const data = new FormData();
        data.append('file', photo);
        await api(`/api/assets/audits/${id}/lines/${saved.id}/photo`, { method: 'POST', body: data });
      }
      setNotice(`${saved.assetCode} saved.`);
      setSelectedId(saved.id);
      setLookup(null);
      setPhoto(null);
      await load({ silent: true });
    } catch (err) {
      if (err.status === 409) {
        setForm((current) => ({ ...current, rescan: false }));
        setLookup((current) => (current ? { ...current, alreadyAudited: true } : current));
      }
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function closeSession(action) {
    const message = action === 'complete' ? 'Close this monthly audit? Pending assets stay pending.' : 'Cancel this audit session?';
    if (!window.confirm(message)) return;
    setError('');
    setSaving(true);
    try {
      setAudit(await api(`/api/assets/audits/${id}/${action}`, { method: 'POST' }));
      setNotice(action === 'complete' ? 'Audit completed.' : 'Audit cancelled.');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const progress = audit?.progress || {};
  const lines = useMemo(() => {
    const rows = audit?.lines || [];
    if (filter === 'pending') return rows.filter((row) => !row.audited);
    if (filter === 'missing') return rows.filter((row) => row.availability === 'NOT_AVAILABLE');
    if (filter === 'damaged') return rows.filter((row) => row.condition === 'DAMAGED');
    if (filter === 'exception') return rows.filter((row) => row.locationException);
    return rows;
  }, [audit, filter]);

  const open = audit?.status === 'IN_PROGRESS' || audit?.status === 'DRAFT';
  const line = lookup?.line;

  return (
    <div className="asset-page asset-audit-detail">
      <PageHeader
        title={audit?.title || 'Asset audit'}
        description={
          audit
            ? `${monthLabel(audit.auditMonth)} · ${audit.location || 'No location'} · ${departmentLabel(audit.department) === '—' ? 'All departments' : departmentLabel(audit.department)}`
            : 'Loading session…'
        }
        actions={
          <div className="toolbar-actions">
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/assets/audit')}>
              All sessions
            </button>
            <button className="btn btn-ghost" type="button" disabled={!audit?.lines?.length} onClick={() => downloadAssetAuditExcel(audit)}>
              Export Excel
            </button>
          </div>
        }
      />
      <div className="kpi-grid kpi-grid-6">
        <KpiCard label="Total assets" value={loading ? '—' : progress.total || 0} hint="Show all" active={!filter} onClick={() => setFilter('')} />
        <KpiCard label="Audited" value={loading ? '—' : progress.audited || 0} />
        <KpiCard label="Pending" value={loading ? '—' : progress.pending || 0} hint="Show pending" active={filter === 'pending'} onClick={() => setFilter('pending')} />
        <KpiCard label="Available" value={loading ? '—' : progress.available || 0} />
        <KpiCard label="Missing" value={loading ? '—' : progress.missing || 0} hint="Not available" active={filter === 'missing'} onClick={() => setFilter('missing')} />
        <KpiCard label="Damaged" value={loading ? '—' : progress.damaged || 0} hint="Show damaged" active={filter === 'damaged'} onClick={() => setFilter('damaged')} />
        <KpiCard label="Location exceptions" value={loading ? '—' : progress.locationExceptions || 0} hint="Actual ≠ expected" active={filter === 'exception'} onClick={() => setFilter('exception')} />
        <KpiCard label="Complete" value={loading ? '—' : `${progress.completionPercent || 0}%`} />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
      <ScanResultPopup alert={scanAlert} onClose={() => setScanAlert(null)} />
      {open ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-pad">
            <div className="list-toolbar list-toolbar-split">
              <h2 className="section-title" style={{ margin: 0 }}>
                Scan QR
              </h2>
              <div className="toolbar-actions">
                <button className="btn btn-primary" type="button" disabled={saving} onClick={toggleScanner}>
                  {scanOpen ? 'Hide scanner' : 'Scan QR'}
                </button>
                <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => closeSession('complete')}>
                  Complete audit
                </button>
                <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => closeSession('cancel')}>
                  Cancel session
                </button>
              </div>
            </div>
            {scanOpen ? (
              <QrScanner
                stream={liveStream}
                onCode={(scanned) => lookupCode(scanned, { record: true })}
                onAlert={setScanAlert}
              />
            ) : null}
            <form
              className="list-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                lookupCode(code);
              }}
            >
              <label className="field" style={{ margin: 0, flex: 1 }}>
                <span>Asset code</span>
                <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="BGT/IT/DSP/047" />
              </label>
              <button className="btn btn-primary" type="submit" disabled={saving || !code}>
                Look up
              </button>
            </form>
            {line ? (
              <form onSubmit={submit} style={{ marginTop: 16 }}>
                <div className="form-grid">
                  <div className="field">
                    <span>Asset code</span>
                    <strong className="mono">{line.assetCode}</strong>
                  </div>
                  <div className="field">
                    <span>Asset name</span>
                    <strong>{line.assetName || '—'}</strong>
                  </div>
                  <div className="field">
                    <span>Category</span>
                    <span>{assetTypeLabel(line.category)}</span>
                  </div>
                  <div className="field">
                    <span>Serial</span>
                    <span className="mono">{line.serialNumber || '—'}</span>
                  </div>
                  <div className="field">
                    <span>Assigned to</span>
                    <span>{line.assignedTo || '—'}</span>
                  </div>
                  <div className="field">
                    <span>Expected location</span>
                    <span>{line.expectedLocation || '—'}</span>
                  </div>
                  <label className="field">
                    <span>Availability</span>
                    <select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}>
                      <option value="AVAILABLE">Available</option>
                      <option value="NOT_AVAILABLE">Not available</option>
                    </select>
                  </label>
                  {form.availability === 'AVAILABLE' ? (
                    <>
                      <label className="field">
                        <span>Condition</span>
                        <select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))}>
                          <option value="GOOD">Good</option>
                          <option value="FAIR">Fair</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="UNDER_REPAIR">Under Repair</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Actual location</span>
                        <input required value={form.actualLocation} onChange={(event) => setForm((current) => ({ ...current, actualLocation: event.target.value }))} />
                      </label>
                    </>
                  ) : (
                    <label className="field">
                      <span>Reason</span>
                      <select value={form.availabilityReason} onChange={(event) => setForm((current) => ({ ...current, availabilityReason: event.target.value }))}>
                        <option value="MISSING">Missing</option>
                        <option value="TRANSFERRED">Transferred</option>
                        <option value="UNDER_REPAIR">Under Repair</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="NOT_FOUND">Not Found</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                  )}
                  <label className="field span-2">
                    <span>Remarks</span>
                    <input value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} />
                  </label>
                  <label className="field span-2">
                    <span>Photograph {form.condition === 'DAMAGED' && form.availability === 'AVAILABLE' ? '(required for damaged)' : '(optional)'}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
                    {line.photoFileName ? <span className="muted">Current photo: {line.photoFileName}</span> : null}
                  </label>
                  {lookup.alreadyAudited ? (
                    <label className="field span-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.rescan} onChange={(event) => setForm((current) => ({ ...current, rescan: event.target.checked }))} />
                      <span>Rescan and replace the previous result</span>
                    </label>
                  ) : null}
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Submit audit'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="muted">This session is {String(audit?.status || '').toLowerCase()}.</p>
      )}
      <div className="panel">
        <DataTable
          stacked
          rows={lines}
          rowKey="id"
          selectedKey={selectedId}
          loading={loading}
          error=""
          onRowClick={(row) => applyLookup({ line: row, alreadyAudited: Boolean(row.audited) })}
          emptyTitle="No lines"
          emptyDescription="No assets match this filter."
          columns={[
            { key: 'assetCode', header: 'Asset', render: (row) => <span className="mono">{row.assetCode}</span> },
            { key: 'assetName', header: 'Name' },
            { key: 'expectedLocation', header: 'Expected' },
            { key: 'actualLocation', header: 'Actual', render: (row) => row.actualLocation || '—' },
            { key: 'availability', header: 'Available', render: (row) => <StatusBadge value={row.availability} /> },
            { key: 'condition', header: 'Condition', render: (row) => <StatusBadge value={row.condition} /> },
            { key: 'auditedBy', header: 'Auditor', render: (row) => row.auditedBy || '—' },
          ]}
        />
      </div>
    </div>
  );
}
