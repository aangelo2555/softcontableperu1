import React from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';

interface PasswordStrengthCheckerProps {
  password: string;
}

export function checkPasswordStrength(password: string) {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

  const score = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol;

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    score,
    isValid
  };
}

export const PasswordStrengthChecker: React.FC<PasswordStrengthCheckerProps> = ({ password }) => {
  if (!password) return null;

  const { hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSymbol, score, isValid } = checkPasswordStrength(password);

  const getStrengthLabel = () => {
    if (isValid) return { text: 'Excelente (Muy Segura)', color: 'text-emerald-600', bg: 'bg-emerald-500' };
    if (score >= 4) return { text: 'Buena', color: 'text-blue-600', bg: 'bg-blue-500' };
    if (score >= 3) return { text: 'Media', color: 'text-amber-600', bg: 'bg-amber-500' };
    return { text: 'Débil', color: 'text-rose-600', bg: 'bg-rose-500' };
  };

  const strength = getStrengthLabel();

  return (
    <div className="mt-2 p-2.5 bg-slate-50 dark:bg-app-surface/80 border border-slate-200 dark:border-app-border rounded-xl space-y-2 animate-fade-in text-[11px]">
      {/* Strength Bar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <ShieldCheck size={13} className={strength.color} /> Seguridad:
        </span>
        <span className={`text-[10px] font-black uppercase tracking-wider ${strength.color}`}>
          {strength.text}
        </span>
      </div>

      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-1 p-0.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`flex-1 h-full rounded-full transition-all duration-300 ${
              score >= level ? strength.bg : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Criteria Grid */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <div className={`flex items-center gap-1 text-[10px] font-bold ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
          {hasMinLength ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
          <span>Mínimo 8 caracteres</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold ${hasUppercase && hasLowercase ? 'text-emerald-600' : 'text-slate-400'}`}>
          {hasUppercase && hasLowercase ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
          <span>Mayúscula y minúscula</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold ${hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
          {hasNumber ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
          <span>Al menos un número</span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold ${hasSymbol ? 'text-emerald-600' : 'text-slate-400'}`}>
          {hasSymbol ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
          <span>Símbolo (!@#$%...)</span>
        </div>
      </div>
    </div>
  );
};

export default PasswordStrengthChecker;
