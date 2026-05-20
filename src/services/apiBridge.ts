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

// Interceptor para añadir el Token JWT en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('softcontable_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
        const res = await api.get('/api/sire/archivos');
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

    // --- Window Control (No-ops en Web) ---
    winMinimize: () => {},
    winMaximize: () => {},
    winClose: () => {},
    winIsMaximized: async () => false,
};
