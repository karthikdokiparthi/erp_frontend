import { PageHeader } from '../components/PageHeader';

export function PlaceholderPage({ title, description }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="panel">
        <div className="panel-pad">
          <p className="muted">
            This HR page is a placeholder so the department exists in the shell. It is not connected
            to payroll, finance, or sales.
          </p>
        </div>
      </div>
    </>
  );
}
