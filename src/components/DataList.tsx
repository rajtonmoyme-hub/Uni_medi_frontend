import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";

export interface DataListColumn<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
  hideOnMobile?: boolean;
  render: (row: T, index: number) => React.ReactNode;
}

export interface DataListProps<T> {
  title?: string;
  subtitle?: string;
  description?: string;
  headerActions?: React.ReactNode;
  toolbar?: React.ReactNode;
  columns: DataListColumn<T>[];
  data: T[];
  getRowId: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  paginate?: boolean;
  deferredBelowFold?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
}

export function DataList<T>({
  title,
  subtitle,
  description,
  headerActions,
  toolbar,
  columns,
  data,
  getRowId,
  onRowClick,
  emptyMessage = "No records match the current view.",
  emptyAction,
  pageSize = 6,
  paginate = true,
  deferredBelowFold = false,
  selectable = false,
  selectedIds = [],
  onToggleRow,
  onToggleAll,
}: DataListProps<T>) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(pageSize);

  useEffect(() => {
    setItemsPerPage(pageSize);
  }, [pageSize]);

  const totalItems = data.length;
  const totalPages = paginate
    ? Math.max(1, Math.ceil(totalItems / itemsPerPage))
    : 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [totalItems, itemsPerPage]);

  const startIndex = paginate ? (safePage - 1) * itemsPerPage : 0;
  const endIndex = paginate
    ? Math.min(startIndex + itemsPerPage, totalItems)
    : totalItems;
  const visibleRows = paginate ? data.slice(startIndex, endIndex) : data;

  const pageNumbers: number[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pageNumbers.push(i);
  } else {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    if (start > 1) pageNumbers.push(1);
    for (let i = start; i <= end; i += 1) pageNumbers.push(i);
    if (end < totalPages) pageNumbers.push(totalPages);
  }

  const pageSizeOptions = Array.from(new Set([5, pageSize, 10, 20, 50])).sort(
    (a, b) => a - b,
  );

  const resolvedSubtitle = subtitle || description;
  const allVisibleSelected =
    selectable &&
    visibleRows.length > 0 &&
    visibleRows.every((row, idx) =>
      selectedIds.includes(getRowId(row, startIndex + idx))
    );

  return (
    <section
      className={`bg-paper border border-line rounded-md overflow-hidden ${
        deferredBelowFold ? 'deferred-section' : ''
      }`}
    >
      {(title || resolvedSubtitle || headerActions) && (
        <div className="px-4 py-3.5 sm:px-5 border-b border-line flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            )}
            {resolvedSubtitle && (
              <p className="text-sm text-mut mt-0.5">{resolvedSubtitle}</p>
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
        <div className="px-4 py-3 sm:px-5 border-b border-line bg-paper-2">
          {toolbar}
        </div>
      )}

      {totalItems === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-mut">{emptyMessage}</p>
          {emptyAction && <div className="mt-3">{emptyAction}</div>}
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-paper-2">
                  {selectable && (
                    <th className="w-10 px-4 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => onToggleAll?.(e.target.checked)}
                        aria-label="Select all rows"
                        className="rounded border-line text-brand-700"
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={`px-4 py-2.5 text-xs font-semibold text-mut tracking-wide ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm text-ink">
                {visibleRows.map((row, idx) => {
                  const globalIndex = startIndex + idx;
                  const id = getRowId(row, globalIndex);
                  const isSelected = selectable && selectedIds.includes(id);
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`transition-colors hover:bg-paper-2 ${
                        onRowClick ? "cursor-pointer" : ""
                      } ${isSelected ? 'bg-brand-50/40' : ''}`}
                    >
                      {selectable && (
                        <td
                          className="w-10 px-4 py-3 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleRow?.(id)}
                            aria-label={`Select row ${id}`}
                            className="rounded border-line text-brand-700"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 align-middle ${
                            col.align === "right" ? "text-right" : "text-left"
                          } ${col.mono ? "font-mono" : ""}`}
                        >
                          {col.render(row, globalIndex)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked List View */}
          <div className="md:hidden divide-y divide-line">
            {visibleRows.map((row, idx) => {
              const globalIndex = startIndex + idx;
              const id = getRowId(row, globalIndex);
              return (
                <div
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`p-4 space-y-2 ${
                    onRowClick ? "cursor-pointer active:bg-paper-2" : ""
                  }`}
                >
                  {columns
                    .filter((col) => !col.hideOnMobile)
                    .map((col) => (
                      <div
                        key={col.key}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span className="text-xs font-medium text-mut shrink-0 pt-0.5">
                          {col.header}
                        </span>
                        <div
                          className={`text-ink text-right ${
                            col.mono ? "font-mono" : ""
                          }`}
                        >
                          {col.render(row, globalIndex)}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          {paginate && (
            <div className="px-4 py-2.5 sm:px-5 border-t border-line bg-paper-2 flex flex-wrap items-center justify-between gap-3 text-xs text-mut">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Showing{" "}
                  <strong className="font-mono font-semibold text-ink">
                    {startIndex + 1}–{endIndex}
                  </strong>{" "}
                  of{" "}
                  <strong className="font-mono font-semibold text-ink">
                    {totalItems}
                  </strong>
                </span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    aria-label="Rows per page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded border border-line bg-paper px-1.5 py-0.5 text-xs font-mono text-ink"
                  >
                    {pageSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <nav
                aria-label="Table pagination"
                className="inline-flex items-center gap-1"
              >
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-ink-2 hover:bg-paper-3 disabled:opacity-45 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {pageNumbers.map((pageNum, idx) => {
                  const prevPage = pageNumbers[idx - 1];
                  const showEllipsis = prevPage && pageNum - prevPage > 1;
                  return (
                    <React.Fragment key={pageNum}>
                      {showEllipsis && <span className="px-1 text-mut">…</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        aria-current={safePage === pageNum ? "page" : undefined}
                        className={`min-w-[1.75rem] rounded border px-2 py-1 text-xs font-mono font-medium transition-colors ${
                          safePage === pageNum
                            ? "border-brand-700 bg-brand-700 text-white"
                            : "border-line bg-paper text-ink-2 hover:bg-paper-3"
                        }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  aria-label="Next page"
                  className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2 py-1 text-xs font-medium text-ink-2 hover:bg-paper-3 disabled:opacity-45 disabled:pointer-events-none"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </section>
  );
}
