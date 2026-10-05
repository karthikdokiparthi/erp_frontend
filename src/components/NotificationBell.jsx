import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractError } from '../api/client';
import { Icon } from './Icons';

function mergeNotification(items, incoming) {
  const next = [incoming, ...items.filter((item) => item.id !== incoming.id)];
  return next.slice(0, 20);
}

function notificationHref(item) {
  if (item?.href) {
    return item.href;
  }
  const title = (item?.title || '').toLowerCase();
  if (title.startsWith('leave approved') || title.startsWith('leave rejected')) {
    return '/leave/my-requests';
  }
  if (title.includes('resignation') || title === 'relieved') {
    return '/hr/exit/inbox';
  }
  if (title.includes('salary credit')) {
    return '/hr/payroll/processing';
  }
  if (title.includes('leave')) {
    return '/leave/inbox';
  }
  return '/leave/inbox';
}

export function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [pollMs, setPollMs] = useState(20000);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, count, options] = await Promise.all([
        api('/api/leave/notifications'),
        api('/api/leave/notifications/unread'),
        api('/api/leave/options').catch(() => ({ bellPollSeconds: 20 })),
      ]);
      setItems(list || []);
      setUnread(count?.unread || 0);
      setPollMs(Math.max(5, options?.bellPollSeconds || 20) * 1000);
      setError('');
    } catch (err) {
      setError(extractError(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const intervalMs = live ? Math.max(pollMs, 120000) : pollMs;
    const timer = window.setInterval(load, intervalMs);
    return () => window.clearInterval(timer);
  }, [load, live, pollMs]);

  useEffect(() => {
    const source = new EventSource('/api/leave/notifications/stream', { withCredentials: true });

    source.addEventListener('connected', () => {
      setLive(true);
      setError('');
    });

    source.addEventListener('notification', (event) => {
      try {
        const item = JSON.parse(event.data);
        setItems((current) => mergeNotification(current, item));
        setPulse(true);
        window.setTimeout(() => setPulse(false), 1600);
      } catch {
        load();
      }
    });

    source.addEventListener('unread', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof payload?.unread === 'number') {
          setUnread(payload.unread);
        }
      } catch {
        load();
      }
    });

    source.onerror = () => {
      setLive(false);
    };

    return () => {
      source.close();
      setLive(false);
    };
  }, [load]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function onDocumentMouseDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  async function openItem(item) {
    try {
      if (!item.read) {
        await api(`/api/leave/notifications/${item.id}/read`, { method: 'POST' });
      }
    } catch {
      // still navigate
    }
    setOpen(false);
    navigate(notificationHref(item));
    load();
  }

  async function markAll() {
    try {
      await api('/api/leave/notifications/read-all', { method: 'POST' });
      await load();
    } catch (err) {
      setError(extractError(err));
    }
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        className={`btn btn-ghost btn-sm notif-btn${pulse ? ' is-pulse' : ''}${live ? ' is-live' : ''}`}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="bell" />
        {unread ? <span className="notif-dot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div
          className="notif-panel"
          role="dialog"
          aria-label="Notifications"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="notif-head">
            <div className="notif-title">
              <strong>Notifications</strong>
              {live ? <span className="notif-live">Live</span> : null}
            </div>
            <div className="notif-actions">
              {unread ? (
                <button className="btn btn-ghost btn-sm" type="button" onClick={markAll}>
                  Mark all read
                </button>
              ) : null}
              <button
                className="btn btn-ghost btn-sm notif-close"
                type="button"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <Icon name="x" />
              </button>
            </div>
          </div>
          {error ? <p className="muted">{error}</p> : null}
          {!items.length ? <p className="muted">No notifications yet.</p> : null}
          <ul className="notif-list">
            {items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  className={`notif-item${item.read ? '' : ' is-unread'}`}
                  type="button"
                  onClick={() => openItem(item)}
                >
                  <div className="primary">{item.title}</div>
                  <div className="secondary">{item.body}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
