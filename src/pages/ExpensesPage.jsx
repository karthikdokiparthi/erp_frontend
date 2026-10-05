import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, apiUrl, extractError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { KpiCard, StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { downloadTableExcel } from '../utils/exportExcel';
import {
  expenseCategoryLabel,
  expensePaymentLabel,
  expenseStatusLabel,
  formatDate,
  formatMoney,
  hasHrAccess,
} from '../utils/format';

const CATEGORIES = [
  ['TRAVEL', 'Travel'],
  ['FOOD', 'Food / meals'],
  ['LODGING', 'Lodging'],
  ['LOCAL_CONVEYANCE', 'Local conveyance'],
  ['MEDICAL', 'Medical'],
  ['OFFICE', 'Office supplies'],
  ['CLIENT', 'Client / business'],
  ['OTHER', 'Other'],
];

const PAYMENTS = [
  ['PERSONAL', 'Paid by me (reimburse)'],
  ['COMPANY_CARD', 'Company card'],
  ['ADVANCE', 'Against advance'],
];

const FILE_KINDS = [
  ['RECEIPT', 'Original receipt'],
  ['XEROX', 'Xerox / photocopy'],
  ['INVOICE', 'Tax invoice'],
  ['OTHER', 'Other'],
];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function emptyForm() {
  return {
    category: 'TRAVEL',
    title: '',
    purpose: '',
    vendor: '',
    spentOn: todayIso(),
    amount: '',
    paymentMode: 'PERSONAL',
  };
}

function claimColumns() {
  return [
    { key: 'claimNumber', header: 'Claim', render: (row) => <span className="mono">{row.claimNumber}</span> },
    {
      key: 'displayName',
      header: 'Person',
      render: (row) => (
        <div className="cell-stack">
          <div className="primary">{row.displayName}</div>
          <div className="secondary">{row.title}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => expenseCategoryLabel(row.category) },
    { key: 'spentOn', header: 'Spent', render: (row) => formatDate(row.spentOn) },
    { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'attachments', header: 'Files' },
  ].map((column) => column);
}

export function ExpensesPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);

  return (
    <>
      <PageHeader
        title="Expenses"
        eyebrow="Expenses"
        description="Raise a claim with receipts or xerox copies. HR reviews, files paper copies, and marks reimbursement."
      />
      <div className="page-tabs" role="tablist" aria-label="Expenses">
        <NavLink to="/hr/expenses" end role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          {hr ? 'All claims' : 'My claims'}
        </NavLink>
        <NavLink to="/hr/expenses/apply" role="tab" className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}>
          New claim
        </NavLink>
        {hr ? (
          <NavLink
            to="/hr/expenses/approvals"
            role="tab"
            className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
          >
            Approvals
          </NavLink>
        ) : null}
        {hr ? (
          <NavLink
            to="/hr/expenses/reports"
            role="tab"
            className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
          >
            Reports
          </NavLink>
        ) : null}
      </div>
      <Outlet />
    </>
  );
}

export function ExpensesClaimsPage() {
  const { user } = useAuth();
  const hr = hasHrAccess(user);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const scope = hr ? 'all' : 'mine';
      const [list, kpis] = await Promise.all([
        api(`/api/hr/expenses?scope=${scope}`),
        api(`/api/hr/expenses/summary?scope=${scope}`),
      ]);
      setRows(list);
      setSummary(kpis);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [hr]);

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="With HR" value={summary?.submitted} />
        <KpiCard label="Needs info" value={summary?.needsInfo} />
        <KpiCard label="Approved" value={summary?.approved} />
        <KpiCard label="Reimbursed" value={summary?.paid} />
        <KpiCard label="Open amount" value={formatMoney(summary?.openAmount)} />
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle={hr ? 'No expense claims yet' : 'You have not raised a claim'}
        emptyDescription="Attach a receipt or xerox copy, then send the claim to HR."
        onRowClick={(row) => navigate(`/hr/expenses/${row.id}`)}
        columns={claimColumns()}
      />
    </>
  );
}

const COMPANY_WORK_GROUPS = [
  ['', 'All / unassigned'],
  ['BGT', 'BGT'],
  ['Ruchitha', 'Ruchitha'],
  ['Akhil', 'Akhil'],
  ['BSK', 'BSK'],
  ['Krystal', 'Krystal'],
];

function emptyCompanyForm() {
  return {
    workGroup: 'BGT',
    category: 'OFFICE',
    title: '',
    description: '',
    vendor: '',
    referenceNo: '',
    spentOn: todayIso(),
    amount: '',
  };
}

export function CompanyExpensesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCompanyForm);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api('/api/hr/expenses/company'));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      workGroup: row.workGroup || '',
      category: row.category || 'OFFICE',
      title: row.title || '',
      description: row.description || '',
      vendor: row.vendor || '',
      referenceNo: row.referenceNo || '',
      spentOn: row.spentOn || todayIso(),
      amount: row.amount != null ? String(row.amount) : '',
    });
    setMsg('');
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyCompanyForm());
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const body = {
        workGroup: form.workGroup || null,
        category: form.category,
        title: form.title,
        description: form.description || null,
        vendor: form.vendor || null,
        referenceNo: form.referenceNo || null,
        spentOn: form.spentOn,
        amount: Number(form.amount),
      };
      if (editingId) {
        await api(`/api/hr/expenses/company/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        setMsg('Company expense updated');
      } else {
        await api('/api/hr/expenses/company', { method: 'POST', body: JSON.stringify(body) });
        setMsg('Company expense recorded');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!row?.id) return;
    if (!window.confirm(`Delete company expense ${row.expenseNumber}?`)) return;
    setError('');
    setMsg('');
    try {
      await api(`/api/hr/expenses/company/${row.id}`, { method: 'DELETE' });
      if (editingId === row.id) resetForm();
      setMsg('Deleted');
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows]
  );

  return (
    <>
      <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 16 }}>
        <KpiCard label="Entries" value={loading ? '…' : rows.length} />
        <KpiCard label="Total recorded" value={loading ? '…' : formatMoney(total)} />
        <KpiCard label="Mode" value={editingId ? 'Editing' : 'Add new'} />
      </div>

      <form className="panel" onSubmit={save} style={{ marginBottom: 20 }}>
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            {editingId ? 'Edit company expense' : 'Record company expense'}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Money HR spends for the company (not employee reimbursement claims). Entries also appear in Payroll →
            Reports under Expenses summary.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          {msg ? <p className="muted">{msg}</p> : null}
          <div className="form-grid">
            <label className="field">
              <span>Company / work group</span>
              <select value={form.workGroup} onChange={(event) => update('workGroup', event.target.value)}>
                {COMPANY_WORK_GROUPS.map(([value, label]) => (
                  <option key={value || 'all'} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={(event) => update('category', event.target.value)}>
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Amount (INR)</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => update('amount', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Spend date</span>
              <input
                type="date"
                required
                value={form.spentOn}
                onChange={(event) => update('spentOn', event.target.value)}
              />
            </label>
            <label className="field span-2">
              <span>Title</span>
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder="Office supplies for HQ"
              />
            </label>
            <label className="field span-2">
              <span>Description</span>
              <textarea
                rows={2}
                maxLength={1000}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Optional details"
              />
            </label>
            <label className="field">
              <span>Vendor</span>
              <input
                maxLength={200}
                value={form.vendor}
                onChange={(event) => update('vendor', event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="field">
              <span>Reference / invoice #</span>
              <input
                maxLength={100}
                value={form.referenceNo}
                onChange={(event) => update('referenceNo', event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="toolbar-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update expense' : 'Add expense'}
            </button>
            {editingId ? (
              <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <DataTable
        rows={rows}
        loading={loading}
        error={error && !rows.length ? error : ''}
        onRetry={load}
        emptyTitle="No company expenses yet"
        emptyDescription="Record an expense HR paid for the company using the form above."
        columns={[
          {
            key: 'expenseNumber',
            header: 'Ref',
            render: (row) => <span className="mono">{row.expenseNumber}</span>,
          },
          {
            key: 'workGroup',
            header: 'Company',
            render: (row) => row.workGroup || '—',
          },
          { key: 'category', header: 'Category', render: (row) => expenseCategoryLabel(row.category) },
          {
            key: 'title',
            header: 'Title',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.title}</div>
                {row.vendor ? <div className="secondary">{row.vendor}</div> : null}
              </div>
            ),
          },
          { key: 'spentOn', header: 'Spent', render: (row) => formatDate(row.spentOn) },
          { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm" onClick={() => startEdit(row)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(row)}>
                  Delete
                </button>
              </span>
            ),
          },
        ]}
      />
    </>
  );
}

export function ExpensesApprovalsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api('/api/hr/expenses?scope=inbox'));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DataTable
      rows={rows}
      loading={loading}
      error={error}
      onRetry={load}
      emptyTitle="Inbox is clear"
      emptyDescription="Submitted claims and requests for more information appear here."
      onRowClick={(row) => navigate(`/hr/expenses/${row.id}`)}
      columns={claimColumns()}
    />
  );
}

export function ExpenseApplyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [kind, setKind] = useState('RECEIPT');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addFiles(list) {
    const next = [...files];
    for (const file of list) {
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, kind });
    }
    setFiles(next);
  }

  async function save(submit) {
    setSaving(true);
    setError('');
    try {
      if (submit && !files.length) {
        throw new Error('Attach at least one receipt or xerox copy before sending to HR');
      }
      const created = await api('/api/hr/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          submit: false,
        }),
      });
      for (const item of files) {
        const data = new FormData();
        data.append('file', item.file);
        data.append('kind', item.kind);
        await api(`/api/hr/expenses/${created.id}/attachments`, { method: 'POST', body: data });
      }
      if (submit) {
        await api(`/api/hr/expenses/${created.id}/submit`, { method: 'POST' });
      }
      navigate(`/hr/expenses/${created.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        save(true);
      }}
    >
      <div className="panel-pad">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          New expense claim
        </h2>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">
          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => update('category', event.target.value)}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount (INR)</span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => update('amount', event.target.value)}
            />
          </label>
          <label className="field span-2">
            <span>Title</span>
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Client visit — taxi and meals"
            />
          </label>
          <label className="field">
            <span>Spend date</span>
            <input type="date" required value={form.spentOn} onChange={(event) => update('spentOn', event.target.value)} />
          </label>
          <label className="field">
            <span>Paid how</span>
            <select value={form.paymentMode} onChange={(event) => update('paymentMode', event.target.value)}>
              {PAYMENTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Vendor / merchant</span>
            <input value={form.vendor} onChange={(event) => update('vendor', event.target.value)} />
          </label>
          <label className="field span-2">
            <span>Purpose</span>
            <textarea
              rows={3}
              value={form.purpose}
              onChange={(event) => update('purpose', event.target.value)}
              placeholder="Why this spend was needed"
            />
          </label>
        </div>
        <h3 className="section-title">Attachments</h3>
        <p className="muted">PDF, Word, or photo. Mark xerox copies so HR can file them after the originals arrive.</p>
        <div className="toolbar-actions" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <span>Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {FILE_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Add files</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              multiple
              onChange={(event) => {
                addFiles(event.target.files || []);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {files.length ? (
          <ul className="muted">
            {files.map((item) => (
              <li key={item.id}>
                {item.file.name} · {FILE_KINDS.find(([value]) => value === item.kind)?.[1]}
                {' '}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setFiles(files.filter((row) => row.id !== item.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No files yet. A claim cannot be sent to HR without at least one attachment.</p>
        )}
        <div className="toolbar-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Sending…' : 'Send to HR'}
          </button>
          <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => save(false)}>
            Save draft
          </button>
        </div>
      </div>
    </form>
  );
}

export function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [originals, setOriginals] = useState(false);
  const [xerox, setXerox] = useState(false);
  const [kind, setKind] = useState('RECEIPT');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/hr/expenses/${id}`);
      setClaim(data);
      setApprovedAmount(data.approvedAmount != null ? String(data.approvedAmount) : String(data.amount || ''));
      setOriginals(Boolean(data.originalsReceived));
      setXerox(Boolean(data.xeroxFiled));
      setNote(data.decisionNote || '');
    } catch (err) {
      setError(extractError(err));
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function post(path, body, label) {
    setBusy(label);
    setError('');
    try {
      setClaim(await api(`/api/hr/expenses/${id}${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function uploadFile(file) {
    if (!file) return;
    setBusy('upload');
    setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('kind', kind);
      setClaim(await api(`/api/hr/expenses/${id}/attachments`, { method: 'POST', body: data }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  async function downloadFile(attachment) {
    const response = await fetch(apiUrl(`/api/hr/expenses/${id}/attachments/${attachment.id}`), { credentials: 'include' });
    if (!response.ok) {
      setError('Could not download that file');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !claim) {
    return <p className="muted">Loading claim…</p>;
  }
  if (!claim) {
    return error ? <p className="form-error">{error}</p> : null;
  }

  const openForHr = claim.hr && (claim.status === 'SUBMITTED' || claim.status === 'NEEDS_INFO');

  return (
    <div className="panel">
      <div className="panel-pad">
        <div className="list-toolbar list-toolbar-split">
          <div>
            <h2 className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>
              {claim.claimNumber}
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {claim.displayName} · {expenseCategoryLabel(claim.category)} · {formatDate(claim.spentOn)}
            </p>
          </div>
          <StatusBadge value={claim.status} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {claim.status === 'NEEDS_INFO' && claim.decisionNote ? (
          <p className="form-error">HR asked for an update: {claim.decisionNote}</p>
        ) : null}
        <div className="form-grid">
          <label className="field">
            <span>Title</span>
            <input readOnly value={claim.title || ''} />
          </label>
          <label className="field">
            <span>Amount</span>
            <input readOnly value={formatMoney(claim.amount)} />
          </label>
          <label className="field">
            <span>Approved</span>
            <input readOnly value={formatMoney(claim.approvedAmount)} />
          </label>
          <label className="field">
            <span>Paid how</span>
            <input readOnly value={expensePaymentLabel(claim.paymentMode)} />
          </label>
          <label className="field">
            <span>Vendor</span>
            <input readOnly value={claim.vendor || ''} />
          </label>
          <label className="field span-2">
            <span>Purpose</span>
            <textarea readOnly rows={3} value={claim.purpose || ''} />
          </label>
        </div>
        <p className="muted">
          Originals received: {claim.originalsReceived ? 'Yes' : 'No'} · Xerox filed: {claim.xeroxFiled ? 'Yes' : 'No'}
          {claim.reimbursedAt ? ` · Reimbursed ${formatDate(claim.reimbursedAt)}` : ''}
        </p>
        <h3 className="section-title">Attachments</h3>
        {(claim.attachments || []).length ? (
          <ul>
            {(claim.attachments || []).map((file) => (
              <li key={file.id}>
                <button className="btn btn-ghost" type="button" onClick={() => downloadFile(file)}>
                  {file.fileName}
                </button>
                {' '}
                <StatusBadge value={file.kind} />
                {claim.canEdit ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      setBusy('delete');
                      try {
                        setClaim(await api(`/api/hr/expenses/${id}/attachments/${file.id}`, { method: 'DELETE' }));
                      } catch (err) {
                        setError(extractError(err));
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No files on this claim.</p>
        )}
        {claim.canEdit ? (
          <div className="toolbar-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <label className="field" style={{ marginBottom: 0, minWidth: 180 }}>
              <span>Add file as</span>
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                {FILE_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Upload</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                onChange={(event) => {
                  uploadFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            {claim.status === 'DRAFT' || claim.status === 'NEEDS_INFO' ? (
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/submit', null, 'submit')}>
                Send to HR
              </button>
            ) : null}
          </div>
        ) : null}
        {claim.mine && (claim.status === 'SUBMITTED' || claim.status === 'NEEDS_INFO' || claim.status === 'DRAFT') ? (
          <button className="btn btn-ghost" type="button" disabled={Boolean(busy)} onClick={() => post('/withdraw', null, 'withdraw')}>
            Withdraw
          </button>
        ) : null}
        {openForHr ? (
          <>
            <h3 className="section-title">HR decision</h3>
            <div className="form-grid">
              <label className="field">
                <span>Approve amount</span>
                <input type="number" min="0.01" step="0.01" value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} />
              </label>
              <label className="field span-2">
                <span>Note to employee</span>
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <label className="field">
                <span>
                  <input type="checkbox" checked={originals} onChange={(event) => setOriginals(event.target.checked)} /> Originals received
                </span>
              </label>
              <label className="field">
                <span>
                  <input type="checkbox" checked={xerox} onChange={(event) => setXerox(event.target.checked)} /> Xerox filed
                </span>
              </label>
            </div>
            <div className="toolbar-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/approve', {
                  approvedAmount: Number(approvedAmount),
                  note: note || null,
                  originalsReceived: originals,
                  xeroxFiled: xerox,
                }, 'approve')}
              >
                Approve
              </button>
              <button
                className="btn"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/needs-info', { note }, 'info')}
              >
                Ask for more info
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/reject', { note }, 'reject')}
              >
                Reject
              </button>
            </div>
          </>
        ) : null}
        {claim.hr && claim.status === 'APPROVED' ? (
          <div className="toolbar-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => post('/pay', null, 'pay')}>
              Mark reimbursed
            </button>
            <button
              className="btn"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => post('/paper', { originalsReceived: originals, xeroxFiled: xerox, note }, 'paper')}
            >
              Save paper checklist
            </button>
          </div>
        ) : null}
        <div className="toolbar-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/hr/expenses')}>
            Back to claims
          </button>
        </div>
      </div>
    </div>
  );
}

function expenseSourceLabel(source) {
  const value = String(source || '').toUpperCase();
  if (value === 'COMPANY') return 'Company expense';
  if (value === 'EMPLOYEE_CLAIM') return 'Employee claim';
  return source || '—';
}

export function ExpensesReportsPage() {
  const [from, setFrom] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 2);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [to, setTo] = useState(currentMonth);
  const [type, setType] = useState('ALL');
  const [workGroup, setWorkGroup] = useState('ALL');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        from,
        to,
        type,
        workGroup,
      });
      setData(await api(`/api/hr/expenses/reports?${params}`));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, to, type, workGroup]);

  const rows = data?.rows || [];

  const byCategory = useMemo(() => {
    const map = {};
    for (const row of rows) {
      map[row.category] = (map[row.category] || 0) + Number(row.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="Employee claims" value={data?.claims} />
        <KpiCard label="Company entries" value={data?.companyExpenses} />
        <KpiCard label="Claims approved" value={formatMoney(data?.employeeApproved)} />
        <KpiCard label="Company total" value={formatMoney(data?.companyTotal)} />
        <KpiCard label="Grand total" value={formatMoney(data?.grandTotal)} />
      </div>
      <div className="list-toolbar list-toolbar-split" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="toolbar-actions" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>From</span>
            <input type="month" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>To</span>
            <input type="month" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="ALL">All expenses</option>
              <option value="EMPLOYEE_CLAIM">Employee claims</option>
              <option value="COMPANY">Company expenses</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Company</span>
            <select value={workGroup} onChange={(event) => setWorkGroup(event.target.value)}>
              <option value="ALL">All</option>
              {COMPANY_WORK_GROUPS.filter(([value]) => value).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!rows.length}
          onClick={() =>
            downloadTableExcel(
              'Expenses',
              ['Type', 'Ref', 'Person / company', 'Work group', 'Category', 'Title', 'Spent', 'Amount', 'Approved', 'Status', 'Vendor'],
              rows.map((row) => [
                expenseSourceLabel(row.source),
                row.number,
                row.displayName,
                row.workGroup || '',
                expenseCategoryLabel(row.category),
                row.title,
                row.spentOn,
                row.amount,
                row.approvedAmount ?? '',
                row.source === 'COMPANY' ? 'Recorded' : expenseStatusLabel(row.status),
                row.vendor || '',
              ]),
              `BGT-expense-report-${from}-to-${to}.xls`
            )
          }
        >
          Export Excel
        </button>
      </div>
      {byCategory.length ? (
        <p className="muted">
          By category:{' '}
          {byCategory.map(([name, amount]) => `${expenseCategoryLabel(name)} ${formatMoney(amount)}`).join(' · ')}
        </p>
      ) : null}
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No expenses in this period"
        emptyDescription="Employee claims and company expenses in the selected months appear here."
        onRowClick={(row) => {
          if (row.source === 'EMPLOYEE_CLAIM') navigate(`/hr/expenses/${row.id}`);
        }}
        columns={[
          {
            key: 'source',
            header: 'Type',
            render: (row) => expenseSourceLabel(row.source),
          },
          { key: 'number', header: 'Ref', render: (row) => <span className="mono">{row.number}</span> },
          {
            key: 'displayName',
            header: 'Person / company',
            render: (row) => (
              <div className="cell-stack">
                <div className="primary">{row.displayName}</div>
                <div className="secondary">{row.title}</div>
              </div>
            ),
          },
          { key: 'category', header: 'Category', render: (row) => expenseCategoryLabel(row.category) },
          { key: 'spentOn', header: 'Spent', render: (row) => formatDate(row.spentOn) },
          { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
          {
            key: 'status',
            header: 'Status',
            render: (row) =>
              row.source === 'COMPANY' ? (
                <StatusBadge value="RECORDED" />
              ) : (
                <StatusBadge value={row.status} />
              ),
          },
        ]}
      />
    </>
  );
}
