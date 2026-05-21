import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Lightbulb, X, Image as ImageIcon, Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const SuggestionBox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('ERROR_CALCULO');
  const [comment, setComment] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Posición del botón flotante
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasInitializedPosition, setHasInitializedPosition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Inicializar posición en la esquina inferior derecha
  useEffect(() => {
    if (!hasInitializedPosition && typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth - 60,
        y: window.innerHeight - 150
      });
      setHasInitializedPosition(true);
    }
  }, [hasInitializedPosition]);

  // Mantener el botón visible si cambia el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const buttonWidth = 44; // Basado en el ancho colapsado
        const buttonHeight = 44;
        const newX = Math.max(10, Math.min(prev.x, window.innerWidth - buttonWidth - 10));
        const newY = Math.max(10, Math.min(prev.y, window.innerHeight - buttonHeight - 10));
        return { x: newX, y: newY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lógica de arrastrar y soltar
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Solo clic izquierdo
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    clickTime.current = Date.now();
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffset.current.x;
      let newY = e.clientY - dragOffset.current.y;
      
      const buttonWidth = 44; // El límite de arrastre es sobre el botón colapsado (para que toque el extremo derecho)
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
      
      // Si el movimiento fue mínimo y rápido, es un click
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

  // Determinar si el botón está en la mitad izquierda o derecha de la pantalla
  const isLeftSide = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const isExpanded = isHovered && !isDragging;
  
  // Si está en la mitad derecha, se expande a la izquierda (offset = 132px).
  // Si está en la mitad izquierda, se expande a la derecha (offset = 0px).
  const leftOffset = isExpanded ? (isLeftSide ? 0 : 132) : 0;

  return (
    <>
      {/* Botón Flotante Draggable, Libre de Círculo en modo pasivo y expansión inteligente */}
      <button
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          left: hasInitializedPosition ? `${position.x - leftOffset}px` : 'auto', 
          top: hasInitializedPosition ? `${position.y}px` : 'auto',
          right: hasInitializedPosition ? 'auto' : '24px',
          bottom: hasInitializedPosition ? 'auto' : '24px'
        }}
        className={`fixed z-[999] group flex items-center justify-start transition-all duration-300 ease-in-out select-none cursor-grab active:cursor-grabbing h-11 w-11 hover:w-44 overflow-hidden ${
          isExpanded 
            ? 'bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-sm border border-slate-300 dark:border-slate-800 text-blue-600 dark:text-blue-400 rounded-xl shadow-md' 
            : 'bg-transparent border border-transparent text-slate-700 dark:text-slate-400 hover:text-blue-600 rounded-full'
        }`}
        title="Arrastra para mover. Clic para reportar."
      >
        <div className={`flex items-center gap-2 px-3 w-full h-full ${
          isLeftSide ? 'flex-row justify-start' : 'flex-row-reverse justify-end'
        }`}>
          <div className="relative flex shrink-0">
            <Lightbulb size={16} className="text-yellow-500 dark:text-yellow-400 animate-pulse group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 whitespace-nowrap">
            Reportar Incidencia
          </span>
        </div>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          
          {/* Modal Container Compacto */}
          <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-scale-in text-slate-100 max-h-[90vh] flex flex-col">
            
            {/* Header del Modal */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900/30 to-slate-900/0 border-b border-slate-850 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-500/20 text-blue-400">
                  <Sparkles size={16} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-white">Buzón de Reportes</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Módulo Activo: <span className="text-blue-400 font-extrabold">{activeTab}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario (Scrollable) */}
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              
              {/* Información Detectada (Compacta) */}
              <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3 flex items-center justify-between text-[10px] font-semibold text-slate-300">
                <div className="flex items-center gap-1.5 text-blue-400 font-black uppercase tracking-wider">
                  <CheckCircle2 size={12} />
                  Contexto Detectado
                </div>
                <div className="truncate max-w-[200px] text-slate-400">
                  <strong className="text-white font-bold">{currentCompany?.name || 'Ninguna'}</strong> ({currentCompany?.regimenTributario || 'N/A'})
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Tipo de Incidencia / Reporte
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-200 outline-none focus:border-blue-500 transition-all"
                >
                  <option value="ERROR_CALCULO">📐 Falla en Fórmulas o Cálculos Contables</option>
                  <option value="INCONSISTENCIA_TRIBUTARIA">🏛️ Inconsistencia en Reglas SUNAT</option>
                  <option value="INTERFAZ_USUARIO">🎨 Problema de Diseño / Interfaz</option>
                  <option value="OTRO">✏️ Otro Comentario o Sugerencia</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Detalles del Reporte
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  required
                  placeholder="Describe la inconsistencia contable, el error de cálculo o la sugerencia aquí..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-[11px] font-semibold text-slate-200 outline-none focus:border-blue-500 transition-all resize-none placeholder:text-slate-600"
                />
              </div>

              {/* Imagen Adjunta (Compacto) */}
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                  Adjuntar Captura de Pantalla (Opcional)
                </label>
                
                {!imageBase64 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/40 hover:bg-slate-950/70 rounded-xl p-3 text-center cursor-pointer transition-all flex items-center justify-center gap-2 group"
                  >
                    <ImageIcon className="text-slate-600 group-hover:text-blue-500 transition-colors" size={16} />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200">
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
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-2 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-805 bg-slate-900 shrink-0">
                        <img 
                          src={imageBase64} 
                          alt="Previsualización" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 truncate">{imageFileName}</p>
                        <p className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-widest mt-0.5">Listo</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all cursor-pointer shrink-0"
                      title="Eliminar imagen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Advertencia IA */}
              <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                ℹ️ El sistema recopilará automáticamente el régimen, la pestaña y los números del formulario en borrador para el diagnóstico inteligente del administrador.
              </p>

              {/* Botón de Envío */}
              <div className="border-t border-slate-800/80 pt-4 mt-1 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-600/10 transition-all cursor-pointer"
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
