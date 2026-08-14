import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, AlertCircle, Info, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop without blur to keep frontend visible and sharp */}
      <div 
        className="fixed inset-0 bg-black/25 transition-opacity animate-fade-in"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${
          isDanger ? 'bg-gradient-to-r from-rose-500 to-red-600' :
          isWarning ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
          'bg-gradient-to-r from-blue-500 to-indigo-500'
        }`} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
              isWarning ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
              'bg-blue-500/10 text-blue-600 border border-blue-500/20'
            }`}>
              {isDanger ? <Trash2 size={24} className="animate-bounce" /> :
               isWarning ? <AlertTriangle size={24} /> :
               <Info size={24} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-app-text tracking-tight">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="p-1 text-app-muted hover:text-app-text rounded-lg hover:bg-app-hover transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-2 text-xs text-app-muted leading-relaxed">
                {message}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-app-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold text-app-muted hover:text-app-text bg-app-bg hover:bg-app-hover border border-app-border rounded-xl transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 hover:shadow-rose-600/30'
                  : isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 hover:shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 hover:shadow-blue-600/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
