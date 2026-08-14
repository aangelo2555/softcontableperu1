import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { webApiBridge } from '../services/apiBridge';
import { 
    User, 
    Lock, 
    Mail, 
    ArrowRight, 
    Loader2, 
    Building2, 
    Layers,
    PieChart,
    FileText,
    GraduationCap,
    Eye,
    EyeOff,
    CheckCircle2,
    Sparkles,
    ShieldCheck,
    Cpu,
    Landmark,
    Users,
    ReceiptText,
    KeyRound,
    X,
    AlertCircle,
    Send,
    ShieldAlert,
    RefreshCw
} from 'lucide-react';

import toast from 'react-hot-toast';
import { LegalPages } from './LegalPages';
import { CookieBanner } from './CookieBanner';
import { PasswordStrengthChecker, checkPasswordStrength } from './ui/PasswordStrengthChecker';

const customStyles = `
  .light-card-pro {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 
      0 20px 45px -15px rgba(15, 23, 42, 0.08),
      0 4px 12px -2px rgba(15, 23, 42, 0.04);
  }
  .light-card-student {
    background: #ffffff;
    border: 1px solid #e0e7ff;
    box-shadow: 
      0 20px 45px -15px rgba(67, 56, 202, 0.1),
      0 4px 12px -2px rgba(67, 56, 202, 0.05);
  }
  .light-input-field {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    transition: all 0.2s ease-in-out;
  }
  .light-input-field:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }
  .light-input-field:focus-within {
    background: #ffffff;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }
  .light-input-field-student:focus-within {
    background: #ffffff;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.14);
  }
`;

export const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isStudentModeActive, setIsStudentModeActive] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorAlert, setErrorAlert] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const [showLoginLegal, setShowLoginLegal] = useState<'terms' | 'privacy' | 'security' | 'confidentiality' | 'cookies' | 'eula' | 'legal' | null>(null);

    // Estado Modal ¿Olvidaste tu clave? (Flujo OTP en 3 Pasos)
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOtpCode, setForgotOtpCode] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState<string | null>(null);
    const [devCodeNotice, setDevCodeNotice] = useState<string | null>(null);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [forgotMessage, setForgotMessage] = useState<string | null>(null);

    // Contador regresivo para el botón "Reenviar código" (evita abusos)
    const [resendCooldown, setResendCooldown] = useState(0);

    // Timer regresivo de 60 segundos para el botón de reenvío de OTP
    useEffect(() => {
        let interval: any = null;
        if (resendCooldown > 0) {
            interval = setInterval(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendCooldown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorAlert(null);

        const requestedMode = isStudentModeActive ? 'estudiante' : 'profesional';

        try {
            if (isLogin) {
                const res = await webApiBridge.authLogin({
                    email: formData.email,
                    password: formData.password,
                    mode: requestedMode
                });

                if (res.success) {
                    if (isStudentModeActive && res.user?.role !== 'estudiante') {
                        const msg = '💼 Esta cuenta es de Modo Profesional. Vuelve al modo "Profesional" para iniciar sesión.';
                        setErrorAlert(msg);
                        toast.error(msg);
                        setIsLoading(false);
                        return;
                    }
                    if (!isStudentModeActive && res.user?.role === 'estudiante') {
                        const msg = '🎓 Esta cuenta está registrada en Modo Estudiante. Activa la opción "Estudiante" para ingresar.';
                        setErrorAlert(msg);
                        toast.error(msg);
                        setIsLoading(false);
                        return;
                    }

                    localStorage.setItem('softcontable_token', res.token);
                    if (res.user) {
                        localStorage.setItem('softcontable_user', JSON.stringify(res.user));
                    }
                    window.location.reload();
                } else {
                    const errMsg = res.error || 'Error al iniciar sesión';
                    setErrorAlert(errMsg);
                    toast.error(errMsg);
                }
            } else {
                const strength = checkPasswordStrength(formData.password);
                if (!strength.isValid) {
                    const msg = 'La contraseña debe tener al menos 8 caracteres y combinar mayúsculas, minúsculas, números y símbolos (!@#$%...).';
                    setErrorAlert(msg);
                    toast.error(msg);
                    setIsLoading(false);
                    return;
                }

                const res = isStudentModeActive
                    ? await webApiBridge.authRegisterStudent(formData)
                    : await webApiBridge.authRegister(formData);
                if (res.success) {
                    if (isStudentModeActive && res.token) {
                        localStorage.setItem('softcontable_token', res.token);
                        if (res.user) {
                            localStorage.setItem('softcontable_user', JSON.stringify(res.user));
                        }
                        toast.success('🎓 ¡Registro de estudiante exitoso! Iniciando sesión automáticamente...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 800);
                    } else {
                        toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
                        setIsLogin(true);
                    }
                } else {
                    const errMsg = res.error || 'Error al registrarse';
                    setErrorAlert(errMsg);
                    toast.error(errMsg);
                }
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Error de conexión con el servidor';
            setErrorAlert(errMsg);
            toast.error(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Manejo de Recuperación de Contraseña - PASO 1: Enviar Código OTP a Gmail
    const handleForgotRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resendCooldown > 0) return;
        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);
        setDevCodeNotice(null);
        try {
            const res = await webApiBridge.authRequestResetOtp({ email: forgotEmail });
            if (res.success) {
                setForgotMessage(res.message);
                if (res.devCode) {
                    setDevCodeNotice(res.devCode);
                }
                setForgotStep(2);
                setResendCooldown(60); // Inicia el contador regresivo de 60 segundos
            } else {
                setForgotError(res.error || 'Error al enviar el código de verificación.');
            }
        } catch (err: any) {
            const serverErr = err.response?.data?.error;
            const statusErr = err.response?.status === 502
                ? 'El servicio de correo tardó en responder. Por favor presiona enviar nuevamente.'
                : 'Error de conexión con el servidor.';
            setForgotError(serverErr || statusErr);
        } finally {
            setForgotLoading(false);
        }
    };

    // Manejo de Recuperación de Contraseña - PASO 2: Verificar Código OTP de 6 Dígitos
    const handleForgotVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);
        try {
            const res = await webApiBridge.authVerifyResetOtp({ email: forgotEmail, code: forgotOtpCode });
            if (res.success) {
                setForgotMessage(res.message);
                if (res.resetToken) {
                    setResetToken(res.resetToken);
                }
                setForgotStep(3);
            } else {
                setForgotError(res.error || 'Código de verificación incorrecto.');
            }
        } catch (err: any) {
            setForgotError(err.response?.data?.error || 'Código inválido o expirado.');
        } finally {
            setForgotLoading(false);
        }
    };

    // Manejo de Recuperación de Contraseña - PASO 3: Guardar Nueva Contraseña
    const handleForgotResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const strength = checkPasswordStrength(forgotNewPassword);
        if (!strength.isValid) {
            setForgotError('La nueva contraseña debe tener al menos 8 caracteres y combinar mayúsculas, minúsculas, números y símbolos (!@#$%...).');
            return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            setForgotError('Las contraseñas ingresadas no coinciden.');
            return;
        }
        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);
        try {
            const res = await webApiBridge.authResetPasswordWithOtp({
                email: forgotEmail,
                code: forgotOtpCode,
                newPassword: forgotNewPassword,
                resetToken: resetToken || undefined
            });
            if (res.success) {
                toast.success('¡Contraseña restablecida exitosamente!');
                setShowForgotPasswordModal(false);
                setFormData(prev => ({ ...prev, email: forgotEmail }));
                setIsLogin(true);
            } else {
                setForgotError(res.error || 'Error al actualizar la contraseña.');
            }
        } catch (err: any) {
            setForgotError(err.response?.data?.error || 'Error al actualizar la contraseña.');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen h-screen w-screen bg-gradient-to-br from-[#040e1d] via-[#071933] to-[#030914] flex items-center justify-center p-3 sm:p-5 lg:p-6 relative overflow-hidden font-sans selection:bg-blue-600/20 selection:text-blue-900">
            <style>{customStyles}{`
                .login-scroll::-webkit-scrollbar { width: 4px; }
                .login-scroll::-webkit-scrollbar-track { background: transparent; }
                .login-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 10px; }
                .login-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }
            `}</style>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FONDO AZUL MARINO CON DISEÑO DE REFLEJOS & DEGRADADOS CANVAS    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Reflejos luminosos de fondo estilo Canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_15%,rgba(14,165,233,0.22),transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_85%_80%,rgba(37,99,235,0.25),transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(6,182,212,0.16),transparent_60%)] pointer-events-none" />
            
            {/* Destello diagonal especular (efecto reflejo canvas) */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(14,165,233,0.1)_35%,transparent_65%)] pointer-events-none" />

            {/* Orbes de iluminación ambiental difusa */}
            <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-cyan-400/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TARJETA UNIFICADA CENTRADA (Panel Blanco + Imagen Pegados)     */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="relative z-10 w-full max-w-[960px] xl:max-w-[1000px] h-[88vh] max-h-[670px] min-h-[560px] bg-[#040e1d] rounded-[26px] xl:rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.65),0_0_60px_rgba(14,165,233,0.12)] border border-white/15 overflow-hidden flex flex-col lg:flex-row animate-fade-in">
                
                {/* LADO IZQUIERDO: Formulario de Autenticación (Blanco) */}
                <div className="w-full lg:w-[430px] xl:w-[450px] bg-white px-6 sm:px-8 lg:px-8 xl:px-9 py-5 sm:py-6 flex flex-col justify-between overflow-y-auto login-scroll shrink-0 relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.08)]">
                    
                    {/* Header Marca */}
                    <div className="text-center mb-2">
                        <div className="inline-flex items-center justify-center p-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl shadow-sm mb-1.5">
                            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-9 h-9 object-contain" />
                        </div>
                        <h1 className="text-xl lg:text-2xl font-black tracking-wider text-slate-900 uppercase notranslate flex items-center justify-center gap-1.5" translate="no">
                            SOFT<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">CONTABLE</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5 notranslate" translate="no">
                            Sistema Contable en la Nube v2.0
                        </p>
                    </div>

                    {/* Contenedor del Formulario */}
                    <div className="flex-1 flex flex-col justify-center py-1">
                        
                        {/* Selector de Modo: Profesional vs Estudiante */}
                        <div className="mb-2.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1.5 select-none">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer outline-none focus:outline-none ${
                                    !isStudentModeActive 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]' 
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                }`}
                            >
                                <Building2 size={14} className={!isStudentModeActive ? 'text-white' : 'text-slate-400'} />
                                <span>Profesional</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer outline-none focus:outline-none ${
                                    isStudentModeActive 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]' 
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                }`}
                            >
                                <GraduationCap size={15} className={isStudentModeActive ? 'text-white' : 'text-slate-400'} />
                                <span>Estudiante</span>
                            </button>
                        </div>

                        {/* Banner informativo del modo */}
                        <div className={`mb-2.5 p-2 rounded-xl border text-[10px] font-medium flex items-center gap-2 ${
                            isStudentModeActive
                                ? 'bg-indigo-50/90 border-indigo-200/80 text-indigo-900'
                                : 'bg-blue-50/90 border-blue-200/80 text-blue-900'
                        }`}>
                            {isStudentModeActive ? (
                                <>
                                    <GraduationCap size={14} className="shrink-0 text-indigo-600" />
                                    <span>Entorno educativo para aprendizaje contable sin riesgo SUNAT.</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={14} className="shrink-0 text-blue-600" />
                                    <span>Acceso al sistema contable oficial y cartera de empresas.</span>
                                </>
                            )}
                        </div>

                        {/* Tabs: Iniciar Sesión / Registrarse */}
                        <div className="flex mb-2.5 border-b border-slate-200 pb-1">
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsLogin(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    isLogin 
                                        ? isStudentModeActive ? 'border-indigo-600 text-indigo-700 font-black' : 'border-blue-600 text-blue-700 font-black' 
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Iniciar Sesión
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsLogin(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    !isLogin 
                                        ? isStudentModeActive ? 'border-indigo-600 text-indigo-700 font-black' : 'border-blue-600 text-blue-700 font-black' 
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Crear Cuenta
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-2.5" autoComplete="on">
                            {errorAlert && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs py-2 px-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
                                    <span className="text-rose-600 mt-0.5 text-sm shrink-0">⚠️</span>
                                    <div className="flex-1 font-medium leading-tight">{errorAlert}</div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-extrabold text-slate-500 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                    <div className={`relative flex items-center rounded-xl light-input-field ${isStudentModeActive ? 'light-input-field-student' : ''}`}>
                                        <User className="absolute left-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full py-2 pr-3 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.5rem' }}
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-extrabold text-slate-500 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                                <div className={`relative flex items-center rounded-xl light-input-field ${isStudentModeActive ? 'light-input-field-student' : ''}`}>
                                    <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="email"
                                        required
                                        autoComplete="username"
                                        placeholder={isStudentModeActive ? "estudiante@universidad.edu.pe" : "usuario@empresa.com"}
                                        className="w-full py-2 pr-3 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-extrabold text-slate-500 ml-1 uppercase tracking-wider">Contraseña</label>
                                    {!isLogin && checkPasswordStrength(formData.password).isValid && (
                                        <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Segura
                                        </span>
                                    )}
                                </div>
                                <div className={`relative flex items-center rounded-xl light-input-field transition-all duration-300 ${
                                    !isLogin && checkPasswordStrength(formData.password).isValid
                                        ? '!border-2 !border-emerald-500 !bg-emerald-50/25 ring-2 ring-emerald-500/20'
                                        : isStudentModeActive ? 'light-input-field-student' : ''
                                }`}>
                                    <Lock className={`absolute left-3 w-4 h-4 ${!isLogin && checkPasswordStrength(formData.password).isValid ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        placeholder={!isLogin ? "Mín. 8 caracteres, mayúscula, núm y símbolo" : "••••••••"}
                                        className="w-full py-2 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                        style={{ paddingLeft: '2.5rem', paddingRight: '4.5rem' }}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                    />
                                    <div className="absolute right-3 flex items-center gap-1.5">
                                        {!isLogin && checkPasswordStrength(formData.password).isValid && (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5"
                                            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                                {!isLogin && formData.password.length > 0 && (
                                    <PasswordStrengthChecker password={formData.password} />
                                )}
                            </div>

                            {isLogin && (
                                <div className="flex items-center justify-end px-1 pt-0.5 text-xs">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setForgotEmail(formData.email);
                                            setShowForgotPasswordModal(true);
                                            setForgotStep(1);
                                            setForgotOtpCode('');
                                            setForgotNewPassword('');
                                            setForgotConfirmPassword('');
                                            setForgotError(null);
                                            setForgotMessage(null);
                                            setDevCodeNotice(null);
                                            setResendCooldown(0);
                                        }} 
                                        className="text-blue-600 hover:text-blue-800 transition-colors font-bold cursor-pointer hover:underline text-[11px]"
                                    >
                                        ¿Olvidaste tu clave?
                                    </button>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className={`w-full font-black py-2.5 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 mt-2 cursor-pointer text-xs uppercase tracking-wider ${
                                    isStudentModeActive
                                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-600/25'
                                        : 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-600/25'
                                } disabled:opacity-50 disabled:pointer-events-none`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        {isLogin 
                                            ? isStudentModeActive ? 'Entrar como Estudiante' : 'Entrar al Sistema' 
                                            : isStudentModeActive ? 'Registrarse como Estudiante' : 'Crear Cuenta Profesional'
                                        }
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Avisos Legales y Derechos */}
                    <div className="mt-2 text-center space-y-0.5">
                        <p className="text-slate-400 text-[10px] font-medium">
                            Al ingresar aceptas nuestros{' '}
                            <button type="button" onClick={() => setShowLoginLegal('terms')} className="text-slate-600 hover:text-blue-600 underline font-semibold cursor-pointer transition-colors">Términos</button>{' '}y{' '}
                            <button type="button" onClick={() => setShowLoginLegal('privacy')} className="text-slate-600 hover:text-blue-600 underline font-semibold cursor-pointer transition-colors">Privacidad</button>.
                        </p>
                        <p className="text-slate-300 text-[9.5px] tracking-wider notranslate" translate="no">
                            &copy; 2026 Angelo Thomas Serna Simeon. SOFTCONTABLE SaaS.
                        </p>
                    </div>
                </div>

                {/* LADO DERECHO: Hero Showcase — Pegado directamente al panel blanco sin brechas y 100% visible */}
                <div className="hidden lg:flex flex-1 relative bg-[#040e1d] items-center justify-center p-0 overflow-hidden">
                    <img 
                        src="/assets/login-hero.png" 
                        alt="Softcontable 2026 - Sistema Contable en la Nube" 
                        className="w-full h-full object-contain select-none animate-fade-in" 
                    />
                </div>
            </div>

            {/* MODAL RECUPERACIÓN DE CONTRASEÑA EN 3 PASOS CON CÓDIGO OTP POR GMAIL */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl relative animate-scale-up text-slate-800">
                        <button
                            onClick={() => setShowForgotPasswordModal(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
                                <KeyRound size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Seguridad &amp; Clave</h3>
                                <p className="text-xs text-slate-500 font-medium">Verificación por Código OTP vía Gmail</p>
                            </div>
                        </div>

                        {/* Stepper Visual */}
                        <div className="flex items-center justify-between mb-5 px-2">
                            <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${forgotStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
                                <span>Correo</span>
                            </div>
                            <div className={`h-0.5 flex-1 mx-2 ${forgotStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${forgotStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
                                <span>Código OTP</span>
                            </div>
                            <div className={`h-0.5 flex-1 mx-2 ${forgotStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${forgotStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
                                <span>Nueva Clave</span>
                            </div>
                        </div>

                        {forgotError && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
                                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                <span>{forgotError}</span>
                            </div>
                        )}

                        {forgotMessage && (
                            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">{forgotMessage}</div>
                            </div>
                        )}

                        {devCodeNotice && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 text-xs p-3 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-[11px]">🔑 Código OTP (Modo Pruebas Dev):</div>
                                    <div className="text-sm font-mono font-black text-blue-700 tracking-widest">{devCodeNotice}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForgotOtpCode(devCodeNotice)}
                                    className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-blue-700 cursor-pointer"
                                >
                                    Auto-completar
                                </button>
                            </div>
                        )}

                        {/* PASO 1: Ingreso de correo registrado */}
                        {forgotStep === 1 && (
                            <form onSubmit={handleForgotRequestOtp} className="space-y-4">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Por motivos de seguridad, te enviaremos un <strong>código OTP de 6 dígitos</strong> a tu correo de Gmail para confirmar tu identidad.
                                </p>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Correo Registrado</label>
                                    <div className="relative flex items-center rounded-xl light-input-field">
                                        <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="usuario@empresa.com"
                                            className="w-full py-2.5 pr-4 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading || resendCooldown > 0}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                        <>
                                            <Send size={14} />
                                            <span>Enviar Código a Gmail</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* PASO 2: Ingreso y verificación de Código OTP con contador regresivo de reenvío */}
                        {forgotStep === 2 && (
                            <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Enviamos un correo a <strong className="text-blue-700">{forgotEmail}</strong>. Ingresa el código OTP de 6 dígitos para continuar.
                                </p>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Código de Verificación OTP</label>
                                        <span className="text-[10px] text-slate-400 font-semibold">Vence en 15 min</span>
                                    </div>
                                    <div className="relative flex items-center rounded-xl light-input-field">
                                        <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            placeholder="123456"
                                            className="w-full py-2.5 pr-4 bg-transparent placeholder:text-slate-400 text-sm font-mono font-bold tracking-widest text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotOtpCode}
                                            onChange={e => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading || forgotOtpCode.length < 6}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar Código OTP'}
                                </button>
                                <div className="flex justify-between items-center pt-1 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotStep(1);
                                            setResendCooldown(0);
                                        }}
                                        className="text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                                    >
                                        Cambiar correo
                                    </button>
                                    <button
                                        type="button"
                                        disabled={resendCooldown > 0 || forgotLoading}
                                        onClick={handleForgotRequestOtp}
                                        className={`font-bold flex items-center gap-1 transition-all ${
                                            resendCooldown > 0 || forgotLoading
                                                ? 'text-slate-400 cursor-not-allowed opacity-70'
                                                : 'text-blue-600 hover:text-blue-800 cursor-pointer'
                                        }`}
                                    >
                                        <RefreshCw size={11} className={forgotLoading ? 'animate-spin' : ''} />
                                        <span>
                                            {resendCooldown > 0
                                                ? `Reenviar en ${resendCooldown}s`
                                                : 'Reenviar código'
                                            }
                                        </span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* PASO 3: Ingreso de Nueva Contraseña */}
                        {forgotStep === 3 && (
                            <form onSubmit={handleForgotResetPassword} className="space-y-4">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Identidad verificada para <strong className="text-blue-700">{forgotEmail}</strong>. Crea tu nueva contraseña de acceso.
                                </p>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nueva Contraseña</label>
                                        {checkPasswordStrength(forgotNewPassword).isValid && (
                                            <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Segura
                                            </span>
                                        )}
                                    </div>
                                    <div className={`relative flex items-center rounded-xl light-input-field transition-all duration-300 ${
                                        checkPasswordStrength(forgotNewPassword).isValid
                                            ? '!border-2 !border-emerald-500 !bg-emerald-50/25 ring-2 ring-emerald-500/20'
                                            : ''
                                    }`}>
                                        <Lock className={`absolute left-3.5 w-4 h-4 ${checkPasswordStrength(forgotNewPassword).isValid ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        <input
                                            type="password"
                                            required
                                            placeholder="Mín. 8 caracteres, mayúscula, núm y símbolo"
                                            className="w-full py-2.5 pr-10 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                        />
                                        {checkPasswordStrength(forgotNewPassword).isValid && (
                                            <CheckCircle2 size={16} className="absolute right-3 text-emerald-500" />
                                        )}
                                    </div>
                                    <PasswordStrengthChecker password={forgotNewPassword} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Confirmar Nueva Contraseña</label>
                                        {forgotConfirmPassword.length > 0 && forgotConfirmPassword === forgotNewPassword && (
                                            <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Coincide
                                            </span>
                                        )}
                                    </div>
                                    <div className={`relative flex items-center rounded-xl light-input-field transition-all duration-300 ${
                                        forgotConfirmPassword.length > 0 && forgotConfirmPassword === forgotNewPassword
                                            ? '!border-2 !border-emerald-500 !bg-emerald-50/25 ring-2 ring-emerald-500/20'
                                            : ''
                                    }`}>
                                        <Lock className={`absolute left-3.5 w-4 h-4 ${forgotConfirmPassword.length > 0 && forgotConfirmPassword === forgotNewPassword ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        <input
                                            type="password"
                                            required
                                            placeholder="Repite la nueva contraseña"
                                            className="w-full py-2.5 pr-10 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotConfirmPassword}
                                            onChange={e => setForgotConfirmPassword(e.target.value)}
                                        />
                                        {forgotConfirmPassword.length > 0 && forgotConfirmPassword === forgotNewPassword && (
                                            <CheckCircle2 size={16} className="absolute right-3 text-emerald-500" />
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading || !checkPasswordStrength(forgotNewPassword).isValid || forgotNewPassword !== forgotConfirmPassword}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Nueva Contraseña'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Legal */}
            {showLoginLegal && (
                <LegalPages initialSection={showLoginLegal} onClose={() => setShowLoginLegal(null)} />
            )}

            {/* Banner de Cookies */}
            <CookieBanner onOpenLegalCookies={() => setShowLoginLegal('cookies')} />
        </div>
    );
};
