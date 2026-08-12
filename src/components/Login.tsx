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
    AlertCircle
} from 'lucide-react';

import toast from 'react-hot-toast';
import { LegalPages } from './LegalPages';

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

const showcaseViews = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        icon: Layers,
        activeColor: 'text-blue-600',
        badge: 'Resumen Gerencial',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-white border border-blue-200/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[8.5px] text-blue-700 font-extrabold uppercase tracking-wider block mb-0.5">Ventas del Mes</span>
                        <span className="text-sm lg:text-base font-black text-slate-900">S/ 83,536.61</span>
                        <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">+14.2% vs mes ant.</span>
                    </div>
                    <div className="bg-white border border-emerald-200/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[8.5px] text-emerald-700 font-extrabold uppercase tracking-wider block mb-0.5">Compras del Mes</span>
                        <span className="text-sm lg:text-base font-black text-slate-900">S/ 312.92</span>
                        <span className="text-[9px] text-slate-500 font-bold block mt-0.5">2 comprobantes</span>
                    </div>
                    <div className="bg-white border border-purple-200/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[8.5px] text-purple-700 font-extrabold uppercase tracking-wider block mb-0.5">IGV Estimado</span>
                        <span className="text-sm lg:text-base font-black text-slate-900">S/ 12,697.10</span>
                        <span className="text-[9px] text-indigo-600 font-bold block mt-0.5">Régimen RMT / RG</span>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-2.5 flex-1">
                    <div className="col-span-8 bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <span className="text-[9.5px] text-slate-800 font-extrabold uppercase tracking-wider block mb-1">Flujo de Caja Anual (2026)</span>
                        <div className="flex items-end justify-between h-28 pt-1 px-1">
                            {[40, 60, 45, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((h, i) => (
                                <div key={i} className="w-[6.5%] flex flex-col items-center gap-1">
                                    <div className="w-full bg-gradient-to-t from-slate-200 to-blue-600/90 rounded-t transition-all duration-500" style={{ height: `${h}%` }}></div>
                                    <span className="text-[8px] text-slate-500 font-bold">{['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <span className="text-[9.5px] text-slate-800 font-extrabold uppercase tracking-wider block mb-1">Rendimiento</span>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-600 mb-0.5 font-medium">
                                    <span>Margen Bruto</span>
                                    <span className="text-slate-900 font-black">99.6%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '99.6%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-600 mb-0.5 font-medium">
                                    <span>Ejecución Presup.</span>
                                    <span className="text-slate-900 font-black">88.4%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: '88.4%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-500 font-semibold mt-1">
                            Sincronización en tiempo real.
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'sire',
        title: 'SIRE SUNAT 2026',
        icon: ReceiptText,
        activeColor: 'text-indigo-600',
        badge: 'RCE 8.1 & RVIE 14.1',
        content: (
            <div className="space-y-2.5 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider">Integración Directa SIRE SUNAT 2026</span>
                    <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">Sincronizado SOL</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex-1 flex flex-col shadow-xs">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/80">
                                <th className="p-2 text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Módulo SIRE</th>
                                <th className="p-2 text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Comprobantes</th>
                                <th className="p-2 text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Base Imponible</th>
                                <th className="p-2 text-[9px] font-extrabold text-slate-700 uppercase tracking-wider text-right">Estado SUNAT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[9.5px]">
                            <tr className="hover:bg-slate-50">
                                <td className="p-2 font-black text-slate-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> RVIE 14.1 (Ventas)
                                </td>
                                <td className="p-2 text-slate-600 font-mono font-semibold">1 Registros</td>
                                <td className="p-2 text-blue-700 font-black font-mono">S/ 70,793.74</td>
                                <td className="p-2 text-right text-emerald-700 font-black">ACEPTADO (Ticket)</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="p-2 font-black text-slate-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span> RCE 8.1 (Compras)
                                </td>
                                <td className="p-2 text-slate-600 font-mono font-semibold">2 Registros</td>
                                <td className="p-2 text-indigo-700 font-black font-mono">S/ 265.19</td>
                                <td className="p-2 text-right text-emerald-700 font-black">ACEPTADO (Ticket)</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="p-2.5 bg-blue-50/70 border-t border-slate-200 flex items-center justify-between text-[9px]">
                        <span className="text-slate-600 font-semibold">Comparativa SIRE vs Local: Sin discrepancias detectadas.</span>
                        <span className="text-blue-700 font-extrabold">Resumen 100% Ok</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'diario',
        title: 'Libro Diario 5.1',
        icon: FileText,
        activeColor: 'text-emerald-600',
        badge: 'Formato SUNAT 5.1 & 5.2',
        content: (
            <div className="space-y-2.5 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider">Libro Diario General (SUNAT 5.1)</span>
                    <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-black">Folio: 0048</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex-1 flex flex-col shadow-xs">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/90">
                                <th className="p-2 text-[9px] font-black text-slate-700 uppercase tracking-wider">Código</th>
                                <th className="p-2 text-[9px] font-black text-slate-700 uppercase tracking-wider">Cuenta Contable</th>
                                <th className="p-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">Debe (S/)</th>
                                <th className="p-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">Haber (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[9.5px]">
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 font-mono font-black text-emerald-700">10411</td>
                                <td className="p-2 text-slate-900 font-bold">BCP - Moneda Nacional</td>
                                <td className="p-2 text-right text-emerald-700 font-black">11,800.00</td>
                                <td className="p-2 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 font-mono font-black text-blue-700">40111</td>
                                <td className="p-2 text-slate-900 font-bold">IGV - Cuenta Propia</td>
                                <td className="p-2 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2 text-right text-blue-700 font-black">1,800.00</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 font-mono font-black text-blue-700">70121</td>
                                <td className="p-2 text-slate-900 font-bold">Mercaderías - Venta Local</td>
                                <td className="p-2 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2 text-right text-blue-700 font-black">10,000.00</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 font-mono font-black text-emerald-700">60111</td>
                                <td className="p-2 text-slate-900 font-bold">Mercaderías - Compra Local</td>
                                <td className="p-2 text-right text-emerald-700 font-black">5,000.00</td>
                                <td className="p-2 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-2 font-mono font-black text-blue-700">42121</td>
                                <td className="p-2 text-slate-900 font-bold">Facturas por Pagar - Local</td>
                                <td className="p-2 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2 text-right text-blue-700 font-black">5,000.00</td>
                            </tr>
                            <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                                <td className="p-2 text-[9px] text-slate-900 uppercase tracking-wider font-black" colSpan={2}>Suma de Operaciones del Folio</td>
                                <td className="p-2 text-right text-emerald-700 font-black text-[10px]">16,800.00</td>
                                <td className="p-2 text-right text-blue-700 font-black text-[10px]">16,800.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    },
    {
        id: 'planillas',
        title: 'Planillas & PLAME',
        icon: Users,
        activeColor: 'text-amber-700',
        badge: 'Ley 27735 & CTS',
        content: (
            <div className="space-y-2.5 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider">Nómina de Colaboradores &amp; Beneficios Sociales</span>
                    <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-extrabold">PLAME Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 flex-1">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <div>
                            <span className="text-[9px] text-amber-800 font-extrabold uppercase block mb-1">Gratificaciones Ley 27735</span>
                            <span className="text-sm lg:text-base font-black text-slate-900">S/ 3,450.00</span>
                            <p className="text-[8.5px] text-slate-500 mt-1 font-medium leading-tight">Cálculo proyectado Julio/Diciembre con Bonificación Extraordinaria (9%).</p>
                        </div>
                        <span className="text-[9px] text-emerald-700 font-black mt-1">● Cálculo Automatizado</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-xs">
                        <div>
                            <span className="text-[9px] text-blue-700 font-extrabold uppercase block mb-1">CTS D.S. 001-97-TR</span>
                            <span className="text-sm lg:text-base font-black text-slate-900">S/ 1,725.00</span>
                            <p className="text-[8.5px] text-slate-500 mt-1 font-medium leading-tight">Depósito Mayo/Noviembre computable con 1/6 de gratificación.</p>
                        </div>
                        <span className="text-[9px] text-blue-700 font-black mt-1">● Sincronizado PLAME</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'bancos',
        title: 'Tesorería & Bancos',
        icon: Landmark,
        activeColor: 'text-cyan-700',
        badge: 'Auto-Match Bancario',
        content: (
            <div className="space-y-2.5 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider">Conciliación Bancaria Automática</span>
                    <span className="text-[9px] bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-full font-extrabold">BCP / BBVA / Interbank</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 flex-1 flex flex-col justify-between shadow-xs">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9.5px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-800 font-bold font-mono">MOV-2026-0814 • Depósito Cliente</span>
                            <span className="text-emerald-700 font-black font-mono">+S/ 11,800.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[9.5px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-800 font-bold font-mono">MOV-2026-0815 • Pago Proveedor</span>
                            <span className="text-blue-700 font-black font-mono">-S/ 5,000.00</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-600 border-t border-slate-200 pt-2 font-semibold">
                        <span>Conciliado: 100% de Extractos Bancarios</span>
                        <span className="text-cyan-700 font-black">Match Automático OK</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'softpremium',
        title: 'SoftPremium Groq AI',
        icon: Cpu,
        activeColor: 'text-purple-700',
        badge: 'Groq LLaMA-3.3 RAG 4.0',
        content: (
            <div className="space-y-2.5 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider">Auditoría Tributaria Preventiva &amp; RAG AI</span>
                    <span className="text-[9px] bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-extrabold">Riesgo SUNAT: BAJO</span>
                </div>
                <div className="bg-white border border-purple-200/80 rounded-xl p-3 space-y-2 flex-1 flex flex-col justify-between shadow-xs">
                    <div>
                        <span className="text-[9px] text-purple-800 font-extrabold uppercase tracking-wider block mb-1">Dictamen de Inteligencia Normativa 2026</span>
                        <p className="text-[9.5px] text-slate-700 leading-relaxed font-medium">
                            "Tu ratio de compras vs ventas se encuentra en 0.37%, dentro de los márgenes óptimos sustentables. No se detectan inconsistencias bancarias Ley 28194."
                        </p>
                    </div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-500 border-t border-purple-100 pt-2 font-semibold">
                        <span>Motor de Inferencia: Groq LLaMA-3.3 70B</span>
                        <span className="text-purple-800 font-black">IA RAG 4.0 Activo</span>
                    </div>
                </div>
            </div>
        )
    }
];

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

    const [activeSlide, setActiveSlide] = useState(0);
    const [showLoginLegal, setShowLoginLegal] = useState<'terms' | 'privacy' | 'security' | 'confidentiality' | 'cookies' | 'eula' | 'legal' | null>(null);

    // Estado Modal ¿Olvidaste tu clave?
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [forgotMessage, setForgotMessage] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide(prev => (prev + 1) % showcaseViews.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

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

    // Manejo de Recuperación de Contraseña (Paso 1: Verificar correo)
    const handleForgotVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);
        try {
            const res = await webApiBridge.authForgotPassword({ email: forgotEmail });
            if (res.success) {
                setForgotMessage(res.message);
                setForgotStep(2);
            } else {
                setForgotError(res.error || 'Error al verificar la cuenta');
            }
        } catch (err: any) {
            setForgotError(err.response?.data?.error || 'No se encontró la cuenta con este correo.');
        } finally {
            setForgotLoading(false);
        }
    };

    // Manejo de Recuperación de Contraseña (Paso 2: Restablecer clave)
    const handleForgotReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotError(null);
        setForgotMessage(null);
        try {
            const res = await webApiBridge.authForgotPassword({ email: forgotEmail, newPassword: forgotNewPassword });
            if (res.success) {
                toast.success(res.message);
                setShowForgotPasswordModal(false);
                setFormData(prev => ({ ...prev, email: forgotEmail }));
                setIsLogin(true);
            } else {
                setForgotError(res.error || 'Error al actualizar la contraseña');
            }
        } catch (err: any) {
            setForgotError(err.response?.data?.error || 'Error al restablecer la contraseña.');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200/80 text-slate-800 flex items-center justify-center font-sans selection:bg-blue-600/20 selection:text-blue-900 overflow-x-hidden relative p-3 md:p-6">
            <style>{customStyles}</style>

            {/* Layout Principal Contenedor */}
            <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-6 lg:gap-10 relative z-10 my-auto">
                
                {/* COLUMNA IZQUIERDA: Formulario de Login / Registro */}
                <div className="w-full md:w-[420px] shrink-0">
                    
                    {/* Header Marca */}
                    <div className="text-center mb-3">
                        <div className="inline-flex items-center justify-center p-2 bg-white border border-slate-200 rounded-2xl shadow-sm mb-2">
                            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-10 h-10 object-contain" />
                        </div>
                        <h1 className="text-xl lg:text-2xl font-black tracking-wider text-slate-900 uppercase notranslate flex items-center justify-center gap-1.5" translate="no">
                            SOFT<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">CONTABLE</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mt-0.5 notranslate" translate="no">
                            Sistema Contable en la Nube v2.0
                        </p>
                    </div>

                    {/* Tarjeta de Formulario (Modo Claro Sobrio) */}
                    <div className={`p-5 lg:p-6 rounded-3xl transition-all duration-300 ${
                        isStudentModeActive ? 'light-card-student' : 'light-card-pro'
                    }`}>
                        
                        {/* Selector de Modo: Profesional vs Estudiante */}
                        <div className="mb-4 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    !isStudentModeActive 
                                        ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60 font-black' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Building2 size={13} />
                                <span>Profesional</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    isStudentModeActive 
                                        ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200/60 font-black' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <GraduationCap size={14} />
                                <span>Estudiante</span>
                            </button>
                        </div>

                        {/* Banner de contexto informativo del modo activo */}
                        <div className={`mb-4 p-2.5 rounded-xl border text-[10px] font-medium flex items-center gap-2 ${
                            isStudentModeActive
                                ? 'bg-indigo-50 border-indigo-200/80 text-indigo-900'
                                : 'bg-blue-50 border-blue-200/80 text-blue-900'
                        }`}>
                            {isStudentModeActive ? (
                                <>
                                    <GraduationCap size={15} className="shrink-0 text-indigo-600" />
                                    <span>Entorno educativo para aprendizaje contable sin riesgo SUNAT.</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={15} className="shrink-0 text-blue-600" />
                                    <span>Acceso al sistema contable oficial y cartera de empresas.</span>
                                </>
                            )}
                        </div>

                        {/* Tabs de Iniciar Sesión / Registrarse */}
                        <div className="flex mb-4 border-b border-slate-200 pb-1">
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsLogin(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-1.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    isLogin 
                                        ? isStudentModeActive ? 'border-indigo-600 text-indigo-700 font-black' : 'border-blue-600 text-blue-700 font-black' 
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
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
                                className={`flex-1 py-1.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    !isLogin 
                                        ? isStudentModeActive ? 'border-indigo-600 text-indigo-700 font-black' : 'border-blue-600 text-blue-700 font-black' 
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                Crear Cuenta
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="on">
                            {errorAlert && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs py-2.5 px-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
                                    <span className="text-rose-600 mt-0.5 text-sm shrink-0">⚠️</span>
                                    <div className="flex-1 font-medium leading-tight">{errorAlert}</div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-extrabold text-slate-600 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                    <div className={`relative flex items-center rounded-xl light-input-field ${isStudentModeActive ? 'light-input-field-student' : ''}`}>
                                        <User className="absolute left-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full py-2.5 pr-3 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.5rem' }}
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10.5px] font-extrabold text-slate-600 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                                <div className={`relative flex items-center rounded-xl light-input-field ${isStudentModeActive ? 'light-input-field-student' : ''}`}>
                                    <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="email"
                                        required
                                        autoComplete="username"
                                        placeholder={isStudentModeActive ? "estudiante@universidad.edu.pe" : "usuario@empresa.com"}
                                        className="w-full py-2.5 pr-3 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                        style={{ paddingLeft: '2.5rem' }}
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10.5px] font-extrabold text-slate-600 ml-1 uppercase tracking-wider">Contraseña</label>
                                <div className={`relative flex items-center rounded-xl light-input-field ${isStudentModeActive ? 'light-input-field-student' : ''}`}>
                                    <Lock className="absolute left-3 w-4 h-4 text-slate-400" />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        placeholder="••••••••"
                                        className="w-full py-2.5 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {isLogin && (
                                <div className="flex items-center justify-end px-1 pt-0.5 text-xs">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setForgotEmail(formData.email);
                                            setShowForgotPasswordModal(true);
                                            setForgotStep(1);
                                            setForgotError(null);
                                            setForgotMessage(null);
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
                                className={`w-full font-black py-3 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 mt-4 cursor-pointer text-xs uppercase tracking-wider ${
                                    isStudentModeActive
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-600/20'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-600/20'
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
                    <div className="mt-3 text-center space-y-1">
                        <p className="text-slate-500 text-[10px] font-medium">
                            Al ingresar aceptas nuestros{' '}
                            <button type="button" onClick={() => setShowLoginLegal('terms')} className="text-slate-700 hover:text-blue-700 underline font-semibold cursor-pointer">Términos</button>{' '}y{' '}
                            <button type="button" onClick={() => setShowLoginLegal('privacy')} className="text-slate-700 hover:text-blue-700 underline font-semibold cursor-pointer">Privacidad</button>.
                        </p>
                        <p className="text-slate-400 text-[9.5px] tracking-wider notranslate" translate="no">
                            &copy; 2026 Angelo Thomas Serna Simeon. SOFTCONTABLE SaaS.
                        </p>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Carrusel Interactivo de Tablas Dinámicas y Maqueta 3D */}
                <div className="hidden md:flex flex-1 max-w-xl lg:max-w-2xl h-[470px] flex-col justify-center [perspective:1400px]">
                    
                    {/* Contenedor Mockup Sistema (Inclinado 3D Sobrio) */}
                    <div className="w-full h-full bg-white border border-slate-300/80 rounded-3xl overflow-hidden flex flex-col shadow-2xl shadow-slate-300/60 relative transition-all duration-700 ease-out [transform:rotateY(-10deg)_rotateX(5deg)_rotate(-1deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)_rotate(0deg)] hover:shadow-blue-500/10">
                        
                        {/* Ventana Header macOS style */}
                        <div className="h-9 border-b border-slate-200 bg-slate-100/90 flex items-center justify-between px-3.5 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <div className="text-[9.5px] text-slate-600 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={11} className="text-blue-600" />
                                SOFTCONTABLE ERP PREVIEW
                            </div>
                            <div className="text-[9px] bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-blue-700 font-mono font-bold">
                                LIVE DEMO
                            </div>
                        </div>

                        {/* Cuerpo de la Maqueta */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Sidebar de Módulos (Navegable por clic) */}
                            <div className="w-44 border-r border-slate-200 p-2.5 flex flex-col gap-1 shrink-0 bg-slate-50/80">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-2">
                                    Módulos Activos
                                </span>
                                {showcaseViews.map((view, idx) => {
                                    const Icon = view.icon;
                                    const isActive = idx === activeSlide;
                                    return (
                                        <button
                                            key={view.id}
                                            type="button"
                                            onClick={() => setActiveSlide(idx)}
                                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                                                isActive 
                                                    ? 'bg-white text-blue-700 font-bold border border-slate-200 shadow-xs' 
                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon size={13} className={isActive ? view.activeColor : 'text-slate-400'} />
                                                <span className="text-[9.5px] tracking-wider uppercase font-semibold">{view.title}</span>
                                            </div>
                                        </button>
                                    );
                                })}

                                <div className="mt-auto p-2 bg-blue-50/60 border border-blue-200/60 rounded-xl text-[8.5px] text-slate-600 space-y-0.5">
                                    <div className="font-extrabold text-blue-800">SUNAT 2026 Ready</div>
                                    <div className="text-[8px] text-slate-500">PLE / SIRE / PLAME integrado automáticamente.</div>
                                </div>
                            </div>

                            {/* Área de Visualización del Carrusel */}
                            <div className="flex-1 p-4 flex flex-col overflow-hidden bg-slate-50/40 relative">
                                
                                {/* Header Vista Activa */}
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                                            {showcaseViews[activeSlide].title}
                                        </span>
                                        <span className="text-[8.5px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded font-bold">
                                            {showcaseViews[activeSlide].badge}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {showcaseViews.map((_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setActiveSlide(i)}
                                                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                                                    i === activeSlide ? 'w-4 bg-blue-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Contenido Dinámico */}
                                <div className="flex-1 relative overflow-hidden">
                                    {showcaseViews.map((view, idx) => {
                                        const isActive = idx === activeSlide;
                                        return (
                                            <div
                                                key={view.id}
                                                className={`absolute inset-0 transition-all duration-500 ease-out transform ${
                                                    isActive 
                                                        ? 'opacity-100 translate-x-0 scale-100' 
                                                        : 'opacity-0 translate-x-6 scale-95 pointer-events-none'
                                                }`}
                                            >
                                                {view.content}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL RECUPERACIÓN DE CONTRASEÑA */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
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
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Recuperar Contraseña</h3>
                                <p className="text-xs text-slate-500 font-medium">SOFTCONTABLE SaaS Security</p>
                            </div>
                        </div>

                        {forgotError && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center gap-2">
                                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                                <span>{forgotError}</span>
                            </div>
                        )}

                        {forgotMessage && (
                            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                <span>{forgotMessage}</span>
                            </div>
                        )}

                        {forgotStep === 1 ? (
                            <form onSubmit={handleForgotVerify} className="space-y-4">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Ingresa el correo electrónico asociado a tu cuenta para verificar tu identidad y restablecer tu clave de acceso.
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
                                    disabled={forgotLoading}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar Cuenta'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleForgotReset} className="space-y-4">
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Cuenta verificada: <strong className="text-blue-600">{forgotEmail}</strong>. Ingresa tu nueva contraseña para actualizar tu acceso.
                                </p>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nueva Contraseña</label>
                                    <div className="relative flex items-center rounded-xl light-input-field">
                                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            placeholder="••••••••"
                                            className="w-full py-2.5 pr-4 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
        </div>
    );
};
