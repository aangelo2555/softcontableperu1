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
    GraduationCap
} from 'lucide-react';

import toast from 'react-hot-toast';

const glassStyles = `
  @keyframes float-slow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-12px) rotate(2deg); }
  }
  @keyframes float-reverse {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(12px) rotate(-2deg); }
  }
  .animate-float-slow {
    animation: float-slow 7s ease-in-out infinite;
  }
  .animate-float-reverse {
    animation: float-reverse 9s ease-in-out infinite;
  }
  .glass-card {
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 30px 70px rgba(0, 0, 0, 0.65),
      inset 0 1px 1px rgba(255, 255, 255, 0.05);
  }
  .glass-input {
    background: rgba(255, 255, 255, 0.012);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .glass-input:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.12);
  }
  .glass-input:focus {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.03);
  }
`;

const showcaseViews = [
    {
        id: 'dashboard',
        title: 'Panel Principal',
        icon: Layers,
        activeColor: 'text-[#d4af37]',
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-amber-500/[0.01] border border-[#d4af37]/20 rounded-2xl p-4">
                        <span className="text-[9px] text-[#d4af37] font-bold uppercase tracking-wider block mb-1">Ventas del Mes</span>
                        <span className="text-lg font-black text-white">S/ 48,250.00</span>
                        <span className="text-[9px] text-emerald-400 font-bold block mt-1.5">+12.4% vs mes ant.</span>
                    </div>
                    <div className="bg-emerald-500/[0.01] border border-emerald-500/20 rounded-2xl p-4">
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Compras del Mes</span>
                        <span className="text-lg font-black text-white">S/ 24,180.00</span>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1.5">142 comprobantes</span>
                    </div>
                    <div className="bg-sky-500/[0.01] border border-sky-500/20 rounded-2xl p-4">
                        <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider block mb-1">Impuesto RMT</span>
                        <span className="text-lg font-black text-white">S/ 4,342.00</span>
                        <span className="text-[9px] text-amber-500/80 font-bold block mt-1.5">IGV / Renta SUNAT</span>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-4 flex-1">
                    <div className="col-span-8 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block mb-2">Flujo de Caja Anual</span>
                        <div className="flex items-end justify-between h-36 pt-2 px-1">
                            {[40, 60, 45, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((h, i) => (
                                <div key={i} className="w-[6%] flex flex-col items-center gap-1.5">
                                    <div className="w-full bg-gradient-to-t from-slate-800 to-[#d4af37]/60 rounded-t" style={{ height: `${h}%` }}></div>
                                    <span className="text-[9px] text-slate-600 font-bold">{['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block mb-2">Rendimiento</span>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                    <span>Margen Neto</span>
                                    <span className="text-white font-bold">49.8%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-[#d4af37] h-full" style={{ width: '49.8%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                    <span>Ejecución Presup.</span>
                                    <span className="text-white font-bold">82.4%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{ width: '82.4%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[9px] text-slate-500 mt-2">
                            Actualizado hace unos instantes.
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
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Libro Diario General (SUNAT 5.1)</span>
                    <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">Folio: 0048</span>
                </div>
                <div className="border border-white/[0.05] rounded-2xl overflow-hidden bg-white/[0.01] flex-1 flex flex-col">
                    <table className="w-full text-left border-collapse flex-1">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                                <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Código</th>
                                <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cuenta Contable</th>
                                <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Debe (S/)</th>
                                <th className="p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Haber (S/)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-[10px]">
                            <tr>
                                <td className="p-3 font-mono font-bold text-slate-400">10411</td>
                                <td className="p-3 text-white">BCP - Moneda Nacional</td>
                                <td className="p-3 text-right text-emerald-400 font-bold">11,800.00</td>
                                <td className="p-3 text-right text-slate-700">-</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono font-bold text-slate-400">40111</td>
                                <td className="p-3 text-white">IGV - Cuenta Propia</td>
                                <td className="p-3 text-right text-slate-700">-</td>
                                <td className="p-3 text-right text-amber-500/80 font-bold">1,800.00</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono font-bold text-slate-400">70121</td>
                                <td className="p-3 text-white">Mercaderías - Venta Local</td>
                                <td className="p-3 text-right text-slate-700">-</td>
                                <td className="p-3 text-right text-amber-500/80 font-bold">10,000.00</td>
                            </tr>
                            <tr className="bg-white/[0.005]">
                                <td className="p-3 font-mono font-bold text-slate-400">60111</td>
                                <td className="p-3 text-white">Mercaderías - Compra Local</td>
                                <td className="p-3 text-right text-emerald-400 font-bold">5,000.00</td>
                                <td className="p-3 text-right text-slate-700">-</td>
                            </tr>
                            <tr className="bg-white/[0.005]">
                                <td className="p-3 font-mono font-bold text-slate-400">42121</td>
                                <td className="p-3 text-white">Facturas por Pagar - Local</td>
                                <td className="p-3 text-right text-slate-700">-</td>
                                <td className="p-3 text-right text-amber-500/80 font-bold">5,000.00</td>
                            </tr>
                            <tr className="bg-white/[0.02] font-bold">
                                <td className="p-3 text-[9px] text-slate-500 uppercase tracking-wider" colSpan={2}>Suma de Operaciones del Folio</td>
                                <td className="p-3 text-right text-emerald-400 font-black border-t border-white/10">16,800.00</td>
                                <td className="p-3 text-right text-amber-500/80 font-black border-t border-white/10">16,800.00</td>
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
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Cartera de Empresas Activas</span>
                    <span className="text-[9px] text-slate-500 font-bold">Total: 4 Registradas</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto max-h-[340px] pr-1">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">RUC 20601234567</span>
                            <h4 className="text-[11px] font-black text-white mt-2 leading-snug">AGROINDUSTRIA DEL SUR S.A.C.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-white/[0.04] pt-2 mt-2">
                            <span>Régimen: RMT</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">RUC 20459876543</span>
                            <h4 className="text-[11px] font-black text-white mt-2 leading-snug">CONSTRUCTORA HERMANOS SERNA E.I.R.L.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-white/[0.04] pt-2 mt-2">
                            <span>Régimen: GENERAL</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">RUC 20123456789</span>
                            <h4 className="text-[11px] font-black text-white mt-2 leading-snug">COMERCIAL SANTA FE S.R.L.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-white/[0.04] pt-2 mt-2">
                            <span>Régimen: MYPE</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/30 transition-colors">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">RUC 20555666777</span>
                            <h4 className="text-[11px] font-black text-white mt-2 leading-snug">SERVICIOS LOGÍSTICOS LIMA S.A.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 border-t border-white/[0.04] pt-2 mt-2">
                            <span>Régimen: GENERAL</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-xl py-2 flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors shrink-0">
                    <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider">+ Registrar Nueva Empresa / RUC</span>
                </div>
            </div>
        )
    },
    {
        id: 'reportes',
        title: 'Reportes NIIF',
        icon: PieChart,
        activeColor: 'text-indigo-400',
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Estado de Situación Financiera (ESF) - Clasificado</span>
                    <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold">NIIF / NIC 1</span>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1 text-[9.5px]">
                    {/* Columna Izquierda: Activos */}
                    <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block border-b border-white/5 pb-1 mb-2">1. ACTIVOS</span>
                            
                            <div className="space-y-1">
                                <span className="text-[8px] text-slate-500 font-bold uppercase block">Activo Corriente</span>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Efectivo y Equiv. Efectivo</span>
                                    <span className="text-white font-mono">S/ 48,250.00</span>
                                </div>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Cuentas por Cobrar Com.</span>
                                    <span className="text-white font-mono">S/ 36,500.00</span>
                                </div>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Inventarios (Mercaderías)</span>
                                    <span className="text-white font-mono">S/ 25,000.00</span>
                                </div>
                                <div className="flex justify-between pl-2 font-bold text-slate-300 border-t border-white/5 pt-0.5">
                                    <span>Total Activo Corriente</span>
                                    <span className="font-mono">S/ 109,750.00</span>
                                </div>
                            </div>

                            <div className="space-y-1 mt-3">
                                <span className="text-[8px] text-slate-500 font-bold uppercase block">Activo No Corriente</span>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Propiedad, Planta y Equip.</span>
                                    <span className="text-white font-mono">S/ 42,680.00</span>
                                </div>
                                <div className="flex justify-between pl-2 font-bold text-slate-300 border-t border-white/5 pt-0.5">
                                    <span>Total Activo No Corriente</span>
                                    <span className="font-mono">S/ 42,680.00</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between font-black text-white text-xs border-t border-white/10 pt-2 mt-2">
                            <span>TOTAL ACTIVOS</span>
                            <span className="font-mono border-b-2 border-double border-white/40">S/ 152,430.00</span>
                        </div>
                    </div>

                    {/* Columna Derecha: Pasivos y Patrimonio */}
                    <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block border-b border-white/5 pb-1 mb-2">2. PASIVO Y PATRIMONIO</span>
                            
                            <div className="space-y-1">
                                <span className="text-[8px] text-slate-500 font-bold uppercase block">Pasivo Corriente</span>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Tributos por Pagar (IGV)</span>
                                    <span className="text-white font-mono">S/ 11,800.00</span>
                                </div>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Cuentas por Pagar Com.</span>
                                    <span className="text-white font-mono">S/ 16,350.00</span>
                                </div>
                                <div className="flex justify-between pl-2 font-bold text-slate-300 border-t border-white/5 pt-0.5">
                                    <span>Total Pasivo Corriente</span>
                                    <span className="font-mono">S/ 28,150.00</span>
                                </div>
                            </div>

                            <div className="space-y-1 mt-2.5">
                                <span className="text-[8px] text-slate-500 font-bold uppercase block">Patrimonio Neto</span>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Capital Social</span>
                                    <span className="text-white font-mono">S/ 80,000.00</span>
                                </div>
                                <div className="flex justify-between pl-2">
                                    <span className="text-slate-400">Resultados Acumulados</span>
                                    <span className="text-white font-mono">S/ 30,280.00</span>
                                </div>
                                <div className="flex justify-between pl-2 font-bold text-slate-300 border-t border-white/5 pt-0.5">
                                    <span>Total Patrimonio Neto</span>
                                    <span className="font-mono">S/ 110,280.00</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between font-black text-indigo-400 text-xs border-t border-white/10 pt-2 mt-2">
                            <span>PASIVO + PATRIMONIO</span>
                            <span className="font-mono border-b-2 border-double border-indigo-400/40">S/ 152,430.00</span>
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
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });
    const [rememberMe, setRememberMe] = useState(false);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

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
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || window.matchMedia('(hover: none)').matches);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide(prev => (prev + 1) % showcaseViews.length);
        }, 4500);
        return () => clearInterval(timer);
    }, []);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isMobile) return;
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth) - 0.5;
        const y = (e.clientY / innerHeight) - 0.5;
        setMousePos({ x, y });
    };

    const handleMouseLeave = () => {
        setMousePos({ x: 0, y: 0 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLogin) {
                const res = await webApiBridge.authLogin({
                    email: formData.email,
                    password: formData.password
                });

                if (res.success) {
                    localStorage.setItem('softcontable_token', res.token);
                    if (rememberMe) {
                        localStorage.setItem('softcontable_rem_email', formData.email);
                    } else {
                        localStorage.removeItem('softcontable_rem_email');
                    }
                    // Limpiar rem_pass residual si existiese por retrocompatibilidad
                    localStorage.removeItem('softcontable_rem_pass');
                    window.location.reload();
                } else {
                    toast.error(res.error || 'Error al iniciar sesión');
                }
            } else {
                const res = isStudentModeActive
                    ? await webApiBridge.authRegisterStudent(formData)
                    : await webApiBridge.authRegister(formData);
                if (res.success) {
                    toast.success(isStudentModeActive ? 'Registro de estudiante exitoso. Ya puedes iniciar sesión.' : 'Registro exitoso. Ahora puedes iniciar sesión.');
                    setIsLogin(true);
                } else {
                    toast.error(res.error || 'Error al registrarse');
                }
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Error de conexión con el servidor';
            toast.error(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            className="min-h-screen flex items-center bg-[#09090b] font-sans selection:bg-white/10 overflow-hidden relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <style>{glassStyles}</style>

            {/* Panel de Login (Ubicado centralizado a la izquierda, z-30 para prioridad) */}
            <div className="w-full md:w-[48%] lg:w-[44%] xl:w-[40%] shrink-0 flex items-center justify-center p-6 md:p-12 relative z-30 md:ml-[1%] lg:ml-[2.5%] select-none">
                {/* Luces de Fondo para móvil */}
                <div className="absolute inset-0 md:hidden overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-[#d4af37]/3 blur-[140px] rounded-full"></div>
                    <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-slate-100/3 blur-[140px] rounded-full"></div>
                </div>

                <div 
                    className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-500"
                    style={!isMobile ? {
                        transform: `perspective(1000px) rotateX(${mousePos.y * -8}deg) rotateY(${mousePos.x * 8}deg) translateZ(15px)`,
                    } : {}}
                >
                    {/* Logo / Título */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-2 bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-[20px] shadow-lg mb-4">
                            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-14 h-14 object-contain" />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase notranslate mb-2" translate="no">
                            Soft<span className="text-white font-black">contable</span>
                        </h1>
                        <p className="text-slate-500 text-xs font-semibold tracking-[0.1em] uppercase notranslate" translate="no">Sistema Contable en la Nube v2.0</p>
                    </div>

                    {/* Card de Login (Glassmorphic) */}
                    <div className={`glass-card p-8 rounded-[32px] shadow-2xl relative overflow-hidden group select-text transition-all duration-500 ${
                        isStudentModeActive ? 'border-indigo-500/20 shadow-indigo-950/20' : ''
                    }`}>
                        {/* Brillo de reflejo superior */}
                        <div className={`absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r ${
                            isStudentModeActive ? 'from-transparent via-indigo-500/30 to-transparent' : 'from-transparent via-white/10 to-transparent'
                        }`}></div>

                        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                            <span className={`text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${
                                isStudentModeActive ? 'text-indigo-400' : 'text-slate-400'
                            }`}>
                                {isStudentModeActive ? (
                                    <>
                                        <GraduationCap size={14} className="animate-pulse" />
                                        Estudiantes
                                    </>
                                ) : (
                                    'Profesional'
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsStudentModeActive(!isStudentModeActive)}
                                className={`text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                                    isStudentModeActive
                                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {isStudentModeActive ? 'Ir a Profesional' : 'Acceso Estudiante'}
                            </button>
                        </div>
                        
                        <div className="flex mb-8 bg-white/[0.02] p-1 rounded-2xl border border-white/[0.04]">
                            <button 
                                type="button"
                                onClick={() => setIsLogin(true)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
                                    isLogin 
                                        ? isStudentModeActive 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20 font-black' 
                                            : 'bg-white text-slate-950 shadow-lg font-black' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                Ingresar
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsLogin(false)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${
                                    !isLogin 
                                        ? isStudentModeActive 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20 font-black' 
                                            : 'bg-white text-slate-950 shadow-lg font-black' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                Registrarse
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-white transition-colors" />
                                        <input 
                                            type="text"
                                            required
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full glass-input rounded-xl py-3.5 pr-4 placeholder:text-slate-600 focus:outline-none"
                                            style={{ paddingLeft: '3.25rem' }}
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                               <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                               <div className="relative group">
                                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-white transition-colors" />
                                   <input 
                                       type="email"
                                       required
                                       placeholder="usuario@ejemplo.com"
                                       className="w-full glass-input rounded-xl py-3.5 pr-4 placeholder:text-slate-600 focus:outline-none"
                                       style={{ paddingLeft: '3.25rem' }}
                                       value={formData.email}
                                       onChange={e => setFormData({...formData, email: e.target.value})}
                                   />
                               </div>
                           </div>

                           <div className="space-y-1">
                               <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Contraseña</label>
                               <div className="relative group">
                                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-white transition-colors" />
                                   <input 
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className="w-full glass-input rounded-xl py-3.5 pr-4 placeholder:text-slate-600 focus:outline-none"
                                        style={{ paddingLeft: '3.25rem' }}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                    />
                               </div>
                           </div>

                            {isLogin && (
                                <div className="flex items-center justify-between px-1 py-1">
                                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={e => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border border-white/10 bg-slate-900/50 checked:bg-white text-slate-950 focus:ring-0 focus:ring-offset-0 accent-slate-300"
                                        />
                                        <span>Recordar mis credenciales</span>
                                    </label>
                                </div>
                            )}

                             <button 
                                 type="submit"
                                 disabled={isLoading}
                                 className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:pointer-events-none mt-4 cursor-pointer text-sm tracking-wider uppercase font-black ${
                                     isStudentModeActive
                                         ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/20'
                                         : 'bg-white hover:bg-slate-200 active:scale-[0.98] text-slate-950'
                                 }`}
                             >
                                 {isLoading ? (
                                     <Loader2 className="w-5 h-5 animate-spin" />
                                 ) : (
                                     <>
                                         {isLogin 
                                             ? isStudentModeActive ? 'Entrar como Estudiante' : 'Entrar al Sistema' 
                                             : isStudentModeActive ? 'Registrarse como Estudiante' : 'Crear Cuenta'
                                         }
                                         <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                     </>
                                 )}
                             </button>
                        </form>

                        {isLogin && (
                            <div className="mt-6 text-center">
                                <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors font-medium">¿Olvidaste tu contraseña?</a>
                            </div>
                        )}
                    </div>

                    <p className="mt-8 text-center text-slate-600 text-xs tracking-wider notranslate" translate="no">
                        &copy; 2026 SOFTCONTABLE ERP. Todos los derechos reservados.
                    </p>
                </div>
            </div>

            {/* Panel de Showcase (Ubicado a la derecha, en perspectiva 3D, z-10) */}
            <div className="absolute right-[4%] lg:right-[8%] xl:right-[12%] top-1/2 -translate-y-1/2 w-[54%] h-[580px] lg:h-[640px] hidden md:flex items-center justify-center z-10 pointer-events-none">
                {/* Luces de Fondo muy tenues y elegantes */}
                <div 
                    className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-[#d4af37]/3 blur-[140px] rounded-full transition-transform duration-500 ease-out"
                    style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
                ></div>
                <div 
                    className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-slate-100/3 blur-[140px] rounded-full transition-transform duration-500 ease-out"
                    style={{ transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)` }}
                ></div>

                {/* Cajones / Botones con Parallax Avanzado en primer plano (z-20) */}
                <div 
                    className="absolute glass-card px-4 py-3 rounded-2xl border border-emerald-500/20 shadow-xl flex items-center gap-2.5 z-20 text-[10px] font-black uppercase tracking-wider text-white select-none"
                    style={{
                        top: '12%',
                        left: '0%',
                        transform: `translate(${mousePos.x * -55}px, ${mousePos.y * -55}px)`,
                        transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400">Asiento Cuadrado ✓</span>
                </div>

                <div 
                    className="absolute glass-card px-4 py-3 rounded-2xl border border-indigo-500/20 shadow-xl flex items-center gap-2.5 z-20 text-[10px] font-black uppercase tracking-wider text-white select-none"
                    style={{
                        bottom: '10%',
                        right: '8%',
                        transform: `translate(${mousePos.x * -75}px, ${mousePos.y * -75}px)`,
                        transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-400">Estados Financieros NIIF</span>
                </div>

                <div 
                    className="absolute glass-card px-4 py-3 rounded-2xl border border-amber-500/20 shadow-xl flex items-center gap-2.5 z-20 text-[10px] font-black uppercase tracking-wider text-white select-none"
                    style={{
                        top: '42%',
                        right: '-2%',
                        transform: `translate(${mousePos.x * -65}px, ${mousePos.y * -65}px)`,
                        transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">RUC SUNAT VALIDADO</span>
                </div>

                {/* Contenedor del Simulador con perspectiva 3D e inclinación isométrica */}
                <div 
                    className="relative w-full h-full opacity-90 hover:opacity-100 transition-all duration-500"
                    style={{
                        transform: `perspective(1600px) rotateY(-28deg) rotateX(10deg) rotateZ(2deg)`,
                        transformStyle: 'preserve-3d',
                    }}
                >
                    {/* Vignette Overlays para fundir la ventana con el fondo negro */}
                    <div className="absolute inset-y-0 -left-1 w-48 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute inset-y-0 -right-1 w-20 bg-gradient-to-l from-[#09090b] to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute -top-1 inset-x-0 h-20 bg-gradient-to-b from-[#09090b] to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute -bottom-1 inset-x-0 h-20 bg-gradient-to-t from-[#09090b] to-transparent z-20 pointer-events-none"></div>

                    {/* Ventana de previsualización (Showcase Mockup) */}
                    <div className="w-full h-full bg-[#0c0c0e]/95 border border-white/[0.08] rounded-3xl overflow-hidden flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative z-10">
                        {/* Barra de título macOS */}
                        <div className="h-11 border-b border-white/[0.06] bg-black/35 flex items-center justify-between px-5 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">SOFTCONTABLE ERP PREVIEW</div>
                            <div className="w-12"></div>
                        </div>

                        {/* Cuerpo de la ventana */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Barra lateral simulada (Sidebar) */}
                            <div className="w-48 border-r border-white/[0.04] p-4 flex flex-col gap-1.5 shrink-0 bg-[#0a0a0c]/60">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2 px-3">Módulos ERP</span>
                                {showcaseViews.map((view, idx) => {
                                    const Icon = view.icon;
                                    const isActive = idx === activeSlide;
                                    return (
                                        <div
                                            key={view.id}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                                                isActive 
                                                    ? 'bg-white/[0.04] text-white font-bold' 
                                                    : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            <Icon size={14} className={isActive ? view.activeColor : 'text-slate-500'} />
                                            <span className="text-[10px] tracking-wider uppercase">{view.title}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Área de trabajo simulada (Workspace) */}
                            <div className="flex-1 p-6 flex flex-col overflow-hidden relative bg-black/5">
                                {/* Cabecera del espacio de trabajo */}
                                <div className="flex justify-between items-center border-b border-white/[0.03] pb-4 mb-4 shrink-0">
                                    <div className="h-6 w-32 bg-white/[0.02] border border-white/[0.04] rounded-lg"></div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400">AC</div>
                                        <div className="h-4 w-16 bg-white/[0.02] rounded"></div>
                                    </div>
                                </div>

                                {/* Contenido dinámico del carrusel */}
                                <div className="flex-1 relative">
                                    {showcaseViews.map((view, idx) => {
                                        const isActive = idx === activeSlide;
                                        return (
                                            <div
                                                key={view.id}
                                                className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${
                                                    isActive 
                                                        ? 'opacity-100 translate-x-0 scale-100' 
                                                        : 'opacity-0 translate-x-12 scale-95 pointer-events-none'
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
        </div>
    );
};
