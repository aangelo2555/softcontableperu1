import React, { useState, useEffect } from 'react';
import { Cookie, X, Check, ShieldCheck, Settings } from 'lucide-react';

interface CookieBannerProps {
  onOpenLegalCookies?: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenLegalCookies }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    performance: true
  });

  useEffect(() => {
    const consent = localStorage.getItem('softcontable_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consentData = {
      essential: true,
      analytics: true,
      performance: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('softcontable_cookie_consent', JSON.stringify(consentData));
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    const consentData = {
      essential: true,
      analytics: false,
      performance: false,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('softcontable_cookie_consent', JSON.stringify(consentData));
    setIsVisible(false);
  };

  const handleSaveCustom = () => {
    const consentData = {
      ...preferences,
      essential: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('softcontable_cookie_consent', JSON.stringify(consentData));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[99999] animate-fade-in">
      <div className="bg-app-surface/95 dark:bg-app-surface/95 backdrop-blur-xl border border-app-border rounded-2xl shadow-2xl p-4 sm:p-5 text-app-text flex flex-col gap-3">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                Control de Cookies y Privacidad
              </h3>
              <p className="text-[9px] text-app-muted font-bold uppercase tracking-wider">
                Ley N° 29733 (LPDP - Perú) & GDPR
              </p>
            </div>
          </div>
          <button
            onClick={handleAcceptEssential}
            className="text-app-muted hover:text-app-text p-1 rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Body */}
        {!showConfig ? (
          <>
            <p className="text-[11px] text-app-muted leading-relaxed font-medium">
              Utilizamos cookies esenciales para autenticación y preferencias del sistema, así como almacenamiento local para acelerar la plataforma contable.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                onClick={handleAcceptAll}
                className="w-full sm:flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aceptar Todas</span>
              </button>

              <button
                onClick={handleAcceptEssential}
                className="w-full sm:flex-1 py-2 px-3 bg-app-bg hover:bg-app-hover text-app-text border border-app-border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Solo Necesarias</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[9px] text-app-muted pt-1 border-t border-app-border/40">
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-1 hover:text-blue-500 font-bold uppercase tracking-wider cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Configurar</span>
              </button>

              {onOpenLegalCookies && (
                <button
                  onClick={onOpenLegalCookies}
                  className="hover:text-blue-500 font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Política de Cookies
                </button>
              )}
            </div>
          </>
        ) : (
          /* Custom Preferences Panel */
          <div className="space-y-2 pt-1 animate-fade-in">
            {/* Essential */}
            <div className="p-2.5 bg-app-bg/60 rounded-xl border border-app-border/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-app-text flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> Esenciales
                </p>
                <p className="text-[8px] text-app-muted">Autenticación, RUC activo y sesión.</p>
              </div>
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Requerido</span>
            </div>

            {/* Analytics */}
            <div className="p-2.5 bg-app-bg/60 rounded-xl border border-app-border/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-app-text">Analíticas</p>
                <p className="text-[8px] text-app-muted">Medición anónima de rendimiento de consultas.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={e => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Performance */}
            <div className="p-2.5 bg-app-bg/60 rounded-xl border border-app-border/40 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-app-text">Rendimiento & Caché</p>
                <p className="text-[8px] text-app-muted">Almacenamiento local acelerado.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.performance}
                onChange={e => setPreferences({ ...preferences, performance: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveCustom}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Guardar Selección
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="py-1.5 px-3 bg-app-bg hover:bg-app-hover text-app-text border border-app-border rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieBanner;
