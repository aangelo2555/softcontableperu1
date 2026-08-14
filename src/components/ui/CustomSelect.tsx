import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  ariaLabel?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  icon,
  compact = false,
  disabled = false,
  searchable = false,
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable && searchTerm.trim()
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : options;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl transition-all duration-200 cursor-pointer ${
          compact
            ? 'h-8 px-2.5 bg-app-bg hover:bg-app-hover border border-app-border text-[10px] font-extrabold text-app-text'
            : 'h-11 px-3.5 bg-app-bg hover:bg-app-hover border border-app-border focus:border-pld-blue text-xs font-bold text-app-text shadow-sm'
        } ${isOpen ? 'ring-2 ring-pld-blue/20 border-pld-blue' : ''} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-app-muted shrink-0">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-pld-blue/10 text-pld-blue font-mono font-bold">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={compact ? 12 : 14}
          className={`text-app-muted shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-pld-blue' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-[9999] min-w-full w-max max-w-xs sm:max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 backdrop-blur-xl ${dropdownClassName}`}
        >
          {/* Search box if enabled or if many options */}
          {(searchable || options.length > 8) && (
            <div className="p-2 border-b border-app-border/60 bg-app-bg/50">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-app-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-app-bg border border-app-border rounded-xl text-app-text placeholder:text-app-muted outline-none focus:border-pld-blue"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar flex flex-col gap-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-app-muted italic">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-pld-blue text-white font-black shadow-md shadow-pld-blue/20'
                        : 'text-app-text hover:bg-app-hover font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.badge && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-app-bg text-app-muted border border-app-border'
                        }`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check size={14} className="shrink-0 text-white stroke-[3]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
