import { useEffect, useState } from 'react';
import { api, extractError } from '../api/client';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/KpiCard';

const emptyShift = { name: 'Office', startTime: '09:15', endTime: '18:00', graceMinutes: 0, defaultShift: false };

export function ShiftManagementPage() {
  const [board, setBoard] = useState(null);
  const [form, setForm] = useState(emptyShift);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setBoard(await api('/api/hr/attendance/shifts'));
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

  function timeValue(value) {
    return (value || '').slice(0, 5);
  }

  async function saveShift(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = {
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        graceMinutes: Number(form.graceMinutes) || 0,
        defaultShift: Boolean(form.defaultShift),
      };
      if (editingId) {
        await api(`/api/hr/attendance/shifts/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        setNotice('Shift updated.');
      } else {
        await api('/api/hr/attendance/shifts', { method: 'POST', body: JSON.stringify(body) });
        setNotice('Shift created.');
      }
      setForm(emptyShift);
      setEditingId('');
      await load();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(id) {
    setError('');
    setNotice('');
    try {
      await api(`/api/hr/attendance/shifts/${id}`, { method: 'DELETE' });
      setNotice('Shift deleted. People were moved to the default shift.');
      if (editingId === id) {
        setEditingId('');
        setForm(emptyShift);
      }
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  async function assign(personId, shiftId) {
    setError('');
    try {
      await api('/api/hr/attendance/shifts/assign', {
        method: 'POST',
        body: JSON.stringify({ personId, shiftId }),
      });
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  const shifts = board?.shifts || [];
  const people = board?.people || [];

  return (
    <>
      <PageHeader
        title="Shift management"
        description="Office default is 09:15–18:00 (8h+ present rule is unchanged). Assign a shift per person for in-time cutoff and grace; unassigned people use the default."
      />
      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <div className="form-notice">{notice}</div> : null}
      <div className="panel">
        <div className="panel-pad">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            {editingId ? 'Edit shift' : 'New shift'}
          </h2>
          <form className="form-grid" onSubmit={saveShift}>
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
            </label>
            <label className="field">
              <span>Start</span>
              <input type="time" value={timeValue(form.startTime)} onChange={(event) => update('startTime', event.target.value)} required />
            </label>
            <label className="field">
              <span>End</span>
              <input type="time" value={timeValue(form.endTime)} onChange={(event) => update('endTime', event.target.value)} required />
            </label>
            <label className="field">
              <span>Grace (minutes)</span>
              <input
                type="number"
                min="0"
                max="180"
                value={form.graceMinutes}
                onChange={(event) => update('graceMinutes', event.target.value)}
              />
            </label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(form.defaultShift)}
                onChange={(event) => update('defaultShift', event.target.checked)}
              />
              <span>Default office shift</span>
            </label>
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save shift' : 'Add shift'}
              </button>
              {editingId ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setEditingId('');
                    setForm(emptyShift);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
        <DataTable
          rows={shifts}
          loading={loading}
          emptyTitle="No shifts"
          emptyDescription="The Office 09:15–18:00 shift is created by migration. Add more if teams start at different times."
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'startTime', header: 'Start', render: (row) => timeValue(row.startTime) },
            { key: 'endTime', header: 'End', render: (row) => timeValue(row.endTime) },
            { key: 'graceMinutes', header: 'Grace' },
            {
              key: 'defaultShift',
              header: 'Default',
              render: (row) => (row.defaultShift ? <StatusBadge value="DEFAULT" /> : '—'),
            },
            {
              key: 'id',
              header: '',
              render: (row) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => {
                      setEditingId(row.id);
                      setForm({
                        name: row.name,
                        startTime: timeValue(row.startTime),
                        endTime: timeValue(row.endTime),
                        graceMinutes: row.graceMinutes,
                        defaultShift: row.defaultShift,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeShift(row.id)} disabled={row.defaultShift}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            People
          </h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Default: {board?.defaultShift?.name || 'Office'} {timeValue(board?.defaultShift?.startTime)}–
            {timeValue(board?.defaultShift?.endTime)}.
          </p>
        </div>
        <DataTable
          rows={people}
          loading={loading}
          emptyTitle="No active people"
          emptyDescription="Add On-Role or Contract people first."
          columns={[
            { key: 'employeeNumber', header: 'ID', render: (row) => <span className="mono">{row.employeeNumber}</span> },
            { key: 'name', header: 'Name' },
            { key: 'department', header: 'Department' },
            {
              key: 'shiftId',
              header: 'Shift',
              render: (row) => (
                <select value={row.shiftId || ''} onChange={(event) => assign(row.personId, event.target.value)}>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
