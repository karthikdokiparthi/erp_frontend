import { useEffect, useMemo, useState } from 'react';
import { api, apiUrl, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AssetSticker, useAssetQr } from '../components/AssetSticker';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { assetTypeLabel, departmentLabel, toDateInputValue } from '../utils/format';
import { downloadAssetsExcel } from '../utils/exportExcel';

const IT_TYPES = [
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'SWITCH', label: 'Switch network' },
  { value: 'ROUTER', label: 'Router' },
];

const emptyForm = {
  assetCode: '',
  department: 'IT',
  assetType: '',
  brand: '',
  monitorSerial: '',
  cpuSerial: '',
  mouseSerial: '',
  ethernetUsbAdapter: '',
  serialNumber: '',
  modelNumber: '',
  ports: '',
  assignedUsername: '',
  assignedUserId: '',
  location: '',
  supplier: '',
  installedOn: '',
  status: 'ACTIVE',
  notes: '',
};

function bodyFromForm(form) {
  return {
    assetCode: form.assetCode,
    department: form.department,
    assetType: form.department === 'IT' ? form.assetType || null : null,
    brand: form.brand,
    monitorSerial: form.monitorSerial || null,
    cpuSerial: form.cpuSerial || null,
    mouseSerial: form.mouseSerial || null,
    ethernetUsbAdapter: form.ethernetUsbAdapter || null,
    serialNumber: form.serialNumber || null,
    modelNumber: form.modelNumber || null,
    ports: form.ports || null,
    assignedUsername: form.assignedUsername || null,
    assignedUserId: form.assignedUserId || null,
    location: form.location || null,
    supplier: form.supplier || null,
    installedOn: form.installedOn || null,
    status: form.status,
    notes: form.notes || null,
  };
}

export function AssetsPage() {
  const { user } = useAuth();
  const allowed = useMemo(() => {
    const list = user?.assetDepartments;
    return list?.length ? list : ['IT', 'ELE', 'MECH'];
  }, [user]);
  const [rows, setRows] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(() => ({ ...emptyForm, department: allowed[0] || 'IT' }));
  const [documentFile, setDocumentFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const created = rows.length;
  const itCount = rows.filter((row) => row.department === 'IT').length;
  const eleCount = rows.filter((row) => row.department === 'ELE').length;
  const mechCount = rows.filter((row) => row.department === 'MECH').length;
  const visibleRows = rows.filter((row) => {
    if (deptFilter && row.department !== deptFilter) return false;
    if (typeFilter && row.assetType !== typeFilter) return false;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const hay = [
        row.assetCode,
        row.brand,
        row.assignedUsername,
        row.assignedUserId,
        row.location,
        row.serialNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const qrSrc = useAssetQr(selected);
  const type = form.department === 'IT' ? form.assetType : '';

  async function load(quiet = false) {
    if (!quiet) {
      setLoading(true);
    }
    setError('');
    try {
      const list = await api('/api/assets');
      setRows(list || []);
      setSelected((current) => (current ? list?.find((row) => row.id === current.id) || null : null));
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
  }, []);

  useEffect(() => {
    if (selected && deptFilter && selected.department !== deptFilter) {
      setSelected(null);
    }
    if (selected && typeFilter && selected.assetType !== typeFilter) {
      setSelected(null);
    }
  }, [deptFilter, typeFilter, selected]);

  useEffect(() => {
    if (selected) {
      setForm({
        assetCode: selected.assetCode || '',
        department: selected.department || allowed[0] || 'IT',
        assetType: selected.assetType || '',
        brand: selected.brand || '',
        monitorSerial: selected.monitorSerial || '',
        cpuSerial: selected.cpuSerial || '',
        mouseSerial: selected.mouseSerial || '',
        ethernetUsbAdapter: selected.ethernetUsbAdapter || '',
        serialNumber: selected.serialNumber || '',
        modelNumber: selected.modelNumber || '',
        ports: selected.ports || '',
        assignedUsername: selected.assignedUsername || '',
        assignedUserId: selected.assignedUserId || '',
        location: selected.location || '',
        supplier: selected.supplier || '',
        installedOn: toDateInputValue(selected.installedOn),
        status: selected.status || 'ACTIVE',
        notes: selected.notes || '',
      });
      setDocumentFile(null);
    }
  }, [selected, allowed]);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'department' && value !== 'IT') {
        next.assetType = '';
      }
      return next;
    });
  }

  function scrollToEditor() {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1024px)').matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById('asset-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function startNew() {
    setSelected(null);
    setDocumentFile(null);
    setFileInputKey((current) => current + 1);
    setError('');
    setNotice('');
    setForm({
      ...emptyForm,
      department: deptFilter || allowed[0] || 'IT',
      assetType: deptFilter === 'IT' ? typeFilter : '',
    });
    scrollToEditor();
  }

  function filterByDepartment(department) {
    setDeptFilter(department);
    setTypeFilter('');
  }

  async function attachDocument(assetId) {
    if (!documentFile) {
      return null;
    }
    if (documentFile.size > 10 * 1024 * 1024) {
      throw new Error('The document must be 10 MB or smaller');
    }
    const data = new FormData();
    data.append('file', documentFile);
    const uploaded = await api(`/api/assets/${assetId}/document`, { method: 'POST', body: data });
    setDocumentFile(null);
    return uploaded;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (form.department === 'IT' && !form.assetType) {
      setError('Select Desktop, Laptop, Printer, Switch network, or Router');
      return;
    }
    const editing = Boolean(selected);
    setSaving(true);
    try {
      const saved = editing
        ? await api(`/api/assets/${selected.id}`, { method: 'PUT', body: JSON.stringify(bodyFromForm(form)) })
        : await api('/api/assets', { method: 'POST', body: JSON.stringify(bodyFromForm(form)) });
      const uploaded = await attachDocument(saved.id);
      const latest = uploaded || saved;
      await load(true);
      if (editing) {
        setSelected(latest);
        setNotice(`${latest.assetCode} updated.`);
      } else {
        if (deptFilter && latest.department !== deptFilter) {
          setDeptFilter('');
        }
        if (typeFilter && latest.assetType !== typeFilter) {
          setTypeFilter('');
        }
        setSelected(null);
        setDocumentFile(null);
        setFileInputKey((current) => current + 1);
        setForm({
          ...emptyForm,
          department: latest.department || allowed[0] || 'IT',
          assetType: latest.assetType || '',
          status: 'ACTIVE',
        });
        setNotice(`${latest.assetCode} saved. Add the next asset with a new asset code. The list keeps every asset in the order you saved them.`);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(row) {
    const target = row || selected;
    if (!target?.id) {
      return;
    }
    if (!window.confirm(`Delete ${target.assetCode}? This cannot be undone.`)) {
      return;
    }
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api(`/api/assets/${target.id}`, { method: 'DELETE' });
      const deletedId = target.id;
      const deletedCode = target.assetCode;
      if (selected?.id === deletedId) {
        setSelected(null);
        setDocumentFile(null);
        setFileInputKey((current) => current + 1);
        setForm({
          ...emptyForm,
          department: deptFilter || allowed[0] || 'IT',
          assetType: deptFilter === 'IT' ? typeFilter : '',
        });
      }
      await load(true);
      setNotice(`${deletedCode} deleted.`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocument() {
    if (!selected?.id || !selected.documentFileName) {
      return;
    }
    const response = await fetch(apiUrl(`/api/assets/${selected.id}/document`), { credentials: 'include' });
    if (!response.ok) {
      setError('Could not download the document');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selected.documentFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeDocument() {
    if (!selected?.id) {
      return;
    }
    setError('');
    setSaving(true);
    try {
      const saved = await api(`/api/assets/${selected.id}/document`, { method: 'DELETE' });
      await load();
      setSelected(saved);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    if (!visibleRows.length) {
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const part = typeFilter
      ? assetTypeLabel(typeFilter).replace(/\s+/g, '-')
      : deptFilter
        ? departmentLabel(deptFilter)
        : 'all';
    downloadAssetsExcel(visibleRows, `BGT-assets-${part}-${stamp}.xls`);
  }

  function printLabel() {
    window.print();
  }

  function downloadLabel() {
    if (!qrSrc || !selected?.assetCode) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const pad = 28;
      const textSpace = 44;
      const canvas = document.createElement('canvas');
      canvas.width = image.width + pad * 2;
      canvas.height = image.height + pad * 2 + textSpace;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, pad, pad);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selected.assetCode, canvas.width / 2, image.height + pad + textSpace / 2);
      const link = document.createElement('a');
      const name = String(selected.assetCode).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      link.href = canvas.toDataURL('image/png');
      link.download = `${name || 'asset'}-qr.png`;
      link.click();
    };
    image.src = qrSrc;
  }

  const filterHint = typeFilter
    ? `${visibleRows.length} ${assetTypeLabel(typeFilter)} asset${visibleRows.length === 1 ? '' : 's'}`
    : deptFilter
      ? `${visibleRows.length} ${departmentLabel(deptFilter)} asset${visibleRows.length === 1 ? '' : 's'}`
      : `${created} asset${created === 1 ? '' : 's'} created`;

  return (
    <div className="asset-page">
      <PageHeader
        title="Asset Master"
        description="Choose a department first. For IT, choose Desktop, Laptop, Printer, Switch network, or Router. Click a saved asset to update or delete it. Attach the invoice PDF or document on the asset."
      />
      <div className="kpi-grid">
        <KpiCard
          label="Assets created"
          value={loading ? '—' : created}
          hint="Show all assets"
          active={!deptFilter && !typeFilter}
          onClick={() => filterByDepartment('')}
        />
        {allowed.includes('IT') ? (
          <KpiCard
            label="IT"
            value={loading ? '—' : itCount}
            hint="Show IT assets"
            active={deptFilter === 'IT'}
            onClick={() => filterByDepartment('IT')}
          />
        ) : null}
        {allowed.includes('ELE') ? (
          <KpiCard
            label="Electrical"
            value={loading ? '—' : eleCount}
            hint="Show Electrical assets"
            active={deptFilter === 'ELE'}
            onClick={() => filterByDepartment('ELE')}
          />
        ) : null}
        {allowed.includes('MECH') ? (
          <KpiCard
            label="Mechanical"
            value={loading ? '—' : mechCount}
            hint="Show Mechanical assets"
            active={deptFilter === 'MECH'}
            onClick={() => filterByDepartment('MECH')}
          />
        ) : null}
      </div>
      <div className="asset-filters">
        <label className="field">
          <span>Department</span>
          <select
            value={deptFilter}
            onChange={(event) => filterByDepartment(event.target.value)}
          >
            <option value="">All departments</option>
            {allowed.map((department) => (
              <option key={department} value={department}>
                {departmentLabel(department)}
              </option>
            ))}
          </select>
        </label>
        {deptFilter === 'IT' ? (
          <label className="field">
            <span>IT asset type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All IT assets</option>
              {IT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Code, brand, user, location"
          />
        </label>
      </div>
      <div className="list-toolbar list-toolbar-split">
        <span className="muted">{loading ? 'Loading assets…' : filterHint}</span>
        <div className="toolbar-actions">
          <button className="btn btn-ghost" type="button" onClick={exportExcel} disabled={loading || !visibleRows.length}>
            Export to Excel
          </button>
          <button className="btn btn-primary" type="button" onClick={startNew}>
            Add asset
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
      <div className="split-2 asset-split">
        <div className="panel">
          <DataTable
            stacked
            rows={visibleRows}
            loading={loading}
            error=""
            selectedKey={selected?.id}
            onRowClick={(row) => {
              setSelected(row);
              scrollToEditor();
            }}
            emptyTitle={typeFilter ? `No ${assetTypeLabel(typeFilter)} assets` : deptFilter ? `No ${departmentLabel(deptFilter)} assets` : 'No company assets'}
            emptyDescription="Select a department, then add an asset. Click a row to update it, or delete it."
            columns={[
              {
                key: 'assetCode',
                header: 'Asset code',
                render: (row) => <span className="mono">{row.assetCode}</span>,
              },
              { key: 'department', header: 'Dept', render: (row) => departmentLabel(row.department) },
              { key: 'assetType', header: 'Type', render: (row) => assetTypeLabel(row.assetType) },
              { key: 'brand', header: 'Make / brand' },
              { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={saving}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteAsset(row);
                    }}
                  >
                    Delete
                  </button>
                ),
              },
            ]}
          />
        </div>
        <div id="asset-editor" className="asset-editor-panel">
          <div className="panel">
            <div className="panel-pad">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {selected ? 'Edit asset' : 'New asset'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Department</span>
                    <select value={form.department} onChange={(event) => update('department', event.target.value)}>
                      {allowed.map((department) => (
                        <option key={department} value={department}>
                          {departmentLabel(department)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.department === 'IT' ? (
                    <label className="field">
                      <span>Asset type</span>
                      <select required value={form.assetType} onChange={(event) => update('assetType', event.target.value)}>
                        <option value="">Select type</option>
                        {IT_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="field">
                      <span>Status</span>
                      <select value={form.status} onChange={(event) => update('status', event.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="IN_MAINTENANCE">In maintenance</option>
                        <option value="RETIRED">Retired</option>
                      </select>
                    </label>
                  )}
                  {form.department === 'IT' && !type ? (
                    <p className="muted field span-2" style={{ margin: 0 }}>
                      Select Desktop, Laptop, Printer, Switch network, or Router to see the fields for that asset.
                    </p>
                  ) : null}
                  {form.department !== 'IT' || type ? (
                    <>
                      <label className="field">
                        <span>Make / brand</span>
                        <input required value={form.brand} onChange={(event) => update('brand', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Asset code</span>
                        <input
                          required
                          value={form.assetCode}
                          onChange={(event) => update('assetCode', event.target.value)}
                          placeholder={type === 'DESKTOP' ? 'BGT/IT/DSP/047' : ''}
                        />
                      </label>
                    </>
                  ) : null}
                  {type === 'DESKTOP' ? (
                    <>
                      <label className="field">
                        <span>Monitor serial number</span>
                        <input required value={form.monitorSerial} onChange={(event) => update('monitorSerial', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>CPU serial number</span>
                        <input required value={form.cpuSerial} onChange={(event) => update('cpuSerial', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Location</span>
                        <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Supplier</span>
                        <input required value={form.supplier} onChange={(event) => update('supplier', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Installed date</span>
                        <input required type="date" value={form.installedOn} onChange={(event) => update('installedOn', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Username</span>
                        <input required value={form.assignedUsername} onChange={(event) => update('assignedUsername', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>User ID</span>
                        <input required value={form.assignedUserId} onChange={(event) => update('assignedUserId', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {type === 'LAPTOP' ? (
                    <>
                      <label className="field">
                        <span>Laptop serial number</span>
                        <input required value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Supplier</span>
                        <input required value={form.supplier} onChange={(event) => update('supplier', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Mouse serial number</span>
                        <input required value={form.mouseSerial} onChange={(event) => update('mouseSerial', event.target.value)} />
                      </label>
                      <label className="field span-2">
                        <span>Ethernet to USB adapter</span>
                        <input
                          required
                          value={form.ethernetUsbAdapter}
                          onChange={(event) => update('ethernetUsbAdapter', event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Username</span>
                        <input required value={form.assignedUsername} onChange={(event) => update('assignedUsername', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>User ID</span>
                        <input required value={form.assignedUserId} onChange={(event) => update('assignedUserId', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {type === 'PRINTER' ? (
                    <>
                      <label className="field">
                        <span>Serial number</span>
                        <input required value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Model number</span>
                        <input required value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} />
                      </label>
                      <label className="field span-2">
                        <span>Location</span>
                        <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {type === 'SWITCH' ? (
                    <>
                      <label className="field">
                        <span>Serial number</span>
                        <input required value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Model number</span>
                        <input required value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Ports</span>
                        <input required value={form.ports} onChange={(event) => update('ports', event.target.value)} placeholder="24" />
                      </label>
                      <label className="field">
                        <span>Location</span>
                        <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {type === 'ROUTER' ? (
                    <>
                      <label className="field">
                        <span>Serial number</span>
                        <input required value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Model number</span>
                        <input required value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} />
                      </label>
                      <label className="field span-2">
                        <span>Location</span>
                        <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {form.department !== 'IT' ? (
                    <>
                      <label className="field">
                        <span>Serial number</span>
                        <input value={form.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Model number</span>
                        <input value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} />
                      </label>
                      <label className="field span-2">
                        <span>Location</span>
                        <input required value={form.location} onChange={(event) => update('location', event.target.value)} />
                      </label>
                    </>
                  ) : null}
                  {form.department === 'IT' && type ? (
                    <label className="field">
                      <span>Status</span>
                      <select value={form.status} onChange={(event) => update('status', event.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="IN_MAINTENANCE">In maintenance</option>
                        <option value="RETIRED">Retired</option>
                      </select>
                    </label>
                  ) : null}
                  {form.department !== 'IT' || type ? (
                    <label className="field span-2">
                      <span>Invoice / document</span>
                      <input
                        key={fileInputKey}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf"
                        onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                      />
                      {selected?.documentFileName ? (
                        <span className="muted">
                          Current file: {selected.documentFileName}
                          {' · '}
                          <button className="linkish" type="button" onClick={downloadDocument}>
                            Download
                          </button>
                          {' · '}
                          <button className="linkish" type="button" onClick={removeDocument} disabled={saving}>
                            Remove
                          </button>
                        </span>
                      ) : (
                        <span className="muted">PDF, Word, or image up to 10 MB. Saved when you create or save the asset.</span>
                      )}
                    </label>
                  ) : null}
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={saving || (form.department === 'IT' && !type)}>
                    {saving ? 'Saving…' : selected ? 'Save asset' : 'Create asset'}
                  </button>
                  {selected ? (
                    <>
                      <button className="btn btn-danger" type="button" onClick={() => deleteAsset(selected)} disabled={saving}>
                        Delete asset
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={printLabel}>
                        Print QR label
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={downloadLabel} disabled={!qrSrc}>
                        Download QR
                      </button>
                    </>
                  ) : null}
                </div>
              </form>
              {!selected ? (
                <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
                  Click an asset in the list to update its details, view its QR, or delete it.
                </p>
              ) : null}
            </div>
          </div>
          {selected ? (
            <div className="panel asset-print" style={{ marginTop: 16 }}>
              <div className="panel-pad">
                <p className="muted no-print" style={{ marginTop: 0 }}>
                  Label shows only the QR and asset code. A phone camera scan shows the fields for this asset type.
                </p>
                <AssetSticker asset={selected} qrSrc={qrSrc} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
