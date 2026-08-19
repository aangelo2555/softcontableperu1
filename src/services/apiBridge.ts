import axios from 'axios';

// Detectar si estamos en Railway o Localhost
let API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim();

// 🔧 SANITIZACIÓN DE DOMINIO (Fallback Inteligente):
// Si VITE_API_URL contiene el dominio de ejemplo ficticio 'softcontable.up.railway.app'
// o si estamos en la web servidos por el mismo Express server, usamos rutas relativas ('')
// para que Axios consuma automáticamente el dominio real de Railway desde el que navega el usuario.
if (API_BASE_URL.includes('softcontable.up.railway.app')) {
    console.warn('[API BRIDGE] ⚠️ Dominio de ejemplo detectado en VITE_API_URL. Usando rutas relativas al mismo origen.');
    API_BASE_URL = '';
}

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 180000, // 180 segundos (3 minutos) para llamadas pesadas de SUNAT en la nube
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

// Interceptor de respuesta con renovación silenciosa de Refresh Token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Si el error es 401 (No autorizado) y la petición no ha sido reintentada
        // y no es una llamada de login o refresh
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/api/auth/login') &&
            !originalRequest.url?.includes('/api/auth/refresh')
        ) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('softcontable_refresh_token');

            if (refreshToken) {
                try {
                    console.log('[API BRIDGE] 🔄 Token de acceso expirado. Renovando sesión con Refresh Token...');
                    const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
                    
                    if (res.data?.success && res.data?.accessToken) {
                        const newAccessToken = res.data.accessToken;
                        const newRefreshToken = res.data.refreshToken;

                        localStorage.setItem('softcontable_token', newAccessToken);
                        if (newRefreshToken) {
                            localStorage.setItem('softcontable_refresh_token', newRefreshToken);
                        }

                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        console.log('[API BRIDGE] ✅ Sesión renovada con éxito. Reintentando operación...');
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    console.warn('[API BRIDGE] ⚠️ Error al renovar token. Cerrando sesión.');
                    localStorage.removeItem('softcontable_token');
                    localStorage.removeItem('softcontable_refresh_token');
                    localStorage.removeItem('softcontable_user');
                    window.location.reload();
                    return Promise.reject(refreshError);
                }
            }
        }

        const serverError = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error('❌ [API BRIDGE ERROR]:', serverError);
        return Promise.reject(error);
    }
);

// Helper: Convertir placeholders de SQLite (?) a PostgreSQL ($1, $2, $3...)
function convertSQLitePlaceholdersToPostgres(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

export const webApiBridge = {
    isWebBridge: true,
    // --- Auth API ---
    authLogin: async (credentials: any) => {
        const res = await api.post('/api/auth/login', credentials);
        return res.data;
    },
    authRegister: async (userData: any) => {
        const res = await api.post('/api/auth/register', userData);
        return res.data;
    },
    authRegisterStudent: async (userData: any) => {
        const res = await api.post('/api/auth/register-student', userData);
        return res.data;
    },
    authForgotPassword: async (data: { email: string; newPassword?: string; code?: string; action?: string }) => {
        const res = await api.post('/api/auth/forgot-password', data);
        return res.data;
    },
    authRequestResetOtp: async (data: { email: string }) => {
        const res = await api.post('/api/auth/forgot-password/request-otp', data);
        return res.data;
    },
    authVerifyResetOtp: async (data: { email: string; code: string }) => {
        const res = await api.post('/api/auth/forgot-password/verify-otp', data);
        return res.data;
    },
    authResetPasswordWithOtp: async (data: { email: string; code?: string; newPassword?: string; resetToken?: string }) => {
        const res = await api.post('/api/auth/forgot-password/reset', data);
        return res.data;
    },
    authChangePassword: async (data: { currentPassword?: string; newPassword?: string }) => {
        const res = await api.post('/api/auth/change-password', data);
        return res.data;
    },
    authVerifyEmailToken: async (data: { token: string }) => {
        const res = await api.post('/api/auth/verify-email-token', data);
        return res.data;
    },
    authVerifyEmailOtp: async (data: { email: string; otpCode: string }) => {
        const res = await api.post('/api/auth/verify-email-otp', data);
        return res.data;
    },
    authResendVerification: async (data: { email: string }) => {
        const res = await api.post('/api/auth/resend-verification', data);
        return res.data;
    },
    authCheckVerificationStatus: async (params: { email: string }) => {
        const res = await api.get(`/api/auth/check-verification-status?email=${encodeURIComponent(params.email)}&t=${Date.now()}`);
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
    dbGetWorkspaceData: async (ruc: string, options?: { period?: string; page?: number; limit?: number; excludePlan?: boolean }) => {
        const params = new URLSearchParams({ t: Date.now().toString() });
        if (options?.period) params.append('period', options.period);
        if (options?.page) params.append('page', options.page.toString());
        if (options?.limit) params.append('limit', options.limit.toString());
        if (options?.excludePlan) params.append('exclude_plan', 'true');
        const res = await api.get(`/api/db/workspaces/${ruc}?${params.toString()}`);
        return res.data.data;
    },
    dbGetPurchases: async (ruc: string, period?: string, page = 1, limit = 500) => {
        const params = new URLSearchParams({ ruc, page: page.toString(), limit: limit.toString() });
        if (period) params.append('period', period);
        const res = await api.get(`/api/db/purchases?${params.toString()}`);
        return res.data.data || [];
    },
    dbGetSales: async (ruc: string, period?: string, page = 1, limit = 500) => {
        const params = new URLSearchParams({ ruc, page: page.toString(), limit: limit.toString() });
        if (period) params.append('period', period);
        const res = await api.get(`/api/db/sales?${params.toString()}`);
        return res.data.data || [];
    },
    dbGetJournal: async (ruc: string, period?: string, page = 1, limit = 1000) => {
        const params = new URLSearchParams({ ruc, page: page.toString(), limit: limit.toString() });
        if (period) params.append('period', period);
        const res = await api.get(`/api/db/journal?${params.toString()}`);
        return res.data.data || [];
    },
    dbExecute: async (sql: string, params?: any[]) => {
        // Convertir ? a $1, $2, $3 para PostgreSQL
        const convertedSQL = convertSQLitePlaceholdersToPostgres(sql);
        const res = await api.post('/api/db/execute', { sql: convertedSQL, params: params || [] });
        return res.data;
    },
    dbSavePurchasesBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/purchases/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveSalesBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/sales/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveJournalBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/journal/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveEntitiesBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/entities/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveHonorariosBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/honorarios/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveAsientosBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/asientos/batch', { workspace_id, items });
        return res.data;
    },
    dbSaveEmployeesBatch: async (workspace_id: string, items: any[]) => {
        const res = await api.post('/api/db/employees/batch', { workspace_id, items });
        return res.data;
    },
    dbDeletePurchase: async (id: string, workspace_id?: string) => {
        const query = workspace_id ? `?workspace_id=${workspace_id}` : '';
        const res = await api.delete(`/api/db/purchases/${id}${query}`);
        return res.data;
    },
    dbDeleteSale: async (id: string, workspace_id?: string) => {
        const query = workspace_id ? `?workspace_id=${workspace_id}` : '';
        const res = await api.delete(`/api/db/sales/${id}${query}`);
        return res.data;
    },
    dbDeleteHonorario: async (id: string, workspace_id?: string) => {
        const query = workspace_id ? `?workspace_id=${workspace_id}` : '';
        const res = await api.delete(`/api/db/honorarios/${id}${query}`);
        return res.data;
    },
    dbDeleteAsiento: async (id: string, workspace_id?: string) => {
        const query = workspace_id ? `?workspace_id=${workspace_id}` : '';
        const res = await api.delete(`/api/db/asientos/${id}${query}`);
        return res.data;
    },
    dbDeleteEmployee: async (id: string, workspace_id?: string) => {
        const query = workspace_id ? `?workspace_id=${workspace_id}` : '';
        const res = await api.delete(`/api/db/employees/${id}${query}`);
        return res.data;
    },
    dbQuery: async (sql: string, params?: any[]) => {
        // Convertir ? a $1, $2, $3 para PostgreSQL
        const convertedSQL = convertSQLitePlaceholdersToPostgres(sql);
        const res = await api.post('/api/db/query', { sql: convertedSQL, params: params || [] });
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
        return { success: res.data.success, data: res.data.metrics };
    },
    
    // --- Period Management & Invalidation ---
    getPeriods: async (ruc: string) => {
        const res = await api.get(`/api/periods/${ruc}`);
        return res.data.periods || [];
    },
    getStaleStatus: async (ruc: string, periodo: string) => {
        try {
            const res = await api.get(`/api/periods/${ruc}/stale-status?periodo=${periodo}`);
            return Array.isArray(res.data?.rows) ? res.data.rows : [];
        } catch (e) {
            console.error('[API BRIDGE] Error fetching stale status:', e);
            return [];
        }
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

    // --- CPE API ---
    cpeDescargarLote: async (args: { ruc: string; usuario_sol?: string; clave_sol?: string; client_id?: string; client_secret?: string; facturas: any[] }) => {
        const res = await api.post('/api/cpe/descargar-xml', args);
        return res.data;
    },
    cpeDescargarArchivo: async (args: { ruta: string }) => {
        const res = await api.post('/api/cpe/descargar-archivo', args);
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

    retenciones41Listar: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/retenciones-41/${ruc}?periodo=${periodo}&t=${Date.now()}`);
        return res.data;
    },
    retenciones41ExportarTXT: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/retenciones-41/${ruc}/exportar-txt?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },
    ple71ExportarTXT: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/ple-71/${ruc}/exportar-txt?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },
    ple101ExportarTXT: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/ple-101/${ruc}/exportar-txt?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },
    ple121ExportarTXT: async (ruc: string, periodo: string) => {
        const res = await api.get(`/api/ple-121/${ruc}/exportar-txt?periodo=${periodo}`, { responseType: 'blob' });
        return res.data;
    },

    // --- Facturación Electrónica UBL 2.1 ---
    facturacionConfigurarCertificado: async (ruc: string, data: { password: string, pfxBase64: string }) => {
        const res = await api.post('/api/facturacion/configurar-certificado', { ruc, ...data });
        return res.data;
    },
    facturacionEmitirComprobante: async (ruc: string, comprobanteId: string) => {
        const res = await api.post('/api/facturacion/emitir-comprobante', { ruc, comprobanteId });
        return res.data;
    },

    // --- AI Assistant APIs ---
    aiGenerate: async (premisa: string, companyContext: any, planContable: any[], history?: any[]) => {
        const res = await api.post('/api/ai/generate', { premisa, companyContext, planContable, history });
        return res.data;
    },
    aiGetChatHistory: async (workspaceId: string) => {
        const res = await api.get(`/api/ai/chat-history?workspaceId=${encodeURIComponent(workspaceId)}`);
        return res.data;
    },
    aiSaveChatHistory: async (workspaceId: string, messages: any[]) => {
        const res = await api.post('/api/ai/chat-history', { workspaceId, messages });
        return res.data;
    },
    aiClearChatHistory: async (workspaceId: string) => {
        const res = await api.delete(`/api/ai/chat-history?workspaceId=${encodeURIComponent(workspaceId)}`);
        return res.data;
    },
    aiGetKnowledge: async (filters?: { sector?: string; regimen?: string; categoria?: string; search?: string }) => {
        const params = new URLSearchParams();
        if (filters?.sector) params.append('sector', filters.sector);
        if (filters?.regimen) params.append('regimen', filters.regimen);
        if (filters?.categoria) params.append('categoria', filters.categoria);
        if (filters?.search) params.append('search', filters.search);
        const res = await api.get(`/api/ai/knowledge?${params.toString()}`);
        return res.data;
    },
    aiSaveKnowledge: async (item: any) => {
        const res = await api.post('/api/ai/knowledge', item);
        return res.data;
    },
    aiUpdateKnowledge: async (id: string, item: any) => {
        const res = await api.put(`/api/ai/knowledge/${id}`, item);
        return res.data;
    },
    aiDeleteKnowledge: async (id: string) => {
        const res = await api.delete(`/api/ai/knowledge/${id}`);
        return res.data;
    },
    aiSeedKnowledge: async () => {
        const res = await api.post('/api/ai/knowledge/seed');
        return res.data;
    },

    // --- SaaS Subscriptions & Billing APIs ---
    subscriptionGetPlans: async () => {
        const res = await api.get('/api/plans/plans');
        return res.data;
    },
    subscriptionGetMe: async () => {
        const res = await api.get('/api/subscription/me');
        return res.data;
    },
    subscriptionCheckout: async (data: { planId: string; culqiToken: string; billingCycle?: string; email?: string }) => {
        const res = await api.post('/api/subscription/checkout', data);
        return res.data;
    },
    subscriptionGetInvoices: async () => {
        const res = await api.get('/api/subscription/invoices');
        return res.data;
    },
    subscriptionCancel: async () => {
        const res = await api.put('/api/subscription/cancel');
        return res.data;
    },

    // --- SuperAdmin APIs ---
    superadminGetMetrics: async () => {
        const res = await api.get('/api/superadmin/metrics');
        return res.data;
    },
    superadminGetClients: async () => {
        const res = await api.get('/api/superadmin/clients');
        return res.data;
    },
    superadminUpdateClientPlan: async (userId: string, data: { planId: string; status?: string; maxWorkspaces?: number; daysToAdd?: number }) => {
        const res = await api.put(`/api/superadmin/client/${userId}/plan`, data);
        return res.data;
    },
    superadminImpersonate: async (targetUserId: string) => {
        const res = await api.post('/api/superadmin/impersonate', { targetUserId });
        return res.data;
    },
    superadminGetInvoices: async () => {
        const res = await api.get('/api/superadmin/invoices');
        return res.data;
    },

    // --- Window Control (No-ops en Web) ---
    winMinimize: () => {},
    winMaximize: () => {},
    winClose: () => {},
    winIsMaximized: async () => false,
};
