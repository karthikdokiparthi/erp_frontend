import { EmptyState, ErrorState, TableSkeleton } from './States';

export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  onRowClick,
  selectedKey,
  stacked = false,
}) {
  if (loading) {
    return <TableSkeleton cols={columns.length} />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const wrapClass = stacked ? 'table-wrap table-wrap-cards' : 'table-wrap';
  const tableClass = [
    'data-table',
    stacked ? 'data-table-cards' : '',
    onRowClick ? 'is-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              className={selectedKey != null && row[rowKey] === selectedKey ? 'is-selected' : ''}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} data-label={column.header || ''}>
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
