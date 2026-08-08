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
  .glass-card-pro {
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
      0 30px 60px -12px rgba(0, 0, 0, 0.65),
      inset 0 1px 1px rgba(255, 255, 255, 0.12);
  }
  .glass-card-student {
    background: rgba(19, 24, 52, 0.9);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(129, 140, 248, 0.28);
    box-shadow: 
      0 30px 60px -12px rgba(30, 27, 75, 0.5),
      inset 0 1px 1px rgba(165, 180, 252, 0.2);
  }
  .glass-input-field {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    transition: all 0.2s ease-in-out;
  }
  .glass-input-field:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
  }
  .glass-input-field:focus-within {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(59, 130, 246, 0.8);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  }
  .glass-input-field-student:focus-within {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(129, 140, 248, 0.85);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
  }
`;

const showcaseViews = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        icon: Layers,
        activeColor: 'text-blue-400',
        badge: 'Resumen Gerencial',
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/90 border border-blue-500/35 rounded-xl p-3.5 shadow-md">
                        <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-wider block mb-1">Ventas del Mes</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 83,536.61</span>
                        <span className="text-[9.5px] text-emerald-400 font-bold block mt-1">+14.2% vs mes ant.</span>
                    </div>
                    <div className="bg-slate-900/90 border border-emerald-500/35 rounded-xl p-3.5 shadow-md">
                        <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-1">Compras del Mes</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 312.92</span>
                        <span className="text-[9.5px] text-slate-300 font-bold block mt-1">2 comprobantes</span>
                    </div>
                    <div className="bg-slate-900/90 border border-purple-500/35 rounded-xl p-3.5 shadow-md">
                        <span className="text-[9px] text-purple-300 font-extrabold uppercase tracking-wider block mb-1">IGV Estimado</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 12,697.10</span>
                        <span className="text-[9.5px] text-indigo-300 font-bold block mt-1">Régimen RMT / RG</span>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-3 flex-1">
                    <div className="col-span-8 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between shadow-md">
                        <span className="text-[10px] text-white font-extrabold uppercase tracking-wider block mb-2">Flujo de Caja Anual (2026)</span>
                        <div className="flex items-end justify-between h-32 pt-2 px-1">
                            {[40, 60, 45, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((h, i) => (
                                <div key={i} className="w-[6%] flex flex-col items-center gap-1.5">
                                    <div className="w-full bg-gradient-to-t from-slate-800 to-blue-500/90 rounded-t transition-all duration-500" style={{ height: `${h}%` }}></div>
                                    <span className="text-[8.5px] text-slate-300 font-bold">{['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between shadow-md">
                        <span className="text-[10px] text-white font-extrabold uppercase tracking-wider block mb-2">Rendimiento</span>
                        <div className="space-y-2.5">
                            <div>
                                <div className="flex justify-between text-[9.5px] text-slate-300 mb-1">
                                    <span>Margen Bruto</span>
                                    <span className="text-white font-bold">99.6%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: '99.6%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9.5px] text-slate-300 mb-1">
                                    <span>Ejecución Presup.</span>
                                    <span className="text-white font-bold">88.4%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '88.4%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[8.5px] text-slate-400 mt-2 font-semibold">
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
        activeColor: 'text-indigo-400',
        badge: 'RCE 8.1 & RVIE 14.1',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10.5px] text-white font-extrabold uppercase tracking-wider">Integración Directa SIRE SUNAT 2026</span>
                    <span className="text-[9.5px] bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 px-2.5 py-0.5 rounded-full font-extrabold">Sincronizado SOL</span>
                </div>
                <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-900/90 flex-1 flex flex-col shadow-md">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-700/80 bg-slate-800/60">
                                <th className="p-2.5 text-[9.5px] font-extrabold text-slate-200 uppercase tracking-wider">Módulo SIRE</th>
                                <th className="p-2.5 text-[9.5px] font-extrabold text-slate-200 uppercase tracking-wider">Comprobantes</th>
                                <th className="p-2.5 text-[9.5px] font-extrabold text-slate-200 uppercase tracking-wider">Base Imponible</th>
                                <th className="p-2.5 text-[9.5px] font-extrabold text-slate-200 uppercase tracking-wider text-right">Estado SUNAT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-[10px]">
                            <tr className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-black text-white flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> RVIE 14.1 (Ventas)
                                </td>
                                <td className="p-2.5 text-slate-200 font-mono font-semibold">1 Registros</td>
                                <td className="p-2.5 text-blue-300 font-black font-mono">S/ 70,793.74</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black">ACEPTADO (Ticket)</td>
                            </tr>
                            <tr className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-black text-white flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> RCE 8.1 (Compras)
                                </td>
                                <td className="p-2.5 text-slate-200 font-mono font-semibold">2 Registros</td>
                                <td className="p-2.5 text-purple-300 font-black font-mono">S/ 265.19</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black">ACEPTADO (Ticket)</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="p-3 bg-blue-500/10 border-t border-slate-700/80 flex items-center justify-between text-[9.5px]">
                        <span className="text-slate-300 font-semibold">Comparativa SIRE vs Local: Sin discrepancias detectadas.</span>
                        <span className="text-blue-400 font-extrabold">Resumen 100% Ok</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'diario',
        title: 'Libro Diario 5.1',
        icon: FileText,
        activeColor: 'text-emerald-400',
        badge: 'Formato SUNAT 5.1 & 5.2',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-white font-black uppercase tracking-wider">Libro Diario General (SUNAT 5.1)</span>
                    <span className="text-[9.5px] bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 px-2.5 py-0.5 rounded-full font-black">Folio: 0048</span>
                </div>
                <div className="border border-slate-700 rounded-xl overflow-hidden bg-[#0a0f1d] flex-1 flex flex-col shadow-xl">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-700 bg-slate-800/90">
                                <th className="p-2.5 text-[10px] font-black text-slate-100 uppercase tracking-wider">Código</th>
                                <th className="p-2.5 text-[10px] font-black text-slate-100 uppercase tracking-wider">Cuenta Contable</th>
                                <th className="p-2.5 text-[10px] font-black text-slate-100 uppercase tracking-wider text-right">Debe (S/)</th>
                                <th className="p-2.5 text-[10px] font-black text-slate-100 uppercase tracking-wider text-right">Haber (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-[10.5px]">
                            <tr className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-2.5 font-mono font-black text-emerald-400">10411</td>
                                <td className="p-2.5 text-white font-bold">BCP - Moneda Nacional</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black">11,800.00</td>
                                <td className="p-2.5 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-2.5 font-mono font-black text-blue-400">40111</td>
                                <td className="p-2.5 text-white font-bold">IGV - Cuenta Propia</td>
                                <td className="p-2.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2.5 text-right text-blue-300 font-black">1,800.00</td>
                            </tr>
                            <tr className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-2.5 font-mono font-black text-blue-400">70121</td>
                                <td className="p-2.5 text-white font-bold">Mercaderías - Venta Local</td>
                                <td className="p-2.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2.5 text-right text-blue-300 font-black">10,000.00</td>
                            </tr>
                            <tr className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-2.5 font-mono font-black text-emerald-400">60111</td>
                                <td className="p-2.5 text-white font-bold">Mercaderías - Compra Local</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black">5,000.00</td>
                                <td className="p-2.5 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-800/60 transition-colors">
                                <td className="p-2.5 font-mono font-black text-blue-400">42121</td>
                                <td className="p-2.5 text-white font-bold">Facturas por Pagar - Local</td>
                                <td className="p-2.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-2.5 text-right text-blue-300 font-black">5,000.00</td>
                            </tr>
                            <tr className="bg-slate-800/90 font-black border-t-2 border-slate-700">
                                <td className="p-2.5 text-[9.5px] text-white uppercase tracking-wider font-black" colSpan={2}>Suma de Operaciones del Folio</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black text-[11px]">16,800.00</td>
                                <td className="p-2.5 text-right text-blue-300 font-black text-[11px]">16,800.00</td>
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
        activeColor: 'text-amber-400',
        badge: 'Ley 27735 & CTS',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10.5px] text-white font-extrabold uppercase tracking-wider">Nómina de Colaboradores &amp; Beneficios Sociales</span>
                    <span className="text-[9.5px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 rounded-full font-extrabold">PLAME Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between shadow-md">
                        <div>
                            <span className="text-[9.5px] text-amber-300 font-extrabold uppercase block mb-1">Gratificaciones Ley 27735</span>
                            <span className="text-base font-black text-white">S/ 3,450.00</span>
                            <p className="text-[8.5px] text-slate-300 mt-1 font-medium">Cálculo proyectado Julio/Diciembre con Bonificación Extraordinaria (9%).</p>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-black mt-2">● Cálculo Automatizado</span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between shadow-md">
                        <div>
                            <span className="text-[9.5px] text-blue-300 font-extrabold uppercase block mb-1">CTS D.S. 001-97-TR</span>
                            <span className="text-base font-black text-white">S/ 1,725.00</span>
                            <p className="text-[8.5px] text-slate-300 mt-1 font-medium">Depósito Mayo/Noviembre computable con 1/6 de gratificación.</p>
                        </div>
                        <span className="text-[9px] text-blue-400 font-black mt-2">● Sincronizado PLAME</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'bancos',
        title: 'Tesorería & Bancos',
        icon: Landmark,
        activeColor: 'text-cyan-400',
        badge: 'Auto-Match Bancario',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10.5px] text-white font-extrabold uppercase tracking-wider">Conciliación Bancaria Automática</span>
                    <span className="text-[9.5px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-2.5 py-0.5 rounded-full font-extrabold">BCP / BBVA / Interbank</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2 flex-1 flex flex-col justify-between shadow-md">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span className="text-white font-bold font-mono">MOV-2026-0814 • Depósito Cliente</span>
                            <span className="text-emerald-400 font-black font-mono">+S/ 11,800.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span className="text-white font-bold font-mono">MOV-2026-0815 • Pago Proveedor</span>
                            <span className="text-blue-400 font-black font-mono">-S/ 5,000.00</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[9.5px] text-slate-300 border-t border-slate-700/80 pt-2 font-semibold">
                        <span>Conciliado: 100% de Extractos Bancarios</span>
                        <span className="text-cyan-400 font-black">Match Automático OK</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'softpremium',
        title: 'SoftPremium Groq AI',
        icon: Cpu,
        activeColor: 'text-purple-400',
        badge: 'Groq LLaMA-3.3 RAG 4.0',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10.5px] text-white font-extrabold uppercase tracking-wider">Auditoría Tributaria Preventiva &amp; RAG AI</span>
                    <span className="text-[9.5px] bg-purple-500/20 border border-purple-500/40 text-purple-300 px-2.5 py-0.5 rounded-full font-extrabold">Riesgo SUNAT: BAJO</span>
                </div>
                <div className="bg-slate-900/90 border border-purple-500/35 rounded-xl p-3.5 space-y-2 flex-1 flex flex-col justify-between shadow-md">
                    <div>
                        <span className="text-[9.5px] text-purple-300 font-extrabold uppercase tracking-wider block mb-1">Dictamen de Inteligencia Normativa 2026</span>
                        <p className="text-[10px] text-slate-100 leading-relaxed font-medium">
                            "Tu ratio de compras vs ventas se encuentra en 0.37%, dentro de los márgenes óptimos sustentables. No se detectan inconsistencias bancarias Ley 28194."
                        </p>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-300 border-t border-purple-500/30 pt-2 font-semibold">
                        <span>Motor de Inferencia: Groq LLaMA-3.3 70B</span>
                        <span className="text-purple-300 font-black">IA RAG 4.0 Activo</span>
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
        <div className="min-h-screen w-full bg-[#07090e] text-slate-100 flex items-center justify-center font-sans selection:bg-blue-600/30 selection:text-blue-200 overflow-x-hidden relative p-4 md:p-8">
            <style>{customStyles}</style>

            {/* Layout Principal Contenedor */}
            <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-12 relative z-10 my-auto">
                
                {/* COLUMNA IZQUIERDA: Formulario de Login / Registro */}
                <div className="w-full md:w-[450px] shrink-0">
                    
                    {/* Header Marca */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center p-2.5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl mb-3">
                            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-12 h-12 object-contain" />
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-wider text-white uppercase notranslate flex items-center justify-center gap-1.5" translate="no">
                            SOFT<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400">CONTABLE</span>
                        </h1>
                        <p className="text-slate-400 text-[10.5px] font-bold tracking-widest uppercase mt-1 notranslate" translate="no">
                            Sistema Contable en la Nube v2.0
                        </p>
                    </div>

                    {/* Tarjeta de Formulario (Glassmorphic) */}
                    <div className={`p-6 lg:p-8 rounded-3xl transition-all duration-300 ${
                        isStudentModeActive ? 'glass-card-student' : 'glass-card-pro'
                    }`}>
                        
                        {/* Selector de Modo: Profesional vs Estudiante */}
                        <div className="mb-5 bg-black/40 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    !isStudentModeActive 
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25' 
                                        : 'text-slate-400 hover:text-white'
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
                                className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    isStudentModeActive 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <GraduationCap size={14} />
                                <span>Estudiante</span>
                            </button>
                        </div>

                        {/* Banner de contexto informativo del modo activo */}
                        <div className={`mb-5 p-2.5 rounded-xl border text-[10.5px] font-medium flex items-center gap-2 ${
                            isStudentModeActive
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                                : 'bg-blue-500/10 border-blue-500/25 text-blue-200/90'
                        }`}>
                            {isStudentModeActive ? (
                                <>
                                    <GraduationCap size={16} className="shrink-0 text-indigo-400" />
                                    <span>Entorno educativo para aprendizaje de contabilidad sin riesgo SUNAT.</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} className="shrink-0 text-blue-400" />
                                    <span>Acceso al sistema contable oficial y cartera de empresas.</span>
                                </>
                            )}
                        </div>

                        {/* Tabs de Iniciar Sesión / Registrarse */}
                        <div className="flex mb-6 border-b border-white/10 pb-1">
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsLogin(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    isLogin 
                                        ? isStudentModeActive ? 'border-indigo-400 text-indigo-300' : 'border-blue-400 text-blue-300' 
                                        : 'border-transparent text-slate-500 hover:text-slate-300'
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
                                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                                    !isLogin 
                                        ? isStudentModeActive ? 'border-indigo-400 text-indigo-300' : 'border-blue-400 text-blue-300' 
                                        : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Crear Cuenta
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                            {errorAlert && (
                                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs py-3 px-3.5 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
                                    <span className="text-rose-400 mt-0.5 text-sm shrink-0">⚠️</span>
                                    <div className="flex-1 font-medium leading-relaxed">{errorAlert}</div>
                                </div>
                            )}

                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                    <div className={`relative flex items-center rounded-xl glass-input-field ${isStudentModeActive ? 'glass-input-field-student' : ''}`}>
                                        <User className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full py-3 pr-4 bg-transparent placeholder:text-slate-600 text-sm focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                                <div className={`relative flex items-center rounded-xl glass-input-field ${isStudentModeActive ? 'glass-input-field-student' : ''}`}>
                                    <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="email"
                                        required
                                        autoComplete="username"
                                        placeholder={isStudentModeActive ? "estudiante@universidad.edu.pe" : "usuario@empresa.com"}
                                        className="w-full py-3 pr-4 bg-transparent placeholder:text-slate-600 text-sm focus:outline-none"
                                        style={{ paddingLeft: '2.75rem' }}
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-400 ml-1 uppercase tracking-wider">Contraseña</label>
                                <div className={`relative flex items-center rounded-xl glass-input-field ${isStudentModeActive ? 'glass-input-field-student' : ''}`}>
                                    <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        placeholder="••••••••"
                                        className="w-full py-3 bg-transparent placeholder:text-slate-600 text-sm focus:outline-none"
                                        style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {isLogin && (
                                <div className="flex items-center justify-end px-1 pt-1 text-xs">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setForgotEmail(formData.email);
                                            setShowForgotPasswordModal(true);
                                            setForgotStep(1);
                                            setForgotError(null);
                                            setForgotMessage(null);
                                        }} 
                                        className="text-blue-400 hover:text-blue-300 transition-colors font-bold cursor-pointer hover:underline"
                                    >
                                        ¿Olvidaste tu clave?
                                    </button>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className={`w-full font-black py-3.5 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 mt-5 cursor-pointer text-xs uppercase tracking-wider ${
                                    isStudentModeActive
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/40'
                                        : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/25'
                                } disabled:opacity-50 disabled:pointer-events-none`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
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
                    <div className="mt-5 text-center space-y-2">
                        <p className="text-slate-500 text-[10.5px] font-medium">
                            Al ingresar aceptas nuestros{' '}
                            <button type="button" onClick={() => setShowLoginLegal('terms')} className="text-slate-400 hover:text-white underline cursor-pointer">Términos</button>{' '}y{' '}
                            <button type="button" onClick={() => setShowLoginLegal('privacy')} className="text-slate-400 hover:text-white underline cursor-pointer">Privacidad</button>.
                        </p>
                        <p className="text-slate-600 text-[10px] tracking-wider notranslate" translate="no">
                            &copy; 2026 Angelo Thomas Serna Simeon. SOFTCONTABLE SaaS.
                        </p>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Carrusel Interactivo de Tablas Dinámicas y Maqueta 3D */}
                <div className="hidden md:flex flex-1 max-w-2xl h-[560px] flex-col justify-center [perspective:1400px]">
                    
                    {/* Contenedor Mockup Sistema (Inclinado 3D 45°) */}
                    <div className="w-full h-full bg-[#0b0f19] border border-slate-700/80 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative transition-all duration-700 ease-out [transform:rotateY(-14deg)_rotateX(7deg)_rotate(-2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)_rotate(0deg)] hover:shadow-blue-500/10">
                        
                        {/* Ventana Header macOS style */}
                        <div className="h-10 border-b border-white/10 bg-black/50 flex items-center justify-between px-4 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <div className="text-[9.5px] text-slate-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={11} className="text-blue-400" />
                                SOFTCONTABLE ERP PREVIEW
                            </div>
                            <div className="text-[9px] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-400 font-mono font-bold">
                                LIVE DEMO
                            </div>
                        </div>

                        {/* Cuerpo de la Maqueta */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Sidebar de Módulos (Navegable por clic) */}
                            <div className="w-48 border-r border-white/5 p-3 flex flex-col gap-1.5 shrink-0 bg-black/40">
                                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-2.5">
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
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                                                isActive 
                                                    ? 'bg-blue-600/15 text-white font-bold border border-blue-500/30 shadow-sm' 
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon size={14} className={isActive ? view.activeColor : 'text-slate-500'} />
                                                <span className="text-[10px] tracking-wider uppercase font-semibold">{view.title}</span>
                                            </div>
                                        </button>
                                    );
                                })}

                                <div className="mt-auto p-2.5 bg-blue-500/[0.04] border border-blue-500/15 rounded-xl text-[9px] text-slate-400 space-y-1">
                                    <div className="font-bold text-blue-300">SUNAT 2026 Ready</div>
                                    <div className="text-[8px] text-slate-500">PLE / SIRE / PLAME integrado automáticamente.</div>
                                </div>
                            </div>

                            {/* Área de Visualización del Carrusel */}
                            <div className="flex-1 p-5 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950/60 to-black/80 relative">
                                
                                {/* Header Vista Activa */}
                                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                                            {showcaseViews[activeSlide].title}
                                        </span>
                                        <span className="text-[8.5px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
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
                                                    i === activeSlide ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-700 hover:bg-slate-500'
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
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative animate-scale-up">
                        <button
                            onClick={() => setShowForgotPasswordModal(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                                <KeyRound size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-wider">Recuperar Contraseña</h3>
                                <p className="text-xs text-slate-400 font-medium">SOFTCONTABLE SaaS Security</p>
                            </div>
                        </div>

                        {forgotError && (
                            <div className="mb-4 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
                                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                                <span>{forgotError}</span>
                            </div>
                        )}

                        {forgotMessage && (
                            <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs p-3 rounded-xl flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                <span>{forgotMessage}</span>
                            </div>
                        )}

                        {forgotStep === 1 ? (
                            <form onSubmit={handleForgotVerify} className="space-y-4">
                                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                    Ingresa el correo electrónico asociado a tu cuenta para verificar tu identidad y restablecer tu clave de acceso.
                                </p>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Correo Registrado</label>
                                    <div className="relative flex items-center rounded-xl glass-input-field">
                                        <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="usuario@empresa.com"
                                            className="w-full py-3 pr-4 bg-transparent placeholder:text-slate-600 text-sm focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar Cuenta'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleForgotReset} className="space-y-4">
                                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                    Cuenta verificada: <strong className="text-blue-400">{forgotEmail}</strong>. Ingresa tu nueva contraseña para actualizar tu acceso.
                                </p>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nueva Contraseña</label>
                                    <div className="relative flex items-center rounded-xl glass-input-field">
                                        <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            placeholder="••••••••"
                                            className="w-full py-3 pr-4 bg-transparent placeholder:text-slate-600 text-sm focus:outline-none"
                                            style={{ paddingLeft: '2.75rem' }}
                                            value={forgotNewPassword}
                                            onChange={e => setForgotNewPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="w-full font-black py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

