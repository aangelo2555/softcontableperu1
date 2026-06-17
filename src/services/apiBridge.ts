import axios from 'axios';

// Detectar si estamos en Railway o Localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 85000, // 85 segundos. Ligeramente menor al timeout del ingress de Railway (100s) para fallar con gracia
});

// Interceptor para añadir el Token JWT y el header de inspección en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('softcontable_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Si el admin está inspeccionando un usuario, enviar su ID para que el backend lo use
    const inspectUserId = (window as any).inspectingUserId;
    if (inspectUserId) {
        config.headers['X-Inspect-User-Id'] = inspectUserId;
    }
    return config;
});

// Interceptor de respuesta para depurar y notificar errores de base de datos
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const serverError = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error('❌ [API BRIDGE ERROR]:', serverError);
        return Promise.reject(error);
    }
);

export const webApiBridge = {
    // --- Auth API ---
    authLogin: async (credentials: any) => {
        const res = await api.post('/api/auth/login', credentials);
        return res.data;
    },
    authRegister: async (userData: any) => {
        const res = await api.post('/api/auth/register', userData);
        return res.data;
    },

    // --- Database API ---
    dbGetWorkspaces: async () => {
        const res = await api.get(`/api/db/workspaces?t=${Date.now()}`);
        return res.data.workspaces || [];
    },
    dbSaveWorkspace: async (w: any) => {
        const res = await api.post('/api/db/workspaces', w);
        return res.data;
    },
    dbDeleteWorkspace: async (ruc: string) => {
        const res = await api.delete(`/api/db/workspaces/${ruc}`);
        return res.data;
    },
    dbGetWorkspaceData: async (ruc: string) => {
        const res = await api.get(`/api/db/workspaces/${ruc}?t=${Date.now()}`);
        return res.data.data;
    },
    dbExecute: async (sql: string, params: any[]) => {
        const res = await api.post('/api/db/execute', { sql, params });
        return res.data;
    },
    dbQuery: async (sql: string, params: any[]) => {
        const res = await api.post('/api/db/query', { sql, params });
        return res.data;
    },
    dbBackup: async () => {
        const res = await api.post('/api/db/backup', {}, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `backup_softcontable_${Date.now()}.db`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return "Carpeta de Descargas";
    },
    dbClearWorkspace: async (ruc: string) => {
        const res = await api.post(`/api/db/clear-workspace/${ruc}`);
        return res.data;
    },
    dbSaveBalanceInicial: async (ruc: string, item: any) => {
        const res = await api.post(`/api/db/balance-inicial/${ruc}`, item);
        return res.data;
    },
    dbSaveBalanceInicialBulk: async (ruc: string, items: any[]) => {
        const res = await api.post(`/api/db/balance-inicial/bulk/${ruc}`, { items });
        return res.data;
    },
    dbDeleteBalanceInicial: async (ruc: string, id: string) => {
        const res = await api.delete(`/api/db/balance-inicial/${ruc}/${id}`);
        return res.data;
    },
    analyticsCCCMetrics: async (ruc: string) => {
        const res = await api.get(`/api/db/analytics/ccc/${ruc}?t=${Date.now()}`);
        return res.data.metrics;
    },
    
    // --- Period Management & Invalidation ---
    getPeriods: async (ruc: string) => {
        const res = await api.get(`/api/periods/${ruc}`);
        return res.data.periods || [];
    },
    getStaleStatus: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/periods/${ruc}/stale-status?periodo=${periodo}`);
        return res.data.rows || [];
    },
    closePeriod: async (ruc: string, payload: { periodo: string, tipo: string, notas?: string }) => {
        const res = await api.post(`/api/periods/${ruc}/close`, payload);
        return res.data;
    },
    reopenPeriod: async (ruc: string, payload: { periodo: string, tipo: string }) => {
        const res = await api.post(`/api/periods/${ruc}/reopen`, payload);
        return res.data;
    },

    // --- SBS API ---
    sbsGetExchangeRate: async (fecha: string) => {
        const res = await api.get(`/api/sbs/tipo-cambio?fecha=${fecha}`);
        return res.data.rate;
    },

    // --- Prorrata & DAOT API ---
    executeProrrata: async (ruc: string, periodo: string) => {
        const res = await api.post('/api/igv/prorrata', { ruc, periodo });
        return res.data;
    },
    getDaotData: async (ruc: string, anio: string) => {
        const res = await api.get(`/api/daot/${ruc}?anio=${anio}`);
        return res.data;
    },

    // --- Bank Reconciliation API ---
    getBankStatements: async (ruc: string, periodo?: string) => {
        const url = periodo ? `/api/bank/statements/${ruc}?periodo=${periodo}` : `/api/bank/statements/${ruc}`;
        const res = await api.get(url);
        return res.data.statements || [];
    },
    importBankStatements: async (ruc: string, lines: any[]) => {
        const res = await api.post('/api/bank/statements/import', { ruc, lines });
        return res.data;
    },
    reconcileTransaction: async (ruc: string, statementId: string, journalId: string) => {
        const res = await api.post('/api/bank/reconcile', { ruc, statementId, journalId });
        return res.data;
    },
    unreconcileTransaction: async (ruc: string, statementId: string) => {
        const res = await api.post('/api/bank/unreconcile', { ruc, statementId });
        return res.data;
    },
    autoMatchBank: async (ruc: string, periodo: string) => {
        const res = await api.post('/api/bank/auto-match', { ruc, periodo });
        return res.data;
    },

    // --- Buzon API ---
    buzonConsultar: async (args: any) => {
        const res = await api.post('/api/buzon/consultar', args);
        return res.data;
    },
    buzonDescargarAdjunto: async (args: any) => {
        const res = await api.post('/api/buzon/descargar-adjunto', args);
        return res.data;
    },
    buzonExtraerDetalle: async (args: any) => {
        const res = await api.post('/api/buzon/extraer-detalle', args);
        return res.data;
    },
    buzonListarConstancias: async (args: any) => {
        const res = await api.post('/api/buzon/listar-constancias', args);
        return res.data;
    },
    buzonCerrarTodas: async () => {
        const res = await api.post('/api/buzon/cerrar-todas');
        return res.data;
    },
    buzonAbrirConstancia: async (args: any) => {
        const res = await api.post('/api/buzon/descargar-archivo-constancia', args);
        return res.data;
    },

    // --- SIRE API ---
    ejecutarSire: async (datos: any) => {
        const res = await api.post('/api/sire/ejecutar', datos);
        return res.data;
    },
    generarArchivoSire: async (args: any) => {
        const res = await api.post('/api/sire/generar-archivo', args);
        return res.data;
    },
    listarArchivosSire: async () => {
        const res = await api.get(`/api/sire/archivos?t=${Date.now()}`);
        return res.data.archivos || [];
    },
    eliminarArchivoSire: async (nombre: string) => {
        const res = await api.delete(`/api/sire/archivos/${encodeURIComponent(nombre)}`);
        return res.data;
    },
    abrirArchivoSire: async (nombre: string) => {
        const res = await api.get(`/api/sire/archivos/${encodeURIComponent(nombre)}/descargar`, { responseType: 'blob' });
        const blob = new Blob([res.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', nombre);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { success: true };
    },
    sireImportarTxt: async () => {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.csv';
            input.onchange = (e: any) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve({ success: false, error: 'No se seleccionó ningún archivo' });
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    resolve({
                        success: true,
                        content: ev.target?.result,
                        filename: file.name
                    });
                };
                reader.onerror = () => {
                    resolve({ success: false, error: 'Error al leer el archivo' });
                };
                reader.readAsText(file);
            };
            input.click();
        });
    },

    // --- Suggestions & Admin API ---
    submitSuggestion: async (data: any) => {
        const res = await api.post('/api/suggestions', data);
        return res.data;
    },
    adminGetSuggestions: async () => {
        const res = await api.get(`/api/admin/suggestions?t=${Date.now()}`);
        return res.data.suggestions || [];
    },
    adminResolveSuggestion: async (id: string) => {
        const res = await api.post(`/api/admin/suggestions/${id}/resolve`);
        return res.data;
    },
    adminGetUsers: async () => {
        const res = await api.get(`/api/admin/users?t=${Date.now()}`);
        return res.data.users || [];
    },
    adminGetUserWorkspaceData: async (userId: string, ruc: string) => {
        const res = await api.get(`/api/admin/user-workspace-data/${userId}/${ruc}?t=${Date.now()}`);
        return res.data.data;
    },

    // --- Sprint 5: IFRS/NIIF & NIC 12 API ---
    getFinanceNotes: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/finance/notes/${ruc}?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    saveFinanceNotes: async (ruc: string, periodo: string, notes: any) => {
        const res = await api.post('/api/finance/notes', { ruc, periodo, notes });
        return res.data;
    },
    getDeferredTax: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/finance/deferred-tax/${ruc}?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    saveDeferredTax: async (ruc: string, periodo: string, computation: any) => {
        const res = await api.post('/api/finance/deferred-tax', { ruc, periodo, computation });
        return res.data;
    },

    // --- Libro Diario 5.2 API ---
    ld52GetAsientos: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/libro-diario-52/${ruc}?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    ld52GetFormatoFisico: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/libro-diario-52/${ruc}/formato-fisico?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    ld52Registrar: async (ruc: string, lineas: any[]) => {
        const res = await api.post(`/api/libro-diario-52/${ruc}/registrar`, { lineas });
        return res.data;
    },
    ld52GenerarMasivo: async (ruc: string, periodo: string) => {
        const res = await api.post(`/api/libro-diario-52/${ruc}/generar-masivo`, { periodo });
        return res.data;
    },
    ld52Corregir: async (ruc: string, cuoOriginal: string, tipo: number, nuevasLineas: any[]) => {
        const res = await api.put(`/api/libro-diario-52/${ruc}/corregir`, { cuoOriginal, tipo, nuevasLineas });
        return res.data;
    },
    ld52ValidarBalance: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/libro-diario-52/${ruc}/validar-balance?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    ld52ExportarTXT: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/libro-diario-52/${ruc}/exportar-txt?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },
    ld52ExportarTXT54: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/libro-diario-52/${ruc}/exportar-txt-54?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },
    ld52SyncCompra: async (ruc: string, id: string) => {
        const res = await api.post(`/api/libro-diario-52/${ruc}/sync-compra`, { id });
        return res.data;
    },
    ld52SyncVenta: async (ruc: string, id: string) => {
        const res = await api.post(`/api/libro-diario-52/${ruc}/sync-venta`, { id });
        return res.data;
    },
    ld52DeleteOrigen: async (ruc: string, id: string) => {
        const res = await api.post(`/api/libro-diario-52/${ruc}/delete-origen`, { id });
        return res.data;
    },

    // --- Window Control (No-ops en Web) ---
    winMinimize: () => {},
    winMaximize: () => {},
    winClose: () => {},
    winIsMaximized: async () => false,
};
