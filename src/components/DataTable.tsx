import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T, index: number) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  totals?: React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  headerClassName?: string;
  rowClassName?: string;
  pageSize?: number;
}

export function DataTable<T>({ 
  columns, 
  data, 
  totals, 
  emptyMessage = "No hay datos disponibles.", 
  loading,
  headerClassName,
  rowClassName,
  pageSize
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = React.useState(1);

  // Reset to page 1 if data size changes (e.g. searching)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalPages = pageSize ? Math.ceil(data.length / pageSize) : 1;
  const page = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedData = pageSize ? data.slice((page - 1) * pageSize, page * pageSize) : data;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto bg-app-surface border border-app-border rounded-lg shadow-sm">
        <table className="w-full text-xs text-left border-collapse text-app-text">
          <thead className="sticky top-0 z-20">
            <tr className={cn("bg-app-surface text-app-muted uppercase tracking-wider text-[10px] border-b border-app-border", headerClassName)}>
              {columns.map((col, i) => (
                <th key={i} className={cn("p-2.5 font-bold", i < columns.length - 1 && "border-r border-app-border/50", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, i) => {
              const globalIndex = pageSize ? (page - 1) * pageSize + i : i;
              return (
                <tr key={globalIndex} className={cn(
                  "hover:bg-pld-blue/[0.04] transition-colors border-b border-app-border/30",
                  globalIndex % 2 === 1 && "bg-app-hover/30",
                  rowClassName
                )}>
                  {columns.map((col, j) => (
                    <td key={j} className={cn("p-2.5", j < columns.length - 1 && "border-r border-app-border/20", col.className)}>
                      {typeof col.accessor === 'function' ? col.accessor(row, globalIndex) : (row[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {totals && (
            <tfoot className="sticky bottom-0 z-20 font-black border-t-2 border-pld-blue/30 bg-app-surface">
              {totals}
            </tfoot>
          )}
        </table>
        {!loading && data.length === 0 && (
          <div className="p-16 text-center text-app-muted">
            <p className="text-xs font-bold uppercase tracking-widest opacity-50">{emptyMessage}</p>
          </div>
        )}
      </div>

      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-[11px] text-app-muted font-medium bg-app-surface border border-app-border rounded-lg p-2.5 shadow-sm">
          <div>
            Mostrando <span className="font-bold text-app-text">{(page - 1) * pageSize + 1}</span> al <span className="font-bold text-app-text">{Math.min(page * pageSize, data.length)}</span> de <span className="font-bold text-app-text">{data.length}</span> registros
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={page === 1}
              className="px-2.5 py-1 bg-app-bg border border-app-border rounded hover:bg-app-hover hover:text-pld-blue disabled:opacity-40 disabled:hover:bg-app-bg disabled:hover:text-app-muted transition-all"
            >
              Primero
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 bg-app-bg border border-app-border rounded hover:bg-app-hover hover:text-pld-blue disabled:opacity-40 disabled:hover:bg-app-bg disabled:hover:text-app-muted transition-all"
            >
              Anterior
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum = page - 2 + idx;
              if (pageNum < 1) pageNum = idx + 1;
              if (pageNum > totalPages) return null;
              
              if (page > totalPages - 2) {
                pageNum = totalPages - 4 + idx;
                if (pageNum < 1) pageNum = idx + 1;
              }
              
              if (pageNum > totalPages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded transition-all border text-[10px] font-bold",
                    page === pageNum 
                      ? "bg-pld-blue border-pld-blue text-white font-bold" 
                      : "bg-app-bg border-app-border hover:bg-app-hover hover:text-pld-blue"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 bg-app-bg border border-app-border rounded hover:bg-app-hover hover:text-pld-blue disabled:opacity-40 disabled:hover:bg-app-bg disabled:hover:text-app-muted transition-all"
            >
              Siguiente
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={page === totalPages}
              className="px-2.5 py-1 bg-app-bg border border-app-border rounded hover:bg-app-hover hover:text-pld-blue disabled:opacity-40 disabled:hover:bg-app-bg disabled:hover:text-app-muted transition-all"
            >
              Último
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
