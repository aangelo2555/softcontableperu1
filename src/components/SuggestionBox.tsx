import React, { useState, useRef } from 'react';
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, seleccione un archivo de imagen válido (.png, .jpg, .jpeg)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen supera el límite de 2MB. Por favor, suba una imagen más ligera.');
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
      toast.error('Por favor, escribe una descripción de la sugerencia o incidencia.');
      return;
    }

    setIsSending(true);

    // Capturar de forma inteligente el estado numérico del formulario activo
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
      
      // Resetear campos
      setComment('');
      handleClearImage();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Botón Flotante con micro-animación y brillo */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[999] group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[12px] uppercase tracking-wider rounded-2xl shadow-[0_8px_32px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 active:translate-y-0 border border-blue-500/20 transition-all duration-300 select-none cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-100"></span>
        </span>
        <Lightbulb size={16} className="text-yellow-300 animate-pulse group-hover:rotate-12 transition-transform duration-300" />
        <span>¿Sugerencia / Error?</span>
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          
          {/* Modal Container con estética Premium Glassmorphism */}
          <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.4)] animate-scale-in text-slate-100">
            
            {/* Header del Modal */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-slate-900/0 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/10 rounded-xl border border-blue-500/20 text-blue-400">
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-white">Buzón de Reportes Inteligente</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Modo Activo: <span className="text-blue-400">{activeTab}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              
              {/* Información Detectada */}
              <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-4 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-wider">
                  <CheckCircle2 size={14} />
                  Contexto Detectado
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-300">
                  <div>
                    <span className="text-slate-500 block uppercase tracking-widest text-[9px] font-black">Empresa</span>
                    <span className="truncate block font-bold text-white">{currentCompany?.name || 'Ninguna Empresa Activa'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase tracking-widest text-[9px] font-black">Régimen</span>
                    <span className="truncate block font-bold text-white">{currentCompany?.regimenTributario || 'No Definido'}</span>
                  </div>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                  Tipo de Incidencia / Reporte
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                >
                  <option value="ERROR_CALCULO">📐 Falla en Fórmulas o Cálculos Contables</option>
                  <option value="INCONSISTENCIA_TRIBUTARIA">🏛️ Inconsistencia en Reglas SUNAT</option>
                  <option value="INTERFAZ_USUARIO">🎨 Problema de Diseño / Interfaz de Usuario</option>
                  <option value="OTRO">✏️ Otro Comentario o Sugerencia</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                  Detalles del Reporte
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  required
                  placeholder="Por favor, describe detalladamente la inconsistencia contable, el error matemático o la sugerencia para poder replicarla y corregirla..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none placeholder:text-slate-600"
                />
              </div>

              {/* Imagen Adjunta */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                  Adjuntar Captura de Pantalla o Imagen (Opcional)
                </label>
                
                {!imageBase64 ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <ImageIcon className="text-slate-600 group-hover:text-blue-500 transition-colors" size={24} />
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200">
                      Haga clic para subir una captura (.png, .jpg)
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                      Límite de tamaño: 2MB
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
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                        <img 
                          src={imageBase64} 
                          alt="Previsualización" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{imageFileName}</p>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">Listo para enviar</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all cursor-pointer shrink-0"
                      title="Eliminar imagen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Advertencia IA */}
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                ℹ️ Al hacer clic en enviar, el motor del sistema recopilará automáticamente la configuración de la empresa actual, el régimen impositivo y los números en borrador del formulario activo. Un diagnóstico matemático automatizado analizará el caso de forma inmediata.
              </p>

              {/* Botón de Envío */}
              <div className="border-t border-slate-800 pt-5 mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Enviar Reporte</span>
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
