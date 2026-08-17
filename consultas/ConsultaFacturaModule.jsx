import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import './ConsultaFacturaModule.css';

/**
 * Módulo para Consulta de Facturas (CPE)
 * Rediseñado estilo Buzón Electrónico
 */
function ConsultaFacturaModule() {
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);

  // Cliente Consultante
  const [clientes, setClientes] = useState([]);
  const [clientesFiltrados, setClientesFiltrados] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // Datos del formulario
  const [formData, setFormData] = useState({
    rucEmisor: '',
    tipoComprobante: '01', // 01: Factura
    serie: '',
    numero: '',
    fecha: '',
    monto: ''
  });

  // Lista de consultas (historial local de sesión)
  const [listaResultados, setListaResultados] = useState([]);

  // Resultado seleccionado para ver detalle
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState(null);

  // Cargar clientes al inicio
  useEffect(() => {
    cargarClientes();
    // Click outside to close dropdown
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtrar clientes
  useEffect(() => {
    if (busqueda.trim() === '') {
      setClientesFiltrados([]);
    } else {
      const lower = busqueda.toLowerCase();
      const filtered = clientes.filter(c =>
        c.empresa.toLowerCase().includes(lower) ||
        c.ruc.includes(lower)
      );
      setClientesFiltrados(filtered);
    }
  }, [busqueda, clientes]);

  const cargarClientes = async () => {
    try {
      // Reutilizamos el método de Buzón (API compartida para leer clientes desde Excel/DB)
      const result = await window.electronAPI.buzonObtenerClientes();
      if (result.success) {
        setClientes(result.clientes);
      } else {
        console.error('Error cargando clientes:', result.error);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  };

  const handleSelectCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setBusqueda(`${cliente.empresa} - ${cliente.ruc}`);
    setShowDropdown(false);
  };

  /**
   * Auto-cargar Excel cuando se selecciona un cliente
   * DESACTIVADO: Ahora se usa botón manual
   */
  // useEffect(() => {
  //   if (clienteSeleccionado) {
  //     cargarExcelCliente(clienteSeleccionado);
  //   } else {
  //     // Limpiar datos de Excel si no hay cliente
  //     setExcelData(null);
  //     setSelectedSheet(null);
  //     setExcelHeaders([]);
  //     setExcelRows([]);
  //   }
  // }, [clienteSeleccionado]);

  /**
   * Cargar Excel automáticamente para el cliente seleccionado
   */
  const cargarExcelCliente = async (cliente) => {
    try {
      const result = await window.electronAPI.cpeCargarExcelCliente({
        ruc: cliente.ruc,
        empresa: cliente.empresa
      });

      if (result.success) {
        // Mostrar selector de archivos con la lista
        setArchivosDisponibles(result.archivos || []);
        setShowFileSelector(true);
      } else {
        console.error('Error al cargar Excel:', result.error);
        Swal.fire({
          title: 'Sin archivos Excel',
          text: result.error,
          icon: 'info'
        });
      }
    } catch (error) {
      console.error('Error al cargar Excel:', error);
    }
  };

  /**
   * Abrir un archivo Excel específico desde el selector
   */
  const abrirArchivoSeleccionado = async (archivo) => {
    try {
      let result;

      if (viewMode === 'produccion') {
        // Modo Producción: Usar lector genérico de Excel
        const sheetsResult = await window.electronAPI.invoke('excel:get-sheets', archivo.ruta);

        if (sheetsResult.success) {
          // Configurar estados para modal de producción
          setProduccionExcelPath(archivo.ruta);
          setProduccionSheets(sheetsResult.sheets);
          setShowFileSelector(false);

          // Auto-seleccionar primera hoja (esto abrirá el modal de previsualización)
          if (sheetsResult.sheets.length > 0) {
            handleProduccionSeleccionarHoja(sheetsResult.sheets[0], archivo.ruta);
          }
          return; // Salir temprano
        } else {
          console.error('Error al abrir Excel (Producción):', sheetsResult.error);
          Swal.fire('Error', 'No se pudo leer el archivo Excel', 'error');
          return;
        }
      }

      // Modo Normal (Individual/Masiva): Usar handler CPE específico
      result = await window.electronAPI.cpeAbrirArchivoExcel({
        excelPath: archivo.ruta
      });

      if (result.success) {
        setExcelData(result);
        setShowFileSelector(false);
        // Auto-seleccionar primera hoja
        if (result.sheets && result.sheets.length > 0) {
          handleSeleccionarHoja(result.sheets[0], result.excelPath);
        }
      } else {
        console.error('Error al abrir Excel:', result.error);
        Swal.fire('Error', 'No se pudo abrir el archivo Excel', 'error');
      }
    } catch (error) {
      console.error('Error al abrir Excel:', error);
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Seleccionar y cargar datos de una hoja específica
   */
  const handleSeleccionarHoja = async (sheetName, excelPath) => {
    if (!excelPath) excelPath = excelData?.excelPath;
    if (!excelPath) return;

    try {
      let result;
      if (viewMode === 'produccion') {
        // Usar lector genérico
        result = await window.electronAPI.invoke('excel:read-sheet', { filePath: excelPath, sheetName });
        // Normalizar respuesta para que coincida con lo que espera el estado
        if (result.success && result.data) {
          result.rows = result.data; // excel:read-sheet devuelve 'data', el estado espera 'rows' (o lo usamos como rows)
          if (result.data.length > 0) {
            result.headers = result.data[0].map(c => c ? c.toString() : '');
          }
        }
      } else {
        // Usar lector específico de CPE (que podría tener lógica extra de parsing)
        result = await window.electronAPI.cpeLeerHojaExcel({
          excelPath: excelPath,
          sheetName: sheetName
        });
      }

      if (result.success) {
        setSelectedSheet(sheetName);
        setExcelHeaders(result.headers || []);
        setExcelRows(result.rows || []);
      } else {
        console.error('Error al leer hoja:', result.error);
        Swal.fire('Error', 'No se pudo leer la hoja seleccionada', 'error');
      }
    } catch (error) {
      console.error('Error al leer hoja:', error);
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Manejar click en fila de Excel
   * Extrae: RUC (col M=12), SERIE (col H=7), NUMERO (col J=9)
   */
  const handleClickFilaExcel = (row) => {
    const ruc = row[12] || ''; // Columna M
    const serie = row[7] || ''; // Columna H
    const numero = row[9] || ''; // Columna J

    if (viewMode === 'individual') {
      // Auto-completar formulario
      setFormData(prev => ({
        ...prev,
        rucEmisor: ruc,
        serie: serie,
        numero: numero
      }));
    } else if (viewMode === 'masiva') {
      // Agregar línea al textarea
      // Formato simplificado: RUC|SERIE|NUMERO (siempre son Facturas)
      const nuevaLinea = `${ruc}|${serie}|${numero}`;
    } else if (viewMode === 'produccion') {
      // Agregar fila individual a la grilla de producción
      // Columnas: M (12) RUC, H (7) SERIE, J (9) NUMERO
      const ruc = row[12];
      const serie = row[7];
      const numero = row[9];
      const tipo = row[4]; // Columna E (TIPO) - A veces es índice 4

      if (!ruc || !serie || !numero) return;

      const newItem = {
        id: produccionRows.length,
        fecha: row[6], // Columna G
        tipoIdx: tipo || '01',
        serie,
        numero,
        ruc,
        monto: row[11], // Columna L
        razonSocial: row[5], // Columna F
        status: 'PENDIENTE',
        message: ''
      };

      // Evitar duplicados
      if (!produccionRows.some(r => r.serie === serie && r.numero === numero && r.ruc === ruc)) {
        setProduccionRows(prev => [...prev, newItem]);
        setProduccionStats(prev => ({ ...prev, total: prev.total + 1, faltantes: prev.faltantes + 1 }));
      }
    }
  };

  /**
   * Seleccionar todas las filas del Excel (solo Masiva)
   */
  const handleSeleccionarTodos = () => {
    if ((viewMode !== 'masiva' && viewMode !== 'produccion') || excelRows.length === 0) return;

    // Modificado: Empezar desde el índice 4 (Fila 5) en masiva, índice 7 (Fila 8) en producción
    const rowsToProcess = viewMode === 'produccion' ? excelRows.slice(7) : excelRows.slice(4);

    if (viewMode === 'masiva') {
      const lineas = rowsToProcess.map(row => {
        const ruc = row[12] || '';
        const serie = row[7] || '';
        const numero = row[9] || '';
        return `${ruc}|${serie}|${numero}`;
      }).filter(linea => linea.split('|').every(campo => campo.trim()));

      setMasivaData(lineas.join('\n'));

      Swal.fire({
        title: '✅ Filas cargadas',
        text: `${lineas.length} facturas agregadas al listado`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } else if (viewMode === 'produccion') {
      // Lógica masiva para producción
      const newItems = [];
      let skipped = 0;

      rowsToProcess.forEach(row => {
        const ruc = row[12];
        const serie = row[7];
        const numero = row[9];

        if (ruc && serie && numero) {
          newItems.push({
            id: produccionRows.length + newItems.length,
            fecha: row[6] || '',
            tipoIdx: row[4] || '01',
            serie,
            numero,
            ruc,
            monto: row[11] || '',
            razonSocial: row[5] || '',
            status: 'PENDIENTE',
            message: ''
          });
        } else {
          skipped++;
        }
      });

      if (newItems.length > 0) {
        setProduccionRows(newItems); // Reemplaza o agrega? "Seleccionar todos" suele ser set completo, pero user dijo "selección".
        // Para "todos", reemplazamos lo actual para evitar duplicados masivos confusos, o preguntamos. 
        // Asumiremos REEMPLAZO para limpiar y cargar, que es lo estándar en importación.
        setProduccionStats({
          total: newItems.length,
          procesados: 0,
          errores: 0,
          faltantes: newItems.length
        });

        // CERRAR MODAL y mostrar éxito
        setExcelData(null);
        setExcelRows([]);

        Swal.fire({
          title: '✅ Datos Importados',
          text: `Se cargaron ${newItems.length} registros (omitidos: ${skipped})`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire('Error', 'No se encontraron filas válidas (RUC, SERIE, NUMERO)', 'warning');
      }
    }
  };

  // Manejo de inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // View Mode: 'individual' | 'masiva' | 'visualizar'
  const [viewMode, setViewMode] = useState('individual');
  const [masivaData, setMasivaData] = useState('');
  const [masivaResult, setMasivaResult] = useState(null);
  const [selectedMassIds, setSelectedMassIds] = useState(new Set());

  // Excel State
  const [excelData, setExcelData] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelRows, setExcelRows] = useState([]);
  const [archivosDisponibles, setArchivosDisponibles] = useState([]);
  const [showFileSelector, setShowFileSelector] = useState(false);

  // Ver Constancias State
  const [showConstancias, setShowConstancias] = useState(false);
  const [constanciasList, setConstanciasList] = useState([]);
  const [selectedConstancia, setSelectedConstancia] = useState(null);

  // Visualizar Facturas State
  const [visualizacionData, setVisualizacionData] = useState(null);
  const [visualizacionSessionId, setVisualizacionSessionId] = useState(null);
  const [visualizandoLoading, setVisualizandoLoading] = useState(false);
  // Refs para los webviews persistentes
  const visualizarWebviewRef = useRef(null);
  const emitirWebviewRef = useRef(null);

  // Emitir Facturas State
  const [emitirData, setEmitirData] = useState(null);
  const [emitirSessionId, setEmitirSessionId] = useState(null);
  const [emitiendoLoading, setEmitiendoLoading] = useState(false);



  // MODO PRODUCCIÓN STATE
  const [produccionData, setProduccionData] = useState(null); // { headers, rows }
  const [produccionRows, setProduccionRows] = useState([]); // Processed rows with status
  const [produccionStats, setProduccionStats] = useState({ total: 0, procesados: 0, errores: 0, faltantes: 0 });
  const [produccionSheets, setProduccionSheets] = useState([]);
  const [produccionSelectedSheet, setProduccionSelectedSheet] = useState('');
  const [produccionExcelPath, setProduccionExcelPath] = useState('');
  const [produccionLoading, setProduccionLoading] = useState(false);
  const [produccionFolder, setProduccionFolder] = useState(''); // Carpeta de salida

  // Sincronizar zoom global con webviews de SUNAT
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onZoomChanged) {
      window.electronAPI.onZoomChanged((zoomFactor) => {
        // Aplicar zoom a ambos webviews si existen
        if (visualizarWebviewRef.current) {
          visualizarWebviewRef.current.setZoomFactor(zoomFactor);
        }
        if (emitirWebviewRef.current) {
          emitirWebviewRef.current.setZoomFactor(zoomFactor);
        }
      });
    }
  }, []);

  /**
   * Cargar constancias (archivos descargados) del cliente consultante
   */
  const handleVerConstancias = async () => {
    if (!clienteSeleccionado) {
      return Swal.fire({
        title: 'Seleccione un cliente',
        text: 'Por favor seleccione un empresa consultante primero',
        icon: 'warning'
      });
    }

    try {
      const result = await window.electronAPI.cpeListarConstancias({
        rucConsultante: clienteSeleccionado.ruc
      });

      if (result.success) {
        setConstanciasList(result.archivos || []);
        setShowConstancias(true);

        if (result.archivos.length === 0) {
          Swal.fire({
            title: 'Sin archivos',
            text: 'No hay archivos descargados para este RUC',
            icon: 'info'
          });
        }
      } else {
        Swal.fire('Error', result.error || 'No se pudieron listar los archivos', 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Enviar archivo local por Email
   */
  const handleEnviarConstanciaEmail = async (archivo) => {
    if (!clienteSeleccionado) return;

    const { value: emailDestino } = await Swal.fire({
      title: 'Enviar por Email',
      input: 'email',
      inputLabel: 'Destino de correo',
      inputValue: clienteSeleccionado.email || '',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      inputPlaceholder: 'ejemplo@correo.com'
    });

    if (!emailDestino) return;

    Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.invoke('email:enviar-con-adjuntos', {
        destinatario: emailDestino,
        asunto: `Constancia CPE - ${archivo.nombre}`,
        mensaje: `Adjunto: ${archivo.nombre}\n\nTipo: ${archivo.tipo}\nFecha: ${new Date(archivo.fechaModificacion).toLocaleString()}`,
        archivos: [archivo.ruta]
      });

      if (result.success) {
        Swal.fire('✅ Enviado', `Email enviado a ${emailDestino}`, 'success');
      } else {
        Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Enviar archivo local por WhatsApp
   */
  const handleEnviarConstanciaWhatsApp = async (archivo) => {
    if (!clienteSeleccionado) return;

    // Verificar WhatsApp conectado
    const statusResult = await window.electronAPI.getWhatsAppStatus();
    if (!statusResult.success || !statusResult.status.isReady) {
      return Swal.fire({
        title: 'WhatsApp no conectado',
        text: 'Por favor conecta WhatsApp desde el botón en el header',
        icon: 'warning'
      });
    }

    const { value: phoneNumber } = await Swal.fire({
      title: 'Enviar por WhatsApp',
      input: 'text',
      inputLabel: 'Número de WhatsApp',
      inputValue: clienteSeleccionado.whatsapp || '',
      inputPlaceholder: '51987654321',
      showCancelButton: true,
      confirmButtonText: 'Enviar'
    });

    if (!phoneNumber) return;

    Swal.fire({
      title: 'Enviando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const result = await window.electronAPI.sendWhatsAppFile({
        phone: phoneNumber,
        filePath: archivo.ruta,
        caption: `📄 Constancia CPE\n\nArchivo: ${archivo.nombre}\nTipo: ${archivo.tipo}\nFecha: ${new Date(archivo.fechaModificacion).toLocaleString()}`
      });

      if (result.success) {
        Swal.fire('✅ Enviado', 'Archivo enviado por WhatsApp', 'success');
      } else {
        Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Abrir Visualización de Facturas
   * Abre el portal SUNAT con auto-login y muestra el iframe
   */
  const handleVisualizarFacturas = async () => {
    if (!clienteSeleccionado) {
      return Swal.fire({
        title: 'Seleccione un cliente',
        text: 'Por favor seleccione una empresa consultante primero',
        icon: 'warning'
      });
    }

    setVisualizandoLoading(true);

    try {
      const result = await window.electronAPI.cpeVisualizarFacturas({
        rucConsultante: clienteSeleccionado.ruc
      });

      if (result.success) {
        setVisualizacionData(result);
        setVisualizacionSessionId(result.sessionId);

        Swal.fire({
          title: '✅ Visualización iniciada',
          text: `Portal SUNAT abierto para ${clienteSeleccionado.empresa}`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire('Error', result.error || 'No se pudo iniciar la visualización', 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setVisualizandoLoading(false);
    }
  };

  /**
   * Abrir Emisión de Facturas
   * Abre el portal SUNAT de emisión con auto-login y muestra el iframe
   */
  const handleEmitirFacturas = async () => {
    if (!clienteSeleccionado) {
      return Swal.fire({
        title: 'Seleccione un cliente',
        text: 'Por favor seleccione una empresa consultante primero',
        icon: 'warning'
      });
    }

    setEmitiendoLoading(true);

    try {
      const result = await window.electronAPI.cpeEmitirFacturas({
        rucConsultante: clienteSeleccionado.ruc
      });

      if (result.success) {
        setEmitirData(result);
        setEmitirSessionId(result.sessionId);

        Swal.fire({
          title: '✅ Emisión iniciada',
          text: `Portal SUNAT de emisión abierto para ${clienteSeleccionado.empresa}`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire('Error', result.error || 'No se pudo iniciar la emisión', 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setEmitiendoLoading(false);
    }
  };

  /**
   * MODO PRODUCCIÓN: Abrir Excel
   */
  const handleProduccionAbrirExcel = async () => {
    try {
      // Usar el mismo diálogo que para cargar excel de cliente
      const result = await window.electronAPI.invoke('cpe-abrir-archivo-excel', {});

      if (result.success || result.filePaths) {
        // Nota: cpe-abrir-archivo-excel retorna excelPath o filePaths dependiendo de la implementación
        const path = result.excelPath || (result.filePaths && result.filePaths[0]);

        if (!path) return;

        setProduccionExcelPath(path);

        // Obtener hojas
        const sheetsResult = await window.electronAPI.invoke('excel:get-sheets', path);
        if (sheetsResult.success) {
          setProduccionSheets(sheetsResult.sheets);
          // Auto-seleccionar si hay hojas
          if (sheetsResult.sheets.length > 0) {
            handleProduccionSeleccionarHoja(sheetsResult.sheets[0], path);
          }
        } else {
          Swal.fire('Error', 'No se pudieron leer las hojas del Excel', 'error');
        }
      }
    } catch (error) {
      console.error('Error abriendo excel producción:', error);
      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * MODO PRODUCCIÓN: Seleccionar Hoja y Cargar Datos
   */
  const handleProduccionSeleccionarHoja = async (sheetName, filePath) => {
    const path = filePath || produccionExcelPath;
    if (!path) return;

    setProduccionLoading(true);
    setProduccionSelectedSheet(sheetName);

    try {
      // Usar servicio genérico de lectura excel
      const result = await window.electronAPI.invoke('excel:read-sheet', { filePath: path, sheetName });

      if (result.success) {
        const rawData = result.data || [];

        // EN LUGAR DE PROCESAR DIRECTAMENTE, ABRIMOS EL MODAL
        // Configurar estados para el modal compartido
        setExcelData({
          excelPath: path,
          sheets: produccionSheets // Mantener info de hojas
        });
        setExcelRows(rawData);

        // Header inferido o vacío
        if (rawData.length > 0) {
          setExcelHeaders(rawData[0].map(c => c ? c.toString() : ''));
        }

        // El modal se mostrará automáticamente porque (clienteSeleccionado && excelData && excelRows) será true

      } else {
        Swal.fire('Error', 'No se pudo leer la hoja', 'error');
      }
    } catch (error) {
      console.error('Error leyendo hoja:', error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setProduccionLoading(false);
    }
  };

  /**
   * MODO PRODUCCIÓN: Descargar Masivo y Unir
   * REUTILIZA sesiones existentes de la consulta masiva
   */
  const handleProduccionDescargarMasivo = async () => {
    if (!clienteSeleccionado) {
      Swal.fire('Seleccione Cliente', 'Debe seleccionar una empresa consultante (arriba a la izquierda)', 'warning');
      return;
    }
    if (produccionRows.length === 0) {
      Swal.fire('Sin Datos', 'Cargue un Excel primero', 'warning');
      return;
    }

    // Filtrar solo las filas procesadas correctamente (que tienen sessionId)
    const filasConSesion = produccionRows.filter(row => row.status === 'OK' && row.sessionId);

    if (filasConSesion.length === 0) {
      Swal.fire('Sin Sesiones', 'Primero debe procesar la lista con "Procesar Lista"', 'warning');
      return;
    }

    setProduccionLoading(true);

    try {
      // Agrupar por mes/año para organizar carpetas
      const porMesAnio = {};

      filasConSesion.forEach(row => {
        // Extraer mes/año de la fecha
        let mesAnio = 'SIN_FECHA';
        if (row.fecha) {
          try {
            // Intentar parsear fecha (puede venir en varios formatos)
            const dateStr = row.fecha.toString();
            let fecha;

            // Formato dd/mm/yyyy
            if (dateStr.includes('/')) {
              const [dia, mes, anio] = dateStr.split('/');
              if (mes && anio) {
                const mesNum = mes.padStart(2, '0');
                const anioCorto = anio.length === 2 ? '20' + anio : anio;
                mesAnio = `${mesNum}-${anioCorto}`; // Formato: MM-YYYY
              }
            }
            // Formato ISO o timestamp
            else {
              fecha = new Date(row.fecha);
              if (!isNaN(fecha.getTime())) {
                const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
                const anio = fecha.getFullYear();
                mesAnio = `${mes}-${anio}`;
              }
            }
          } catch (e) {
            console.warn('No se pudo parsear fecha:', row.fecha, e);
          }
        }

        if (!porMesAnio[mesAnio]) {
          porMesAnio[mesAnio] = [];
        }
        porMesAnio[mesAnio].push(row);
      });

      // Mostrar progreso
      Swal.fire({
        title: 'Descargando PDFs...',
        html: `
          <div style="margin: 20px 0;">
            <div id="download-progress-bar" style="width: 100%; background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
              <div id="download-progress-fill" style="width: 0%; background: linear-gradient(90deg, #10b981, #059669); height: 100%; transition: width 0.3s;"></div>
            </div>
            <p id="download-progress-text" style="margin-top: 10px; font-size: 14px;">Preparando descargas...</p>
          </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
      });

      const progressBar = document.getElementById('download-progress-fill');
      const progressText = document.getElementById('download-progress-text');

      let totalDescargados = 0;
      let totalErrores = 0;
      const archivosPorCarpeta = {}; // {carpeta: [archivos]}
      const newRows = [...produccionRows];

      // Procesar todas las filas (reutilizar sessionId)
      for (let i = 0; i < filasConSesion.length; i++) {
        const row = filasConSesion[i];

        try {
          // Actualizar progreso
          const progreso = Math.round(((i + 1) / filasConSesion.length) * 100);
          if (progressBar) progressBar.style.width = progreso + '%';
          if (progressText) progressText.textContent = `Descargando ${i + 1} de ${filasConSesion.length}...`;

          // Descargar usando la sesión existente
          const downloadResult = await window.electronAPI.cpeDescargar({
            sessionId: row.sessionId,
            tipo: 'PDF',
            cpe: {
              rucEmisor: row.ruc,
              tipoDoc: row.tipoIdx?.toString().padStart(2, '0') || '01',
              serie: row.serie,
              numero: row.numero
            }
          });

          if (downloadResult.success && downloadResult.path) {
            // Determinar carpeta de destino
            let mesAnio = 'SIN_FECHA';
            if (row.fecha) {
              try {
                const dateStr = row.fecha.toString();
                if (dateStr.includes('/')) {
                  const [dia, mes, anio] = dateStr.split('/');
                  if (mes && anio) {
                    const mesNum = mes.padStart(2, '0');
                    const anioCorto = anio.length === 2 ? '20' + anio : anio;
                    mesAnio = `${mesNum}-${anioCorto}`;
                  }
                } else {
                  const fecha = new Date(row.fecha);
                  if (!isNaN(fecha.getTime())) {
                    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
                    const anio = fecha.getFullYear();
                    mesAnio = `${mes}-${anio}`;
                  }
                }
              } catch (e) {
                // Usar carpeta genérica
              }
            }

            const carpeta = `C:\\AUTOMATIZADOR\\${clienteSeleccionado.ruc}\\${mesAnio}`;

            if (!archivosPorCarpeta[carpeta]) {
              archivosPorCarpeta[carpeta] = [];
            }
            archivosPorCarpeta[carpeta].push(downloadResult.path);

            // Actualizar row
            const rowIndex = produccionRows.findIndex(r => r.id === row.id);
            if (rowIndex !== -1) {
              newRows[rowIndex].status = 'OK';
              newRows[rowIndex].pdfPath = downloadResult.path;
            }

            totalDescargados++;
          } else {
            // Error en descarga
            const rowIndex = produccionRows.findIndex(r => r.id === row.id);
            if (rowIndex !== -1) {
              newRows[rowIndex].status = 'ERROR';
              newRows[rowIndex].message = downloadResult.error || 'Error al descargar';
            }
            totalErrores++;
          }
        } catch (error) {
          console.error('Error descargando:', error);
          const rowIndex = produccionRows.findIndex(r => r.id === row.id);
          if (rowIndex !== -1) {
            newRows[rowIndex].status = 'ERROR';
            newRows[rowIndex].message = error.message;
          }
          totalErrores++;
        }
      }

      // Actualizar estado
      setProduccionRows(newRows);
      setProduccionStats({
        total: newRows.length,
        procesados: totalDescargados,
        errores: totalErrores,
        faltantes: newRows.length - totalDescargados - totalErrores
      });

      // 4. UNIR PDFs por carpeta
      if (totalDescargados > 0) {
        Swal.fire({
          title: 'Uniendo PDFs...',
          text: 'Generando archivos combinados (2x1) por carpeta',
          didOpen: () => Swal.showLoading()
        });

        const resultadosUnion = [];
        for (const [carpeta, archivos] of Object.entries(archivosPorCarpeta)) {
          try {
            const mergeResult = await window.electronAPI.invoke('pdf:merge-files', {
              inputFiles: archivos,
              outputDir: carpeta
            });

            if (mergeResult.success) {
              resultadosUnion.push({
                carpeta,
                archivosOriginales: archivos.length,
                archivosUnidos: mergeResult.generatedFiles || [],
                totalUnidos: mergeResult.generatedFiles?.length || 0
              });
            }
          } catch (error) {
            console.error(`Error uniendo PDFs en ${carpeta}:`, error);
          }
        }

        // Mostrar resumen mejorado
        const carpetas = Object.keys(archivosPorCarpeta);
        const totalUnidos = resultadosUnion.reduce((sum, r) => sum + r.totalUnidos, 0);

        const listaUnidos = resultadosUnion
          .flatMap(r => (r.archivosUnidos || []).map(fullPath => {
            const nombre = fullPath.split('\\').pop();
            const mes = r.carpeta.split('\\').pop();
            return `  • <code>${nombre}</code> (${mes})`;
          }))
          .join('<br>');

        Swal.fire({
          title: '¡Proceso Terminado!',
          html: `
            📊 <b>Resumen:</b><br>
            ✅ Descargados: ${totalDescargados}<br>
            ❌ Errores: ${totalErrores}<br>
            📦 PDFs Unidos: ${total Unidos
        } archivos < br >
        <br>
          📁 <b>Organización por Mes/Año:</b><br>
            ${carpetas.map(c => {
              const mes = c.split('\\').pop();
              const resultado = resultadosUnion.find(r => r.carpeta === c);
              return `<b>${mes}</b> → ${resultado ? resultado.totalUnidos : 0} unidos (${resultado ? resultado.archivosOriginales : 0} originales)`;
            }).join('<br>')}<br>
              <br>
                ${listaUnidos ? `
              📄 <b>Archivos Unidos (2-en-1):</b><br>
              <div style="max-height: 120px; overflow-y: auto; text-align: left; font-size: 0.8rem; margin: 8px 0; padding: 10px; background: #f1f5f9; border-radius: 4px; border-left: 3px solid #3b82f6;">
                ${listaUnidos}
              </div>
            ` : ''}
                <div style="display: flex; gap: 8px; justify-content: center; margin-top: 15px;">
                  <button id="open-ruc-folder" style="padding: 10px 18px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
                    📂 Carpeta Principal
                  </button>
                  ${carpetas.length > 0 ? `
                <button id="open-first-month" style="padding: 10px 18px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
                  📁 Ver ${carpetas[0].split('\\').pop()}
                </button>
              ` : ''}
                </div>
                `,
                icon: 'success',
                width: '650px',
          didOpen: () => {
                  document.getElementById('open-ruc-folder')?.addEventListener('click', () => {
                    window.electronAPI.openExternal(`C:\\AUTOMATIZADOR\\${clienteSeleccionado.ruc}`);
                    Swal.close();
                  });
            if (carpetas.length > 0) {
                  document.getElementById('open-first-month')?.addEventListener('click', () => {
                    window.electronAPI.openExternal(carpetas[0]);
                    Swal.close();
                  });
            }
          }
        });
      } else {
                  Swal.fire('Sin Descargas', 'No se pudo descargar ningún PDF válido.', 'error');
      }

    } catch (error) {
                  console.error('Error en proceso masivo:', error);
                Swal.fire('Error Crítico', error.message, 'error');
    } finally {
                  setProduccionLoading(false);
    }
  };

  /**
   * Realizar la consulta CPE (Individual)
   */
  const handleConsultar = async (e) => {
                  e.preventDefault();

                // Validaciones básicas
                if (!clienteSeleccionado) {
                  Swal.fire({
                    title: 'Error',
                    text: 'Por favor, seleccione una empresa (Consultante) primero.',
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6'
                  });
                return;
    }

                if (!formData.rucEmisor || !formData.serie || !formData.numero) {
                  Swal.fire({
                    title: 'Error',
                    text: 'Por favor, complete RUC Emisor, Serie y Número',
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6'
                  });
                return;
    }

                setLoading(true);
                try {
      const result = await window.electronAPI.cpeConsultar({
                  rucConsultante: clienteSeleccionado.ruc, // Importante: pasamos el RUC del consultante
                rucEmisor: formData.rucEmisor,
                tipoDoc: formData.tipoComprobante,
                serie: formData.serie,
                numero: formData.numero,
                fecha: formData.fecha,
                monto: formData.monto
      });

                if (result.success) {
        // ACTUALIZAR ESTADÍSTICAS
        try {
                  await window.electronAPI.invoke('user:update-stats', {
                    key: 'consultasHoy',
                    value: 1,
                    isIncrement: true
                  });
        } catch (statError) {
                  console.error('Error actualizando stats:', statError);
        }

                // Agregar a la lista de resultados
                const nuevoResultado = {
                  id: result.sessionId, // Usamos el sessionId como ID único
                formData: {...formData},
                data: result.data || { },
                timestamp: new Date().toISOString(),
                estado: result.data?.estado || 'DESCONOCIDO'
        };

        setListaResultados(prev => [nuevoResultado, ...prev]);
                setResultadoSeleccionado(nuevoResultado);
                setActiveSession(result.sessionId);

                // Notificación discreta
                const Toast = Swal.mixin({
                  toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
        });
                Toast.fire({
                  icon: 'success',
                title: 'Consulta realizada con éxito'
        });

      } else {
                  Swal.fire({
                    title: 'Error en la consulta',
                    text: result.error || 'No se pudo obtener información',
                    icon: 'error',
                    confirmButtonColor: '#3b82f6'
                  });
      }
    } catch (error) {
                  console.error('Error al consultar:', error);
                Swal.fire({
                  title: 'Error de sistema',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#3b82f6'
      });
    } finally {
                  setLoading(false);
    }
  };

  /**
   * Realizar Consulta Masiva
   */
  const handleConsultarMasivo = async () => {
    // Validar que haya un cliente seleccionado
    if (!clienteSeleccionado) {
                  Swal.fire({
                    title: 'Cliente Requerido',
                    text: 'Por favor, seleccione una empresa consultante.',
                    icon: 'warning',
                    confirmButtonColor: '#3b82f6'
                  });
                return;
    }

                if (!masivaData.trim()) {
                  Swal.fire('Ingrese datos', 'Pegue la lista de comprobantes (RUC|SERIE|NUMERO)', 'warning');
                return;
    }

    // Parsear datos - Formato: RUC|SERIE|NUMERO (sin TIPO, siempre Factura)
    const lineas = masivaData.split('\n').filter(l => l.trim().length > 0);
                const lista = [];

    lineas.forEach(linea => {
      const partes = linea.split(/\||,|\t|\s{2,}/).map(p => p.trim());
      if (partes.length >= 3) {
                  lista.push({
                    rucEmisor: partes[0],
                    tipoDoc: '01', // Siempre Factura para consultas masivas
                    serie: partes[1],
                    numero: partes[2],
                    filtro: 'recibido'
                  });
      }
    });

                if (lista.length === 0) {
                  Swal.fire('Formato incorrecto', 'No se detectaron líneas válidas. Use el formato: RUC|SERIE|NUMERO', 'error');
                return;
    }

                setLoading(true);
                try {
      const result = await window.electronAPI.invoke('cpe-scraping-consultar-masivo', {
                  sessionId: activeSession, // Puede ser null, no es requerido
                listaComprobantes: lista,
                cliente: {
                  ruc: clienteSeleccionado.ruc
          // Las credenciales se obtendrán automáticamente del API_SIRE.xlsm en el backend
        }
      });

                if (result.success) {
                  setMasivaResult(result);

                // ACTUALIZAR ESTADÍSTICAS
                try {
          if (result.procesados > 0) {
                  await window.electronAPI.invoke('user:update-stats', {
                    key: 'consultasHoy',
                    value: result.procesados,
                    isIncrement: true
                  });
          }
        } catch (statError) {
                  console.error('Error actualizando stats:', statError);
        }

                Swal.fire({
                  title: 'Proceso completado',
                text: `${result.procesados} facturas procesadas correctamente`,
                icon: 'success',
                confirmButtonColor: '#3b82f6'
        });
      } else {
                  Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
                  Swal.fire('Error crítico', error.message, 'error');
    } finally {
                  setLoading(false);
    }
  };


  /**
   * HELPERS DE ELIMINACIÓN MASIVA
   */
  const getMassId = (res, idx) => res.sessionId || `masiva_${idx}`;

  const handleDeleteMassItem = (e, idx) => {
                  e.stopPropagation();
                Swal.fire({
                  title: '¿Eliminar ítem?',
                text: "Se quitará de la lista de resultados.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
                  setMasivaResult(prev => {
                    if (!prev || !prev.resultados) return prev;
                    const newArr = [...prev.resultados];
                    newArr.splice(idx, 1);
                    return { ...prev, resultados: newArr };
                  });
                // Si estaba seleccionado, quitamos el ID (opcional limpiar todo para evitar problemas de índices mixtos)
                // pero mejor es recalcular. Al borrar por índice, el ID basado en índice 'masiva_idx' cambiaría.
                // Por seguridad, limpiamos selección si usamos IDs inestables.
                // Si tenemos sessionIds, es seguro.
                const item = masivaResult.resultados[idx];
                const id = getMassId(item, idx);

        setSelectedMassIds(prev => {
          const next = new Set(prev);
                next.delete(id);
                return next;
        });
      }
    });
  };

  const handleDeleteMassSelected = () => {
    if (selectedMassIds.size === 0) return;

                Swal.fire({
                  title: '¿Eliminar seleccionados?',
                text: `Se eliminarán ${selectedMassIds.size} ítems.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
                  setMasivaResult(prev => {
                    if (!prev || !prev.resultados) return prev;
                    // Filtramos aquellos cuyo ID NO esté en el set
                    const newArr = prev.resultados.filter((res, i) => {
                      const id = getMassId(res, i);
                      return !selectedMassIds.has(id);
                    });
                    return { ...prev, resultados: newArr };
                  });
                setSelectedMassIds(new Set());
      }
    });
  };

  const handleToggleMassSelect = (e, idx) => {
                  e.stopPropagation();
                const item = masivaResult.resultados[idx];
                const id = getMassId(item, idx);

    setSelectedMassIds(prev => {
      const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
    });
  };

  const handleSelectAllMass = (e) => {
    if (!masivaResult || !masivaResult.resultados) return;

                // Si ya están todos seleccionados, deseleccionar
                // Chequeo simple: si el tamaño del set == tamaño array
                if (selectedMassIds.size === masivaResult.resultados.length) {
                  setSelectedMassIds(new Set());
    } else {
      const newSet = new Set();
      masivaResult.resultados.forEach((res, i) => {
                  newSet.add(getMassId(res, i));
      });
                setSelectedMassIds(newSet);
    }
  };


  /**
   * Exportar resultados masivos a CSV
   */
  const exportarMasivoCSV = () => {
    if (!masivaResult || !masivaResult.resultados) return;

                const headers = ['RUC Emisor', 'Tipo', 'Serie', 'Número', 'Estado', 'Razón Social', 'Fecha', 'Error'];
    const rows = masivaResult.resultados.map(r => {
      const d = r.data || { };
                return [
                r.request.rucEmisor,
                r.request.tipoDoc,
                r.request.serie,
                r.request.numero,
                d.estado || 'ERROR',
                d.razonSocial || '',
                d.fechaEmision || '',
                r.error || ''
                ].join(',');
    });

                const blob = new Blob([[headers.join(','), ...rows].join('\n')], {type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `consulta_masiva_${Date.now()}.csv`;
                a.click();
  };

  /**
   * Descargar archivos (PDF/XML/CDR)
   */
  const handleDescargar = async (tipo) => {
    // Usar la sesión del resultado seleccionado si existe, sino la activa
    const targetSessionId = resultadoSeleccionado?.id || activeSession;

                if (!targetSessionId) {
      return Swal.fire('Error', 'No hay una sesión activa para este comprobante. Intente consultarlo nuevamente.', 'error');
    }
    // Limpiar sesión anterior si existe - DESHABILITADO POR SOLICITUD DE USUARIO (MANTENER PESTAÑAS)
    // if (activeSession) {
    //   await window.electronAPI.cpeCerrarSesion({sessionId: activeSession });
    //   setActiveSession(null);
    // }

    try {
      // Construir datos CPE para fallback (Fuzzy Match) en backend
      const cpeData = resultadoSeleccionado ?
                {
                  rucEmisor: resultadoSeleccionado.formData.rucEmisor,
                tipoDoc: resultadoSeleccionado.formData.tipoDoc || resultadoSeleccionado.formData.tipoComprobante,
                serie: resultadoSeleccionado.formData.serie,
                numero: resultadoSeleccionado.formData.numero
        } :
                {
                  rucEmisor: formData.rucEmisor,
                tipoDoc: formData.tipoComprobante,
                serie: formData.serie,
                numero: formData.numero
        };

                const result = await window.electronAPI.cpeDescargar({
                  sessionId: targetSessionId,
                tipo: tipo,
                cpe: cpeData
      });

                if (result.success) {
                  Swal.fire({
                    title: 'Descarga exitosa',
                    text: `Archivo guardado en: ${result.path}`,
                    icon: 'success',
                    timer: 3000
                  });
      } else {
                  Swal.fire({
                    title: 'Error al descargar',
                    text: result.error,
                    icon: 'error'
                  });
      }
    } catch (error) {
                  Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error'
                  });
    }
  };

  /**
   * Cerrar todas las sesiones (navegadores)
   */
  const handleCerrarSesiones = async () => {
    try {
      const result = await window.electronAPI.invoke('cpe-scraping-cerrar-todas');
                if (result.success) {
                  Swal.fire({
                    title: 'Sesiones Cerradas',
                    text: 'Todos los navegadores abieros han sido cerrados.',
                    icon: 'success',
                    timer: 2000
                  });
                setActiveSession(null);
      } else {
                  Swal.fire('Error', result.error, 'error');
      }
    } catch (error) {
                  console.error('Error cerrando sesiones:', error);
    }
  };

  /**
   * Enviar factura por correo
   */
  const handleEnviarEmail = async () => {
    if (!resultadoSeleccionado || !clienteSeleccionado) return;

                // Determinar destinatario (prioridad: email del cliente en Excel)
                let destinatario = clienteSeleccionado.email;

                // Si no hay email, preguntar al usuario
                if (!destinatario) {
      const {value: emailInput } = await Swal.fire({
                  title: 'Enviar Factura por Email',
                input: 'email',
                inputLabel: 'El cliente no tiene email registrado. Ingrese uno:',
                inputPlaceholder: 'cliente@ejemplo.com',
                showCancelButton: true,
                confirmButtonText: 'Enviar',
                cancelButtonText: 'Cancelar'
      });

                if (emailInput) {
                  destinatario = emailInput;
      } else {
        return; // Cancelado
      }
    } else {
      // Confirmar envío
      const confirm = await Swal.fire({
                  title: 'Enviar Factura',
                html: `Se enviará el detalle a: <strong>${destinatario}</strong>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, enviar',
                cancelButtonText: 'Cancelar'
      });
                if (!confirm.isConfirmed) return;
    }

                // Mostrar loading
                Swal.fire({
                  title: 'Enviando correo...',
                text: 'Por favor espere',
                allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

                try {
      const result = await window.electronAPI.invoke('email:enviar-factura', {
                  destinatario: destinatario,
                facturaData: {
                  rucEmisor: resultadoSeleccionado.formData.rucEmisor,
                tipoComprobante: resultadoSeleccionado.formData.tipoComprobante,
                serie: resultadoSeleccionado.formData.serie,
                numero: resultadoSeleccionado.formData.numero,
                fechaEmision: resultadoSeleccionado.data.fechaEmision || resultadoSeleccionado.formData.fecha,
                importeTotal: resultadoSeleccionado.data.importeTotal || resultadoSeleccionado.formData.monto,
                razonSocial: resultadoSeleccionado.data.razonSocial,
                estado: resultadoSeleccionado.data.estado,
                html: resultadoSeleccionado.data.html, // Full detailed HTML
                consultante: {
                  ruc: clienteSeleccionado.ruc,
                empresa: clienteSeleccionado.empresa
          }
        }
      });

                if (result.success) {
                  Swal.fire({
                    title: '✅ Enviado',
                    text: `El correo se envió correctamente a ${destinatario}`,
                    icon: 'success'
                  });
      } else {
                  Swal.fire({
                    title: '❌ Error',
                    text: `No se pudo enviar el correo: ${result.error}`,
                    icon: 'error'
                  });
      }
    } catch (error) {
                  Swal.fire('Error crítico', error.message, 'error');
    }
  };

  /**
   * Eliminar ítem del historial reciente
   */
  const handleEliminarHistorial = (e, itemToDelete) => {
                  e.stopPropagation(); // Evitar seleccionar el ítem al borrarlo

    // Filtrar la lista
    const nuevaLista = listaResultados.filter(item => item.id !== itemToDelete.id);
                setListaResultados(nuevaLista);

                // Actualizar localStorage
                localStorage.setItem('sunat_ultima_busqueda', JSON.stringify(nuevaLista));

                // Si el ítem borrado era el seleccionado, deseleccionar
                if (resultadoSeleccionado?.id === itemToDelete.id) {
                  setResultadoSeleccionado(null);
    }
  };

  /**
   * Enviar correos masivos de facturas encontradas
   */
  const handleEnviarMasivo = async () => {
    if (!masivaResult?.resultados || masivaResult.resultados.length === 0) {
      return Swal.fire('Sin datos', 'No hay facturas para enviar.', 'warning');
    }

    // Filtrar solo las que tienen estado válido/HTML
    const validas = masivaResult.resultados.filter(r => r.data && (r.data.estado === 'ACEPTADO' || r.data.estado === 'ACTIVO' || r.data.estado === 'ENCONTRADO'));

                if (validas.length === 0) {
      return Swal.fire('Sin facturas válidas', 'No se encontraron facturas aceptadas/activas para enviar.', 'warning');
    }

                // Pedir confirmación + Email
                const {value: emailDestino } = await Swal.fire({
                  title: 'Enviar Correos Masivos',
                text: `Se enviarán ${validas.length} correos con las facturas encontradas.`,
                input: 'email',
                inputLabel: 'Correo de destino',
                inputPlaceholder: 'ejemplo@empresa.com',
                inputValue: clienteSeleccionado?.email || '',
                showCancelButton: true,
                confirmButtonText: `Enviar ${validas.length} Correos`,
                cancelButtonText: 'Cancelar',
                validationMessage: 'Por favor ingrese un correo válido'
    });

                if (!emailDestino) return;

                Swal.fire({
                  title: 'Enviando correos...',
                html: 'Por favor espere, esto puede tomar unos segundos.<br><b>No cierre la aplicación.</b>',
                  allowOutsideClick: false,
      didOpen: () => {
                    Swal.showLoading();
      }
    });

                  let enviados = 0;
                  let fallidos = 0;

                  // Procesar envío secuencial para no saturar
                  for (const res of validas) {
      try {
        const facturaPayload = {
                    rucEmisor: res.request.rucEmisor,
                  tipoComprobante: res.request.tipoDoc || res.request.tipoComprobante || '01',
                  serie: res.request.serie,
                  numero: res.request.numero,
                  fechaEmision: res.data.fechaEmision,
                  importeTotal: res.data.importeTotal,
                  razonSocial: res.data.razonSocial,
                  estado: res.data.estado,
                  html: res.data.html,
                  consultante: {
                    ruc: clienteSeleccionado?.ruc,
                  empresa: clienteSeleccionado?.empresa
          }
        };

                  const result = await window.electronAPI.invoke('email:enviar-factura', {
                    destinatario: emailDestino,
                  facturaData: facturaPayload
        });

                  if (result.success) enviados++;
                  else fallidos++;

      } catch (err) {
                    console.error('Error enviando uno de los masivos:', err);
                  fallidos++;
      }
    }

                  Swal.fire({
                    title: 'Proceso completado',
                  html: `Envío finalizado.<br><br>✅ Enviados: ${enviados}<br>❌ Fallidos: ${fallidos}`,
                    icon: fallidos === 0 ? 'success' : 'warning'
    });
  };

  /**
   * Enviar factura por WhatsApp (Individual)
   */
  const handleEnviarWhatsApp = async () => {
    if (!resultadoSeleccionado || !clienteSeleccionado) return;

                    // Verificar que WhatsApp esté conectado
                    const statusResult = await window.electronAPI.getWhatsAppStatus();
                    if (!statusResult.success || !statusResult.status.isReady) {
      return Swal.fire({
                      title: 'WhatsApp no conectado',
                    text: 'Por favor conecta WhatsApp desde el botón en el header',
                    icon: 'warning'
      });
    }

                    // Determinar destinatario
                    let phoneNumber = clienteSeleccionado.whatsapp;

                    if (!phoneNumber) {
      const {value: phoneInput } = await Swal.fire({
                      title: 'Enviar Factura por WhatsApp',
                    input: 'text',
                    inputLabel: 'El cliente no tiene WhatsApp registrado. Ingrese número:',
                    inputPlaceholder: '51987654321 (código país + número)',
                    showCancelButton: true,
                    confirmButtonText: 'Enviar',
                    cancelButtonText: 'Cancelar'
      });

                    if (phoneInput) {
                      phoneNumber = phoneInput;
      } else {
        return;
      }
    }

                    // Mostrar opciones de archivos a enviar
                    const {value: archivos } = await Swal.fire({
                      title: 'Seleccionar archivos',
                    html: `
                    <div style="text-align: left; padding: 10px;">
                      <p><strong>Seleccione los archivos a enviar:</strong></p>
                      <label style="display: block; margin: 8px 0;">
                        <input type="checkbox" id="chk-pdf" checked style="margin-right: 8px;">
                          PDF (Representación impresa)
                      </label>
                      <label style="display: block; margin: 8px 0;">
                        <input type="checkbox" id="chk-xml" style="margin-right: 8px;">
                          XML (Archivo electrónico)
                      </label>
                      <label style="display: block; margin: 8px 0;">
                        <input type="checkbox" id="chk-cdr" style="margin-right: 8px;">
                          CDR (Constancia de recepción)
                      </label>
                    </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Enviar',
      preConfirm: () => {
        return {
                      pdf: document.getElementById('chk-pdf').checked,
                    xml: document.getElementById('chk-xml').checked,
                    cdr: document.getElementById('chk-cdr').checked
        };
      }
    });

                    if (!archivos) return;

                    const tiposSeleccionados = [];
                    if (archivos.pdf) tiposSeleccionados.push('PDF');
                    if (archivos.xml) tiposSeleccionados.push('XML');
                    if (archivos.cdr) tiposSeleccionados.push('CDR');

                    if (tiposSeleccionados.length === 0) {
      return Swal.fire('Sin archivos', 'Debe seleccionar al menos un archivo', 'warning');
    }

                    // Mostrar loading
                    Swal.fire({
                      title: 'Enviando por WhatsApp...',
                    text: 'Descargando archivos y enviando',
                    allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

                    try {
      // Primero descargar los archivos
      const archivosDescargados = [];
                    const targetSessionId = resultadoSeleccionado.id || activeSession;

                    if (!targetSessionId) {
        return Swal.fire('Error', 'Sesión no válida. Consulte nuevamente.', 'error');
      }

                    for (const tipo of tiposSeleccionados) {
        const cpeData = {
                      rucEmisor: resultadoSeleccionado.formData.rucEmisor,
                    tipoDoc: resultadoSeleccionado.formData.tipoDoc || resultadoSeleccionado.formData.tipoComprobante,
                    serie: resultadoSeleccionado.formData.serie,
                    numero: resultadoSeleccionado.formData.numero
        };

                    const result = await window.electronAPI.cpeDescargar({
                      sessionId: targetSessionId,
                    tipo: tipo,
                    cpe: cpeData
        });

                    if (result.success && result.path) {
                      archivosDescargados.push({ tipo, path: result.path });
        }
      }

                    if (archivosDescargados.length === 0) {
        return Swal.fire('Error', 'No se pudieron descargar los archivos', 'error');
      }

                    // Crear mensaje
                    const mensaje = `📄 *Factura Electrónica*

                    Estimado cliente,

                    Adjuntamos los documentos de su factura electrónica:

                    • *Tipo:* ${formData.tipoComprobante === '01' ? 'Factura' : 'Boleta'}
                    • *Serie:* ${resultadoSeleccionado.formData.serie}
                    • *Número:* ${resultadoSeleccionado.formData.numero}
                    • *RUC Emisor:* ${resultadoSeleccionado.formData.rucEmisor}
                    • *Estado:* ${resultadoSeleccionado.data.estado || 'Consultado'}

                    Documentos adjuntos: ${tiposSeleccionados.join(', ')}

                    _Mensaje automático del Sistema SUNAT Bot_`;

                    // Enviar archivos uno por uno
                    let enviados = 0;
                    for (const archivo of archivosDescargados) {
        const result = await window.electronAPI.sendWhatsAppFile({
                      phone: phoneNumber,
                    filePath: archivo.path,
                    caption: enviados === 0 ? mensaje : `Archivo ${archivo.tipo}`
        });

                    if (result.success) enviados++;

                    // Pequeño delay entre archivos
                    if (enviados < archivosDescargados.length) {
                      await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

                    Swal.fire({
                      title: '✅ Enviado',
                    text: `${enviados} archivo(s) enviado(s) a WhatsApp`,
                    icon: 'success'
      });

    } catch (error) {
                      Swal.fire('Error', error.message, 'error');
    }
  };

  /**
   * Enviar facturas masivas por WhatsApp
   */
  const handleEnviarWhatsAppMasivo = async () => {
    if (!masivaResult?.resultados || masivaResult.resultados.length === 0) {
      return Swal.fire('Sin datos', 'No hay facturas para enviar', 'warning');
    }

                    //Verificar WhatsApp conectado
                    const statusResult = await window.electronAPI.getWhatsAppStatus();
                    if (!statusResult.success || !statusResult.status.isReady) {
      return Swal.fire({
                      title: 'WhatsApp no conectado',
                    text: 'Por favor conecta WhatsApp desde el botón en el header',
                    icon: 'warning'
      });
    }

    const validas = masivaResult.resultados.filter(r => r.data && (r.data.estado === 'ACEPTADO' || r.data.estado === 'ACTIVO' || r.data.estado === 'ENCONTRADO'));

                    if (validas.length === 0) {
      return Swal.fire('Sin facturas válidas', 'No hay facturas aceptadas/activas', 'warning');
    }

                    // Pedir número WhatsApp
                    const {value: phoneNumber } = await Swal.fire({
                      title: 'Enviar PDFs Masivos por WhatsApp',
                    html: `
                    <p>Se enviarán <strong>${validas.length}</strong> archivos PDF.</p>
                    <p><small>Delay de 3 segundos entre envíos para evitar bloqueos</small></p>
                    `,
                    input: 'text',
                    inputLabel: 'Número de WhatsApp',
                    inputPlaceholder: '51987654321',
                    inputValue: clienteSeleccionado?.whatsapp || '',
                    showCancelButton: true,
                    confirmButtonText: `Enviar ${validas.length} PDFs`,
                    cancelButtonText: 'Cancelar'
    });

                    if (!phoneNumber) return;

                    // Mostrar progress
                    Swal.fire({
                      title: 'Enviando por WhatsApp...',
                    html: `
                    <div style="margin: 20px 0;">
                      <div id="wa-progress-bar" style="width: 100%; background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
                        <div id="wa-progress-fill" style="width: 0%; background: linear-gradient(90deg, #10b981, #059669); height: 100%; transition: width 0.3s;"></div>
                      </div>
                      <p id="wa-progress-text" style="margin-top: 10px; font-size: 14px;">Preparando envíos...</p>
                    </div>
                    `,
                    allowOutsideClick: false,
                    showConfirmButton: false
    });

                    const progressBar = document.getElementById('wa-progress-fill');
                    const progressText = document.getElementById('wa-progress-text');

                    let enviados = 0;
                    let fallidos = 0;

                    for (let i = 0; i < validas.length; i++) {
      const res = validas[i];

                    try {
        // Actualizar progreso
        const progreso = Math.round(((i + 1) / validas.length) * 100);
                    if (progressBar) progressBar.style.width = progreso + '%';
                    if (progressText) progressText.textContent = `Enviando ${i + 1} de ${validas.length}...`;

                    // Descargar PDF
                    const sessionId = res.sessionId || activeSession;
                    const downloadResult = await window.electronAPI.cpeDescargar({
                      sessionId: sessionId,
                    tipo: 'PDF',
                    cpe: {
                      rucEmisor: res.request.rucEmisor,
                    tipoDoc: res.request.tipoDoc || '01',
                    serie: res.request.serie,
                    numero: res.request.numero
          }
        });

                    if (!downloadResult.success || !downloadResult.path) {
                      fallidos++;
                    continue;
        }

                    // Crear mensaje
                    const mensaje = `📄 *Factura ${res.request.serie}-${res.request.numero}*

                    • *RUC Emisor:* ${res.request.rucEmisor}
                    • *Estado:* ${res.data.estado}
                    ${res.data.razonSocial ? `• *Razón Social:* ${res.data.razonSocial}` : ''}

                    _Mensaje automático del Sistema SUNAT Bot_`;

                    // Enviar por WhatsApp
                    const waResult = await window.electronAPI.sendWhatsAppFile({
                      phone: phoneNumber,
                    filePath: downloadResult.path,
                    caption: mensaje
        });

                    if (waResult.success) enviados++;
                    else fallidos++;

                    // Delay entre envíos (crítico para no ser bloqueado)
                    if (i < validas.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos
        }

      } catch (err) {
                      console.error('Error en envío masivo WhatsApp:', err);
                    fallidos++;
      }
    }

                    Swal.fire({
                      title: 'Proceso completado',
                    html: `Envío por WhatsApp finalizado.<br><br>✅ Enviados: ${enviados}<br>❌ Fallidos: ${fallidos}`,
                      icon: fallidos === 0 ? 'success' : 'warning'
    });
  };

  /**
   * Renderiza el contenido HTML del resultado (simulación de documento)
   */
  const renderDocumentContent = () => {
    if (!resultadoSeleccionado) {
      return (
                      <div className="cf-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <h3>Sin comprobante seleccionado</h3>
                        <p>Realice una consulta o seleccione un ítem de la izquierda para ver el detalle.</p>
                      </div>
                      );
    }

                      const {data} = resultadoSeleccionado;

                      // Si tenemos HTML raw del scraping, lo usamos, pero le agregamos el header con el botón
                      if (data.html) {
      return (
                      <div className="cf-document-paper">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h2 style={{ color: '#1e40af', margin: 0 }}>Resultado de Consulta</h2>

                          <button
                            onClick={handleEnviarEmail}
                            className="cf-btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                            title="Enviar detalle por correo"
                          >
                            <span style={{ fontSize: '16px' }}>✉️</span> Enviar Gmail
                          </button>
                          <button
                            onClick={handleEnviarWhatsApp}
                            className="cf-btn-success"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
                            title="Enviar archivos por WhatsApp"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg> WhatsApp
                          </button>
                        </div>

                        <div dangerouslySetInnerHTML={{ __html: data.html }} />
                      </div>
                      );
    }

                      // Si no, renderizamos una vista genérica bonita con los datos que tengamos
                      return (
                      <div className="cf-document-paper">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h2 style={{ color: '#1e40af', margin: 0 }}>Resultado de Consulta</h2>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleEnviarEmail}
                              className="cf-btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
                              title="Enviar detalle por correo"
                            >
                              <span style={{ fontSize: '16px' }}>✉️</span> Enviar Gmail
                            </button>
                            <button
                              onClick={handleEnviarWhatsApp}
                              className="cf-btn-success"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '13px' }}
                              title="Enviar archivos por WhatsApp"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg> WhatsApp
                            </button>
                          </div>
                        </div>

                        <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <p><strong>Estado:</strong> {data.estado || 'Desconocido'}</p>
                          <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                          <p><strong>Consultante:</strong> {clienteSeleccionado?.empresa} ({clienteSeleccionado?.ruc})</p>
                          <p><strong>RUC Emisor:</strong> {resultadoSeleccionado.formData.rucEmisor}</p>
                          <p><strong>Comprobante:</strong> {resultadoSeleccionado.formData.tipoComprobante === '01' ? 'Factura' : 'Boleta'} {resultadoSeleccionado.formData.serie}-{resultadoSeleccionado.formData.numero}</p>
                          {/* Aquí se mostrarán más detalles cuando actualicemos el scraper */}
                          {data.razonSocial && <p><strong>Razón Social:</strong> {data.razonSocial}</p>}
                          {data.fechaEmision && <p><strong>Fecha Emisión:</strong> {data.fechaEmision}</p>}
                          {data.importeTotal && <p><strong>Importe Total:</strong> {data.importeTotal}</p>}
                        </div>
                      </div>
                      );
  };

                      return (
                      <div className="consulta-factura-module">
                        {/* Header */}
                        <div className="cf-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <h2>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                              </svg>
                              Consultar Facturas (CPE)
                            </h2>
                            <button
                              onClick={handleVerConstancias}
                              className="cf-btn-header-constancias"
                              title="Ver archivos descargados (PDF, XML, CDR)"
                            >
                              <span className="icon">📂</span> Ver Constancias
                            </button>
                            <button
                              onClick={handleCerrarSesiones}
                              className="cf-btn-header-close"
                              title="Cerrar todos los navegadores abiertos"
                            >
                              <span className="icon">⛔</span> Cerrar Sesiones
                            </button>

                            {/* MODO PRODUCCIÓN BUTTON */}
                            <button
                              className={`cf-btn-header-produccion ${viewMode === 'produccion' ? 'active' : ''}`}
                              onClick={() => setViewMode('produccion')}
                            >
                              <span className="icon">⚙️</span> Modo Producción
                            </button>
                          </div>
                          <p>Validez de Comprobantes de Pago Electrónicos - Consulta Individual</p>
                        </div>

                        {/* Main Content (Split Pane) */}
                        <div className="cf-content">

                          {/* Left Panel: Form & List */}
                          <div className="cf-left-panel">

                            {/* Form Section with Padding */}
                            <div className="cf-controls">

                              {/* Mode Toggle */}
                              <div className="cf-mode-toggle">
                                <button
                                  className={`cf-toggle-btn ${viewMode === 'individual' ? 'active' : ''}`}
                                  onClick={() => setViewMode('individual')}
                                >
                                  Individual
                                </button>
                                <button
                                  className={`cf-toggle-btn ${viewMode === 'masiva' ? 'active' : ''}`}
                                  onClick={() => setViewMode('masiva')}
                                >
                                  Masiva
                                </button>
                                <button
                                  className={`cf-toggle-btn ${viewMode === 'visualizar' ? 'active' : ''}`}
                                  onClick={() => setViewMode('visualizar')}
                                >
                                  Visualizar
                                </button>
                                <button
                                  className={`cf-toggle-btn ${viewMode === 'emitir' ? 'active' : ''}`}
                                  onClick={() => setViewMode('emitir')}
                                >
                                  Emitir Facturas
                                </button>
                              </div>

                              {/* Buscador de Empresa Consultante (Always visible) */}
                              <div className="cf-search-group" ref={searchRef}>
                                <label>Empresa Consultante</label>
                                <div className="cf-search-input-wrapper">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                  </svg>
                                  <input
                                    type="text"
                                    className="cf-search-input"
                                    placeholder="Buscar cliente por RUC o nombre..."
                                    value={busqueda}
                                    onChange={(e) => {
                                      setBusqueda(e.target.value);
                                      setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                  />
                                </div>

                                {showDropdown && clientesFiltrados.length > 0 && (
                                  <div className="cf-client-dropdown">
                                    {clientesFiltrados.map((cliente, index) => (
                                      <div
                                        key={index}
                                        className="cf-client-item"
                                        onClick={() => handleSelectCliente(cliente)}
                                      >
                                        <div className="empresa">{cliente.empresa}</div>
                                        <div className="ruc">RUC: {cliente.ruc}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Bot\u00f3n Abrir Excel - Manual */}
                              {clienteSeleccionado && (
                                <button
                                  onClick={() => cargarExcelCliente(clienteSeleccionado)}
                                  className="cf-btn-abrir-excel"
                                  type="button"
                                >
                                  📂 Abrir Excel {viewMode === 'produccion' ? '(RCE)' : ''}
                                </button>
                              )}

                              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

                              {/* Formulario Individual - PERSISTENTE */}
                              <form onSubmit={handleConsultar} style={{ display: viewMode === 'individual' ? 'block' : 'none' }}>
                                <div className="cf-form-group">
                                  <label>RUC Emisor</label>
                                  <input
                                    type="text"
                                    name="rucEmisor"
                                    className="cf-input"
                                    placeholder="20123456789"
                                    value={formData.rucEmisor}
                                    onChange={handleInputChange}
                                    maxLength={11}
                                  />
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <div className="cf-form-group" style={{ flex: 1 }}>
                                    <label>Tipo</label>
                                    <select name="tipoComprobante" className="cf-select" value={formData.tipoComprobante} onChange={handleInputChange}>
                                      <option value="01">Factura</option>
                                      <option value="03">Boleta</option>
                                      <option value="07">Nota Crédito</option>
                                      <option value="08">Nota Débito</option>
                                    </select>
                                  </div>
                                  <div className="cf-form-group" style={{ width: '80px' }}>
                                    <label>Serie</label>
                                    <input type="text" name="serie" className="cf-input" placeholder="F001" value={formData.serie} onChange={handleInputChange} />
                                  </div>
                                  <div className="cf-form-group" style={{ flex: 1 }}>
                                    <label>Número</label>
                                    <input type="text" name="numero" className="cf-input" placeholder="12345" value={formData.numero} onChange={handleInputChange} />
                                  </div>
                                </div>

                                {formData.tipoComprobante === '01' && (
                                  <div className="cf-form-group">
                                    <label>Monto Total (Opcional para Facturas)</label>
                                    <input type="number" name="monto" className="cf-input" placeholder="0.00" value={formData.monto} onChange={handleInputChange} step="0.01" />
                                  </div>
                                )}

                                {(formData.tipoComprobante !== '01') && (
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <div className="cf-form-group" style={{ flex: 1 }}>
                                      <label>Fecha Emisión</label>
                                      <input type="date" name="fecha" className="cf-input" value={formData.fecha} onChange={handleInputChange} />
                                    </div>
                                    <div className="cf-form-group" style={{ flex: 1 }}>
                                      <label>Monto Total</label>
                                      <input type="number" name="monto" className="cf-input" value={formData.monto} onChange={handleInputChange} step="0.01" />
                                    </div>
                                  </div>
                                )}

                                <button type="submit" className="cf-btn-primary" disabled={loading}>
                                  {loading ? <div className="cf-spinner"></div> : 'Consultar CPE'}
                                </button>
                              </form>

                              {/* Formulario Masivo - PERSISTENTE */}
                              <div className="cf-masiva-form" style={{ display: viewMode === 'masiva' ? 'flex' : 'none' }}>
                                <div className="cf-alert-blue">
                                  ℹ️ Las consultas masivas funcionan con su propio navegador. Cada factura se procesa de forma independiente.
                                </div>

                                <div className="cf-form-group">
                                  <label>Lista de Comprobantes (RUC|SERIE|NUMERO)</label>
                                  <textarea
                                    className="cf-textarea"
                                    rows={10}
                                    placeholder="Lista de Comprobantes (RUC|SERIE|NUMERO)&#10;&#10;Ejemplo:&#10;20606080134|F002|3848&#10;20606080134|F002|3859&#10;&#10;Nota: Todas las consultas masivas son facturas por defecto."
                                    value={masivaData}
                                    onChange={(e) => setMasivaData(e.target.value)}
                                  />
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <button className="cf-btn-primary" onClick={handleConsultarMasivo} disabled={loading || !clienteSeleccionado}>
                                    {loading ? <div className="cf-spinner"></div> : 'Procesar Lista'}
                                  </button>
                                  {masivaResult && (
                                    <button className="cf-btn-secondary" onClick={exportarMasivoCSV}>
                                      📥 Exportar CSV
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Tab Visualizar Facturas - PERSISTENTE */}
                              <div className="cf-visualizar-section" style={{ display: viewMode === 'visualizar' ? 'block' : 'none' }}>
                                <div className="cf-alert-blue">
                                  ℹ️ Esta función abre el portal SUNAT con login automático para visualizar todas las facturas del mes.
                                </div>

                                <button
                                  className="cf-btn-primary"
                                  onClick={handleVisualizarFacturas}
                                  disabled={visualizandoLoading || !clienteSeleccionado}
                                  style={{ marginTop: '15px' }}
                                >
                                  {visualizandoLoading ? <div className="cf-spinner"></div> : '🔍 Abrir Visualización SUNAT'}
                                </button>

                                {visualizacionData && (
                                  <div style={{ marginTop: '15px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '13px', color: '#166534' }}>
                                      ✅ Sesión activa para: <strong>{visualizacionData.clienteRazon}</strong>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                                      RUC: {visualizacionData.clienteRuc} | Session ID: {visualizacionData.sessionId}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#15803d', marginTop: '8px', fontStyle: 'italic' }}>
                                      📄 El formulario SUNAT se muestra en el panel derecho →
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Tab Emitir Facturas - PERSISTENTE */}
                              <div className="cf-emitir-section" style={{ display: viewMode === 'emitir' ? 'block' : 'none' }}>
                                <div className="cf-alert-blue">
                                  ℹ️ Esta función abre el portal SUNAT con login automático para emitir facturas electrónicas.
                                </div>

                                <button
                                  className="cf-btn-primary"
                                  onClick={handleEmitirFacturas}
                                  disabled={emitiendoLoading || !clienteSeleccionado}
                                  style={{ marginTop: '15px' }}
                                >
                                  {emitiendoLoading ? <div className="cf-spinner"></div> : '📝 Abrir Emisión SUNAT'}
                                </button>

                                {emitirData && (
                                  <div style={{ marginTop: '15px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '13px', color: '#166534' }}>
                                      ✅ Sesión activa para: <strong>{emitirData.clienteRazon}</strong>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                                      RUC: {emitirData.clienteRuc} | Session ID: {emitirData.sessionId}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#15803d', marginTop: '8px', fontStyle: 'italic' }}>
                                      📝 El formulario SUNAT se muestra en el panel derecho →
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Tab Modo Producción - NUEVO */}
                              <div className="cf-produccion-section" style={{ display: viewMode === 'produccion' ? 'flex' : 'none', flexDirection: 'column', height: '100%', gap: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {/* Botón Abrir Excel RCE eliminado, se usa el principal en el panel izquierdo */}
                                    {produccionSheets.length > 0 && (
                                      <select
                                        className="cf-select"
                                        value={produccionSelectedSheet}
                                        onChange={(e) => handleProduccionSeleccionarHoja(e.target.value)}
                                        style={{ width: '200px' }}
                                      >
                                        {produccionSheets.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    )}

                                    {/* Botón Procesar Lista (Consulta Masiva) */}
                                    {produccionRows.length > 0 && produccionStats.procesados === 0 && (
                                      <button
                                        className="cf-btn-primary"
                                        onClick={async () => {
                                          if (!clienteSeleccionado) {
                                            return Swal.fire('Error', 'Seleccione un cliente consultante', 'warning');
                                          }

                                          setProduccionLoading(true);
                                          try {
                                            // Preparar lista para consulta masiva
                                            const lista = produccionRows.map(row => ({
                                              rucEmisor: row.ruc,
                                              tipoDoc: row.tipoIdx?.toString().padStart(2, '0') || '01',
                                              serie: row.serie,
                                              numero: row.numero,
                                              filtro: 'recibido'
                                            }));

                                            const result = await window.electronAPI.invoke('cpe-scraping-consultar-masivo', {
                                              sessionId: null,
                                              listaComprobantes: lista,
                                              cliente: { ruc: clienteSeleccionado.ruc }
                                            });

                                            if (result.success) {
                                              // Actualizar estados de las filas
                                              const newRows = [...produccionRows];
                                              let procesados = 0;
                                              let errores = 0;

                                              result.resultados.forEach(res => {
                                                const rowIndex = produccionRows.findIndex(r => r.serie === res.request.serie && r.numero === res.request.numero);
                                                if (rowIndex !== -1) {
                                                  if (res.data && res.data.estado) {
                                                    newRows[rowIndex].status = 'OK';
                                                    newRows[rowIndex].sessionId = res.sessionId;
                                                    procesados++;
                                                  } else {
                                                    newRows[rowIndex].status = 'ERROR';
                                                    newRows[rowIndex].message = res.error || 'No encontrado';
                                                    errores++;
                                                  }
                                                }
                                              });

                                              setProduccionRows(newRows);
                                              setProduccionStats({
                                                total: newRows.length,
                                                procesados,
                                                errores,
                                                faltantes: newRows.length - procesados - errores
                                              });

                                              Swal.fire({
                                                title: 'Consulta Completada',
                                                html: `Procesados: ${procesados}<br>Errores: ${errores}`,
                                                icon: 'success'
                                              });
                                            } else {
                                              Swal.fire('Error', result.error, 'error');
                                            }
                                          } catch (error) {
                                            console.error('Error en consulta masiva:', error);
                                            Swal.fire('Error', error.message, 'error');
                                          } finally {
                                            setProduccionLoading(false);
                                          }
                                        }}
                                        disabled={produccionLoading}
                                        style={{ fontSize: '13px', padding: '6px 12px' }}
                                      >
                                        {produccionLoading ? '⏳ Procesando...' : '🔍 Procesar Lista'}
                                      </button>
                                    )}

                                    {/* Botón Descargar PDFs (después de procesar) */}
                                    {produccionStats.procesados > 0 && (
                                      <button
                                        className="cf-btn-success"
                                        onClick={handleProduccionDescargarMasivo}
                                        disabled={produccionLoading}
                                        style={{ fontSize: '13px', padding: '6px 12px' }}
                                      >
                                        {produccionLoading ? '⏳ Descargando...' : '📥 Descargar PDFs'}
                                      </button>
                                    )}
                                  </div>
                                  {produccionStats.total > 0 && (
                                    <div style={{ display: 'flex', gap: '15px', fontSize: '14px', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 'bold' }}>Total: {produccionStats.total}</span>
                                      <span style={{ color: 'green' }}>Procesados: {produccionStats.procesados}</span>
                                      <span style={{ color: 'red' }}>Errores: {produccionStats.errores}</span>

                                      {/* Botón Abrir Carpeta Descargas */}
                                      <button
                                        onClick={() => {
                                          const folder = `C:\\AUTOMATIZADOR\\produccion`;
                                          window.electronAPI.openExternal(folder);
                                        }}
                                        style={{
                                          background: 'none',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          padding: '2px 8px',
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          color: '#64748b',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        title={`Abrir carpeta: C:\\AUTOMATIZADOR\\produccion`}
                                      >
                                        📂 Ver Carpeta
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {produccionLoading && <div className="cf-spinner" style={{ alignSelf: 'center' }}></div>}

                                {/* Table Container */}
                                <div className="cf-table-container" style={{ flex: 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '300px' }}>
                                  <table className="cf-table">
                                    <thead>
                                      <tr>
                                        <th>Fecha</th>
                                        <th>Tipo</th>
                                        <th>Serie</th>
                                        <th>Número</th>
                                        <th>RUC</th>
                                        <th>Monto</th>
                                        <th>Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {produccionRows.map(row => (
                                        <tr key={row.id} style={{
                                          backgroundColor: row.status === 'ERROR' || row.status === 'ERROR_DOWNLOAD' ? '#fef9c3' : 'white', // Yellow rows
                                          color: row.status.includes('ERROR') || row.status === 'MISSING' ? '#dc2626' : 'inherit' // Red text
                                        }}>
                                          <td>{row.fecha}</td>
                                          <td>{row.tipoIdx}</td>
                                          <td>{row.serie}</td>
                                          <td>{row.numero}</td>
                                          <td style={{ color: !row.ruc ? 'red' : 'inherit', fontWeight: !row.ruc ? 'bold' : 'normal' }}>{row.ruc || '(Faltante)'}</td>
                                          <td>{row.monto}</td>
                                          <td>
                                            {row.status === 'OK' && '✅ Descargado'}
                                            {row.status === 'PENDIENTE' && '⏳ Pendiente'}
                                            {row.status.includes('ERROR') && `❌ ${row.message || 'Error'}`}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                            </div>


                            {/* FILE SELECTOR MODAL - Shows list of available Excel files */}
                            {showFileSelector && archivosDisponibles.length > 0 && (
                              <div className="cf-file-selector-overlay" onClick={() => setShowFileSelector(false)}>
                                <div className="cf-file-selector-modal" onClick={(e) => e.stopPropagation()}>

                                  <div className="cf-file-selector-header">
                                    <h4>📂 Seleccionar Archivo Excel</h4>
                                    <button
                                      className="cf-btn-close-selector"
                                      onClick={() => setShowFileSelector(false)}
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="cf-file-selector-content">
                                    <p className="cf-file-selector-subtitle">
                                      {clienteSeleccionado?.empresa} - RUC: {clienteSeleccionado?.ruc}
                                    </p>
                                    <div className="cf-files-list">
                                      {archivosDisponibles.map((archivo, idx) => (
                                        <div
                                          key={idx}
                                          className="cf-file-item"
                                          onClick={() => abrirArchivoSeleccionado(archivo)}
                                        >
                                          <div className="cf-file-icon">📄</div>
                                          <div className="cf-file-info">
                                            <div className="cf-file-nombre">{archivo.nombre}</div>
                                            <div className="cf-file-details">
                                              {new Date(archivo.fecha).toLocaleString('es-ES')} • {(archivo.size / 1024).toFixed(1)} KB
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                </div>
                              </div>
                            )}

                            {/* EXCEL MODAL OVERLAY - Opens when client has Excel data */}
                            {clienteSeleccionado && excelData && excelRows.length > 0 && (
                              <div className="cf-excel-modal-overlay" onClick={() => {
                                // Close modal when clicking backdrop
                                setExcelData(null);
                                setExcelRows([]);
                              }}>
                                <div className="cf-excel-modal" onClick={(e) => e.stopPropagation()}>

                                  {/* Modal Header */}
                                  <div className="cf-excel-modal-header">
                                    <div>
                                      <h3>Vista Previa: {clienteSeleccionado.empresa}</h3>
                                      <p>RUC: {clienteSeleccionado.ruc} | {excelRows.length} filas</p>
                                    </div>
                                    <button
                                      className="cf-btn-close-modal"
                                      onClick={() => {
                                        setExcelData(null);
                                        setExcelRows([]);
                                      }}
                                    >
                                      ✕ Cerrar
                                    </button>
                                  </div>

                                  {/* Sheet Tabs */}
                                  {excelData.sheets && excelData.sheets.length > 1 && (
                                    <div className="cf-excel-tabs">
                                      {excelData.sheets.map((sheet, idx) => (
                                        <button
                                          key={idx}
                                          className={`cf-excel-tab ${selectedSheet === sheet ? 'active' : ''}`}
                                          onClick={() => handleSeleccionarHoja(sheet)}
                                        >
                                          {sheet}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Excel Table */}
                                  <div className="cf-excel-modal-content">
                                    <div className="cf-excel-table-container-modal">
                                      <table className="cf-excel-table">
                                        <thead>
                                          <tr>
                                            {excelHeaders.slice(6).map((header, idx) => {
                                              // Ajustar índices para highlight: M=12, H=7, J=9.
                                              // Al hacer slice(6), el índice 0 es la columna 6.
                                              // Columna H (7) -> índice 1 en el slice.
                                              // Columna J (9) -> índice 3 en el slice.
                                              // Columna M (12) -> índice 6 en el slice.
                                              const originalIndex = idx + 6;
                                              const isHighlight = [7, 9, 12].includes(originalIndex);
                                              return (
                                                <th
                                                  key={idx}
                                                  className={isHighlight ? 'highlight' : ''}
                                                  title={isHighlight ? `Columna ${originalIndex === 7 ? 'H (SERIE)' : originalIndex === 9 ? 'J (NÚMERO)' : 'M (RUC)'}` : ''}
                                                >
                                                  {header || `Col ${originalIndex + 1}`}
                                                </th>
                                              );
                                            })}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {excelRows.map((row, rowIndex) => (
                                            <tr
                                              key={rowIndex}
                                              className={`cf-excel-row-selectable ${(viewMode === 'produccion' ? rowIndex < 7 : rowIndex < 4) ? 'disabled-row' : ''}`}
                                              onClick={() => handleClickFilaExcel(row)}
                                              style={{ opacity: (viewMode === 'produccion' ? rowIndex < 7 : rowIndex < 4) ? 0.5 : 1 }}
                                            >
                                              {row.slice(6).map((cell, cellIndex) => {
                                                // Ajustar índices para highlight: M=12, H=7, J=9.
                                                // Al hacer slice(6), el índice 0 es la columna 6.
                                                // Columna H (7) -> índice 1 en el slice.
                                                // Columna J (9) -> índice 3 en el slice.
                                                // Columna M (12) -> índice 6 en el slice.

                                                const originalIndex = cellIndex + 6;
                                                const isHighlight = [7, 9, 12].includes(originalIndex);

                                                return (
                                                  <td key={cellIndex} className={isHighlight ? 'highlight' : ''}>
                                                    {cell}
                                                  </td>
                                                );
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Botón Seleccionar Todos - Masiva y Producción */}
                                  {(viewMode === 'masiva' || viewMode === 'produccion') && (
                                    <div className="cf-excel-modal-footer">
                                      <button
                                        onClick={handleSeleccionarTodos}
                                        className="cf-btn-select-all"
                                        disabled={excelRows.length === 0}
                                      >
                                        ✓ Seleccionar todos ({excelRows.length} filas)
                                      </button>
                                    </div>
                                  )}

                                </div>
                              </div>
                            )}

                            {/* Results List */}
                            <div className="cf-results-list">

                              {/* Header Result List */}
                              <div style={{ padding: '0 20px 10px', fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {viewMode === 'masiva' && masivaResult?.resultados?.length > 0 && (
                                    <input
                                      type="checkbox"
                                      checked={selectedMassIds.size > 0 && selectedMassIds.size === masivaResult.resultados.length}
                                      onChange={handleSelectAllMass}
                                      style={{ cursor: 'pointer' }}
                                      title="Seleccionar todos"
                                    />
                                  )}
                                  <span>{viewMode === 'individual' ? 'Historial Reciente' : `Resultados Masivos (${masivaResult?.resultados?.length || 0})`}</span>
                                </div>

                                {viewMode === 'masiva' && masivaResult?.resultados?.length > 0 && (
                                  <div style={{ display: 'flex', gap: '10px' }}>

                                    {selectedMassIds.size > 0 && (
                                      <button
                                        onClick={handleDeleteMassSelected}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}
                                        title="Eliminar seleccionados"
                                      >
                                        🗑️ Eliminar ({selectedMassIds.size})
                                      </button>
                                    )}

                                    <button
                                      onClick={handleEnviarMasivo}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#2563eb' }}
                                      title="Enviar todas las facturas encontradas por correo"
                                    >
                                      📧 <span style={{ fontSize: '11px', textDecoration: 'underline' }}>Enviar Gmail</span>
                                    </button>
                                    <button
                                      onClick={handleEnviarWhatsAppMasivo}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#10b981' }}
                                      title="Enviar PDFs por WhatsApp"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '4px' }}>
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                      </svg>
                                      <span style={{ fontSize: '11px', textDecoration: 'underline' }}>WhatsApp Masivo</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {viewMode === 'individual' && listaResultados.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                  <small>No hay consultas recientes</small>
                                </div>
                              )}

                              {/* MODIFICADO: Renderizado condicional de lista */}
                              {viewMode === 'individual' ? (
                                listaResultados.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`cf-result-item ${resultadoSeleccionado?.id === item.id ? 'selected' : ''}`}
                                    onClick={() => {
                                      setResultadoSeleccionado(item);
                                      setActiveSession(item.id);
                                    }}
                                  >
                                    <div className="cf-item-header">
                                      <span className="cf-item-type">
                                        {item.formData.tipoComprobante === '01' ? 'Factura' : 'Boleta'}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="cf-item-date">
                                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                          onClick={(e) => handleEliminarHistorial(e, item)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}
                                          title="Eliminar del historial"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                    <div className="cf-item-details">
                                      {item.formData.serie}-{item.formData.numero}
                                    </div>
                                    <div className="cf-item-details" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                      RUC: {item.formData.rucEmisor}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: item.estado === 'ACEPTADO' ? '#16a34a' : '#d97706' }}>
                                      {item.estado}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                // RESULTADOS MASIVOS
                                masivaResult?.resultados?.map((res, idx) => (
                                  <div
                                    key={idx}
                                    className={`cf-result-item ${resultadoSeleccionado?.id === `masiva_${idx}` ? 'selected' : ''}`}
                                    onClick={() => {
                                      // Adaptar para visualización en detalle
                                      setResultadoSeleccionado({
                                        id: res.sessionId || `masiva_${idx}`, // Usar sessionId real si existe
                                        formData: { ...res.request, tipoComprobante: res.request.tipoDoc },
                                        data: res.data || {},
                                        estado: res.data?.estado || 'ERROR'
                                      });
                                    }}
                                  >
                                    <div className="cf-item-header">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                          type="checkbox"
                                          checked={selectedMassIds.has(res.sessionId || `masiva_${idx}`)}
                                          onChange={(e) => handleToggleMassSelect(e, idx)}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ cursor: 'pointer' }}
                                        />
                                        <span className="cf-item-type">Item {idx + 1}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`estado-badge-small ${res.data?.estado || 'ERROR'}`} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0' }}>
                                          {res.data?.estado || 'ERROR'}
                                        </span>
                                        <button
                                          onClick={(e) => handleDeleteMassItem(e, idx)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 4px', fontSize: '14px' }}
                                          title="Eliminar de la lista"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                    <div className="cf-item-details">
                                      {res.request.serie}-{res.request.numero}
                                    </div>
                                    <div className="cf-item-details" style={{ fontSize: '0.8rem' }}>
                                      {res.request.rucEmisor}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                          </div>

                          {/* Right Panel: Preview & WebViews (STACKED) */}
                          <div className="cf-right-panel">

                            {/* LAYER 1: Standard Details (Individual/Masiva) */}
                            <div style={{ display: (viewMode === 'individual' || viewMode === 'masiva') ? 'block' : 'none', height: '100%' }}>
                              {resultadoSeleccionado ? (
                                <>
                                  <div className="cf-preview-header">
                                    <div className="cf-preview-title">
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                      </svg>
                                      Ver Factura: {resultadoSeleccionado.formData.serie}-{resultadoSeleccionado.formData.numero}
                                    </div>
                                    <div className="cf-preview-subtitle">
                                      {clienteSeleccionado?.empresa} - {resultadoSeleccionado.formData.rucEmisor}
                                    </div>
                                  </div>

                                  <div className="cf-attachments-section">

                                    <h4 className="cf-attachments-title">
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                      </svg>
                                      Archivos Adjuntos
                                    </h4>

                                    {/* PDF Card */}
                                    <div className="cf-attachment-card">
                                      <div className="cf-attachment-info">
                                        <div className="cf-attachment-icon cf-icon-pdf">
                                          <i className="fas fa-file-pdf"></i>
                                        </div>
                                        <div className="cf-attachment-details">
                                          <span className="cf-attachment-name">Formato PDF</span>
                                          <span className="cf-attachment-meta">Visualización impresa del comprobante</span>
                                        </div>
                                      </div>
                                      <button className="cf-btn-download" onClick={() => handleDescargar('pdf')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Descargar
                                      </button>
                                    </div>

                                    {/* XML Card */}
                                    <div className="cf-attachment-card">
                                      <div className="cf-attachment-info">
                                        <div className="cf-attachment-icon cf-icon-xml">
                                          <i className="fas fa-file-code"></i>
                                        </div>
                                        <div className="cf-attachment-details">
                                          <span className="cf-attachment-name">Formato XML</span>
                                          <span className="cf-attachment-meta">Comprobante electrónico firmado</span>
                                        </div>
                                      </div>
                                      <button className="cf-btn-download" onClick={() => handleDescargar('xml')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Descargar
                                      </button>
                                    </div>

                                    {/* CDR Card */}
                                    <div className="cf-attachment-card">
                                      <div className="cf-attachment-info">
                                        <div className="cf-attachment-icon cf-icon-cdr">
                                          <i className="fas fa-file-contract"></i>
                                        </div>
                                        <div className="cf-attachment-details">
                                          <span className="cf-attachment-name">Constancia CDR</span>
                                          <span className="cf-attachment-meta">Constancia de Recepción SUNAT</span>
                                        </div>
                                      </div>
                                      <button className="cf-btn-download" onClick={() => handleDescargar('cdr')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Descargar
                                      </button>
                                    </div>

                                    <div style={{ marginTop: '20px' }}>
                                      {renderDocumentContent()}
                                    </div>

                                  </div>
                                </>
                              ) : (
                                <div className="cf-placeholder">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                  </svg>
                                  <h3>Sin comprobante seleccionado</h3>
                                  <p>Realice una consulta o seleccione un ítem de la izquierda para ver los archivos adjuntos.</p>
                                </div>
                              )}
                            </div>

                            {/* LAYER 2: Visualizar WebView (PERSISTENT) */}
                            {visualizacionData && (
                              <div style={{ display: viewMode === 'visualizar' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
                                <div style={{ padding: '15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                                    📄 Portal SUNAT - Consulta de Facturas Electrónicas
                                  </h3>
                                  <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>
                                    {visualizacionData.clienteRazon} | RUC: {visualizacionData.clienteRuc}
                                  </p>
                                </div>

                                {visualizacionData.targetUrl ? (
                                  <webview
                                    ref={visualizarWebviewRef}
                                    src={visualizacionData.targetUrl}
                                    style={{ flex: 1, width: '100%', border: 'none', background: 'white' }}
                                    allowpopups="true"
                                  />
                                ) : (
                                  <div className="cf-placeholder" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3>Contenido no disponible</h3>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Placeholder for Visualizar when no session active but mode selected */}
                            {viewMode === 'visualizar' && !visualizacionData && (
                              <div className="cf-placeholder">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '20px', opacity: 0.4 }}>
                                  <circle cx="11" cy="11" r="8"></circle>
                                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                <h3>Visualización no iniciada</h3>
                                <p>Haga clic en el botón "Abrir Visualización SUNAT" para iniciar sesión.</p>
                              </div>
                            )}

                            {/* LAYER 3: Emitir WebView (PERSISTENT) */}
                            {emitirData && (
                              <div style={{ display: viewMode === 'emitir' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
                                <div style={{ padding: '15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                                    📝 Portal SUNAT - Emisión de Facturas Electrónicas
                                  </h3>
                                  <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>
                                    {emitirData.clienteRazon} | RUC: {emitirData.clienteRuc}
                                  </p>
                                </div>

                                {emitirData.targetUrl ? (
                                  <webview
                                    ref={emitirWebviewRef}
                                    src={emitirData.targetUrl}
                                    style={{ flex: 1, width: '100%', border: 'none', background: 'white' }}
                                    allowpopups="true"
                                  />
                                ) : (
                                  <div className="cf-placeholder" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3>Contenido no disponible</h3>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Placeholder for Emitir when no session active but mode selected */}
                            {viewMode === 'emitir' && !emitirData && (
                              <div className="cf-placeholder">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '20px', opacity: 0.4 }}>
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                <h3>Emisión no iniciada</h3>
                                <p>Haga clic en el botón "Abrir Emisión SUNAT" para iniciar sesión.</p>
                              </div>
                            )}

                          </div>

                        </div>

                        {/* CONSTANCIAS MODAL - Mostrar archivos descargados */}
                        {showConstancias && (
                          <div className="cf-excel-modal-overlay" onClick={() => setShowConstancias(false)}>
                            <div className="cf-excel-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>

                              {/* Modal Header */}
                              <div className="cf-excel-modal-header">
                                <div>
                                  <h3>📂 Archivos Descargados (Constancias)</h3>
                                  <p>RUC: {clienteSeleccionado?.ruc} | {constanciasList.length} archivo(s)</p>
                                </div>
                                <button
                                  className="cf-btn-close-modal"
                                  onClick={() => setShowConstancias(false)}
                                >
                                  ✕ Cerrar
                                </button>
                              </div>

                              {/* Constancias List */}
                              <div className="cf-excel-modal-content" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {constanciasList.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                    <p>No hay archivos descargados para este RUC</p>
                                  </div>
                                ) : (
                                  <div style={{ display: 'grid', gap: '12px' }}>
                                    {constanciasList.map((archivo, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '12px 16px',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: '8px',
                                          background: selectedConstancia === archivo ? '#eff6ff' : '#fff',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                        onClick={() => setSelectedConstancia(archivo)}
                                      >
                                        {/* File Info */}
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '24px' }}>
                                              {archivo.tipo === 'PDF' ? '📄' : archivo.tipo === 'XML' ? '📋' : '📦'}
                                            </span>
                                            <div>
                                              <div style={{ fontWeight: '500', fontSize: '14px', color: '#1e293b' }}>
                                                {archivo.nombre}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                {archivo.tipo} • {(archivo.size / 1024).toFixed(1)} KB • {new Date(archivo.fechaModificacion).toLocaleString('es-ES')}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEnviarConstanciaEmail(archivo);
                                            }}
                                            style={{
                                              padding: '6px 12px',
                                              fontSize: '12px',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: '6px',
                                              background: '#fff',
                                              color: '#475569',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            title="Enviar por Gmail"
                                          >
                                            ✉️ Gmail
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEnviarConstanciaWhatsApp(archivo);
                                            }}
                                            style={{
                                              padding: '6px 12px',
                                              fontSize: '12px',
                                              border: '1px solid #86efac',
                                              borderRadius: '6px',
                                              background: '#dcfce7',
                                              color: '#166534',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                            title="Enviar por WhatsApp"
                                          >
                                            📱 WhatsApp
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>
                        )}
                      </div >
                      );
}

                      export default ConsultaFacturaModule;
