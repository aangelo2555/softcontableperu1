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
    Briefcase 
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
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 4px 30px rgba(0, 0, 0, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 0 80px rgba(37, 99, 235, 0.03);
  }
  .glass-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .glass-input:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }
  .glass-input:focus {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
  }
`;

const floatingItems = [
    { Icon: Calculator, size: 48, top: '12%', left: '10%', factor: -0.06, color: 'text-blue-500/20', delay: '0s', reverse: false },
    { Icon: TrendingUp, size: 56, top: '22%', left: '82%', factor: 0.08, color: 'text-indigo-500/20', delay: '1s', reverse: true },
    { Icon: Coins, size: 40, top: '78%', left: '12%', factor: -0.07, color: 'text-violet-500/25', delay: '2s', reverse: false },
    { Icon: Scale, size: 48, top: '72%', left: '78%', factor: 0.09, color: 'text-sky-500/20', delay: '1.5s', reverse: true },
    { Icon: Building2, size: 60, top: '8%', left: '62%', factor: -0.05, color: 'text-blue-600/15', delay: '3s', reverse: false },
    { Icon: Briefcase, size: 42, top: '50%', left: '6%', factor: 0.06, color: 'text-indigo-600/20', delay: '2.5s', reverse: true },
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

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || window.matchMedia('(hover: none)').matches);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
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
            className="min-h-screen flex items-center justify-center bg-[#060608] p-4 font-sans selection:bg-blue-500/30 overflow-hidden relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <style>{glassStyles}</style>

            {/* Fondo decorativo Parallax */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                {/* Luces de Fondo (Blobs) */}
                <div 
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[130px] rounded-full transition-transform duration-500 ease-out"
                    style={!isMobile ? { transform: `translate(${mousePos.x * -25}px, ${mousePos.y * -25}px)` } : {}}
                ></div>
                <div 
                    className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[130px] rounded-full transition-transform duration-500 ease-out"
                    style={!isMobile ? { transform: `translate(${mousePos.x * 25}px, ${mousePos.y * 25}px)` } : {}}
                ></div>

                {/* Iconos Flotantes Parallax */}
                {floatingItems.map((item, index) => {
                    const { Icon, size, top, left, factor, color, delay, reverse } = item;
                    const transformStyle = !isMobile 
                        ? {
                            transform: `translate(${mousePos.x * factor * window.innerWidth}px, ${mousePos.y * factor * window.innerHeight}px)`,
                            transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                          }
                        : {};
                    return (
                        <div
                            key={index}
                            className={`absolute ${color} ${reverse ? 'animate-float-reverse' : 'animate-float-slow'} transition-all`}
                            style={{
                                top,
                                left,
                                animationDelay: delay,
                                ...transformStyle
                            }}
                        >
                            <Icon size={size} strokeWidth={1.2} />
                        </div>
                    );
                })}
            </div>

            {/* Contenido principal */}
            <div 
                className="w-full max-w-md relative z-10 transition-transform duration-300 ease-out"
                style={!isMobile ? {
                    transform: `perspective(1000px) rotateX(${mousePos.y * -8}deg) rotateY(${mousePos.x * 8}deg) translateZ(10px)`,
                } : {}}
            >
                {/* Logo / Título */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 notranslate" translate="no">
                        SOFT<span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">CONTABLE</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-medium tracking-wide notranslate" translate="no">Sistema Contable en la Nube v2.0</p>
                </div>

                {/* Card de Login (Glassmorphic) */}
                <div className="glass-card p-8 rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden group">
                    {/* Brillo de reflejo superior */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    
                    <div className="flex mb-8 bg-black/30 p-1 rounded-2xl border border-white/[0.05]">
                        <button 
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
                        >
                            Ingresar
                        </button>
                        <button 
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
                        >
                            Registrarse
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
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
                               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
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
                               <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
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
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-500/10 border border-blue-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:pointer-events-none mt-4 cursor-pointer"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Entrar al Sistema' : 'Crear Cuenta Ahora'}
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {isLogin && (
                        <div className="mt-6 text-center">
                            <a href="#" className="text-sm text-slate-500 hover:text-blue-400 transition-colors font-medium">¿Olvidaste tu contraseña?</a>
                        </div>
                    )}
                </div>

                <p className="mt-8 text-center text-slate-600 text-xs tracking-wider notranslate" translate="no">
                    &copy; 2026 SOFTCONTABLE ERP. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
};
