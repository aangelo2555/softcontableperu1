import React, { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle, X, ShieldCheck, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

import { webApiBridge } from '../services/apiBridge';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onVerificationSuccess: (data: { accessToken: string; token: string; user: any; refreshToken?: string }) => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  email,
  onClose,
  onVerificationSuccess
}) => {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');
  const [devCodeNotice, setDevCodeNotice] = useState<string | null>(null);
  const [verifiedFromOtherDevice, setVerifiedFromOtherDevice] = useState(false);
  const hasHandledSuccess = useRef(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setOtpDigits(['', '', '', '', '', '']);
      setErrorMessage('');
      setDevCodeNotice(null);
      setVerifiedFromOtherDevice(false);
      hasHandledSuccess.current = false;
      return;
    }

    // Auto-focus en el primer input
    setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 200);

    // Iniciar temporizador de reenvío
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, email]);

  // --- SONDEO EN TIEMPO REAL: DETECTAR ACTIVACIÓN EN CELULAR / OTRA PESTAÑA ---
  useEffect(() => {
    if (!isOpen || !email) return;

    let isSubscribed = true;
    let pollTimer: any = null;

    const checkStatus = async () => {
      if (hasHandledSuccess.current) return;
      try {
        const data = await webApiBridge.authCheckVerificationStatus({ email });
        if (hasHandledSuccess.current) return;

        if (data && data.success && data.verified) {
          hasHandledSuccess.current = true;
          setVerifiedFromOtherDevice(true);
          toast.success('🎉 ¡Cuenta activada desde tu dispositivo móvil! Ingresando al sistema...', { duration: 4000 });
          
          if (data.token || data.accessToken) {
            localStorage.setItem('softcontable_token', data.token || data.accessToken);
          }
          if (data.refreshToken) {
            localStorage.setItem('softcontable_refresh_token', data.refreshToken);
          }
          if (data.user) {
            localStorage.setItem('softcontable_user', JSON.stringify(data.user));
          }
          localStorage.setItem('softcontable_last_activity', Date.now().toString());

          // Redirección y recarga garantizada para entrar al dashboard
          setTimeout(() => {
            try {
              onVerificationSuccess(data);
            } catch (_) {}
            window.location.reload();
          }, 800);
          return;
        }
      } catch (_) {
        // Ignorar fallos de red en sondeo
      }

      if (isSubscribed && !hasHandledSuccess.current) {
        pollTimer = setTimeout(checkStatus, 2500);
      }
    };

    pollTimer = setTimeout(checkStatus, 1500);

    return () => {
      isSubscribed = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [isOpen, email]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1); // Solo un dígito numérico
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    setErrorMessage('');

    // Si ingresó un dígito y no es el último, avanzar el foco
    if (cleanVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Si completó los 6 dígitos, disparar verificación automática
    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      submitOtp(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    if (pasted.length === 6) {
      submitOtp(pasted);
    } else {
      inputsRef.current[pasted.length]?.focus();
    }
  };

  const submitOtp = async (codeToSubmit: string) => {
    if (codeToSubmit.length !== 6 || hasHandledSuccess.current) {
      if (codeToSubmit.length !== 6) setErrorMessage('Ingresa los 6 dígitos del código.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await webApiBridge.authVerifyEmailOtp({
        email,
        otpCode: codeToSubmit
      });

      if (data.success) {
        hasHandledSuccess.current = true;
        setVerifiedFromOtherDevice(true);
        toast.success(data.message || '¡Cuenta verificada con éxito!', { duration: 4000 });
        if (data.token || data.accessToken) {
          localStorage.setItem('softcontable_token', data.token || data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem('softcontable_refresh_token', data.refreshToken);
        }
        if (data.user) {
          localStorage.setItem('softcontable_user', JSON.stringify(data.user));
        }
        localStorage.setItem('softcontable_last_activity', Date.now().toString());

        setTimeout(() => {
          try {
            onVerificationSuccess(data);
          } catch (_) {}
          window.location.reload();
        }, 800);
      } else {
        const err = data.error || 'Código de verificación incorrecto.';
        setErrorMessage(err);
        toast.error(err);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Error al validar el código OTP.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage('');

    try {
      const data = await webApiBridge.authResendVerification({ email });

      if (data.success) {
        toast.success('¡Nuevo código enviado a tu bandeja de entrada!');
        setCooldown(60);
        setOtpDigits(['', '', '', '', '', '']);
        if (data.devCode) {
          setDevCodeNotice(data.devCode);
        }
        inputsRef.current[0]?.focus();
      } else {
        toast.error(data.error || 'Error al reenviar código.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al reenviar correo.';
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-app-surface border border-app-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up text-center p-6 md:p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-app-muted hover:text-app-text hover:bg-app-hover transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {verifiedFromOtherDevice ? (
          <div className="py-6 space-y-4 animate-scale-up">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
              ¡Dispositivo Vinculado!
            </h3>
            <p className="text-xs text-app-muted font-semibold max-w-xs mx-auto">
              Detectamos la activación de tu cuenta desde tu dispositivo móvil. Ingresando automáticamente...
            </p>
            <div className="flex justify-center items-center gap-2 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 pt-2">
              <RefreshCw size={15} className="animate-spin" />
              <span>Cargando tu sesión...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Icono Principal */}
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
              <Mail size={32} className="animate-pulse" />
            </div>

            <h3 className="text-xl font-black text-app-text uppercase tracking-tight">
              Verifica tu Correo
            </h3>
            <p className="text-xs text-app-muted font-bold mt-1 max-w-xs mx-auto">
              Hemos enviado un correo con tu enlace de activación y código de 6 dígitos a:
            </p>
            <div className="mt-2 inline-block px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded-lg border border-blue-500/20 truncate max-w-full">
              {email}
            </div>

            {devCodeNotice && (
              <div className="mt-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs p-2.5 rounded-xl flex items-center justify-between">
                <div className="text-left">
                  <span className="font-bold text-[10px] block">🔑 Código (Modo Pruebas):</span>
                  <span className="text-sm font-mono font-black tracking-widest text-blue-600 dark:text-blue-400">{devCodeNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const chars = devCodeNotice.slice(0, 6).split('');
                    setOtpDigits(chars);
                    submitOtp(devCodeNotice);
                  }}
                  className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Auto-completar
                </button>
              </div>
            )}

            {/* Cajas de OTP de 6 dígitos */}
            <div className="mt-5 flex justify-center gap-2" onPaste={handlePaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  disabled={loading}
                  className="w-11 h-13 text-center text-xl font-black font-mono bg-app-bg border border-app-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-app-text outline-none transition-all shadow-inner"
                />
              ))}
            </div>

            {errorMessage && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-1.5 text-xs text-red-500 font-semibold">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={loading || otpDigits.join('').length !== 6}
                onClick={() => submitOtp(otpDigits.join(''))}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                  otpDigits.join('').length === 6 && !loading
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 cursor-pointer active:scale-95'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-app-border'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar y Entrar al Sistema</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              {/* Reenviar Correo */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={cooldown > 0 || resending}
                  onClick={handleResend}
                  className={`text-xs font-bold transition-colors flex items-center justify-center gap-1.5 mx-auto ${
                    cooldown > 0 || resending
                      ? 'text-app-muted cursor-not-allowed opacity-60'
                      : 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer'
                  }`}
                >
                  <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                  <span>
                    {cooldown > 0
                      ? `Reenviar correo en ${cooldown}s`
                      : '¿No recibiste el correo? Reenviar código'}
                  </span>
                </button>
              </div>
            </div>

            {/* Sincronización Cross-Device Activa */}
            <div className="mt-6 pt-4 border-t border-app-border flex items-center justify-center gap-2 text-[10px] text-app-muted font-medium">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Smartphone size={13} className="text-emerald-500 shrink-0" />
              <span>Sincronización en vivo activa: Si pulsas el enlace desde tu celular, esta pantalla se activará sola.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
