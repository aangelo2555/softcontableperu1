import React, { useState } from 'react';
import { X, Shield, FileText, CheckSquare, ExternalLink } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onOpenLegal?: (section: 'terms' | 'privacy') => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept, onOpenLegal }) => {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-app-surface border border-app-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-6 border-b border-app-border bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-600/20 shadow-sm">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-app-text uppercase tracking-tight">
                Uso de SoftContable: Condiciones esenciales
              </h3>
              <p className="text-[11px] text-app-muted font-bold">
                Términos Generales, Privacidad y Tratamiento de Datos (Perú 2026)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-app-muted hover:text-app-text hover:bg-app-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Texto con Scroll */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 text-xs text-app-muted leading-relaxed flex-1">
          <p className="text-app-text font-semibold">
            Al continuar con el registro, usted declara haber leído, comprendido y aceptado los{' '}
            <button
              type="button"
              onClick={() => onOpenLegal?.('terms')}
              className="text-blue-600 dark:text-blue-400 font-black underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer inline-flex items-center gap-0.5"
            >
              Términos y Condiciones Generales de SoftContable SaaS
              <ExternalLink size={11} className="inline ml-0.5 shrink-0" />
            </button>
            {' '}y sus{' '}
            <button
              type="button"
              onClick={() => onOpenLegal?.('privacy')}
              className="text-blue-600 dark:text-blue-400 font-black underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer inline-flex items-center gap-0.5"
            >
              Políticas de Privacidad
              <ExternalLink size={11} className="inline ml-0.5 shrink-0" />
            </button>
            , regulados bajo las normativas vigentes en la República del Perú.
          </p>

          <div className="p-4 bg-app-bg rounded-2xl border border-app-border space-y-3 font-normal">
            <div className="space-y-1">
              <h4 className="font-black text-app-text text-xs uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={13} className="text-blue-500" />
                1. Naturaleza y Propósito del Software
              </h4>
              <p className="text-[11px]">
                SoftContable es una plataforma tecnológica de gestión contable, financiera y tributaria en la nube diseñada para contadores, estudios contables y empresas en Perú. Facilita la generación de libros electrónicos (SIRE, PLE), asientos contables, liquidación de IGV-Renta y balances financieros.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-app-text text-xs uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={13} className="text-blue-500" />
                2. Confidencialidad y Protección de Datos (Ley N° 29733)
              </h4>
              <p className="text-[11px]">
                Toda la información ingresada (comprobantes de compras, ventas, RUCs de clientes y asientos contables) pertenece con exclusividad al usuario y sus clientes. SoftContable garantiza estricta confidencialidad mediante cifrado SSL/TLS de 256 bits y no comercializa ni divulga información tributaria a terceros.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-app-text text-xs uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={13} className="text-blue-500" />
                3. Periodo de Prueba Gratuito (14 Días)
              </h4>
              <p className="text-[11px]">
                El registro en Modo Profesional otorga <strong>1 único periodo de prueba gratuita de 14 días con hasta 3 empresas</strong>. Al concluir los 14 días, el usuario podrá seleccionar un plan de suscripción en la pasarela de pagos para continuar con la operatividad ininterrumpida.
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-app-text text-xs uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={13} className="text-blue-500" />
                4. Responsabilidad Tributaria del Usuario
              </h4>
              <p className="text-[11px]">
                El usuario es el único responsable de la veracidad y consistencia de los datos contables registrados y de las declaraciones juradas mensuales y anuales presentadas ante la SUNAT.
              </p>
            </div>
          </div>

          <p className="text-[10px] text-app-muted italic text-center">
            Titular y Propietario Legal: <strong>Angelo Thomas Serna Simeon</strong> &bull; Lima, Perú &bull; SoftContable SaaS v2.0.0
          </p>
        </div>

        {/* Pie del Modal con Checkbox de Aceptación Bien Alineado */}
        <div className="p-5 border-t border-app-border bg-app-surface/95 flex flex-col gap-4 shrink-0">
          <div 
            onClick={() => setAccepted(!accepted)}
            className="flex items-center gap-3 p-3.5 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-2xl transition-all cursor-pointer select-none"
          >
            <div className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-transform hover:scale-105">
              {accepted ? (
                <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                  <CheckSquare size={16} className="text-white" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-md border-2 border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900" />
              )}
            </div>

            <div className="text-xs text-app-text font-medium leading-relaxed flex-1">
              <span>Acepto los </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLegal?.('terms');
                }}
                className="text-blue-600 dark:text-blue-400 font-black underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer inline-flex items-center gap-0.5"
              >
                TÉRMINOS Y CONDICIONES GENERALES
                <ExternalLink size={11} className="inline ml-0.5 shrink-0" />
              </button>
              <span> DE SOFTCONTABLE Y SUS </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLegal?.('privacy');
                }}
                className="text-blue-600 dark:text-blue-400 font-black underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer inline-flex items-center gap-0.5"
              >
                POLÍTICAS DE PRIVACIDAD
                <ExternalLink size={11} className="inline ml-0.5 shrink-0" />
              </button>
              <span>.</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-app-border text-xs font-bold text-app-muted hover:text-app-text hover:bg-app-hover transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!accepted}
              onClick={() => {
                if (accepted) {
                  onAccept();
                }
              }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all shadow-md ${
                accepted 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 cursor-pointer active:scale-95 shadow-blue-500/25'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-app-border'
              }`}
            >
              Continuar y Registrarme &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
