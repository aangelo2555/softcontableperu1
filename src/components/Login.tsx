import React, { useState } from 'react';
import { useStore } from '../store';
import { webApiBridge } from '../services/apiBridge';
import { User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

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
                    // Actualizar el estado global (asumiendo que añadiremos setUser al store)
                    window.location.reload(); // Forma sencilla de refrescar el estado con el nuevo token
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
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] p-4 font-sans selection:bg-blue-500/30">
            {/* Fondo decorativo */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo / Título */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2 notranslate" translate="no">
                        SOFT<span className="text-blue-500">CONTABLE</span>
                    </h1>
                    <p className="text-gray-400 text-sm notranslate" translate="no">Sistema Contable en la Nube v2.0</p>
                </div>

                {/* Card de Login */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-500">
                    <div className="flex mb-8 bg-black/20 p-1 rounded-xl">
                        <button 
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Ingresar
                        </button>
                        <button 
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Registrarse
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Nombre Completo</label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                    <input 
                                        type="text"
                                        required
                                        placeholder="Ej. Juan Pérez"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        style={{ paddingLeft: '2.75rem' }}
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Correo Electrónico</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    type="email"
                                    required
                                    placeholder="usuario@ejemplo.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    style={{ paddingLeft: '2.75rem' }}
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    type="text"
                                    required
                                    autoComplete="off"
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    style={{ paddingLeft: '2.75rem', WebkitTextSecurity: 'disc' } as any}
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:pointer-events-none mt-4"
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
                            <a href="#" className="text-sm text-gray-500 hover:text-blue-400 transition-colors">¿Olvidaste tu contraseña?</a>
                        </div>
                    )}
                </div>

                <p className="mt-8 text-center text-gray-600 text-xs notranslate" translate="no">
                    &copy; 2026 SOFTCONTABLE ERP. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
};
