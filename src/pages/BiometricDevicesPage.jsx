import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, extractError } from '../api/client';
import { isQueuedSync, waitForAttendanceSyncJob } from '../api/attendanceSync';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/KpiCard';
import { formatTime } from '../utils/format';

const TABS = [
  { id: 'devices', label: 'Devices' },
  { id: 'users', label: 'Users' },
  { id: 'punches', label: 'Punches' },
  { id: 'commands', label: 'Commands' },
  { id: 'eve', label: 'Eve host' },
];

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateTime(offsetHours = 0) {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTwDateTime(value, withSeconds = false) {
  if (!value) return '';
  const text = value.replace('T', ' ');
  return withSeconds ? (text.length === 16 ? `${text}:00` : text) : text.slice(0, 16);
}

function splitSerials(value) {
  return (value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pretty(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data ?? '');
  }
}

function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of [
    'Data',
    'data',
    'Result',
    'result',
    'Devices',
    'devices',
    'DeviceList',
    'Users',
    'users',
    'UserList',
    'PunchData',
    'punchData',
    'Logs',
    'logs',
    'Commands',
    'commands',
  ]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function cell(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && String(value).trim() !== '') return String(value);
  }
  return '—';
}

function imageSrc(base64) {
  if (!base64) return '';
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
}

export function BiometricDevicesPage() {
  const [tab, setTab] = useState('devices');
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState(null);
  const [proxyHealth, setProxyHealth] = useState(null);
  const [probe, setProbe] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [probing, setProbing] = useState(false);

  const handleLiveRefresh = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError('');
    }
    try {
      const [health, twapi, biometric] = await Promise.all([
        api('/api/hr/attendance/device'),
        api('/api/hr/attendance/twapi'),
        api('/api/v1/biometric/health'),
      ]);
      setDevice(health);
      setStatus(twapi);
      setProxyHealth(biometric);
    } catch (err) {
      if (!isSilent) {
        setError(extractError(err));
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  async function probeDevices() {
    setProbing(true);
    setError('');
    try {
      const result = await api('/api/v1/biometric/devices/probe', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setProbe(result);
      if (!result?.success && result?.channel !== 'tcp') {
        setError(result?.message || 'Device probe failed');
      } else if (!result?.success && result?.channel === 'tcp') {
        setError(result?.message || 'Device TCP is not reachable');
      }
    } catch (err) {
      setProbe(null);
      setError(extractError(err));
    } finally {
      setProbing(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError('');
    try {
      let run = await api('/api/hr/attendance/sync', { method: 'POST' });
      if (isQueuedSync(run)) {
        run = await waitForAttendanceSyncJob(run.id || run.jobId);
      }
      if (run?.status === 'ERROR') {
        setError(run.message || 'Sync failed');
        return;
      }
      await handleLiveRefresh(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    handleLiveRefresh(false);
  }, [handleLiveRefresh]);

  const defaultDeviceId = status?.deviceSerial || proxyHealth?.deviceTcp?.serial || '';
  const mockSource = (device?.provider || status?.provider || '').toLowerCase() === 'mock';
  const livePath = proxyHealth?.livePath || 'tcp';
  const twapiLive = livePath === 'twapi';
  const tcp = proxyHealth?.deviceTcp;
  const sourceLine = mockSource
    ? 'Sync source: MOCK (demo punches). Set provider to timewatch and restart ERP to read the machine.'
    : twapiLive
      ? 'Sync source: TWAPI (Eve HTTP). Use Probe device / Sync punches manually — no auto-refresh.'
      : `Sync source: Device TCP — ATF-305 ${tcp?.serial || 'TIPL596020924497'} at ${tcp?.host || '192.168.1.8'}:${tcp?.port || 5005}. Use Probe / Sync manually — no auto-refresh.`;

  return (
    <>
      <PageHeader
        title="Biometric devices"
        description={
          mockSource
            ? 'Attendance sync is on MOCK sample punches. Device TCP still probes the ATF-305, but Sync punches will not store real biometric data until provider is timewatch.'
            : 'Probe or Sync punches on demand. Auto-refresh and scheduled sync are off. Device ServerIP is not changed from here.'
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={probeDevices} disabled={probing}>
              {probing ? 'Probing…' : 'Probe device'}
            </button>
            <button className="btn btn-primary" type="button" onClick={syncNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync punches'}
            </button>
          </div>
        }
      />
      {error ? <p className="form-error">{error}</p> : null}
      <p className={mockSource ? 'form-error' : 'muted'} style={{ marginBottom: 12 }}>
        {sourceLine}
      </p>
      {proxyHealth ? <ChannelStatus health={proxyHealth} probe={probe} /> : null}
      <div className="panel" style={{ marginBottom: 16 }}>
        <DataTable
          rows={device ? [device] : []}
          loading={loading}
          emptyTitle="No device configured"
          emptyDescription="Attendance device settings come from ERP application config."
          columns={[
            { key: 'name', header: 'Device name' },
            {
              key: 'provider',
              header: 'Sync source',
              render: (row) =>
                row.provider === 'mock'
                  ? 'MOCK sample punches'
                  : (row.provider || 'timewatch') + (twapiLive ? ' · TWAPI' : ' · Device TCP'),
            },
            {
              key: 'host',
              header: 'Device host',
              render: (row) => (
                <span className="mono">
                  {row.host}:{row.port}
                </span>
              ),
            },
            {
              key: 'reachable',
              header: 'Status',
              render: (row) => <StatusBadge value={row.reachable ? 'REACHABLE' : 'UNREACHABLE'} />,
            },
            { key: 'message', header: 'Last check', render: (row) => row.message || '—' },
          ]}
        />
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        TWAPI Eve (optional): <span className="mono">{status?.apiBaseUrl || 'not configured'}</span>
        {status?.deviceSerial ? (
          <>
            {' '}
            · default serial <span className="mono">{status.deviceSerial}</span>
          </>
        ) : null}
        {status?.configured ? ' · X-Api-Key is set' : ' · no API key required for ATF-305 TCP'}
      </p>
      <div className="page-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`page-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'devices' ? <DevicesTab defaultSerial={defaultDeviceId} twapiConfigured={Boolean(proxyHealth?.twapi?.configured)} /> : null}
      {tab === 'users' ? <UsersTab defaultDeviceId={defaultDeviceId} /> : null}
      {tab === 'punches' ? <PunchesTab defaultDeviceId={defaultDeviceId} /> : null}
      {tab === 'commands' ? <CommandsTab defaultDeviceId={defaultDeviceId} /> : null}
      {tab === 'eve' ? <EveHostTab eve={status?.eve} lastSync={device?.lastSyncAt} /> : null}
    </>
  );
}

function ChannelStatus({ health, probe }) {
  const tcp = health?.deviceTcp;
  const twapi = health?.twapi;
  const probeLine = probe
    ? probe.channel === 'tcp'
      ? probe.success
        ? `TCP probe ok (${probe.deviceCount || 0} device)`
        : 'TCP probe: not reachable'
      : probe.success
        ? `GetDeviceList ok (${probe.deviceCount} device${probe.deviceCount === 1 ? '' : 's'})`
        : 'GetDeviceList failed'
    : '';
  return (
    <div className="channel-grid">
      <section className="panel panel-pad">
        <div className="channel-head">
          <h2>Device TCP (live path)</h2>
          <StatusBadge value={tcp?.reachable ? 'REACHABLE' : 'UNREACHABLE'} />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {tcp?.model || 'ATF-305'} {tcp?.serial || 'TIPL596020924497'} @ {tcp?.host || '192.168.1.8'}:{tcp?.port || 5005}
          {tcp?.message ? ` — ${tcp.message}` : ''}
          {probe?.channel === 'tcp' && probeLine ? ` · ${probeLine}` : ''}
        </p>
      </section>
      <section className="panel panel-pad">
        <div className="channel-head">
          <h2>TWAPI Eve HTTP (optional)</h2>
          <StatusBadge value={twapi?.configured ? 'CONFIGURED' : 'OPTIONAL'} />
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {twapi?.message || 'TWAPI Eve HTTP is optional and not configured. No API key is required for this ATF-305.'}
          {twapi?.configured && twapi?.timeoutMs ? ` · timeout ${twapi.timeoutMs}ms` : ''}
          {probe?.channel === 'twapi' && probeLine ? ` · ${probeLine}` : ''}
        </p>
      </section>
    </div>
  );
}

function DevicesTab({ defaultSerial, twapiConfigured }) {
  const [serial, setSerial] = useState(defaultSerial);
  const [deviceList, setDeviceList] = useState(defaultSerial);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setSerial((current) => current || defaultSerial);
    setDeviceList((current) => current || defaultSerial);
  }, [defaultSerial]);

  async function run(name, path, body) {
    setBusy(name);
    setError('');
    try {
      setResult(await api(path, { method: 'POST', body: JSON.stringify(body) }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  const rows = useMemo(() => rowsOf(result).map((row, index) => ({ ...row, _key: index })), [result]);

  return (
    <div className="twapi-stack">
      <section className="panel panel-pad">
        <h2>GetDeviceList</h2>
        <p className="muted">
          {twapiConfigured
            ? 'Optional serial. Leave blank to list every registered reader on the Eve host.'
            : 'Eve GetDeviceList is optional. Office ATF-305 uses Device TCP — use Probe device above. This button needs TIMEWATCH_API_BASE_URL and TIMEWATCH_API_KEY only if Eve is installed.'}
        </p>
        <div className="form-grid">
          <label className="field">
            <span>SerialNumber</span>
            <input value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="TW6000…" />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => run('devices', '/api/hr/attendance/twapi/devices', { serialNumber: serial })}>
            {busy === 'devices' ? 'Calling…' : 'List devices'}
          </button>
        </div>
      </section>
      <section className="panel panel-pad">
        <h2>SyncTime</h2>
        <p className="muted">Pushes current Eve server time to one or more serials. DeviceList is mandatory on TWAPI.</p>
        <div className="form-grid">
          <label className="field span-2">
            <span>DeviceList</span>
            <input value={deviceList} onChange={(event) => setDeviceList(event.target.value)} placeholder="Serial numbers, comma separated" />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => run('sync', '/api/hr/attendance/twapi/sync-time', { deviceList: splitSerials(deviceList) })}>
            {busy === 'sync' ? 'Calling…' : 'Sync time'}
          </button>
        </div>
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      {rows.length ? (
        <div className="panel">
          <DataTable
            rows={rows}
            rowKey="_key"
            emptyTitle="No devices"
            columns={[
              { key: 'serial', header: 'Serial', render: (row) => cell(row, 'SerialNumber', 'serialNumber', 'DeviceID') },
              { key: 'name', header: 'Name', render: (row) => cell(row, 'DeviceName', 'Name', 'Model') },
              { key: 'ip', header: 'IP', render: (row) => cell(row, 'IPAddress', 'IpAddress', 'IP') },
              { key: 'status', header: 'Status', render: (row) => cell(row, 'Status', 'Online', 'State') },
            ]}
          />
        </div>
      ) : null}
      {result ? <pre className="json-preview">{pretty(result)}</pre> : null}
    </div>
  );
}

function UsersTab({ defaultDeviceId }) {
  const [lookup, setLookup] = useState({ userId: '', deviceId: defaultDeviceId });
  const [add, setAdd] = useState({
    userId: '',
    name: '',
    deviceId: defaultDeviceId,
    accessTimeFrom: '',
    accessTimeTo: '',
    card: '',
    faceTemplate: '',
  });
  const [enroll, setEnroll] = useState({ userId: '', deviceId: defaultDeviceId, type: 'FACE' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [image, setImage] = useState('');

  useEffect(() => {
    setLookup((current) => ({ ...current, deviceId: current.deviceId || defaultDeviceId }));
    setAdd((current) => ({ ...current, deviceId: current.deviceId || defaultDeviceId }));
    setEnroll((current) => ({ ...current, deviceId: current.deviceId || defaultDeviceId }));
  }, [defaultDeviceId]);

  async function run(name, path, body) {
    setBusy(name);
    setError('');
    setImage('');
    try {
      const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
      setResult(data);
      if (data?.imageBase64) setImage(data.imageBase64);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  const rows = useMemo(() => rowsOf(result?.body ?? result).map((row, index) => ({ ...row, _key: index })), [result]);

  return (
    <div className="twapi-stack">
      <section className="panel panel-pad">
        <h2>GetUserDetails</h2>
        <p className="muted">At least UserID or DeviceID is required. Blank UserID lists everyone on that device.</p>
        <div className="form-grid">
          <label className="field">
            <span>UserID</span>
            <input value={lookup.userId} onChange={(event) => setLookup({ ...lookup, userId: event.target.value })} />
          </label>
          <label className="field">
            <span>DeviceID</span>
            <input value={lookup.deviceId} onChange={(event) => setLookup({ ...lookup, deviceId: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => run('details', '/api/hr/attendance/twapi/user-details', lookup)}>
            {busy === 'details' ? 'Calling…' : 'Get user details'}
          </button>
          <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => run('image', '/api/hr/attendance/twapi/user-image', lookup)}>
            {busy === 'image' ? 'Calling…' : 'Get user image'}
          </button>
        </div>
      </section>
      <section className="panel panel-pad">
        <h2>AddUser</h2>
        <p className="muted">UserID, Name, and DeviceID are mandatory. Access window, card, and face template are optional.</p>
        <div className="form-grid">
          <label className="field">
            <span>UserID</span>
            <input value={add.userId} onChange={(event) => setAdd({ ...add, userId: event.target.value })} />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={add.name} onChange={(event) => setAdd({ ...add, name: event.target.value })} />
          </label>
          <label className="field">
            <span>DeviceID</span>
            <input value={add.deviceId} onChange={(event) => setAdd({ ...add, deviceId: event.target.value })} />
          </label>
          <label className="field">
            <span>Card</span>
            <input value={add.card} onChange={(event) => setAdd({ ...add, card: event.target.value })} />
          </label>
          <label className="field">
            <span>AccesstimeFrom</span>
            <input type="datetime-local" value={add.accessTimeFrom} onChange={(event) => setAdd({ ...add, accessTimeFrom: event.target.value })} />
          </label>
          <label className="field">
            <span>AccesstimeTo</span>
            <input type="datetime-local" value={add.accessTimeTo} onChange={(event) => setAdd({ ...add, accessTimeTo: event.target.value })} />
          </label>
          <label className="field span-2">
            <span>FaceTemplate (Base64)</span>
            <textarea value={add.faceTemplate} onChange={(event) => setAdd({ ...add, faceTemplate: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              run('add', '/api/hr/attendance/twapi/users', {
                ...add,
                accessTimeFrom: toTwDateTime(add.accessTimeFrom, true),
                accessTimeTo: toTwDateTime(add.accessTimeTo, true),
              })
            }
          >
            {busy === 'add' ? 'Calling…' : 'Add user'}
          </button>
        </div>
      </section>
      <section className="panel panel-pad">
        <h2>DeleteUser / RemoteEnrollment</h2>
        <p className="muted">Delete removes that user from one device. RemoteEnrollment (CARD / FACE / FP) is TrueFace series only.</p>
        <div className="form-grid">
          <label className="field">
            <span>UserID</span>
            <input value={enroll.userId} onChange={(event) => setEnroll({ ...enroll, userId: event.target.value })} />
          </label>
          <label className="field">
            <span>DeviceID</span>
            <input value={enroll.deviceId} onChange={(event) => setEnroll({ ...enroll, deviceId: event.target.value })} />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={enroll.type} onChange={(event) => setEnroll({ ...enroll, type: event.target.value })}>
              <option value="FACE">FACE</option>
              <option value="CARD">CARD</option>
              <option value="FP">FP</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-danger" type="button" disabled={Boolean(busy)} onClick={() => run('delete', '/api/hr/attendance/twapi/users/delete', enroll)}>
            {busy === 'delete' ? 'Calling…' : 'Delete user'}
          </button>
          <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => run('enroll', '/api/hr/attendance/twapi/remote-enrollment', enroll)}>
            {busy === 'enroll' ? 'Calling…' : 'Remote enroll'}
          </button>
        </div>
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      {image ? <img className="user-image-preview" alt="TimeWatch user" src={imageSrc(image)} /> : null}
      {rows.length ? (
        <div className="panel">
          <DataTable
            rows={rows}
            rowKey="_key"
            emptyTitle="No users"
            columns={[
              { key: 'userId', header: 'UserID', render: (row) => cell(row, 'UserID', 'UserId', 'userId') },
              { key: 'name', header: 'Name', render: (row) => cell(row, 'Name', 'UserName') },
              { key: 'device', header: 'Device', render: (row) => cell(row, 'DeviceID', 'SerialNumber') },
              { key: 'card', header: 'Card', render: (row) => cell(row, 'Card', 'CardNumber') },
            ]}
          />
        </div>
      ) : null}
      {result ? <pre className="json-preview">{pretty(result)}</pre> : null}
    </div>
  );
}

function PunchesTab({ defaultDeviceId }) {
  const [form, setForm] = useState({
    fromDate: todayIso(-1),
    toDate: todayIso(0),
    deviceId: defaultDeviceId,
    userId: '',
  });
  const [pull, setPull] = useState({
    deviceList: defaultDeviceId,
    fromDate: localDateTime(-24),
    toDate: localDateTime(0),
  });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setForm((current) => ({ ...current, deviceId: current.deviceId || defaultDeviceId }));
    setPull((current) => ({ ...current, deviceList: current.deviceList || defaultDeviceId }));
  }, [defaultDeviceId]);

  async function run(name, path, body) {
    setBusy(name);
    setError('');
    try {
      setResult(await api(path, { method: 'POST', body: JSON.stringify(body) }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy('');
    }
  }

  const rows = useMemo(() => rowsOf(result).map((row, index) => ({ ...row, _key: index })), [result]);

  return (
    <div className="twapi-stack">
      <section className="panel panel-pad">
        <h2>GetPunchData</h2>
        <p className="muted">FromDate and ToDate are required (yyyy-mm-dd). UserID and DeviceID may be blank for all punches.</p>
        <div className="form-grid">
          <label className="field">
            <span>FromDate</span>
            <input type="date" value={form.fromDate} onChange={(event) => setForm({ ...form, fromDate: event.target.value })} />
          </label>
          <label className="field">
            <span>ToDate</span>
            <input type="date" value={form.toDate} onChange={(event) => setForm({ ...form, toDate: event.target.value })} />
          </label>
          <label className="field">
            <span>DeviceID</span>
            <input value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })} />
          </label>
          <label className="field">
            <span>UserID</span>
            <input value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => run('punches', '/api/hr/attendance/twapi/punch-data', form)}>
            {busy === 'punches' ? 'Calling…' : 'Get punch data'}
          </button>
        </div>
      </section>
      <section className="panel panel-pad">
        <h2>PullLogs</h2>
        <p className="muted">Asks the Eve host to retrieve logs. Leave DeviceList blank to query every registered reader.</p>
        <div className="form-grid">
          <label className="field span-2">
            <span>DeviceList</span>
            <input value={pull.deviceList} onChange={(event) => setPull({ ...pull, deviceList: event.target.value })} placeholder="Serial numbers, comma separated" />
          </label>
          <label className="field">
            <span>FromDate</span>
            <input type="datetime-local" value={pull.fromDate} onChange={(event) => setPull({ ...pull, fromDate: event.target.value })} />
          </label>
          <label className="field">
            <span>ToDate</span>
            <input type="datetime-local" value={pull.toDate} onChange={(event) => setPull({ ...pull, toDate: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button
            className="btn"
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              run('pull', '/api/hr/attendance/twapi/pull-logs', {
                deviceList: splitSerials(pull.deviceList),
                fromDate: toTwDateTime(pull.fromDate),
                toDate: toTwDateTime(pull.toDate),
              })
            }
          >
            {busy === 'pull' ? 'Calling…' : 'Pull logs'}
          </button>
        </div>
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      {rows.length ? (
        <div className="panel">
          <DataTable
            rows={rows}
            rowKey="_key"
            emptyTitle="No punches"
            columns={[
              { key: 'userId', header: 'UserID', render: (row) => cell(row, 'UserID', 'UserId', 'PIN') },
              { key: 'time', header: 'Time', render: (row) => cell(row, 'PunchDateTime', 'PunchTime', 'LogTime', 'InTime', 'DateTime') },
              { key: 'device', header: 'Device', render: (row) => cell(row, 'DeviceID', 'SerialNumber') },
              { key: 'io', header: 'In/Out', render: (row) => cell(row, 'InOut', 'PunchType', 'Status') },
            ]}
          />
        </div>
      ) : null}
      {result ? <pre className="json-preview">{pretty(result)}</pre> : null}
    </div>
  );
}

function CommandsTab({ defaultDeviceId }) {
  const [form, setForm] = useState({ executed: 'false', transferToDevice: defaultDeviceId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setForm((current) => ({ ...current, transferToDevice: current.transferToDevice || defaultDeviceId }));
  }, [defaultDeviceId]);

  async function run() {
    setBusy(true);
    setError('');
    try {
      setResult(await api('/api/hr/attendance/twapi/commands', { method: 'POST', body: JSON.stringify(form) }));
    } catch (err) {
      setError(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => rowsOf(result).map((row, index) => ({ ...row, _key: index })), [result]);

  return (
    <div className="twapi-stack">
      <section className="panel panel-pad">
        <h2>GetCommands</h2>
        <p className="muted">Executed is mandatory (pending vs already run). TransferToDevice is optional.</p>
        <div className="form-grid">
          <label className="field">
            <span>Executed</span>
            <select value={form.executed} onChange={(event) => setForm({ ...form, executed: event.target.value })}>
              <option value="false">False (pending)</option>
              <option value="true">True (executed)</option>
            </select>
          </label>
          <label className="field">
            <span>TransferToDevice</span>
            <input value={form.transferToDevice} onChange={(event) => setForm({ ...form, transferToDevice: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={run}>
            {busy ? 'Calling…' : 'Get commands'}
          </button>
        </div>
      </section>
      {error ? <p className="form-error">{error}</p> : null}
      {rows.length ? (
        <div className="panel">
          <DataTable
            rows={rows}
            rowKey="_key"
            emptyTitle="No commands"
            columns={[
              { key: 'command', header: 'Command', render: (row) => cell(row, 'Command', 'CommandName', 'Type') },
              { key: 'device', header: 'Device', render: (row) => cell(row, 'TransferToDevice', 'DeviceID', 'SerialNumber') },
              { key: 'executed', header: 'Executed', render: (row) => cell(row, 'Executed', 'Status') },
              { key: 'time', header: 'Time', render: (row) => cell(row, 'CommandTime', 'CreatedAt', 'DateTime') },
            ]}
          />
        </div>
      ) : null}
      {result ? <pre className="json-preview">{pretty(result)}</pre> : null}
    </div>
  );
}

function EveHostTab({ eve, lastSync }) {
  if (!eve) {
    return <p className="muted">Eve host requirements load with TWAPI status.</p>;
  }
  return (
    <div className="twapi-stack">
      <section className="panel panel-pad">
        <h2>{eve.software}</h2>
        <p className="muted">
          TWAPI 2.0 runs on this Windows Eve / iAS host. ERP does not replace Eve; it calls HTTP APIs after readers are online.
          {lastSync ? ` Last punch sync ${formatTime(lastSync)}.` : ''}
        </p>
        <ul className="eve-spec-list">
          <li>OS: {eve.operatingSystem}</li>
          <li>Runtime: {eve.framework}</li>
          <li>CPU: {eve.processor}</li>
          <li>RAM: {eve.ram}</li>
          <li>Disk: {eve.storage}</li>
          <li>Login: {eve.userPrivilege}</li>
          <li>Office: {eve.office}</li>
          <li>Database: {eve.database}</li>
          <li>
            Reader ports (two-way): {(eve.devicePorts || []).join(', ')}
          </li>
          <li>Network: {eve.connectivity}</li>
          <li>License: {eve.license}</li>
          <li>Email: {eve.emailRelay}</li>
          <li>Support: {eve.remoteSupport}</li>
        </ul>
      </section>
      <section className="panel panel-pad">
        <h2>Customer IT notes</h2>
        <ul className="eve-spec-list">
          {(eve.notes || []).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
