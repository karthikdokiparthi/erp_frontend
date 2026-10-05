import { useEffect, useState } from 'react';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import { formatTime } from '../utils/format';

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function personLabel(person) {
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.fullName || person.displayName;
  return `${person.employeeNumber || person.staffNumber} · ${name}`;
}

export function RegularizationPage() {
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    personId: '',
    workDate: kolkataToday(),
    requestedIn: '',
    requestedOut: '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(selectedStatus = status) {
    setLoading(true);
    setError('');
    try {
      const query = selectedStatus ? `?status=${encodeURIComponent(selectedStatus)}` : '';
      const [staffList, employeeList, requests] = await Promise.all([
        api('/api/hr/staff').catch(() => []),
        api('/api/hr/employees').catch(() => []),
        api(`/api/hr/attendance/regularization${query}`),
      ]);
      const staff = (Array.isArray(staffList) ? staffList : []).map((row) => ({ ...row, _kind: 'STAFF' }));
      const employees = (Array.isArray(employeeList) ? employeeList : []).map((row) => ({ ...row, _kind: 'EMPLOYEE' }));
      setPeople([...staff, ...employees]);
      setRows(Array.isArray(requests) ? requests : []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(status);
  }, [status]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.personId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/api/hr/attendance/regularization', {
        method: 'POST',
        body: JSON.stringify({
          personId: form.personId,
          workDate: form.workDate,
          requestedIn: form.requestedIn || null,
          requestedOut: form.requestedOut || null,
          reason: form.reason,
        }),
      });
      setNotice('Request submitted as PENDING. Approve it to overlay the daily/monthly board (punches on the device are not changed).');
      setForm((current) => ({ ...current, requestedIn: '', requestedOut: '', reason: '' }));
      await load(status);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function decide(id, nextStatus) {
    setError('');
    setNotice('');
    try {
      await api(`/api/hr/attendance/regularization/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(nextStatus === 'APPROVED' ? 'Approved — attendance board uses requested IN/OUT.' : 'Rejected.');
      await load(status);
    } catch (err) {
      setError(extractError(err));
    }
  }

  async function removeRequest(row) {
    const label = `${row.displayName || row.employeeNumber || 'this person'} · ${row.workDate}`;
    if (!window.confirm(`Delete timing request for ${label}?`)) return;
    setError('');
    setNotice('');
    try {
      await api(`/api/hr/attendance/regularization/${row.id}`, { method: 'DELETE' });
      setNotice(
        row.status === 'APPROVED'
          ? 'Request deleted. Attendance board no longer uses that IN/OUT overlay.'
          : 'Timing request deleted.'
      );
      await load(status);
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance regularization"
        description="Correct missing punches (MS) or wrong IN/OUT. Approval overlays the attendance board for that person and date. BioAPI punches stay as recorded."
      />
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <div className="form-notice">{notice}</div> : null}
      <div className="panel">
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            New request
          </h2>
          <form className="form-grid" onSubmit={submit}>
            <label className="field">
              <span>Person</span>
              <select value={form.personId} onChange={(event) => update('personId', event.target.value)} required>
                <option value="">Select…</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {personLabel(person)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.workDate} max={kolkataToday()} onChange={(event) => update('workDate', event.target.value)} required />
            </label>
            <label className="field">
              <span>Requested IN</span>
              <input type="time" value={form.requestedIn} onChange={(event) => update('requestedIn', event.target.value)} />
            </label>
            <label className="field">
              <span>Requested OUT</span>
              <input type="time" value={form.requestedOut} onChange={(event) => update('requestedOut', event.target.value)} />
            </label>
            <label className="field span-2">
              <span>Reason</span>
              <textarea rows={2} value={form.reason} onChange={(event) => update('reason', event.target.value)} />
            </label>
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit" disabled={saving || !form.personId}>
                {saving ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>
            Requests
          </h2>
          <label className="field" style={{ margin: 0 }}>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          emptyTitle="No regularization requests"
          emptyDescription="Submit a request for a missing punch, then approve it so the board uses the requested times."
          columns={[
            { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
            { key: 'displayName', header: 'Name' },
            { key: 'workDate', header: 'Date', render: (row) => <span className="mono">{row.workDate}</span> },
            { key: 'requestedIn', header: 'IN', render: (row) => row.requestedIn || '—' },
            { key: 'requestedOut', header: 'OUT', render: (row) => row.requestedOut || '—' },
            { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'requestedBy', header: 'Requested by', render: (row) => row.requestedBy || '—' },
            {
              key: 'requestedAt',
              header: 'Requested',
              render: (row) => formatTime(row.requestedAt),
            },
            {
              key: 'id',
              header: 'Actions',
              render: (row) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {row.status === 'PENDING' ? (
                    <>
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => decide(row.id, 'APPROVED')}>
                        Approve
                      </button>
                      <button className="btn btn-sm" type="button" onClick={() => decide(row.id, 'REJECTED')}>
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="muted">{row.decidedBy || '—'}</span>
                  )}
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => removeRequest(row)}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
