import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { webApiBridge } from '../services/apiBridge';
import { 
    User, 
    Lock, 
    Mail, 
    ArrowRight, 
    Loader2, 
    Calculator, 
    TrendingUp, 
    Coins, 
    Scale, 
    Building2, 
    Briefcase,
    Layers,
    PieChart,
    FileText
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
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.06);
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
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Ventas del Mes</span>
                        <span className="text-lg font-black text-white">S/ 48,250.00</span>
                        <span className="text-[9px] text-emerald-400 font-bold block mt-1.5">+12.4% vs mes ant.</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Compras del Mes</span>
                        <span className="text-lg font-black text-white">S/ 24,180.00</span>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1.5">142 comprobantes</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Impuesto RMT</span>
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
                                    <div className="w-full bg-gradient-to-t from-slate-800 to-slate-400 rounded-t" style={{ height: `${h}%` }}></div>
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
                                    <div className="bg-white h-full" style={{ width: '49.8%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                    <span>Ejecución Presup.</span>
                                    <span className="text-white font-bold">82.4%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-slate-400 h-full" style={{ width: '82.4%' }}></div>
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
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Libro Diario General (SUNAT 5.1)</span>
                    <span className="text-[9px] bg-white/5 border border-white/10 text-slate-300 px-3 py-1 rounded-full font-bold">Folio: 0048</span>
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
                                <td className="p-3 text-right text-white font-black border-t border-white/10">16,800.00</td>
                                <td className="p-3 text-right text-white font-black border-t border-white/10">16,800.00</td>
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
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Cartera de Empresas Activas</span>
                <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">RUC 20601234567</span>
                            <h4 className="text-sm font-black text-white mt-3 leading-snug">AGROINDUSTRIA DEL SUR S.A.C.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-white/[0.04] pt-3 mt-3">
                            <span>Regimen: RMT</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO SUNAT</span>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <span className="text-[8px] bg-slate-800 text-slate-300 border border-white/10 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">RUC 20459876543</span>
                            <h4 className="text-sm font-black text-white mt-3 leading-snug">CONSTRUCTORA HERMANOS SERNA E.I.R.L.</h4>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-white/[0.04] pt-3 mt-3">
                            <span>Regimen: GENERAL</span>
                            <span className="text-emerald-400 font-bold">● ACTIVO SUNAT</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Registrar Nueva Empresa / RUC en el ERP</span>
                </div>
            </div>
        )
    },
    {
        id: 'reportes',
        title: 'Reportes NIIF',
        icon: PieChart,
        content: (
            <div className="space-y-4 h-full flex flex-col justify-center animate-in fade-in duration-500">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Estado de Situación Financiera (ESF)</span>
                <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 space-y-4 flex flex-col justify-center">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Liquidez y Activos</span>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-300 mb-1 font-bold">
                                    <span>Activo Corriente</span>
                                    <span>72%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-white h-full" style={{ width: '72%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-slate-300 mb-1 font-bold">
                                    <span>Activo No Corriente</span>
                                    <span>28%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="bg-slate-500 h-full" style={{ width: '28%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 flex flex-col justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Balance General Resumido</span>
                        <div className="space-y-1.5 text-[10px] mt-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Total Activos:</span>
                                <span className="font-bold text-white">S/ 152,430.00</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Total Pasivos:</span>
                                <span className="font-bold text-white">S/ 42,150.00</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Patrimonio Neto:</span>
                                <span className="font-bold text-white">S/ 110,280.00</span>
                            </div>
                            <div className="h-[1px] bg-white/10 my-2"></div>
                            <div className="flex justify-between font-black text-white text-xs">
                                <span>Pasivo + Patrim.:</span>
                                <span>S/ 152,430.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
];

export const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

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
                    window.location.reload();
                } else {
                    toast.error(res.error || 'Error al iniciar sesión');
                }
            } else {
                const res = await webApiBridge.authRegister(formData);
                if (res.success) {
                    toast.success('Registro exitoso. Ahora puedes iniciar sesión.');
                    setIsLogin(true);
                } else {
                    toast.error(res.error || 'Error al registrarse');
                }
            }
        } catch (error: any) {
            toast.error('Error de conexión con el servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            className="min-h-screen flex flex-col md:flex-row bg-[#09090b] font-sans selection:bg-white/10 overflow-hidden relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <style>{glassStyles}</style>

            {/* Panel de Login (Izquierda, toma el 100% en móvil y ~40% en escritorio) */}
            <div className="w-full md:w-[42%] lg:w-[38%] xl:w-[35%] shrink-0 min-h-screen flex items-center justify-center p-6 md:p-10 relative z-20 overflow-y-auto">
                {/* Luces de Fondo para móvil */}
                <div className="absolute inset-0 md:hidden overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-[#d4af37]/3 blur-[140px] rounded-full"></div>
                    <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-slate-100/3 blur-[140px] rounded-full"></div>
                </div>

                <div className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-500">
                    {/* Logo / Título */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-3.5 bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-[20px] shadow-lg mb-4">
                            <Layers className="w-8 h-8 text-slate-200" strokeWidth={1.5} />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase notranslate mb-2" translate="no">
                            Soft<span className="text-white font-black">contable</span>
                        </h1>
                        <p className="text-slate-500 text-xs font-semibold tracking-[0.1em] uppercase notranslate" translate="no">Sistema Contable en la Nube v2.0</p>
                    </div>

                    {/* Card de Login (Glassmorphic) */}
                    <div className="glass-card p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
                        {/* Brillo de reflejo superior */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        
                        <div className="flex mb-8 bg-white/[0.02] p-1 rounded-2xl border border-white/[0.04]">
                            <button 
                                onClick={() => setIsLogin(true)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${isLogin ? 'bg-white text-slate-950 shadow-lg font-black' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Ingresar
                            </button>
                            <button 
                                onClick={() => setIsLogin(false)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-300 ${!isLogin ? 'bg-white text-slate-950 shadow-lg font-black' : 'text-slate-400 hover:text-slate-200'}`}
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
                                       type="text"
                                       required
                                       autoComplete="off"
                                       placeholder="••••••••"
                                       className="w-full glass-input rounded-xl py-3.5 pr-4 placeholder:text-slate-600 focus:outline-none"
                                       style={{ paddingLeft: '3.25rem', WebkitTextSecurity: 'disc' } as any}
                                       value={formData.password}
                                       onChange={e => setFormData({...formData, password: e.target.value})}
                                   />
                               </div>
                           </div>

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-white hover:bg-slate-200 active:scale-[0.98] text-slate-950 font-bold py-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:pointer-events-none mt-4 cursor-pointer text-sm tracking-wider uppercase font-black"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? 'Entrar al Sistema' : 'Crear Cuenta'}
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

            {/* Panel de Showcase (Derecha, visible solo en escritorio) */}
            <div className="hidden md:flex flex-1 min-h-screen items-center justify-center p-8 lg:p-16 relative overflow-hidden z-10">
                {/* Luces de Fondo muy tenues y elegantes */}
                <div 
                    className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-[#d4af37]/3 blur-[140px] rounded-full transition-transform duration-500 ease-out"
                    style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
                ></div>
                <div 
                    className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-slate-100/3 blur-[140px] rounded-full transition-transform duration-500 ease-out"
                    style={{ transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)` }}
                ></div>

                {/* Contenedor del Simulador con degradados de desvanecimiento en bordes */}
                <div className="relative w-full max-w-4xl h-[560px] lg:h-[620px] opacity-40 hover:opacity-60 transition-opacity duration-500">
                    {/* Vignette Overlays para fundir la ventana con el fondo negro */}
                    <div className="absolute inset-y-0 -left-1 w-48 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute inset-y-0 -right-1 w-20 bg-gradient-to-l from-[#09090b] to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute -top-1 inset-x-0 h-20 bg-gradient-to-b from-[#09090b] to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute -bottom-1 inset-x-0 h-20 bg-gradient-to-t from-[#09090b] to-transparent z-20 pointer-events-none"></div>

                    {/* Ventana de previsualización (Showcase Mockup) */}
                    <div 
                        className="w-full h-full bg-[#0c0c0e]/95 border border-white/[0.05] rounded-3xl overflow-hidden flex flex-col shadow-2xl relative z-10 transition-transform duration-500"
                        style={{
                            transform: `perspective(1000px) rotateX(${mousePos.y * -4}deg) rotateY(${mousePos.x * 4}deg) translateZ(10px)`,
                        }}
                    >
                        {/* Barra de título macOS */}
                        <div className="h-11 border-b border-white/[0.04] bg-black/25 flex items-center justify-between px-5 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
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
                                                    ? 'bg-white/[0.03] text-white font-bold' 
                                                    : 'text-slate-500'
                                            }`}
                                        >
                                            <Icon size={14} />
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
                                                        ? 'opacity-100 translate-x-0 pointer-events-auto scale-100' 
                                                        : 'opacity-0 translate-x-12 pointer-events-none scale-95'
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
