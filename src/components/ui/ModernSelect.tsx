import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ModernSelectOption {
  value: string | number;
  label: string;
  count?: number;
  badge?: string;
  icon?: React.ReactNode;
  desc?: string;
  disabled?: boolean;
}

interface ModernSelectProps {
  label?: string;
  value: string | number;
  options: ModernSelectOption[];
  onChange: (value: any) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'pill' | 'ghost';
  align?: 'left' | 'right';
  disabled?: boolean;
  emptyLabel?: string;
}

export default function ModernSelect({
  label,
  value,
  options,
  onChange,
  placeholder = '-- Seleccionar --',
  icon,
  className = '',
  dropdownClassName = '',
  size = 'md',
  variant = 'default',
  align = 'left',
  disabled = false,
  emptyLabel
}: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Cerrar al presionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Tamaños y paddings
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px] h-8 min-w-[100px]',
    md: 'px-3 py-1.5 text-xs h-8.5 min-w-[120px]',
    lg: 'px-3.5 py-2 text-xs sm:text-sm h-10 min-w-[150px]'
  }[size];

  // Variantes de diseño
  const variantClasses = {
    default: 'bg-app-bg hover:bg-app-hover border border-app-border focus:border-blue-500 rounded-xl shadow-2xs',
    compact: 'bg-app-surface hover:bg-app-hover border border-app-border hover:border-blue-500/40 rounded-xl shadow-2xs',
    pill: 'bg-app-bg hover:bg-app-hover border border-app-border hover:border-blue-500/40 rounded-full shadow-2xs',
    ghost: 'bg-transparent hover:bg-app-hover/50 border border-transparent hover:border-app-border rounded-xl'
  }[variant];

  return (
    <div
      className={`relative inline-flex flex-col select-none ${isOpen ? 'z-50' : 'z-20'} ${className}`}
      ref={containerRef}
    >
      {label && (
        <span className="text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
          {label}
        </span>
      )}

      {/* Botón Trigger del Select */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 transition-all cursor-pointer outline-none font-bold text-app-text ${sizeClasses} ${variantClasses} ${
          isOpen ? 'ring-2 ring-blue-500/30 border-blue-500 bg-app-surface' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {icon && <span className="text-blue-500 shrink-0">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-mono font-bold">{selectedOption.label}</span>
              {selectedOption.count !== undefined && (
                <span
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded-md shrink-0 ${
                    selectedOption.count > 0
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'bg-app-bg text-app-muted'
                  }`}
                >
                  {selectedOption.count}
                </span>
              )}
            </div>
          ) : (
            <span className="text-app-muted font-medium truncate">{emptyLabel || placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={13}
          className={`text-app-muted transition-transform duration-200 shrink-0 ml-1 ${
            isOpen ? 'rotate-180 text-blue-500' : ''
          }`}
        />
      </button>

      {/* Popover / Menú Desplegable Sólido y con Alto Z-Index */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-[100] bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 flex flex-col gap-1 min-w-[210px] max-h-72 overflow-y-auto custom-scrollbar ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${dropdownClassName}`}
          role="listbox"
        >
          {emptyLabel && (
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs ${
                !value
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'hover:bg-app-hover text-app-muted hover:text-app-text font-medium'
              }`}
            >
              <span>{emptyLabel}</span>
              {!value && <Check size={13} className="text-white shrink-0" />}
            </div>
          )}

          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            const hasCount = opt.count !== undefined;

            return (
              <div
                key={String(opt.value)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs select-none ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'hover:bg-app-hover text-app-text font-medium'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  {opt.icon && <span className="text-sm shrink-0">{opt.icon}</span>}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate tracking-tight font-mono">
                      {opt.label}
                    </span>
                    {opt.desc && (
                      <span className={`text-[9px] truncate ${isSelected ? 'text-blue-100' : 'text-app-muted'}`}>
                        {opt.desc}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {hasCount && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : opt.count! > 0
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : 'bg-app-bg text-app-muted'
                      }`}
                    >
                      {opt.count} {opt.badge || 'compras'}
                    </span>
                  )}
                  {isSelected && <Check size={13} className="text-white shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
