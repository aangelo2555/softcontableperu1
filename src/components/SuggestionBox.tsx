import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Lightbulb, X, Image as ImageIcon, Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ModernSelect from './ui/ModernSelect';

const CATEGORY_OPTIONS = [
  { value: 'ERROR_CALCULO', label: 'Falla en Fórmulas o Cálculos Contables', icon: '📐' },
  { value: 'INCONSISTENCIA_TRIBUTARIA', label: 'Inconsistencia en Reglas SUNAT', icon: '🏛️' },
  { value: 'INTERFAZ_USUARIO', label: 'Problema de Diseño / Interfaz', icon: '🎨' },
  { value: 'OTRO', label: 'Otro Comentario o Sugerencia', icon: '✏️' }
];

export const SuggestionBox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('ERROR_CALCULO');
  const [comment, setComment] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Posición del botón flotante
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia('(hover: none)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const clickTime = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    activeTab, 
    currentCompany, 
    sendSuggestion,
    draftCompra,
    draftVenta,
    draftHonorario,
    draftAsiento
  } = useStore();

  // Mantener el botón visible si cambia el tamaño de la ventana
  useEffect(() => {
    if (!hasDragged) return;
    const handleResize = () => {
      setPosition(prev => {
        const buttonWidth = 44;
        const buttonHeight = 44;
        const newX = Math.max(10, Math.min(prev.x, window.innerWidth - buttonWidth - 10));
        const newY = Math.max(10, Math.min(prev.y, window.innerHeight - buttonHeight - 10));
        return { x: newX, y: newY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasDragged]);

  // Manejadores de Mouse (Desktop)
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Solo clic izquierdo
    
    const currentX = e.clientX - 22;
    const currentY = e.clientY - 22;
    
    setPosition({ x: currentX, y: currentY });
    setHasDragged(true);
    
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: 22, y: 22 };
    clickTime.current = Date.now();
    setIsDragging(true);
    setIsHovered(false);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffset.current.x;
      let newY = e.clientY - dragOffset.current.y;
      
      const buttonWidth = 44;
      const buttonHeight = 44;
      newX = Math.max(10, Math.min(newX, window.innerWidth - buttonWidth - 10));
      newY = Math.max(10, Math.min(newY, window.innerHeight - buttonHeight - 10));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      
      const diffX = Math.abs(e.clientX - dragStart.current.x);
      const diffY = Math.abs(e.clientY - dragStart.current.y);
      const duration = Date.now() - clickTime.current;
      
      if (diffX < 6 && diffY < 6 && duration < 250) {
        setIsOpen(true);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Manejadores Táctiles (Móvil / Tablets)
  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const currentX = touch.clientX - 22;
    const currentY = touch.clientY - 22;

    setPosition({ x: currentX, y: currentY });
    setHasDragged(true);

    dragStart.current = { x: touch.clientX, y: touch.clientY };
    dragOffset.current = { x: 22, y: 22 };
    clickTime.current = Date.now();
    setIsDragging(true);
    setIsHovered(false);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    let newX = touch.clientX - dragOffset.current.x;
    let newY = touch.clientY - dragOffset.current.y;

    const buttonWidth = 44;
    const buttonHeight = 44;
    newX = Math.max(10, Math.min(newX, window.innerWidth - buttonWidth - 10));
    newY = Math.max(10, Math.min(newY, window.innerHeight - buttonHeight - 10));

    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    const touch = e.changedTouches[0];
    if (touch) {
      const diffX = Math.abs(touch.clientX - dragStart.current.x);
      const diffY = Math.abs(touch.clientY - dragStart.current.y);
      const duration = Date.now() - clickTime.current;

      if (diffX < 10 && diffY < 10 && duration < 350) {
        setIsOpen(true);
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen válido (.png, .jpg, .jpeg)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2MB.');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImageBase64(null);
    setImageFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Escribe una descripción de la sugerencia o incidencia.');
      return;
    }

    setIsSending(true);

    let systemState: any = {};
    if (activeTab === 'COMPRAS' && draftCompra) {
      systemState = {
        bi: draftCompra.bi || 0,
        igv: draftCompra.igv || 0,
        total: draftCompra.total || 0,
        noGravada: draftCompra.noGravada || 0,
        isc: draftCompra.isc || 0,
        ctaGasto: draftCompra.ctaGasto,
        ctaAbono: draftCompra.ctaAbono,
        tipOperCode: draftCompra.tipOperCode
      };
    } else if (activeTab === 'VENTAS' && draftVenta) {
      systemState = {
        bi: draftVenta.bi || 0,
        igv: draftVenta.igv || 0,
        total: draftVenta.total || 0,
        noGravada: draftVenta.noGravada || 0,
        isc: draftVenta.isc || 0,
        ctaCargo: draftVenta.ctaCargo,
        ctaIngreso: draftVenta.ctaIngreso,
        tipOperCode: draftVenta.tipOperCode
      };
    } else if (activeTab === 'HONORARIOS' && draftHonorario) {
      systemState = {
        bi: draftHonorario.bi || 0,
        retencion: draftHonorario.retencion || 0,
        total: draftHonorario.total || 0,
        ctaGasto: draftHonorario.ctaGasto,
        ctaAbono: draftHonorario.ctaAbono
      };
    } else if (activeTab === 'ASIENTOS' && draftAsiento) {
      const lines = draftAsiento.lines || [];
      const debe = lines.reduce((acc, l) => acc + (l.debe || 0), 0);
      const haber = lines.reduce((acc, l) => acc + (l.haber || 0), 0);
      systemState = {
        asiento: draftAsiento.header?.asiento,
        glosa: draftAsiento.header?.glosa,
        lineCount: lines.length,
        totalDebe: debe,
        totalHaber: haber,
        isBalanced: Math.abs(debe - haber) < 0.01
      };
    }

    try {
      await sendSuggestion(comment, imageBase64, category, systemState);
      setComment('');
      handleClearImage();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const isLeftSide = hasDragged ? (position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500)) : false;
  const isExpanded = isHovered && !isDragging && !isMobile;
  const leftOffset = isExpanded ? (isLeftSide ? 0 : 132) : 0;

  return (
    <>
      {/* Botón Flotante con Diseño de Alto Contraste y Soporte Touch */}
      <button
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={hasDragged ? { 
          left: `${position.x - leftOffset}px`, 
          top: `${position.y}px`,
          right: 'auto',
          bottom: 'auto'
        } : {}}
        className={`fixed z-[999] group flex items-center justify-start overflow-hidden select-none cursor-grab active:cursor-grabbing md:h-11 h-9.5 touch-none ${
          isExpanded ? 'w-48' : 'w-9.5 md:w-11'
        } ${
          !hasDragged ? 'right-3 bottom-20 md:right-6 md:bottom-36' : ''
        } ${
          isDragging ? 'transition-none scale-105 ring-2 ring-amber-500 shadow-xl' : 'transition-all duration-300 ease-in-out'
        } ${
          isExpanded 
            ? 'bg-white/95 dark:bg-slate-900/95 border border-amber-500/40 text-slate-800 dark:text-white rounded-2xl shadow-[0_8px_30px_rgba(245,158,11,0.25)]' 
            : 'bg-white/95 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-850 border border-amber-500/30 hover:border-amber-500/60 text-slate-800 dark:text-white shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_6px_25px_rgba(245,158,11,0.35)] rounded-full'
        }`}
        title="Arrastra para mover. Clic para reportar."
      >
        <div className={`flex items-center w-full h-full ${
          !isExpanded 
            ? 'justify-center' 
            : (isLeftSide ? 'flex-row justify-start gap-2.5 px-3.5' : 'flex-row-reverse justify-start gap-2.5 px-3.5')
        }`}>
          <div className="relative flex shrink-0">
            <Lightbulb size={isMobile ? 16 : 18} className="text-amber-500 dark:text-yellow-400 animate-pulse group-hover:rotate-12 transition-transform duration-300 fill-amber-500/20" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>
          {isExpanded && (
            <span className="text-[10px] font-black uppercase tracking-wider opacity-100 transition-opacity duration-300 whitespace-nowrap text-app-text">
              Reportar Incidencia
            </span>
          )}
        </div>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          
          {/* Modal Container con Soporte Completo de Modo Claro y Oscuro */}
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-2xl animate-scale-in text-app-text max-h-[90vh] flex flex-col">
            
            {/* Header del Modal */}
            <div className="px-5 py-4 bg-app-bg/60 border-b border-app-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500">
                  <Sparkles size={16} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-app-text">Buzón de Reportes</h3>
                  <p className="text-[9px] text-app-muted font-bold uppercase tracking-widest mt-0.5">
                    Módulo Activo: <span className="text-blue-500 font-extrabold">{activeTab}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-app-hover text-app-muted hover:text-app-text rounded-xl transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario (Scrollable) */}
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
              
              {/* Información Detectada (Compacta) */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between text-[10px] font-semibold text-app-text">
                <div className="flex items-center gap-1.5 text-blue-500 font-black uppercase tracking-wider">
                  <CheckCircle2 size={12} />
                  Contexto Detectado
                </div>
                <div className="truncate max-w-[200px] text-app-muted">
                  <strong className="text-app-text font-bold">{currentCompany?.name || 'Ninguna'}</strong> ({currentCompany?.regimenTributario || 'N/A'})
                </div>
              </div>

              {/* Categoría con ModernSelect (Requerimiento 5) */}
              <div className="flex flex-col gap-1">
                <label className="block text-[10px] font-black uppercase text-app-muted tracking-wider">
                  Tipo de Incidencia / Reporte
                </label>
                <ModernSelect
                  value={category}
                  options={CATEGORY_OPTIONS}
                  onChange={(val) => setCategory(String(val))}
                  size="md"
                  variant="default"
                  className="w-full"
                  dropdownClassName="w-full"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-black uppercase text-app-muted tracking-wider mb-1.5">
                  Detalles del Reporte
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  required
                  placeholder="Describe la inconsistencia contable, el error de cálculo o la sugerencia aquí..."
                  className="w-full bg-app-bg border border-app-border focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-app-text outline-none transition-all resize-none placeholder:text-app-muted shadow-2xs"
                />
              </div>

              {/* Imagen Adjunta */}
              <div>
                <label className="block text-[10px] font-black uppercase text-app-muted tracking-wider mb-1.5">
                  Adjuntar Captura de Pantalla (Opcional)
                </label>
                
                {!imageBase64 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-app-border hover:border-blue-500 bg-app-bg/50 hover:bg-app-hover rounded-xl p-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2 group shadow-2xs"
                  >
                    <ImageIcon className="text-app-muted group-hover:text-blue-500 transition-colors" size={16} />
                    <span className="text-[10px] font-bold text-app-muted group-hover:text-app-text">
                      Haz clic para subir captura (Máx. 2MB)
                    </span>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                ) : (
                  <div className="bg-app-bg border border-app-border rounded-xl p-2 flex items-center justify-between gap-3 animate-fade-in shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-app-border bg-app-surface shrink-0">
                        <img 
                          src={imageBase64} 
                          alt="Previsualización" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-app-text truncate">{imageFileName}</p>
                        <p className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-widest mt-0.5">Listo</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1.5 hover:bg-rose-500/10 text-app-muted hover:text-rose-500 rounded-lg transition-all cursor-pointer shrink-0"
                      title="Eliminar imagen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Advertencia IA */}
              <p className="text-[9px] text-app-muted font-medium leading-relaxed">
                ℹ️ El sistema recopilará automáticamente el régimen, la pestaña y los números del formulario en borrador para el diagnóstico inteligente del administrador.
              </p>

              {/* Botón de Envío */}
              <div className="border-t border-app-border pt-4 mt-1 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-app-bg hover:bg-app-hover border border-app-border text-app-text rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-98"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Enviar</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </>
  );
};
