import { BrandLockup } from './BrandLockup';

export function AuthCard({ title, lead, children }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <BrandLockup size="lg" company="BrightGrid ERP" product="Human Resources" />
        {title ? <h1>{title}</h1> : null}
        {lead ? <p className="lead">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}
