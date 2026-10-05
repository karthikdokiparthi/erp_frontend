export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <div className="page-header-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
