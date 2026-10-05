import { apiUrl } from '../api/client';

function Glyph({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'view') {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (name === 'download') {
    return (
      <svg {...common}>
        <path d="M12 4v11" />
        <path d="M7 11l5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
    );
  }
  if (name === 'mail') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 7 9-7" />
      </svg>
    );
  }
  if (name === 'print') {
    return (
      <svg {...common}>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

export function PayslipIconButton({ icon, label, href, className = '', ...rest }) {
  const classes = `btn btn-icon${className ? ` ${className}` : ''}`;
  const iconNode = <Glyph name={icon} />;
  if (href) {
    return (
      <a className={classes} href={apiUrl(href)} title={label} aria-label={label} {...rest}>
        {iconNode}
      </a>
    );
  }
  return (
    <button type="button" className={classes} title={label} aria-label={label} {...rest}>
      {iconNode}
    </button>
  );
}
