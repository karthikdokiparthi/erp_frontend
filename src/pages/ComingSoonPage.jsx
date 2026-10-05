import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function ComingSoonPage({ title, description, backTo, backLabel }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="empty-state">
        <div className="empty-state__title">Not live yet</div>
        <p className="empty-state__body">
          This screen is in the HR ERP menu so the module has a home. It is not a live register yet — no dummy
          employees or fake payroll numbers.
        </p>
        {backTo ? (
          <Link className="btn btn-primary" to={backTo}>
            {backLabel || 'Back'}
          </Link>
        ) : null}
      </div>
    </>
  );
}
