import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  accentColor?: string;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg', accentColor }) => {
  if (!open) return null;
  
  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className={`bg-app-surface w-full ${maxWidth} rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.4)] overflow-hidden border border-app-border animate-slide-up`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-app-border bg-app-bg/50 flex items-center justify-between">
          <div>
            <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${accentColor ? `text-${accentColor}` : 'text-pld-blue'}`}>
              {title}
            </h3>
            {subtitle && <p className="text-[10px] text-app-muted mt-0.5">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-app-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
