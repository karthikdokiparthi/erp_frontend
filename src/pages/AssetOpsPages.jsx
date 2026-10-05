import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { AssetSticker, useAssetQr } from '../components/AssetSticker';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import {
  assetMaintenanceKindLabel,
  assetTypeLabel,
  departmentLabel,
  formatDate,
  formatMoney,
} from '../utils/format';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function useLoad(path) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(quiet = false) {
    if (!quiet) {
      setLoading(true);
    }
    setError('');
    try {
      setRows((await api(path)) || []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return { rows, error, setError, loading, load, setRows };
}

function assetLabel(asset) {
  if (!asset) return '';
  const holder = asset.assignedUsername || 'unassigned';
  return `${asset.assetCode} · ${asset.brand || '—'} · ${holder}`;
}

function AssetSelect({ assets, value, onChange, filter }) {
  const options = assets.filter((asset) => (filter ? filter(asset) : true));
  return (
    <select required value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select asset</option>
      {options.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {assetLabel(asset)}
        </option>
      ))}
    </select>
  );
}

export function AssetAssignmentPage() {
  const assets = useLoad('/api/assets');
  const history = useLoad('/api/assets/assignments');
  const [form, setForm] = useState({
    action: 'ASSIGN',
    assetId: '',
    assignedUsername: '',
    assignedUserId: '',
    location: '',
    assignedOn: todayIso(),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = assets.rows.find((row) => row.id === form.assetId);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setForm((current) => ({
      ...current,
      assignedUsername: selected.assignedUsername || '',
      assignedUserId: selected.assignedUserId || '',
      location: selected.location || current.location,
    }));
  }, [selected?.id, form.action]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    history.setError('');
    setNotice('');
    setSaving(true);
    try {
      const body = {
        assetId: form.assetId,
        assignedUsername: form.assignedUsername,
        assignedUserId: form.assignedUserId,
        location: form.location,
        assignedOn: form.assignedOn,
        notes: form.notes || null,
      };
      if (form.action === 'RETURN') {
        await api('/api/assets/returns', { method: 'POST', body: JSON.stringify(body) });
        setNotice('Asset returned.');
      } else {
        await api('/api/assets/assignments', { method: 'POST', body: JSON.stringify(body) });
        setNotice('Asset assigned.');
      }
      setForm({
        action: 'ASSIGN',
        assetId: '',
        assignedUsername: '',
        assignedUserId: '',
        location: '',
        assignedOn: todayIso(),
        notes: '',
      });
      await Promise.all([assets.load(true), history.load(true)]);
    } catch (err) {
      history.setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const assignedCount = assets.rows.filter((row) => row.assignedUsername).length;

  return (
    <div className="asset-page">
      <PageHeader
        title="Asset Assignment"
        description="Issue an asset to a user or take it back into stock. Every change is stored as assignment history."
      />
      <div className="kpi-grid">
        <KpiCard label="Assets" value={assets.loading ? '—' : assets.rows.length} />
        <KpiCard label="Currently assigned" value={assets.loading ? '—' : assignedCount} />
        <KpiCard label="Movements" value={history.loading ? '—' : history.rows.length} />
      </div>
      {history.error ? <p className="form-error">{history.error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
      <div className="split-2 asset-split asset-split-form-first">
        <div className="panel">
          <DataTable
            stacked
            rows={history.rows}
            loading={history.loading}
            error=""
            emptyTitle="No assignment history"
            emptyDescription="Assign or return an asset to start the register."
            columns={[
              { key: 'assetCode', header: 'Asset', render: (row) => <span className="mono">{row.assetCode}</span> },
              { key: 'action', header: 'Action', render: (row) => <StatusBadge value={row.action} /> },
              {
                key: 'assignedUsername',
                header: 'To / from',
                render: (row) =>
                  row.action === 'RETURN'
                    ? row.previousUsername || '—'
                    : row.assignedUsername || '—',
              },
              { key: 'location', header: 'Location' },
              { key: 'assignedOn', header: 'Date', render: (row) => formatDate(row.assignedOn) },
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              {form.action === 'RETURN' ? 'Return asset' : 'Assign asset'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field">
                  <span>Action</span>
                  <select value={form.action} onChange={(event) => update('action', event.target.value)}>
                    <option value="ASSIGN">Assign to user</option>
                    <option value="RETURN">Return to stock</option>
                  </select>
                </label>
                <label className="field">
                  <span>Asset</span>
                  <AssetSelect
                    assets={assets.rows}
                    value={form.assetId}
                    onChange={(value) => update('assetId', value)}
                    filter={(asset) =>
                      asset.status !== 'RETIRED' &&
                      (form.action === 'RETURN' ? Boolean(asset.assignedUsername || asset.assignedUserId) : true)
                    }
                  />
                </label>
                {form.action === 'ASSIGN' ? (
                  <>
                    <label className="field">
                      <span>Username</span>
                      <input
                        required
                        value={form.assignedUsername}
                        onChange={(event) => update('assignedUsername', event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>User ID</span>
                      <input
                        required
                        value={form.assignedUserId}
                        onChange={(event) => update('assignedUserId', event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                <label className="field">
                  <span>Location</span>
                  <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input required type="date" value={form.assignedOn} onChange={(event) => update('assignedOn', event.target.value)} />
                </label>
                <label className="field span-2">
                  <span>Notes</span>
                  <input value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || !form.assetId}>
                  {saving ? 'Saving…' : form.action === 'RETURN' ? 'Return asset' : 'Assign asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetTransferPage() {
  const assets = useLoad('/api/assets');
  const transfers = useLoad('/api/assets/transfers');
  const [form, setForm] = useState({
    assetId: '',
    toUsername: '',
    toUserId: '',
    toLocation: '',
    transferredOn: todayIso(),
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = assets.rows.find((row) => row.id === form.assetId);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setForm((current) => ({
      ...current,
      toLocation: current.toLocation || selected.location || '',
    }));
  }, [selected?.id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    transfers.setError('');
    setNotice('');
    setSaving(true);
    try {
      await api('/api/assets/transfers', {
        method: 'POST',
        body: JSON.stringify({
          assetId: form.assetId,
          toUsername: form.toUsername,
          toUserId: form.toUserId,
          toLocation: form.toLocation,
          transferredOn: form.transferredOn,
          reason: form.reason || null,
        }),
      });
      setNotice('Asset transferred.');
      setForm({
        assetId: '',
        toUsername: '',
        toUserId: '',
        toLocation: '',
        transferredOn: todayIso(),
        reason: '',
      });
      await Promise.all([assets.load(true), transfers.load(true)]);
    } catch (err) {
      transfers.setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="asset-page">
      <PageHeader
        title="Asset Transfer"
        description="Move an asset from one user or location to another. The current holder is recorded automatically."
      />
      {transfers.error ? <p className="form-error">{transfers.error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
      <div className="split-2 asset-split asset-split-form-first">
        <div className="panel">
          <DataTable
            stacked
            rows={transfers.rows}
            loading={transfers.loading}
            error=""
            emptyTitle="No transfers"
            emptyDescription="Transfer an asset to start the register."
            columns={[
              { key: 'assetCode', header: 'Asset', render: (row) => <span className="mono">{row.assetCode}</span> },
              { key: 'fromUsername', header: 'From', render: (row) => row.fromUsername || row.fromLocation || '—' },
              { key: 'toUsername', header: 'To', render: (row) => row.toUsername || '—' },
              { key: 'toLocation', header: 'Location' },
              { key: 'transferredOn', header: 'Date', render: (row) => formatDate(row.transferredOn) },
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Transfer asset
            </h2>
            {selected ? (
              <p className="muted">
                Current: {selected.assignedUsername || 'unassigned'}
                {selected.assignedUserId ? ` (${selected.assignedUserId})` : ''}
                {selected.location ? ` · ${selected.location}` : ''}
              </p>
            ) : null}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field span-2">
                  <span>Asset</span>
                  <AssetSelect
                    assets={assets.rows}
                    value={form.assetId}
                    onChange={(value) => update('assetId', value)}
                    filter={(asset) => asset.status !== 'RETIRED'}
                  />
                </label>
                <label className="field">
                  <span>New username</span>
                  <input required value={form.toUsername} onChange={(event) => update('toUsername', event.target.value)} />
                </label>
                <label className="field">
                  <span>New user ID</span>
                  <input required value={form.toUserId} onChange={(event) => update('toUserId', event.target.value)} />
                </label>
                <label className="field">
                  <span>New location</span>
                  <input required value={form.toLocation} onChange={(event) => update('toLocation', event.target.value)} />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    required
                    type="date"
                    value={form.transferredOn}
                    onChange={(event) => update('transferredOn', event.target.value)}
                  />
                </label>
                <label className="field span-2">
                  <span>Reason</span>
                  <input value={form.reason} onChange={(event) => update('reason', event.target.value)} />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || !form.assetId}>
                  {saving ? 'Saving…' : 'Transfer asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetMaintenancePage() {
  const assets = useLoad('/api/assets');
  const jobs = useLoad('/api/assets/maintenance');
  const [form, setForm] = useState({
    assetId: '',
    kind: 'CORRECTIVE',
    vendor: '',
    scheduledOn: todayIso(),
    cost: '',
    description: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    jobs.setError('');
    setNotice('');
    setSaving(true);
    try {
      await api('/api/assets/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          assetId: form.assetId,
          kind: form.kind,
          vendor: form.vendor || null,
          scheduledOn: form.scheduledOn || null,
          cost: form.cost === '' ? null : Number(form.cost),
          description: form.description,
          notes: form.notes || null,
        }),
      });
      setNotice('Maintenance job opened. The asset is marked In maintenance.');
      setForm({
        assetId: '',
        kind: 'CORRECTIVE',
        vendor: '',
        scheduledOn: todayIso(),
        cost: '',
        description: '',
        notes: '',
      });
      await Promise.all([assets.load(true), jobs.load(true)]);
    } catch (err) {
      jobs.setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(row, status) {
    jobs.setError('');
    setSaving(true);
    try {
      await api(`/api/assets/maintenance/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await Promise.all([assets.load(true), jobs.load(true)]);
    } catch (err) {
      jobs.setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const openCount = jobs.rows.filter((row) => row.status === 'OPEN' || row.status === 'IN_PROGRESS').length;

  return (
    <div className="asset-page">
      <PageHeader
        title="Asset Maintenance"
        description="Log preventive, corrective, or inspection work. Open jobs mark the asset In maintenance until they are completed or cancelled."
      />
      <div className="kpi-grid">
        <KpiCard label="Jobs" value={jobs.loading ? '—' : jobs.rows.length} />
        <KpiCard label="Open" value={jobs.loading ? '—' : openCount} />
      </div>
      {jobs.error ? <p className="form-error">{jobs.error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
      <div className="split-2 asset-split asset-split-form-first">
        <div className="panel">
          <DataTable
            stacked
            rows={jobs.rows}
            loading={jobs.loading}
            error=""
            emptyTitle="No maintenance jobs"
            emptyDescription="Open a job against an asset."
            columns={[
              { key: 'assetCode', header: 'Asset', render: (row) => <span className="mono">{row.assetCode}</span> },
              { key: 'kind', header: 'Type', render: (row) => assetMaintenanceKindLabel(row.kind) },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'scheduledOn', header: 'Scheduled', render: (row) => formatDate(row.scheduledOn) },
              { key: 'cost', header: 'Cost', render: (row) => formatMoney(row.cost) },
              {
                key: 'actions',
                header: '',
                render: (row) =>
                  row.status === 'OPEN' || row.status === 'IN_PROGRESS' ? (
                    <div className="toolbar-actions">
                      {row.status === 'OPEN' ? (
                        <button className="btn btn-ghost btn-sm" type="button" disabled={saving} onClick={() => setStatus(row, 'IN_PROGRESS')}>
                          Start
                        </button>
                      ) : null}
                      <button className="btn btn-ghost btn-sm" type="button" disabled={saving} onClick={() => setStatus(row, 'COMPLETED')}>
                        Complete
                      </button>
                      <button className="btn btn-ghost btn-sm" type="button" disabled={saving} onClick={() => setStatus(row, 'CANCELLED')}>
                        Cancel
                      </button>
                    </div>
                  ) : null,
              },
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-pad">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              New maintenance job
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field span-2">
                  <span>Asset</span>
                  <AssetSelect
                    assets={assets.rows}
                    value={form.assetId}
                    onChange={(value) => update('assetId', value)}
                    filter={(asset) => asset.status !== 'RETIRED'}
                  />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select value={form.kind} onChange={(event) => update('kind', event.target.value)}>
                    <option value="PREVENTIVE">Preventive</option>
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="INSPECTION">Inspection</option>
                  </select>
                </label>
                <label className="field">
                  <span>Scheduled</span>
                  <input type="date" value={form.scheduledOn} onChange={(event) => update('scheduledOn', event.target.value)} />
                </label>
                <label className="field">
                  <span>Vendor</span>
                  <input value={form.vendor} onChange={(event) => update('vendor', event.target.value)} />
                </label>
                <label className="field">
                  <span>Cost</span>
                  <input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => update('cost', event.target.value)} />
                </label>
                <label className="field span-2">
                  <span>Work description</span>
                  <input required value={form.description} onChange={(event) => update('description', event.target.value)} />
                </label>
                <label className="field span-2">
                  <span>Notes</span>
                  <input value={form.notes} onChange={(event) => update('notes', event.target.value)} />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || !form.assetId}>
                  {saving ? 'Saving…' : 'Open job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function QrCard({ asset }) {
  const qrSrc = useAssetQr(asset);
  return <AssetSticker asset={asset} qrSrc={qrSrc} />;
}

export function AssetQrPage() {
  const assets = useLoad('/api/assets');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const visible = assets.rows.filter((row) => !deptFilter || row.department === deptFilter);
  const selected = visible.find((row) => row.id === selectedId) || visible[0] || null;

  return (
    <div className="asset-page">
      <PageHeader
        title="QR Code"
        description="Print or preview asset labels. A phone camera scan shows the fields for that asset type. Public lookup is also at /scan?code=."
      />
      <div className="list-toolbar list-toolbar-split">
        <label className="field" style={{ margin: 0, minWidth: 180 }}>
          <span>Department</span>
          <select value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}>
            <option value="">All departments</option>
            <option value="IT">IT</option>
            <option value="ELE">Electrical</option>
            <option value="MECH">Mechanical</option>
          </select>
        </label>
        <div className="toolbar-actions">
          <button className="btn btn-primary" type="button" onClick={() => window.print()} disabled={!visible.length}>
            Print labels
          </button>
        </div>
      </div>
      {assets.error ? <p className="form-error">{assets.error}</p> : null}
      <div className="split-2 asset-split">
        <div className="panel">
          <DataTable
            stacked
            rows={visible}
            loading={assets.loading}
            error=""
            selectedKey={selected?.id}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyTitle="No assets"
            emptyDescription="Add assets on Asset Master first."
            columns={[
              { key: 'assetCode', header: 'Asset code', render: (row) => <span className="mono">{row.assetCode}</span> },
              { key: 'department', header: 'Dept', render: (row) => departmentLabel(row.department) },
              { key: 'assetType', header: 'Type', render: (row) => assetTypeLabel(row.assetType) },
              { key: 'brand', header: 'Make / brand' },
              {
                key: 'scan',
                header: '',
                render: (row) => (
                  <Link className="linkish" to={`/scan?code=${encodeURIComponent(row.assetCode)}`} target="_blank">
                    Scan page
                  </Link>
                ),
              },
            ]}
          />
        </div>
        <div className="panel asset-print">
          <div className="panel-pad">
            <p className="muted no-print" style={{ marginTop: 0 }}>
              On a phone, tap a row to preview that sticker. Print still includes every label in the filter.
            </p>
            {selected ? (
              <div className="asset-qr-single no-print">
                <QrCard asset={selected} />
              </div>
            ) : null}
            <div className="asset-qr-grid">
              {visible.map((asset) => (
                <QrCard key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
