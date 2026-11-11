import React, { useId } from 'react';

export interface DataListColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

interface DataListProps<T> {
  title?: string;
  description?: string;
  columns: DataListColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  toolbar?: React.ReactNode;
  headerActions?: React.ReactNode;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function DataList<T>({
  title,
  description,
  columns,
  data,
  getRowId,
  selectable = false,
  selectedIds = [],
  onToggleRow,
  onToggleAll,
  toolbar,
  headerActions,
  emptyMessage = 'No records found.',
  ariaLabel,
}: DataListProps<T>) {
  const headingId = useId();
  const allSelected =
    selectable &&
    data.length > 0 &&
    data.every((row) => selectedIds.includes(getRowId(row)));

  return (
    <section className="bg-paper border border-line rounded-md overflow-hidden">
      {(title || description || headerActions) && (
        <div className="px-4 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-paper">
          <div>
            {title && (
              <h2
                id={headingId}
                className="text-lg font-semibold text-ink leading-snug"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-mut mt-0.5">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex flex-wrap items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {toolbar && (
        <search className="px-4 py-3 border-b border-line bg-paper-2">
          {toolbar}
        </search>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-labelledby={title ? headingId : undefined}
        aria-label={!title ? ariaLabel || 'Data list' : undefined}
        className="table-wrapper"
      >
        <table>
          <thead>
            <tr>
              {selectable && (
                <th className="w-11">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onToggleAll?.(e.target.checked)}
                    aria-label="Select all rows"
                    className="w-4 h-4 accent-brand-700 cursor-pointer align-middle"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-10 text-center text-sm text-mut"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const id = getRowId(row);
                const isSelected = selectable && selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    className={isSelected ? 'bg-brand-50' : 'bg-paper'}
                  >
                    {selectable && (
                      <td data-col-label="Select" className="w-11">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleRow?.(id)}
                          aria-label={`Select row ${id}`}
                          className="w-4 h-4 accent-brand-700 cursor-pointer align-middle"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        data-col-label={col.header}
                        className={`${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
