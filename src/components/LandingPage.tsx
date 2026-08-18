import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Zap,
  ArrowRight,
  TrendingUp,
  Building2,
  FileSpreadsheet,
  Brain,
  Scale,
  CreditCard,
  ChevronDown
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      name: 'Estudiante / Free',
      price: 0,
      workspaces: '1 Empresa (Práctica)',
      users: '1 Usuario',
      popular: false,
      features: [
        '10 Módulos de práctica contable',
        'PCGE 2026 preconfigurado',
        'Balance de comprobación 10 columnas',
        'Exportación básica en Excel',
        'Sin límite de tiempo'
      ]
    },
    {
      name: 'Starter / Básico',
      price: billingCycle === 'annual' ? 39 : 49,
      workspaces: '3 Empresas Activas',
      users: '2 Usuarios',
      popular: false,
      features: [
        '3 Empresas en la nube',
        'Sincronización SIRE OAuth2 SUNAT',
        'Libros electrónicos PLE (TXT & Excel)',
        'Cálculo de IGV y Renta automático',
        'Soporte por correo electrónico'
      ]
    },
    {
      name: 'Profesional',
      price: billingCycle === 'annual' ? 79 : 99,
      workspaces: '8 Empresas Activas',
      users: '4 Usuarios',
      popular: true,
      features: [
        '8 Empresas en la nube',
        '4 Usuarios concurrentes',
        'Estados Financieros NIIF completos',
        'Cálculo de Impuesto a la Renta Diferido (NIC 12)',
        'Prorrata de Crédito Fiscal IGV',
        'Soporte estándar WhatsApp'
      ]
    },
    {
      name: 'Estudio Contable',
      price: billingCycle === 'annual' ? 143 : 179,
      workspaces: '20 Empresas Activas',
      users: '10 Usuarios',
      popular: false,
      features: [
        '20 Empresas en la nube',
        '10 Usuarios para tu equipo contable',
        'Módulo SoftPremium IA incluido',
        'Auditor tributario con inteligencia artificial',
        'Multi-sesión simultánea',
        'Soporte prioritario 24/7'
      ]
    },
    {
      name: 'Corporativo',
      price: billingCycle === 'annual' ? 399 : 499,
      workspaces: 'Empresas Ilimitadas (50+)',
      users: 'Usuarios Ilimitados',
      popular: false,
      features: [
        'Empresas y clientes ilimitados',
        'Acceso total para todo el consorcio',
        'SoftPremium IA sin restricciones',
        'Base de datos PostgreSQL dedicada',
        'Capacitación y onboarding personalizado',
        'SLA 99.9% garantizado'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/assets/logo.png" alt="SoftContable" className="w-8 h-8 object-contain" />
          <span className="font-black text-base uppercase tracking-wider text-white">
            SOFT<span className="text-blue-500">CONTABLE</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onLogin}
            className="text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Iniciar Sesión
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95"
          >
            Probar 14 Días Gratis
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 text-center max-w-5xl mx-auto overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-extrabold uppercase tracking-widest mb-6 animate-fade-in">
          <Sparkles size={14} className="animate-pulse text-amber-400" />
          <span>Plataforma SaaS de Contabilidad Peruana v2.0</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white leading-tight mb-6">
          La Contabilidad Inteligente <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">
            Diseñada para el Perú
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium mb-8">
          Cumplimiento tributario SUNAT, integración nativa con SIRE, estados financieros bajo NIIF y auditoría contable potenciada con Inteligencia Artificial.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 group active:scale-95"
          >
            <span>Comenzar Prueba Gratuita</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Acceso Estudiantes
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> 14 días de prueba gratis
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> Sin tarjeta de crédito
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> Cancelación en 1-clic
          </span>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl backdrop-blur-sm hover:border-blue-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap size={24} />
            </div>
            <h3 className="text-lg font-black uppercase text-white mb-2">Motor Contable en Nube</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              18 módulos de cálculo con partida doble estricta, prorrata de IGV automática, ajuste por diferencia de cambio y cierre de periodo automático.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl backdrop-blur-sm hover:border-indigo-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-black uppercase text-white mb-2">Cumplimiento SIRE & PLE</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Conexión directa vía OAuth2 con los servicios de SUNAT. Consulta de propuestas RVIE/RCE, aceptación de propuestas y generación de archivos PLE.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl backdrop-blur-sm hover:border-purple-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Brain size={24} />
            </div>
            <h3 className="text-lg font-black uppercase text-white mb-2">SoftPremium con IA</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Asistente tributario y financiero inteligente con base de conocimiento RAG especializada en la Ley del Impuesto a la Renta, IGV y NIIF peruanas.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-blue-400 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
            Precios Transparentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-4 mb-3">
            Planes a la Medida de tu Estudio
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Elige el plan ideal según la cantidad de empresas que administra tu estudio contable.
          </p>

          {/* Toggle Mensual / Anual */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-xs font-black uppercase ${billingCycle === 'monthly' ? 'text-blue-400' : 'text-slate-500'}`}>
              Facturación Mensual
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className="w-12 h-6 bg-slate-900 border border-slate-700 rounded-full p-1 transition-colors relative cursor-pointer"
            >
              <div
                className={`w-4 h-4 bg-blue-500 rounded-full transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-black uppercase flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-blue-400' : 'text-slate-500'}`}>
              Facturación Anual <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md">20% OFF</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`bg-slate-900/70 border rounded-3xl p-6 flex flex-col justify-between transition-all relative ${
                p.popular ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-md">
                  Más Popular
                </span>
              )}

              <div>
                <h4 className="text-sm font-black uppercase text-white mb-2">{p.name}</h4>
                <div className="flex items-baseline gap-1 my-4">
                  <span className="text-3xl font-black text-white">S/ {p.price}</span>
                  <span className="text-[10px] font-bold text-slate-400">/ mes</span>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl mb-5 text-center">
                  <span className="text-xs font-black text-blue-400 uppercase block">{p.workspaces}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{p.users}</span>
                </div>

                <ul className="space-y-2.5 text-[11px] text-slate-300 font-medium mb-6">
                  {p.features.map((f, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={onGetStarted}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  p.popular
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/30 active:scale-95'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                Comenzar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-800/80 bg-slate-950 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
            <span className="font-bold text-white uppercase">SoftContable SaaS</span>
            <span className="text-slate-600">•</span>
            <span>Desarrollado por <strong>Angelo Serna Simeon</strong></span>
          </div>

          <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
            <span>© 2026 SoftContable</span>
            <span className="text-slate-600">•</span>
            <span>Perú</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
