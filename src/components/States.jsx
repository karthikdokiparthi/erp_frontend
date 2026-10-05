export function EmptyState({ title = 'No records', description = 'Nothing matches the current filters.' }) {
  return (
    <div className="state-block">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({ message = 'Unable to load data', onRetry }) {
  return (
    <div className="state-block">
      <h3>Request failed</h3>
      <p>{message}</p>
      {onRetry ? (
        <button className="btn" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="state-block" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row}>
              {Array.from({ length: cols }).map((__, col) => (
                <td key={col}>
                  <span className="skeleton" style={{ width: col === 0 ? '70%' : '50%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
