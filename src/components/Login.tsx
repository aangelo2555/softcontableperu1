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

const showcaseViews = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        icon: Layers,
        activeColor: 'text-blue-600',
        badge: 'Régimen General (RG)',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                {/* Header informativo del sistema */}
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Building2 size={12} className="text-blue-600" />
                        <span>EMPRESA: ACME PERÚ S.A.C.</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono text-slate-600">RUC: 20601234567</span>
                    </div>
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-black text-[8px] tracking-wider uppercase">
                        RÉGIMEN GENERAL (RG)
                    </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white border border-blue-200/80 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[8px] text-blue-700 font-extrabold uppercase tracking-wider block mb-0.5">Ventas del Mes</span>
                        <span className="text-sm font-black text-slate-900">S/ 83,536.61</span>
                        <span className="text-[8.5px] text-emerald-600 font-bold block mt-0.5">+14.2% vs mes ant.</span>
                    </div>
                    <div className="bg-white border border-emerald-200/80 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[8px] text-emerald-700 font-extrabold uppercase tracking-wider block mb-0.5">Compras del Mes</span>
                        <span className="text-sm font-black text-slate-900">S/ 312.92</span>
                        <span className="text-[8.5px] text-slate-500 font-bold block mt-0.5">2 comprobantes</span>
                    </div>
                    <div className="bg-white border border-purple-200/80 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[8px] text-purple-700 font-extrabold uppercase tracking-wider block mb-0.5">IGV Estimado</span>
                        <span className="text-sm font-black text-slate-900">S/ 12,697.10</span>
                        <span className="text-[8.5px] text-indigo-600 font-bold block mt-0.5">Régimen RG 18%</span>
                    </div>
                    <div className="bg-white border border-amber-200/80 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[8px] text-amber-700 font-extrabold uppercase tracking-wider block mb-0.5">Pago a Cuenta IR</span>
                        <span className="text-sm font-black text-slate-900">S/ 1,253.05</span>
                        <span className="text-[8.5px] text-amber-600 font-bold block mt-0.5">Tasa RG 1.5%</span>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-2.5 flex-1">
                    <div className="col-span-8 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] text-slate-800 font-extrabold uppercase tracking-wider">Flujo de Caja Anual (2026)</span>
                            <span className="text-[8px] text-slate-500 font-semibold">Ejecución Mensual RG</span>
                        </div>
                        <div className="flex items-end justify-between h-24 pt-1 px-1">
                            {[40, 60, 45, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((h, i) => (
                                <div key={i} className="w-[6.5%] flex flex-col items-center gap-1">
                                    <div className="w-full bg-gradient-to-t from-slate-200 to-blue-600/90 rounded-t transition-all duration-500" style={{ height: `${h}%` }}></div>
                                    <span className="text-[7.5px] text-slate-500 font-bold">{['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                        <span className="text-[9px] text-slate-800 font-extrabold uppercase tracking-wider block mb-1">Ratios Régimen General</span>
                        <div className="space-y-1.5">
                            <div>
                                <div className="flex justify-between text-[8.5px] text-slate-600 mb-0.5 font-medium">
                                    <span>Margen Bruto</span>
                                    <span className="text-slate-900 font-black">99.6%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '99.6%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[8.5px] text-slate-600 mb-0.5 font-medium">
                                    <span>Ratio Liquidez</span>
                                    <span className="text-slate-900 font-black">2.45 Óptimo</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[7.5px] text-slate-500 font-semibold mt-1">
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
            <div className="space-y-2 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] text-slate-900 font-extrabold uppercase tracking-wider">Integración Directa SIRE SUNAT 2026</span>
                    <span className="text-[8.5px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">SOL Sincronizado</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex-1 flex flex-col shadow-xs">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/80">
                                <th className="p-2 text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider">Módulo SIRE</th>
                                <th className="p-2 text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider">Comprobantes</th>
                                <th className="p-2 text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider">Base Imponible</th>
                                <th className="p-2 text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider text-right">Estado SUNAT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[9px]">
                            <tr className="hover:bg-slate-50">
                                <td className="p-2 font-black text-slate-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> RVIE 14.1 (Ventas RG)
                                </td>
                                <td className="p-2 text-slate-600 font-mono font-semibold">1 Registros</td>
                                <td className="p-2 text-blue-700 font-black font-mono">S/ 70,793.74</td>
                                <td className="p-2 text-right text-emerald-700 font-black">ACEPTADO (Ticket #89412)</td>
                            </tr>
                            <tr className="hover:bg-slate-50">
                                <td className="p-2 font-black text-slate-900 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span> RCE 8.1 (Compras RG)
                                </td>
                                <td className="p-2 text-slate-600 font-mono font-semibold">2 Registros</td>
                                <td className="p-2 text-indigo-700 font-black font-mono">S/ 265.19</td>
                                <td className="p-2 text-right text-emerald-700 font-black">ACEPTADO (Ticket #89413)</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="p-2 bg-blue-50/70 border-t border-slate-200 flex items-center justify-between text-[8.5px]">
                        <span className="text-slate-600 font-semibold">Comparativa SIRE vs Local: Sin discrepancias detectadas.</span>
                        <span className="text-blue-700 font-extrabold">Propuesta SUNAT 100% OK</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'diario',
        title: 'Libro Diario 5.1 & 5.2',
        icon: FileText,
        activeColor: 'text-emerald-600',
        badge: 'PCGE Formato SUNAT',
        content: (
            <div className="space-y-2 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] text-slate-900 font-extrabold uppercase tracking-wider">Libro Diario General (SUNAT 5.1 &amp; 5.2)</span>
                    <span className="text-[8.5px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-black">Folio SUNAT: 0048</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex-1 flex flex-col shadow-xs">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/90">
                                <th className="p-1.5 text-[8.5px] font-black text-slate-700 uppercase tracking-wider">Código</th>
                                <th className="p-1.5 text-[8.5px] font-black text-slate-700 uppercase tracking-wider">Cuenta Contable (PCGE)</th>
                                <th className="p-1.5 text-[8.5px] font-black text-slate-700 uppercase tracking-wider text-right">Debe (S/)</th>
                                <th className="p-1.5 text-[8.5px] font-black text-slate-700 uppercase tracking-wider text-right">Haber (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[9px]">
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 font-mono font-black text-emerald-700">10411</td>
                                <td className="p-1.5 text-slate-900 font-bold">BCP - Moneda Nacional</td>
                                <td className="p-1.5 text-right text-emerald-700 font-black">11,800.00</td>
                                <td className="p-1.5 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 font-mono font-black text-blue-700">40111</td>
                                <td className="p-1.5 text-slate-900 font-bold">IGV - Cuenta Propia (18%)</td>
                                <td className="p-1.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-1.5 text-right text-blue-700 font-black">1,800.00</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 font-mono font-black text-blue-700">70121</td>
                                <td className="p-1.5 text-slate-900 font-bold">Venta Mercadería - Reg. General</td>
                                <td className="p-1.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-1.5 text-right text-blue-700 font-black">10,000.00</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 font-mono font-black text-emerald-700">60111</td>
                                <td className="p-1.5 text-slate-900 font-bold">Compra Mercadería - Local</td>
                                <td className="p-1.5 text-right text-emerald-700 font-black">5,000.00</td>
                                <td className="p-1.5 text-right text-slate-400 font-bold">-</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 font-mono font-black text-blue-700">42121</td>
                                <td className="p-1.5 text-slate-900 font-bold">Facturas por Pagar - Proveedor</td>
                                <td className="p-1.5 text-right text-slate-400 font-bold">-</td>
                                <td className="p-1.5 text-right text-blue-700 font-black">5,000.00</td>
                            </tr>
                            <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                                <td className="p-1.5 text-[8.5px] text-slate-900 uppercase tracking-wider font-black" colSpan={2}>Suma de Operaciones Cuadradas</td>
                                <td className="p-1.5 text-right text-emerald-700 font-black text-[9.5px]">16,800.00</td>
                                <td className="p-1.5 text-right text-blue-700 font-black text-[9.5px]">16,800.00</td>
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
            <div className="space-y-2 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] text-slate-900 font-extrabold uppercase tracking-wider">Nómina de Colaboradores &amp; Beneficios Sociales</span>
                    <span className="text-[8.5px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-extrabold">PLAME Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                        <div>
                            <span className="text-[8.5px] text-amber-800 font-extrabold uppercase block mb-0.5">Gratificaciones Ley 27735</span>
                            <span className="text-sm font-black text-slate-900">S/ 3,450.00</span>
                            <p className="text-[8px] text-slate-500 mt-1 font-medium leading-tight">Cálculo proyectado Julio/Diciembre con Bonificación Extraordinaria (9%).</p>
                        </div>
                        <span className="text-[8.5px] text-emerald-700 font-black mt-1">● Cálculo Automatizado RG</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                        <div>
                            <span className="text-[8.5px] text-blue-700 font-extrabold uppercase block mb-0.5">CTS D.S. 001-97-TR</span>
                            <span className="text-sm font-black text-slate-900">S/ 1,725.00</span>
                            <p className="text-[8px] text-slate-500 mt-1 font-medium leading-tight">Depósito Mayo/Noviembre computable con 1/6 de gratificación.</p>
                        </div>
                        <span className="text-[8.5px] text-blue-700 font-black mt-1">● Sincronizado PLAME</span>
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
            <div className="space-y-2 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] text-slate-900 font-extrabold uppercase tracking-wider">Conciliación Bancaria Automática</span>
                    <span className="text-[8.5px] bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-full font-extrabold">BCP / BBVA / Interbank</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 flex-1 flex flex-col justify-between shadow-xs">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-800 font-bold font-mono">MOV-2026-0814 • Depósito Cliente</span>
                            <span className="text-emerald-700 font-black font-mono">+S/ 11,800.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-800 font-bold font-mono">MOV-2026-0815 • Pago Proveedor</span>
                            <span className="text-blue-700 font-black font-mono">-S/ 5,000.00</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[8.5px] text-slate-600 border-t border-slate-200 pt-1.5 font-semibold">
                        <span>Conciliado: 100% Extractos Bancarios</span>
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
            <div className="space-y-2 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9.5px] text-slate-900 font-extrabold uppercase tracking-wider">Auditoría Tributaria Preventiva &amp; RAG AI</span>
                    <span className="text-[8.5px] bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-extrabold">Riesgo SUNAT: BAJO</span>
                </div>
                <div className="bg-white border border-purple-200/80 rounded-xl p-2.5 space-y-1.5 flex-1 flex flex-col justify-between shadow-xs">
                    <div>
                        <span className="text-[8.5px] text-purple-800 font-extrabold uppercase tracking-wider block mb-0.5">Dictamen Normativo Régimen General 2026</span>
                        <p className="text-[9px] text-slate-700 leading-relaxed font-medium">
                            "Tu ratio de compras vs ventas se encuentra en 0.37%, dentro de los márgenes óptimos para Régimen General. No se detectan inconsistencias bancarias Ley 28194."
                        </p>
                    </div>
                    <div className="flex justify-between items-center text-[8px] text-slate-500 border-t border-purple-100 pt-1.5 font-semibold">
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

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide(prev => (prev + 1) % showcaseViews.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

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
                        <div className="mb-4 bg-slate-200/70 p-1 rounded-2xl border border-slate-300/60 flex items-center gap-1.5 select-none">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(false);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none ${
                                    !isStudentModeActive 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                }`}
                            >
                                <Building2 size={14} className={!isStudentModeActive ? 'text-white' : 'text-slate-500'} />
                                <span>Profesional</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsStudentModeActive(true);
                                    setErrorAlert(null);
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer outline-none focus:outline-none ${
                                    isStudentModeActive 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]' 
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                }`}
                            >
                                <GraduationCap size={15} className={isStudentModeActive ? 'text-white' : 'text-slate-500'} />
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
                                <div className="flex items-center justify-between">
                                    <label className="text-[10.5px] font-extrabold text-slate-600 ml-1 uppercase tracking-wider">Contraseña</label>
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
                                        className="w-full py-2.5 bg-transparent placeholder:text-slate-400 text-xs text-slate-900 focus:outline-none"
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
                        
                        {/* Ventana Header macOS style (SOFTCONTABLE SAAS VIEW) */}
                        <div className="h-9 border-b border-slate-200 bg-slate-100/90 flex items-center justify-between px-3.5 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <div className="text-[9.5px] text-slate-700 font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={11} className="text-blue-600" />
                                SOFTCONTABLE SAAS VIEW
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
                                    <div className="text-[8px] text-slate-500">Régimen General / MIPE integrado.</div>
                                </div>
                            </div>

                            {/* Área de Visualización del Carrusel */}
                            <div className="flex-1 p-3.5 flex flex-col overflow-hidden bg-slate-50/40 relative">
                                
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
