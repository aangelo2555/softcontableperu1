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
    ShieldCheck
} from 'lucide-react';

import toast from 'react-hot-toast';
import { LegalPages } from './LegalPages';

const customStyles = `
  .glass-card-pro {
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 25px 60px -15px rgba(0, 0, 0, 0.7),
      inset 0 1px 1px rgba(255, 255, 255, 0.08);
  }
  .glass-card-student {
    background: rgba(19, 16, 42, 0.8);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(129, 140, 248, 0.2);
    box-shadow: 
      0 25px 60px -15px rgba(49, 46, 129, 0.4),
      inset 0 1px 1px rgba(165, 180, 252, 0.15);
  }
  .glass-input-field {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #ffffff;
    transition: all 0.2s ease-in-out;
  }
  .glass-input-field:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .glass-input-field:focus-within {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(212, 175, 55, 0.6);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
  }
  .glass-input-field-student:focus-within {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(129, 140, 248, 0.7);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
`;

const showcaseViews = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        icon: Layers,
        activeColor: 'text-[#d4af37]',
        badge: 'Resumen Gerencial',
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-amber-500/[0.03] border border-[#d4af37]/30 rounded-xl p-3.5">
                        <span className="text-[9px] text-[#d4af37] font-bold uppercase tracking-wider block mb-1">Ventas del Mes</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 48,250.00</span>
                        <span className="text-[9px] text-emerald-400 font-bold block mt-1">+12.4% vs mes ant.</span>
                    </div>
                    <div className="bg-emerald-500/[0.03] border border-emerald-500/30 rounded-xl p-3.5">
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Compras del Mes</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 24,180.00</span>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1">142 comprobantes</span>
                    </div>
                    <div className="bg-sky-500/[0.03] border border-sky-500/30 rounded-xl p-3.5">
                        <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider block mb-1">Impuesto RMT</span>
                        <span className="text-base lg:text-lg font-black text-white">S/ 4,342.00</span>
                        <span className="text-[9px] text-amber-500/80 font-bold block mt-1">IGV / Renta SUNAT</span>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-3 flex-1">
                    <div className="col-span-8 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block mb-2">Flujo de Caja Anual (2026)</span>
                        <div className="flex items-end justify-between h-32 pt-2 px-1">
                            {[40, 60, 45, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((h, i) => (
                                <div key={i} className="w-[6%] flex flex-col items-center gap-1.5">
                                    <div className="w-full bg-gradient-to-t from-slate-800 to-[#d4af37]/70 rounded-t transition-all duration-500" style={{ height: `${h}%` }}></div>
                                    <span className="text-[8px] text-slate-500 font-bold">{['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block mb-2">Rendimiento</span>
                        <div className="space-y-2.5">
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                    <span>Margen Neto</span>
                                    <span className="text-white font-bold">49.8%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-[#d4af37] h-full rounded-full" style={{ width: '49.8%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                    <span>Ejecución Presup.</span>
                                    <span className="text-white font-bold">82.4%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '82.4%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-500 mt-2">
                            Actualización en tiempo real.
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'diario',
        title: 'Libro Diario',
        icon: FileText,
        activeColor: 'text-emerald-400',
        badge: 'Formato SUNAT 5.1',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Libro Diario General (SUNAT 5.1)</span>
                    <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">Folio: 0048</span>
                </div>
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.01] flex-1 flex flex-col">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                                <th className="p-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Código</th>
                                <th className="p-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cuenta Contable</th>
                                <th className="p-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Debe (S/)</th>
                                <th className="p-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Haber (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-[9.5px]">
                            <tr className="hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-slate-400">10411</td>
                                <td className="p-2.5 text-white">BCP - Moneda Nacional</td>
                                <td className="p-2.5 text-right text-emerald-400 font-bold">11,800.00</td>
                                <td className="p-2.5 text-right text-slate-600">-</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-slate-400">40111</td>
                                <td className="p-2.5 text-white">IGV - Cuenta Propia</td>
                                <td className="p-2.5 text-right text-slate-600">-</td>
                                <td className="p-2.5 text-right text-amber-500/80 font-bold">1,800.00</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-slate-400">70121</td>
                                <td className="p-2.5 text-white">Mercaderías - Venta Local</td>
                                <td className="p-2.5 text-right text-slate-600">-</td>
                                <td className="p-2.5 text-right text-amber-500/80 font-bold">10,000.00</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-slate-400">60111</td>
                                <td className="p-2.5 text-white">Mercaderías - Compra Local</td>
                                <td className="p-2.5 text-right text-emerald-400 font-bold">5,000.00</td>
                                <td className="p-2.5 text-right text-slate-600">-</td>
                            </tr>
                            <tr className="hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-slate-400">42121</td>
                                <td className="p-2.5 text-white">Facturas por Pagar - Local</td>
                                <td className="p-2.5 text-right text-slate-600">-</td>
                                <td className="p-2.5 text-right text-amber-500/80 font-bold">5,000.00</td>
                            </tr>
                            <tr className="bg-white/[0.03] font-bold border-t border-white/10">
                                <td className="p-2.5 text-[8.5px] text-slate-400 uppercase tracking-wider" colSpan={2}>Suma de Operaciones del Folio</td>
                                <td className="p-2.5 text-right text-emerald-400 font-black">16,800.00</td>
                                <td className="p-2.5 text-right text-amber-500/80 font-black">16,800.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    },
    {
        id: 'empresas',
        title: 'Mis Empresas',
        icon: Building2,
        activeColor: 'text-sky-400',
        badge: 'Multi-Empresa',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Cartera de Empresas Activas</span>
                    <span className="text-[9px] text-slate-400 font-bold">Total: 4 Registradas</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded font-mono font-bold">RUC 20601234567</span>
                            <h4 className="text-[11px] font-black text-white mt-1.5 leading-snug">AGROINDUSTRIA DEL SUR S.A.C.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-400 border-t border-white/[0.04] pt-2 mt-1.5">
                            <span>Régimen: RMT</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded font-mono font-bold">RUC 20459876543</span>
                            <h4 className="text-[11px] font-black text-white mt-1.5 leading-snug">CONSTRUCTORA HERMANOS E.I.R.L.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-400 border-t border-white/[0.04] pt-2 mt-1.5">
                            <span>Régimen: GENERAL</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded font-mono font-bold">RUC 20123456789</span>
                            <h4 className="text-[11px] font-black text-white mt-1.5 leading-snug">COMERCIAL SANTA FE S.R.L.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-400 border-t border-white/[0.04] pt-2 mt-1.5">
                            <span>Régimen: MYPE</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/40 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded font-mono font-bold">RUC 20555666777</span>
                            <h4 className="text-[11px] font-black text-white mt-1.5 leading-snug">SERVICIOS LOGÍSTICOS S.A.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-slate-400 border-t border-white/[0.04] pt-2 mt-1.5">
                            <span>Régimen: GENERAL</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">● ACTIVO</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 'reportes',
        title: 'Reportes NIIF',
        icon: PieChart,
        activeColor: 'text-indigo-400',
        badge: 'Estados Financieros',
        content: (
            <div className="space-y-3 h-full flex flex-col justify-center animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Estado de Situación Financiera (ESF)</span>
                    <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold">NIIF / NIC 1</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1 text-[9px]">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 flex flex-col justify-between">
                        <div>
                            <span className="text-[8.5px] text-slate-400 font-bold uppercase block border-b border-white/5 pb-1 mb-1.5">1. ACTIVOS</span>
                            <div className="space-y-1">
                                <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Activo Corriente</span>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Efectivo y Equiv.</span>
                                    <span className="text-white font-mono">S/ 48,250.00</span>
                                </div>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Cuentas por Cobrar</span>
                                    <span className="text-white font-mono">S/ 36,500.00</span>
                                </div>
                                <div className="flex justify-between pl-1 font-bold text-slate-300 border-t border-white/5 pt-0.5">
                                    <span>Total Corriente</span>
                                    <span className="font-mono">S/ 109,750.00</span>
                                </div>
                            </div>

                            <div className="space-y-1 mt-2">
                                <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Activo No Corriente</span>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Propiedad y Equip.</span>
                                    <span className="text-white font-mono">S/ 42,680.00</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between font-black text-white text-[10px] border-t border-white/10 pt-1.5 mt-1">
                            <span>TOTAL ACTIVOS</span>
                            <span className="font-mono text-emerald-400">S/ 152,430.00</span>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 flex flex-col justify-between">
                        <div>
                            <span className="text-[8.5px] text-slate-400 font-bold uppercase block border-b border-white/5 pb-1 mb-1.5">2. PASIVO Y PATRIMONIO</span>
                            <div className="space-y-1">
                                <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Pasivo Corriente</span>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Tributos por Pagar</span>
                                    <span className="text-white font-mono">S/ 11,800.00</span>
                                </div>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Cuentas por Pagar</span>
                                    <span className="text-white font-mono">S/ 16,350.00</span>
                                </div>
                            </div>

                            <div className="space-y-1 mt-2">
                                <span className="text-[7.5px] text-slate-500 font-bold uppercase block">Patrimonio Neto</span>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Capital Social</span>
                                    <span className="text-white font-mono">S/ 80,000.00</span>
                                </div>
                                <div className="flex justify-between pl-1">
                                    <span className="text-slate-400">Res. Acumulados</span>
                                    <span className="text-white font-mono">S/ 30,280.00</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between font-black text-indigo-400 text-[10px] border-t border-white/10 pt-1.5 mt-1">
                            <span>PASIVO + PATRIMONIO</span>
                            <span className="font-mono">S/ 152,430.00</span>
                        </div>
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
    const [rememberMe, setRememberMe] = useState(false);

    const [activeSlide, setActiveSlide] = useState(0);
    const [showLoginLegal, setShowLoginLegal] = useState<'terms' | 'privacy' | 'security' | 'confidentiality' | 'cookies' | 'eula' | 'legal' | null>(null);

    useEffect(() => {
        const savedEmail = localStorage.getItem('softcontable_rem_email');
        if (savedEmail) {
            setFormData(prev => ({
                ...prev,
                email: savedEmail,
                password: ''
            }));
            setRememberMe(true);
        }
    }, []);

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
                    // Validar doblemente en cliente que el rol coincida con el modo activado
                    if (isStudentModeActive && res.user?.role !== 'estudiante') {
                        const msg = '💼 Esta cuenta es de Modo Profesional. Vuelve al modo "Profesional" para iniciar sesión.';
                        setErrorAlert(msg);
                        toast.error(msg);
                        setIsLoading(false);
                        return;
                    }
                    if (!isStudentModeActive && res.user?.role === 'estudiante') {
                        const msg = '🎓 Esta cuenta está registrada en Modo Estudiante. Activa "Acceso Estudiante" para ingresar.';
                        setErrorAlert(msg);
                        toast.error(msg);
                        setIsLoading(false);
                        return;
                    }

                    localStorage.setItem('softcontable_token', res.token);
                    if (rememberMe) {
                        localStorage.setItem('softcontable_rem_email', formData.email);
                    } else {
                        localStorage.removeItem('softcontable_rem_email');
                    }
                    localStorage.removeItem('softcontable_rem_pass');
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

    return (
        <div className="min-h-screen w-full bg-[#08090d] text-slate-100 flex items-center justify-center font-sans selection:bg-amber-500/20 selection:text-amber-200 overflow-x-hidden relative p-4 md:p-8">
            <style>{customStyles}</style>

            {/* Elementos ambientales de fondo (Optimizados sin blurs intensivos de renderizado) */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full filter blur-3xl"></div>
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-20"></div>
            </div>

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
                            SOFT<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">CONTABLE</span>
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
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20' 
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
                                <span>🎓 Estudiante</span>
                            </button>
                        </div>

                        {/* Banner de contexto informativo del modo activo */}
                        <div className={`mb-5 p-2.5 rounded-xl border text-[10.5px] font-medium flex items-center gap-2 ${
                            isStudentModeActive
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-200/90'
                        }`}>
                            {isStudentModeActive ? (
                                <>
                                    <GraduationCap size={16} className="shrink-0 text-indigo-400" />
                                    <span>Entorno educativo para aprendizaje de contabilidad sin riesgo SUNAT.</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} className="shrink-0 text-amber-400" />
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
                                        ? isStudentModeActive ? 'border-indigo-400 text-indigo-300' : 'border-amber-400 text-amber-300' 
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
                                        ? isStudentModeActive ? 'border-indigo-400 text-indigo-300' : 'border-amber-400 text-amber-300' 
                                        : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Crear Cuenta
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {errorAlert && (
                                <div className="bg-red-500/15 border border-red-500/30 text-red-200 text-xs py-3 px-3.5 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
                                    <span className="text-red-400 mt-0.5 text-sm shrink-0">⚠️</span>
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
                                        autoComplete="current-password"
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
                                <div className="flex items-center justify-between px-1 pt-1 text-xs">
                                    <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={e => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-black/40 checked:bg-amber-400 accent-amber-500"
                                        />
                                        <span>Recordar credenciales</span>
                                    </label>
                                    <a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">
                                        ¿Olvidaste tu clave?
                                    </a>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className={`w-full font-black py-3.5 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 mt-5 cursor-pointer text-xs uppercase tracking-wider ${
                                    isStudentModeActive
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/40'
                                        : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20'
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
                <div className="hidden md:flex flex-1 max-w-2xl h-[560px] flex-col justify-center">
                    
                    {/* Contenedor Mockup Sistema */}
                    <div className="w-full h-full bg-[#0c0d12] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
                        
                        {/* Ventana Header macOS style */}
                        <div className="h-10 border-b border-white/10 bg-black/50 flex items-center justify-between px-4 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={11} className="text-amber-400" />
                                SOFTCONTABLE ERP PREVIEW
                            </div>
                            <div className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-400 font-mono">
                                LIVE DEMO
                            </div>
                        </div>

                        {/* Cuerpo de la Maqueta */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Sidebar de Módulos (Navegable por clic) */}
                            <div className="w-48 border-r border-white/5 p-3 flex flex-col gap-1.5 shrink-0 bg-black/30">
                                <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-2.5">
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
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                                                isActive 
                                                    ? 'bg-white/10 text-white font-bold border border-white/10 shadow' 
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon size={14} className={isActive ? view.activeColor : 'text-slate-500'} />
                                                <span className="text-[10px] tracking-wider uppercase">{view.title}</span>
                                            </div>
                                        </button>
                                    );
                                })}

                                <div className="mt-auto p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[9px] text-slate-400 space-y-1">
                                    <div className="font-bold text-slate-300">SUNAT 2026 Ready</div>
                                    <div className="text-[8px] text-slate-500">PLE / SIRE 2026 integrado automáticamente.</div>
                                </div>
                            </div>

                            {/* Área de Visualización del Carrusel */}
                            <div className="flex-1 p-5 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950/40 to-black/60 relative">
                                
                                {/* Header Vista Activa */}
                                <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                            {showcaseViews[activeSlide].title}
                                        </span>
                                        <span className="text-[8.5px] bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded font-medium">
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
                                                    i === activeSlide ? 'w-5 bg-amber-400' : 'w-1.5 bg-slate-700 hover:bg-slate-500'
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

            {/* Modal Legal */}
            {showLoginLegal && (
                <LegalPages initialSection={showLoginLegal} onClose={() => setShowLoginLegal(null)} />
            )}
        </div>
    );
};
