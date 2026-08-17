import React, { useState } from 'react';
import { webApiBridge } from '../services/apiBridge';
import Swal from 'sweetalert2';

interface ConsultasViewProps {
  currentWorkspace: any;
}

export default function ConsultasView({ currentWorkspace }: ConsultasViewProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'individual' | 'masiva'>('individual');
  const [formData, setFormData] = useState({
    rucEmisor: '',
    tipoDoc: '01',
    serie: '',
    numero: '',
    fechaEmision: '',
    total: ''
  });
  const [masivaText, setMasivaText] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const procesarFacturas = async (facturas: any[]) => {
    if (!currentWorkspace?.ruc) {
      Swal.fire('Atención', 'Debe seleccionar una empresa activa primero.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await webApiBridge.cpeDescargarLote({
        ruc: currentWorkspace.ruc,
        facturas
      });
      
      setResultados(response);
      Swal.fire('Éxito', `Consulta finalizada. ${response.length} documentos procesados.`, 'success');
    } catch (error: any) {
      console.error(error);
      Swal.fire('Error', error?.response?.data?.error || error.message || 'Error al consultar SUNAT', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConsultarIndividual = () => {
    if (!formData.rucEmisor || !formData.serie || !formData.numero) {
      Swal.fire('Faltan Datos', 'RUC Emisor, Serie y Número son obligatorios', 'warning');
      return;
    }
    
    procesarFacturas([{
      id: `ind-${Date.now()}`,
      rucEmisor: formData.rucEmisor,
      tipoDoc: formData.tipoDoc,
      serie: formData.serie,
      numero: formData.numero,
      fechaEmision: formData.fechaEmision,
      total: formData.total
    }]);
  };

  const handleConsultarMasiva = () => {
    if (!masivaText.trim()) {
      Swal.fire('Sin Datos', 'Ingrese al menos una factura en el formato RUC|TIPO|SERIE|NUMERO|FECHA|TOTAL', 'warning');
      return;
    }

    const lineas = masivaText.split('\n').filter(l => l.trim().length > 0);
    const facturas = lineas.map((linea, index) => {
      const partes = linea.split('|').map(p => p.trim());
      return {
        id: `masiva-${index}`,
        rucEmisor: partes[0] || '',
        tipoDoc: partes[1] || '01',
        serie: partes[2] || '',
        numero: partes[3] || '',
        fechaEmision: partes[4] || '',
        total: partes[5] || ''
      };
    });

    procesarFacturas(facturas);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </span>
              Consulta y Descarga API SUNAT
            </h1>
            <p className="text-gray-500 mt-1 ml-10 text-sm">
              Consulte la validez y descargue XML/CDR de facturas recibidas de forma instantánea vía OAuth2.
            </p>
          </div>
          {currentWorkspace && (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Empresa Activa: {currentWorkspace.ruc} - {currentWorkspace.name}
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form Panel */}
          <div className="col-span-1 lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button 
                  onClick={() => setActiveTab('individual')}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'individual' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Consulta Individual
                </button>
                <button 
                  onClick={() => setActiveTab('masiva')}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === 'masiva' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Consulta Masiva
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'individual' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo Documento</label>
                      <select name="tipoDoc" value={formData.tipoDoc} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm">
                        <option value="01">Factura (01)</option>
                        <option value="03">Boleta (03)</option>
                        <option value="07">Nota de Crédito (07)</option>
                        <option value="08">Nota de Débito (08)</option>
                        <option value="R1">Recibo por Honorario (R1)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">RUC Emisor</label>
                      <input name="rucEmisor" value={formData.rucEmisor} onChange={handleInputChange} placeholder="Ej. 20123456789" className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Serie</label>
                        <input name="serie" value={formData.serie} onChange={handleInputChange} placeholder="Ej. F001" className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm uppercase" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Número</label>
                        <input name="numero" value={formData.numero} onChange={handleInputChange} placeholder="Ej. 123" className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha Emisión</label>
                        <input type="date" name="fechaEmision" value={formData.fechaEmision} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Monto Total</label>
                        <input type="number" name="total" value={formData.total} onChange={handleInputChange} placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-sm" />
                      </div>
                    </div>

                    <button 
                      onClick={handleConsultarIndividual}
                      disabled={loading}
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      )}
                      Consultar y Descargar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Pegar datos (RUC|TIPO|SERIE|NUMERO|FECHA|TOTAL)
                      </label>
                      <textarea 
                        value={masivaText} 
                        onChange={(e) => setMasivaText(e.target.value)}
                        placeholder="20100000000|01|F001|1234|2023-10-01|100.50&#10;20200000000|03|B001|5678|2023-10-02|50.00"
                        className="w-full h-48 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 outline-none transition-all text-xs font-mono resize-none whitespace-nowrap overflow-auto"
                      />
                    </div>
                    
                    <button 
                      onClick={handleConsultarMasiva}
                      disabled={loading}
                      className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                      )}
                      Procesar Lote Masivo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="col-span-1 lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden min-h-[500px]">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Resultados de Consulta</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                  {resultados.length} registros
                </span>
              </div>
              
              <div className="flex-1 overflow-auto p-0">
                {resultados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p className="font-medium text-gray-500">No hay resultados para mostrar</p>
                    <p className="text-sm mt-1">Realice una consulta individual o masiva para ver los resultados aquí.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Factura</th>
                        <th className="px-6 py-3 font-semibold">Estado</th>
                        <th className="px-6 py-3 font-semibold">Archivos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultados.map((res: any, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-gray-600">
                             {/* The backend only returns ID and ESTADO by default, we could render ID here */}
                             {res.id || `Item ${idx+1}`}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                              res.estado === 'ACEPTADO' ? 'bg-emerald-100 text-emerald-700' :
                              res.estado.includes('ERROR') ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {res.estado === 'ACEPTADO' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                              {res.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {res.xmlPath ? (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-100 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  XML
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">No XML</span>
                              )}
                              
                              {res.cdrPath ? (
                                <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs border border-purple-100 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  CDR
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
