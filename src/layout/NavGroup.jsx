import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function NavGroup({ title, match, children }) {
  const location = useLocation();
  const active = match.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);

  return (
    <div className={`nav-group${active ? ' is-current' : ''}`}>
      <button
        type="button"
        className={`nav-group-toggle${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="nav-caret" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className="nav-group-items">{children}</div> : null}
    </div>
  );
}

export function NavItem({ to, end = true, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
      {children}
    </NavLink>
  );
}
