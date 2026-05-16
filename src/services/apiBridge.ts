import axios from 'axios';

// Detectar si estamos en Railway o Localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para añadir el Token JWT en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('softcontable_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

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
        const res = await api.get('/api/db/workspaces');
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
        const res = await api.get(`/api/db/workspaces/${ruc}`);
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
        const res = await api.post('/api/db/backup');
        return res.data;
    },
    dbClearWorkspace: async (ruc: string) => {
        const res = await api.post(`/api/db/clear-workspace/${ruc}`);
        return res.data;
    },
    dbSaveBalanceInicial: async (ruc: string, item: any) => {
        const res = await api.post(`/api/db/balance-inicial/${ruc}`, item);
        return res.data;
    },
    dbDeleteBalanceInicial: async (ruc: string, id: string) => {
        const res = await api.delete(`/api/db/balance-inicial/${ruc}/${id}`);
        return res.data;
    },
    analyticsCCCMetrics: async (ruc: string) => {
        const res = await api.get(`/api/db/analytics/ccc/${ruc}`);
        return res.data.metrics;
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

    // --- SIRE API ---
    ejecutarSire: async (datos: any) => {
        const res = await api.post('/api/sire/ejecutar', datos);
        return res.data;
    },
    generarArchivoSire: async (args: any) => {
        const res = await api.post('/api/sire/generar-archivo', args);
        return res.data;
    },

    // --- Window Control (No-ops en Web) ---
    winMinimize: () => {},
    winMaximize: () => {},
    winClose: () => {},
    winIsMaximized: async () => false,
};
