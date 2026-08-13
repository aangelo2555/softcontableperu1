import React, { useState } from 'react';
import { KeyRound, Lock, X, Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { webApiBridge } from '../services/apiBridge';
import { PasswordStrengthChecker, checkPasswordStrength } from './ui/PasswordStrengthChecker';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const strength = checkPasswordStrength(newPassword);
  const isMatch = confirmPassword.length > 0 && confirmPassword === newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strength.isValid) {
      setErrorMsg('La nueva contraseña debe cumplir todos los requisitos de seguridad.');
      return;
    }
    if (!isMatch) {
      setErrorMsg('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await webApiBridge.authChangePassword({
        currentPassword,
        newPassword
      });

      if (res.success) {
        toast.success('¡Contraseña actualizada exitosamente! 🎉');
        onClose();
      } else {
        setErrorMsg(res.error || 'Error al actualizar la contraseña.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error de conexión con el servidor.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl p-6 shadow-2xl relative animate-scale-up text-app-text">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-app-muted hover:text-app-text rounded-xl transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-app-text">
              Seguridad &amp; Contraseña
            </h3>
            <p className="text-[10px] text-app-muted font-bold uppercase tracking-wider">
              Actualizar clave de acceso
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold leading-tight flex items-start gap-2 animate-fade-in">
            <span className="text-sm shrink-0">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contraseña Actual */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-extrabold text-app-muted uppercase tracking-wider">
              Contraseña Actual
            </label>
            <div className="relative flex items-center rounded-xl bg-app-bg border border-app-border">
              <Lock className="absolute left-3.5 w-4 h-4 text-app-muted" />
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                placeholder="Ingresa tu clave actual"
                className="w-full py-2.5 pr-10 bg-transparent placeholder:text-app-muted/50 text-xs text-app-text focus:outline-none"
                style={{ paddingLeft: '2.75rem' }}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 text-app-muted hover:text-app-text transition-colors cursor-pointer"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Nueva Contraseña */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-app-muted uppercase tracking-wider">
                Nueva Contraseña
              </label>
              {strength.isValid && (
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Segura
                </span>
              )}
            </div>
            <div
              className={`relative flex items-center rounded-xl transition-all duration-300 ${
                strength.isValid
                  ? 'border-2 border-emerald-500 bg-emerald-50/20 shadow-sm shadow-emerald-500/10'
                  : 'bg-app-bg border border-app-border focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10'
              }`}
            >
              <Lock className={`absolute left-3.5 w-4 h-4 ${strength.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-app-muted'}`} />
              <input
                type={showNew ? 'text' : 'password'}
                required
                placeholder="Mín. 8 carácteres, mayúscula, núm y símbolo"
                className="w-full py-2.5 pr-16 bg-transparent placeholder:text-app-muted/50 text-xs text-app-text focus:outline-none"
                style={{ paddingLeft: '2.75rem' }}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <div className="absolute right-3 flex items-center gap-1.5">
                {strength.isValid && <CheckCircle2 size={16} className="text-emerald-500" />}
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="text-app-muted hover:text-app-text transition-colors cursor-pointer p-0.5"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Checklist interactivo */}
            <PasswordStrengthChecker password={newPassword} />
          </div>

          {/* Confirmar Nueva Contraseña */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-app-muted uppercase tracking-wider">
                Confirmar Nueva Contraseña
              </label>
              {isMatch && (
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Coincide
                </span>
              )}
            </div>
            <div
              className={`relative flex items-center rounded-xl transition-all duration-300 ${
                isMatch
                  ? 'border-2 border-emerald-500 bg-emerald-50/20 shadow-sm shadow-emerald-500/10'
                  : 'bg-app-bg border border-app-border focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10'
              }`}
            >
              <Lock className={`absolute left-3.5 w-4 h-4 ${isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-app-muted'}`} />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                placeholder="Repite la nueva contraseña"
                className="w-full py-2.5 pr-16 bg-transparent placeholder:text-app-muted/50 text-xs text-app-text focus:outline-none"
                style={{ paddingLeft: '2.75rem' }}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <div className="absolute right-3 flex items-center gap-1.5">
                {isMatch && <CheckCircle2 size={16} className="text-emerald-500" />}
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="text-app-muted hover:text-app-text transition-colors cursor-pointer p-0.5"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-app-bg hover:bg-app-hover border border-app-border text-app-text font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !strength.isValid || !isMatch}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
