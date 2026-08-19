import React, { useState, useEffect, useRef } from 'react';
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
    RefreshCw,
    Phone
} from 'lucide-react';

import toast from 'react-hot-toast';
import { LegalPages } from './LegalPages';
import { CookieBanner } from './CookieBanner';
import { PasswordStrengthChecker, checkPasswordStrength } from './ui/PasswordStrengthChecker';
import { TermsModal } from './TermsModal';
import { EmailVerificationModal } from './EmailVerificationModal';

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
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorAlert, setErrorAlert] = useState<string | null>(null);

    // Estado independiente para Iniciar Sesión
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Estado independiente para Crear Cuenta
    const [registerName, setRegisterName] = useState('');
    const [registerPhone, setRegisterPhone] = useState('');
    const [registerDocumentNumber, setRegisterDocumentNumber] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

    const [showTermsModal, setShowTermsModal] = useState(false);
    const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');

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

    // Estado Autenticación con Google
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    // Manejar Respuesta de Autenticación de Google (ID Token o Access Token)
    const handleGoogleAuthResponse = async ({ credential, accessToken }: { credential?: string; accessToken?: string }) => {
        setIsGoogleLoading(true);
        setErrorAlert(null);
        try {
            const requestedMode = isStudentModeActive ? 'estudiante' : 'profesional';
            const res = await webApiBridge.authGoogleLogin({
                credential,
                accessToken,
                mode: requestedMode
            });

            if (res.success) {
                localStorage.setItem('softcontable_token', res.token || res.accessToken);
                if (res.refreshToken) {
                    localStorage.setItem('softcontable_refresh_token', res.refreshToken);
                }
                if (res.user) {
                    localStorage.setItem('softcontable_user', JSON.stringify(res.user));
                }
                toast.success(res.message || '¡Inicio de sesión con Google exitoso!');
                setTimeout(() => {
                    window.location.reload();
                }, 300);
            } else {
                const errMsg = res.error || 'Error al iniciar sesión con Google';
                setErrorAlert(errMsg);
                toast.error(errMsg);
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Error de conexión con el servidor de autenticación';
            setErrorAlert(errMsg);
            toast.error(errMsg);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // Disparador Oficial y Directo de Google OAuth 2.0 (Evita iframe en blanco)
    const handleTriggerGoogleLogin = () => {
        setIsGoogleLoading(true);
        setErrorAlert(null);

        const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '686232326828-5icr0f5eghni2ouvscnging0671v0duf.apps.googleusercontent.com';

        try {
            // Método Primario Oficial: Google OAuth2 Token Client (Ventana Popup Nativa)
            if ((window as any).google?.accounts?.oauth2) {
                const client = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: 'email profile openid',
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            await handleGoogleAuthResponse({ accessToken: tokenResponse.access_token });
                        } else if (tokenResponse?.error) {
                            console.warn('[GOOGLE OAUTH ERROR]', tokenResponse.error);
                            setIsGoogleLoading(false);
                            if (tokenResponse.error !== 'popup_closed_by_user') {
                                toast.error('No se completó el acceso con Google.');
                            }
                        } else {
                            setIsGoogleLoading(false);
                        }
                    },
                    error_callback: (err: any) => {
                        console.error('[GOOGLE POPUP ERROR]', err);
                        setIsGoogleLoading(false);
                    }
                });

                client.requestAccessToken({ prompt: 'select_account' });
                return;
            }

            // Método Secundario Fallback: Google Identity Services ID Prompt
            if ((window as any).google?.accounts?.id) {
                (window as any).google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response: any) => {
                        if (response.credential) {
                            handleGoogleAuthResponse({ credential: response.credential });
                        } else {
                            setIsGoogleLoading(false);
                        }
                    },
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });
                (window as any).google.accounts.id.prompt((notification: any) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        setIsGoogleLoading(false);
                    }
                });
                return;
            }

            setIsGoogleLoading(false);
            toast.error('El servicio de Google aún está cargando. Por favor espera un momento.');
        } catch (e: any) {
            console.error('[GOOGLE TRIGGER EXCEPTION]', e);
            setIsGoogleLoading(false);
            toast.error('Error al abrir la ventana de Google.');
        }
    };

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

    const executeProfessionalRegister = async () => {
        setIsLoading(true);
        setErrorAlert(null);
        try {
            const res = await webApiBridge.authRegister({
                name: registerName,
                email: registerEmail,
                password: registerPassword,
                phone: registerPhone,
                documentNumber: registerDocumentNumber,
                termsAccepted: true
            });

            if (res.success) {
                setRegisterPassword('');
                setRegisterConfirmPassword('');
                if (res.requireVerification) {
                    setVerificationEmail(registerEmail);
                    setShowEmailVerificationModal(true);
                    toast.success(res.message || '¡Cuenta creada! Revisa tu correo electrónico.');
                } else if (res.token) {
                    localStorage.setItem('softcontable_token', res.token);
                    if (res.user) {
                        localStorage.setItem('softcontable_user', JSON.stringify(res.user));
                    }
                    toast.success('¡Registro exitoso!');
                    window.location.reload();
                } else {
                    toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
                    setLoginEmail(registerEmail);
                    setLoginPassword('');
                    setIsLogin(true);
                }
            } else {
                const errMsg = res.error || 'Error al registrarse';
                setErrorAlert(errMsg);
                toast.error(errMsg);
            }
        } catch (error: any) {
            const resData = error.response?.data;
            if (resData?.requireVerification) {
                setRegisterPassword('');
                setRegisterConfirmPassword('');
                setVerificationEmail(resData.email || registerEmail);
                setShowEmailVerificationModal(true);
                toast.success(resData.message || 'Hemos enviado tu código de activación a tu correo.');
            } else {
                const errMsg = resData?.error || resData?.message || 'Error de conexión con el servidor';
                setErrorAlert(errMsg);
                toast.error(errMsg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorAlert(null);

        const requestedMode = isStudentModeActive ? 'estudiante' : 'profesional';

        if (isLogin) {
            setIsLoading(true);
            try {
                const res = await webApiBridge.authLogin({
                    email: loginEmail,
                    password: loginPassword,
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
            } catch (error: any) {
                const resData = error.response?.data;
                if (resData?.requireVerification) {
                    setVerificationEmail(resData.email || loginEmail);
                    setShowEmailVerificationModal(true);
                    toast.error(resData.error || 'Por favor verifica tu correo electrónico.');
                } else {
                    const errMsg = resData?.error || resData?.message || 'Error de conexión con el servidor';
                    setErrorAlert(errMsg);
                    toast.error(errMsg);
                }
            } finally {
                setIsLoading(false);
            }
        } else {
            // Validaciones de Registro
            const strength = checkPasswordStrength(registerPassword);
            if (!strength.isValid) {
                const msg = 'La contraseña debe tener al menos 8 caracteres y combinar mayúsculas, minúsculas, números y símbolos (!@#$%...).';
                setErrorAlert(msg);
                toast.error(msg);
                return;
            }

            if (!isStudentModeActive && registerPassword !== registerConfirmPassword) {
                const msg = 'Las contraseñas no coinciden. Por favor verifícalas.';
                setErrorAlert(msg);
                toast.error(msg);
                return;
            }

            if (!isStudentModeActive && registerPhone.trim().length > 0 && registerPhone.trim().length < 9) {
                const msg = 'El teléfono debe tener 9 dígitos (+51).';
                setErrorAlert(msg);
                toast.error(msg);
                return;
            }

            // Si es estudiante, registrar de inmediato
            if (isStudentModeActive) {
                setIsLoading(true);
                try {
                    const res = await webApiBridge.authRegisterStudent({
                        name: registerName,
                        email: registerEmail,
                        password: registerPassword
                    });
                    if (res.success) {
                        setRegisterPassword('');
                        setRegisterConfirmPassword('');
                        if (res.token) {
                            localStorage.setItem('softcontable_token', res.token);
                            if (res.user) {
                                localStorage.setItem('softcontable_user', JSON.stringify(res.user));
                            }
                            toast.success('🎓 ¡Registro de estudiante exitoso! Iniciando sesión...');
                            setTimeout(() => {
                                window.location.reload();
                            }, 800);
                        } else {
                            toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
                            setLoginEmail(registerEmail);
                            setLoginPassword('');
                            setIsLogin(true);
                        }
                    } else {
                        const errMsg = res.error || 'Error al registrarse';
                        setErrorAlert(errMsg);
                        toast.error(errMsg);
                    }
                } catch (error: any) {
                    const errMsg = error.response?.data?.error || error.response?.data?.message || 'Error al registrarse';
                    setErrorAlert(errMsg);
                    toast.error(errMsg);
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Modo Profesional: Abrir Modal de Términos y Condiciones (Ley N° 29733)
                setShowTermsModal(true);
            }
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
                setLoginEmail(forgotEmail);
                setLoginPassword('');
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
        <div className="min-h-screen w-full bg-gradient-to-br from-[#0d2238] via-[#122b47] to-[#091829] flex items-center justify-center p-3 sm:p-4 lg:p-6 font-sans selection:bg-blue-600/20 selection:text-blue-900 relative overflow-y-auto no-scrollbar">
            <style>{customStyles}{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                    width: 0px;
                    background: transparent;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }

                .login-scroll::-webkit-scrollbar { width: 4px; }
                .login-scroll::-webkit-scrollbar-track { background: transparent; }
                .login-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 10px; }
                .login-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }

                @keyframes driftLR1 {
                    0% { transform: translateX(-320px); }
                    100% { transform: translateX(calc(100vw + 320px)); }
                }
                @keyframes driftLR2 {
                    0% { transform: translateX(-420px); }
                    100% { transform: translateX(calc(100vw + 420px)); }
                }
                @keyframes driftLR3 {
                    0% { transform: translateX(-250px); }
                    100% { transform: translateX(calc(100vw + 250px)); }
                }
                @keyframes driftLR4 {
                    0% { transform: translateX(-350px); }
                    100% { transform: translateX(calc(100vw + 350px)); }
                }
                @keyframes driftLR5 {
                    0% { transform: translateX(-280px); }
                    100% { transform: translateX(calc(100vw + 280px)); }
                }

                @keyframes driftRL1 {
                    0% { transform: translateX(calc(100vw + 350px)); }
                    100% { transform: translateX(-350px); }
                }
                @keyframes driftRL2 {
                    0% { transform: translateX(calc(100vw + 270px)); }
                    100% { transform: translateX(-270px); }
                }
                @keyframes driftRL3 {
                    0% { transform: translateX(calc(100vw + 320px)); }
                    100% { transform: translateX(-320px); }
                }
                @keyframes driftRL4 {
                    0% { transform: translateX(calc(100vw + 380px)); }
                    100% { transform: translateX(-380px); }
                }
                @keyframes driftRL5 {
                    0% { transform: translateX(calc(100vw + 290px)); }
                    100% { transform: translateX(-290px); }
                }

                .cloud-drift-lr-1 { animation: driftLR1 44s linear infinite; }
                .cloud-drift-lr-2 { animation: driftLR2 64s linear infinite -18s; }
                .cloud-drift-lr-3 { animation: driftLR3 36s linear infinite -10s; }
                .cloud-drift-lr-4 { animation: driftLR4 52s linear infinite -30s; }
                .cloud-drift-lr-5 { animation: driftLR5 48s linear infinite -22s; }

                .cloud-drift-rl-1 { animation: driftRL1 50s linear infinite -6s; }
                .cloud-drift-rl-2 { animation: driftRL2 38s linear infinite -20s; }
                .cloud-drift-rl-3 { animation: driftRL3 58s linear infinite -34s; }
                .cloud-drift-rl-4 { animation: driftRL4 66s linear infinite -12s; }
                .cloud-drift-rl-5 { animation: driftRL5 42s linear infinite -26s; }
            `}</style>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* NUBES EN MOVIMIENTO (Arriba, Centro y Abajo del Panel)         */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                {/* ── NUBES SUPERIORES (Arriba del panel) ── */}
                <div className="absolute -top-[3%] cloud-drift-lr-1 opacity-30 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[260px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[2%] cloud-drift-rl-1 opacity-25 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[320px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[8%] cloud-drift-lr-4 opacity-30 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[220px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[13%] cloud-drift-rl-4 opacity-25 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[280px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>

                {/* ── NUBES CENTRALES (Detrás del panel en vidrio) ── */}
                <div className="absolute top-[32%] cloud-drift-lr-3 opacity-20 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[200px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[48%] cloud-drift-rl-2 opacity-20 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[340px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[62%] cloud-drift-lr-5 opacity-25 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[240px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>

                {/* ── NUBES INFERIORES (Abajo del panel) ── */}
                <div className="absolute top-[78%] cloud-drift-rl-3 opacity-30 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[290px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[85%] cloud-drift-lr-2 opacity-25 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[360px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute top-[92%] cloud-drift-rl-5 opacity-35 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[230px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
                <div className="absolute -bottom-[2%] cloud-drift-lr-1 opacity-30 select-none">
                    <img src="/assets/nube.png" alt="Nube" className="w-[310px] h-auto object-contain pointer-events-none drop-shadow-sm" />
                </div>
            </div>

            {/* Efectos de Iluminación Ambiental Suave en Azul Marino */}
            <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TARJETA MAESTRA UNIFICADA (Lienzo Continuo & Cero Scrollbars)   */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="relative z-10 w-full max-w-[480px] lg:max-w-[940px] xl:max-w-[1000px] h-auto lg:h-[92vh] lg:max-h-[640px] xl:max-h-[660px] bg-white rounded-[28px] lg:rounded-[36px] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.7)_inset] border border-white/60 overflow-hidden flex flex-col lg:flex-row items-stretch my-auto animate-fade-in">
                
                {/* LADO IZQUIERDO: Formulario de Autenticación */}
                <div className="w-full lg:w-[410px] xl:w-[440px] bg-white px-5 py-3 sm:px-6 sm:py-3.5 flex flex-col justify-between overflow-y-auto no-scrollbar shrink-0">
                    
                    {/* Header Marca */}
                    <div className="text-center mb-0.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200/90 border border-slate-200/90 shadow-sm flex items-center justify-center mx-auto mb-1">
                            <img src="/assets/logo.png" alt="Softcontable" className="w-7 h-7 object-contain drop-shadow-sm" />
                        </div>
                        <h1 className="text-base font-black tracking-widest text-[#1e3a8a] uppercase flex items-center justify-center gap-2 notranslate" translate="no">
                            SOFT CONTABLE
                        </h1>
                        <p className="text-slate-400 text-[9px] font-bold tracking-[0.22em] uppercase text-center notranslate" translate="no">
                            SISTEMA CONTABLE EN LA NUBE V2.0
                        </p>
                    </div>

                    {/* Contenedor del Formulario */}
                    <div className="flex-1 flex flex-col justify-center py-0">
                        
                        {/* Selector de Modo: Profesional vs Estudiante */}
                        <div className="my-1 bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/70 flex items-center gap-1 select-none">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer outline-none ${
                                    !isStudentModeActive 
                                        ? 'bg-[#1d4ed8] text-white shadow-md shadow-blue-600/30' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Building2 size={13} className={!isStudentModeActive ? 'text-white' : 'text-slate-400'} />
                                <span>Profesional</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer outline-none ${
                                    isStudentModeActive 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <GraduationCap size={14} className={isStudentModeActive ? 'text-white' : 'text-slate-400'} />
                                <span>Estudiante</span>
                            </button>
                        </div>

                        {/* Banner informativo del modo */}
                        <div className={`mb-1 p-1.5 rounded-xl border text-[10px] sm:text-[10.5px] font-medium flex items-center gap-2 ${
                            isStudentModeActive
                                ? 'bg-indigo-50/90 border-indigo-200/80 text-indigo-900'
                                : 'bg-[#f0f6ff] border-[#dbeafe] text-[#1e40af]'
                        }`}>
                            {isStudentModeActive ? (
                                <>
                                    <GraduationCap size={13} className="shrink-0 text-indigo-600" />
                                    <span className="leading-tight">Entorno educativo para aprendizaje sin riesgo SUNAT.</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={14} className="shrink-0 text-blue-600" />
                                    <span className="leading-tight">Acceso al sistema contable oficial y empresas.</span>
                                </>
                            )}
                        </div>

                        {/* Tabs: Iniciar Sesión / Registrarse */}
                        <div className="flex mb-1.5 border-b border-slate-200/80 pb-0.5">
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsLogin(true);
                                    setErrorAlert(null);
                                    setLoginPassword('');
                                }}
                                className={`flex-1 py-1 text-center text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    isLogin 
                                        ? 'text-[#1d4ed8] border-b-2 border-[#1d4ed8] -mb-[2px]' 
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
                                    setRegisterPassword('');
                                    setRegisterConfirmPassword('');
                                }}
                                className={`flex-1 py-1 text-center text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    !isLogin 
                                        ? 'text-[#1d4ed8] border-b-2 border-[#1d4ed8] -mb-[2px]' 
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                Crear Cuenta
                            </button>
                        </div>

                        {/* Botón Autenticación con Google (Estilo Moderno Imagen 2) */}
                        <div className="mb-1.5 space-y-1.5">
                            <button
                                type="button"
                                onClick={handleTriggerGoogleLogin}
                                disabled={isGoogleLoading || isLoading}
                                className="w-full py-2 px-3 rounded-xl border border-slate-300/90 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2.5 transition-all duration-200 shadow-xs hover:shadow hover:border-slate-400 cursor-pointer select-none active:scale-[0.99] disabled:opacity-50"
                            >
                                {isGoogleLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                ) : (
                                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                )}
                                <span>{isGoogleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
                            </button>

                            {/* Divisor Visual "o" */}
                            <div className="relative flex items-center justify-center my-1">
                                <div className="border-t border-slate-200/90 w-full"></div>
                                <span className="bg-white px-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                                    o con correo
                                </span>
                                <div className="border-t border-slate-200/90 w-full"></div>
                            </div>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-1.5" autoComplete="on">
                            {errorAlert && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs py-1.5 px-2 rounded-xl flex items-start gap-1.5 animate-in fade-in duration-200">
                                    <span className="text-rose-600 mt-0.5 text-xs shrink-0">⚠️</span>
                                    <div className="flex-1 font-medium leading-tight text-[11px]">{errorAlert}</div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">Nombre Completo</label>
                                    <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                        <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                        <input 
                                            type="text"
                                            id="register_name"
                                            name="register_name"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-medium"
                                            value={registerName}
                                            onChange={e => setRegisterName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {!isLogin && !isStudentModeActive && (
                                <>
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">Teléfono / WhatsApp (+51)</label>
                                        <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                            <Phone className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                            <input 
                                                type="tel"
                                                id="register_phone"
                                                name="register_phone"
                                                required
                                                maxLength={9}
                                                inputMode="numeric"
                                                autoComplete="tel"
                                                placeholder="923 887 478"
                                                className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-mono"
                                                value={registerPhone}
                                                onChange={e => setRegisterPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">RUC Estudio o DNI <span className="text-[8.5px] text-slate-400 font-normal">(Opcional)</span></label>
                                        <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                            <Building2 className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                            <input 
                                                type="text"
                                                id="register_document"
                                                name="register_document"
                                                maxLength={11}
                                                inputMode="numeric"
                                                autoComplete="off"
                                                placeholder="2060... o DNI"
                                                className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-mono"
                                                value={registerDocumentNumber}
                                                onChange={e => setRegisterDocumentNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Campo Correo Electrónico */}
                            <div className="space-y-0.5">
                                <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">Correo Electrónico</label>
                                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                    <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                    <input 
                                        type="email"
                                        id={isLogin ? "login_email" : "register_email"}
                                        name={isLogin ? "login_email" : "register_email"}
                                        required
                                        autoComplete="email"
                                        placeholder={isStudentModeActive ? "estudiante@universidad.edu.pe" : "usuario@empresa.com"}
                                        className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-medium"
                                        value={isLogin ? loginEmail : registerEmail}
                                        onChange={e => isLogin ? setLoginEmail(e.target.value) : setRegisterEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Campo Contraseña */}
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">Contraseña</label>
                                    {!isLogin && checkPasswordStrength(registerPassword).isValid && (
                                        <span className="text-[8.5px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Segura
                                        </span>
                                    )}
                                </div>
                                <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                    <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        id={isLogin ? "login_password" : "register_password"}
                                        name={isLogin ? "login_password" : "register_password"}
                                        required
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        placeholder={!isLogin ? "Mín. 8 caracteres, mayúscula, núm y símbolo" : "••••••••"}
                                        className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-medium pr-7"
                                        value={isLogin ? loginPassword : registerPassword}
                                        onChange={e => isLogin ? setLoginPassword(e.target.value) : setRegisterPassword(e.target.value)}
                                    />
                                    <div className="absolute right-2.5 flex items-center gap-1">
                                        {!isLogin && checkPasswordStrength(registerPassword).isValid && (
                                            <CheckCircle2 size={14} className="text-emerald-500" />
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5"
                                            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        >
                                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                {!isLogin && registerPassword.length > 0 && (
                                    <PasswordStrengthChecker password={registerPassword} />
                                )}
                            </div>

                            {!isLogin && !isStudentModeActive && (
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-600 ml-1 uppercase tracking-wider block">Confirmar Contraseña</label>
                                        {registerConfirmPassword.length > 0 && registerConfirmPassword === registerPassword && (
                                            <span className="text-[8.5px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 size={11} /> Coincide
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative flex items-center rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all px-3 py-2 shadow-xs">
                                        <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"}
                                            id="register_confirm_password"
                                            name="register_confirm_password"
                                            required
                                            autoComplete="new-password"
                                            placeholder="Repite la contraseña"
                                            className="w-full bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none font-medium pr-7"
                                            value={registerConfirmPassword}
                                            onChange={e => setRegisterConfirmPassword(e.target.value)}
                                        />
                                        <div className="absolute right-2.5 flex items-center gap-1">
                                            {registerConfirmPassword.length > 0 && registerConfirmPassword === registerPassword && (
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                            )}
                                            <button 
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5"
                                            >
                                                {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLogin && (
                                <div className="flex items-center justify-end px-1">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setForgotEmail(loginEmail);
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
                                        className="text-[#1d4ed8] hover:underline transition-colors font-bold cursor-pointer text-[11px]"
                                    >
                                        ¿Olvidaste tu clave?
                                    </button>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className={`w-full font-black py-2 rounded-xl shadow-md shadow-blue-600/25 transition-all duration-200 flex items-center justify-center gap-2 mt-1.5 cursor-pointer text-xs uppercase tracking-wider ${
                                    isStudentModeActive
                                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-600/25'
                                        : 'bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] hover:from-[#1e40af] hover:to-[#2563eb] text-white'
                                } active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none`}
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
                    <div className="mt-1.5 text-center space-y-0.5">
                        <p className="text-slate-400 text-[9.5px] font-medium">
                            Al ingresar aceptas nuestros{' '}
                            <button type="button" onClick={() => setShowLoginLegal('terms')} className="text-slate-600 hover:text-blue-600 underline font-semibold cursor-pointer transition-colors">Términos</button>{' '}y{' '}
                            <button type="button" onClick={() => setShowLoginLegal('privacy')} className="text-slate-600 hover:text-blue-600 underline font-semibold cursor-pointer transition-colors">Privacidad</button>.
                        </p>
                        <p className="text-slate-400 text-[9px] tracking-wider notranslate" translate="no">
                            &copy; 2026 Angelo Thomas Serna Simeon. SOFTCONTABLE SaaS.
                        </p>
                    </div>
                </div>

                {/* LADO DERECHO: Hero Showcase — Integración Total sin recortes (Estilo Imagen 2) */}
                <div className="hidden lg:flex flex-1 bg-white items-center justify-center p-1 xl:p-2 overflow-hidden relative h-full">
                    <img 
                        src="/assets/login-hero.png" 
                        alt="Softcontable 2026 - Sistema Contable en la Nube" 
                        className="w-full h-full object-contain object-center select-none pointer-events-none animate-fade-in" 
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

            {/* Modal de Términos y Condiciones Legales (Estilo Flow - Ley N° 29733) */}
            <TermsModal
                isOpen={showTermsModal}
                onClose={() => setShowTermsModal(false)}
                onOpenLegal={(section) => setShowLoginLegal(section)}
                onAccept={() => {
                    setShowTermsModal(false);
                    executeProfessionalRegister();
                }}
            />

            {/* Modal de Verificación de Email (OTP 6 dígitos + reenvío) */}
            <EmailVerificationModal
                isOpen={showEmailVerificationModal}
                email={verificationEmail}
                onClose={() => setShowEmailVerificationModal(false)}
                onVerificationSuccess={(data) => {
                    setShowEmailVerificationModal(false);
                    window.location.reload();
                }}
            />

            {/* Modal Legal */}
            {showLoginLegal && (
                <LegalPages initialSection={showLoginLegal} onClose={() => setShowLoginLegal(null)} />
            )}

            {/* Banner de Cookies */}
            <CookieBanner onOpenLegalCookies={() => setShowLoginLegal('cookies')} />
        </div>
    );
};
