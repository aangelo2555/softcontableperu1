/**
 * Componente de Paginación Reutilizable
 * Optimizado para tablas grandes con performance mejorada
 */

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onFirstPage,
  onLastPage,
  onPrevPage,
  onNextPage,
  itemsPerPage,
  onItemsPerPageChange,
  startIndex,
  endIndex,
  totalItems
}) => {
  // Generar números de página a mostrar
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Mostrar todas las páginas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Mostrar páginas con elipsis
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-app-surface border-t border-app-border">
      {/* Información de registros */}
      <div className="text-xs font-bold text-app-muted">
        Mostrando <span className="text-app-text">{startIndex + 1}</span> a{' '}
        <span className="text-app-text">{endIndex}</span> de{' '}
        <span className="text-app-text">{totalItems}</span> registros
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-2">
        {/* Selector de items por página */}
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="text-xs font-bold bg-app-bg border border-app-border rounded-lg px-2 py-1.5 text-app-text focus:ring-2 focus:ring-blue-500/20 outline-none"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
        </select>

        {/* Primera página */}
        <button
          onClick={onFirstPage}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-app-border bg-app-bg hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Primera página"
        >
          <ChevronsLeft size={14} className="text-app-text" />
        </button>

        {/* Página anterior */}
        <button
          onClick={onPrevPage}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-app-border bg-app-bg hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Página anterior"
        >
          <ChevronLeft size={14} className="text-app-text" />
        </button>

        {/* Números de página */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-app-muted">
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-black transition-all ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-app-bg border border-app-border text-app-text hover:bg-app-hover'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Página actual (móvil) */}
        <div className="sm:hidden flex items-center gap-2 px-3 py-1.5 bg-app-bg border border-app-border rounded-lg">
          <span className="text-xs font-black text-app-text">
            {currentPage} / {totalPages}
          </span>
        </div>

        {/* Página siguiente */}
        <button
          onClick={onNextPage}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-app-border bg-app-bg hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Página siguiente"
        >
          <ChevronRight size={14} className="text-app-text" />
        </button>

        {/* Última página */}
        <button
          onClick={onLastPage}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-app-border bg-app-bg hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Última página"
        >
          <ChevronsRight size={14} className="text-app-text" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
