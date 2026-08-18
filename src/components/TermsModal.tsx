import React, { useState } from 'react';
import { X, Shield, FileText, CheckSquare, Square, ExternalLink } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
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
            Al continuar con el registro, usted declara haber leído, comprendido y aceptado los 
            <strong className="text-blue-600 dark:text-blue-400"> Términos y Condiciones Generales de SoftContable SaaS</strong> y sus 
            <strong className="text-blue-600 dark:text-blue-400"> Políticas de Privacidad</strong>, regulados bajo las normativas vigentes en la República del Perú.
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

        {/* Pie del Modal con Checkbox de Aceptación */}
        <div className="p-5 border-t border-app-border bg-app-surface/90 flex flex-col gap-4 shrink-0">
          <label 
            onClick={() => setAccepted(!accepted)}
            className="flex items-start gap-3 cursor-pointer select-none group"
          >
            <div className="mt-0.5 text-blue-600 transition-transform group-hover:scale-110">
              {accepted ? (
                <CheckSquare size={18} className="fill-blue-600 text-white" />
              ) : (
                <Square size={18} className="text-app-muted group-hover:text-blue-500" />
              )}
            </div>
            <span className="text-xs font-bold text-app-text leading-tight">
              Acepto los <strong className="text-blue-600 underline">Términos y Condiciones generales</strong> de SoftContable y sus <strong className="text-blue-600 underline">Políticas de Privacidad</strong>.
            </span>
          </label>

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
