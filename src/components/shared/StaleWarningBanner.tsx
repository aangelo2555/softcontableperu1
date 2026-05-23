/**
 * StaleWarningBanner — SOFTCONTABLE 2026
 * 
 * Banner reutilizable que alerta al usuario cuando un libro contable
 * derivado tiene datos obsoletos por cambios en el Libro Diario.
 * 
 * Integra con el pipeline de cascada (cascadeInvalidator.ts).
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface StaleWarningBannerProps {
  /** Nombre del módulo actual ('mayor', 'hhtt', 'eeff') */
  moduleName: string;
  /** Si el módulo está obsoleto */
  isStale: boolean;
  /** Fecha desde cuando está obsoleto (ISO string) */
  staleSince?: string | null;
  /** Callback para recalcular/sincronizar el libro */
  onRecalculate?: () => void;
  /** Si se está recalculando */
  isRecalculating?: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  mayor: 'Libro Mayor',
  hhtt: 'Balance de Comprobación',
  eeff: 'Estados Financieros',
  journal: 'Libro Diario',
};

function formatTimeSince(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  
  if (diffMinutes < 1) return 'hace un momento';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} día(s)`;
}

const StaleWarningBanner: React.FC<StaleWarningBannerProps> = ({
  moduleName,
  isStale,
  staleSince,
  onRecalculate,
  isRecalculating = false,
}) => {
  if (!isStale) return null;

  const label = MODULE_LABELS[moduleName] || moduleName;
  const timeLabel = staleSince ? formatTimeSince(staleSince) : '';

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 animate-fade-in">
      <AlertTriangle size={18} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">
          ⚠️ {label} desactualizado
        </p>
        <p className="text-[10px] opacity-80 mt-0.5">
          Se detectaron cambios en el Libro Diario{timeLabel ? ` (${timeLabel})` : ''} que aún no se reflejan aquí.
        </p>
      </div>
      {onRecalculate && (
        <button
          onClick={onRecalculate}
          disabled={isRecalculating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={12} className={isRecalculating ? 'animate-spin' : ''} />
          {isRecalculating ? 'Recalculando...' : 'Recalcular'}
        </button>
      )}
    </div>
  );
};

export default StaleWarningBanner;
