# 💼 SOFTCONTABLE - Sistema de Gestión Contable y Tributaria

> ERP especializado en contabilidad, facturación electrónica SUNAT, buzón SOL, libros electrónicos SIRE y reportes financieros para empresas peruanas.

## 🚀 Novedades - Junio 2026

### ⚡ Nuevas Funcionalidades Automáticas

#### 1️⃣ **Buzón Electrónico Automático**
Configura tus credenciales SOL una vez y olvídate. El sistema consultará automáticamente tu buzón de SUNAT cada vez que guardes tu empresa.

- ✅ Sin intervención manual
- ✅ Solo para la empresa seleccionada
- ✅ Notificaciones listas al instante

#### 2️⃣ **Descarga Automática de SIRE**
Al configurar tus credenciales SIRE (Client ID + Secret), el sistema descarga automáticamente todos tus comprobantes desde **enero hasta el mes actual**.

- ✅ Compras (RCE) y Ventas (RVIE)
- ✅ Desde enero hasta hoy
- ✅ Sin clicks adicionales

#### 3️⃣ **Centralización Manual Mejorada**
Ahora tienes el control. Después de descargar SIRE, **tú decides** cuándo centralizar con el botón dedicado.

- ✅ Control total
- ✅ Revisar antes de importar
- ✅ Evita duplicados

#### 4️⃣ **Performance Optimizado para Railway**
- ✅ Compresión GZIP (70% menos tráfico)
- ✅ Índices de base de datos optimizados
- ✅ Consultas 10-100x más rápidas

---

## 📦 Instalación

### Requisitos
- Node.js 20+
- NPM o Yarn
- Windows/Linux/macOS

### Pasos

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/softcontable.git
cd softcontable

# Instalar dependencias
npm install

# Modo desarrollo (Frontend)
npm run dev

# Servidor backend (Railway/Local)
node server/app.js
```

---

## 🔧 Configuración Inicial

### 1. Configurar Empresa
1. Ir al **Panel Principal** → **Configurar Empresa**
2. Ingresar datos básicos (RUC, Razón Social, etc.)

### 2. Configurar Credenciales (Automatización)

#### Buzón Automático:
- **Usuario SOL**: Tu usuario SUNAT (ej: JSANTOS1)
- **Clave SOL**: Tu contraseña SOL

#### SIRE Automático:
- **Client ID**: Credencial de API SUNAT
- **Client Secret**: Secreto de API SUNAT
- **Nota**: También necesitas las credenciales SOL

Al guardar, el sistema automáticamente:
1. Consultará tu buzón electrónico
2. Descargará SIRE desde enero hasta hoy

---

## 📚 Estructura del Proyecto

```
SOFTCONTABLE_WEB_READY/
├── src/                    # Frontend React + TypeScript
│   ├── components/         # Componentes de la UI
│   ├── store.ts           # Estado global (Zustand)
│   └── App.tsx            # Componente principal
├── server/                 # Backend Express.js
│   ├── app.js             # Servidor principal
│   ├── databaseServer.js  # Gestión de base de datos
│   ├── autoSyncService.js # 🆕 Sincronización automática
│   └── ...
├── main/                   # Electron (Versión Desktop)
│   ├── buzonHandler.js    # Módulo Buzón Electrónico
│   └── ...
├── modulo/                 # Módulo SIRE
│   ├── sireOrchestrator.js
│   ├── sunatApi.js
│   └── ...
├── database/               # Base de datos SQLite
│   ├── pld_contable.db
│   └── performance_indexes.sql # 🆕 Índices de optimización
├── MEJORAS_IMPLEMENTADAS.md    # 🆕 Documentación de mejoras
├── RECOMENDACIONES_OPTIMIZACION.md # 🆕 Guía de performance
└── package.json
```

---

## 🎯 Módulos Principales

### 📥 Operaciones
- Registro de Compras
- Registro de Ventas
- Registro de Honorarios
- Asientos Contables Manuales

### 📊 Tesorería
- Libro Caja
- Conciliación Bancaria
- Control de Cuentas Corrientes

### 📖 Libros Oficiales
- Libro Diario (Formato 5.2)
- Libro Mayor
- Balance de Comprobación
- Estados Financieros

### 🌐 Módulos Auxiliares
- **Buzón Electrónico** (Automático)
- **SIRE SUNAT** (Automático desde enero)
- Facturación Electrónica UBL 2.1
- Reportes DAOT
- Prorrata IGV

### 👨‍💼 Administración
- Gestión de Usuarios
- Auditoría de Incidentes
- Inspección de Workspaces

---

## 🚀 Despliegue en Railway

### Variables de Entorno

```env
DATABASE_PATH=/app/database/pld_contable.db
JWT_SECRET=tu-secreto-jwt-super-seguro
PORT=8888
```

### Configuración del Volume
- **Mount Path**: `/app/database`
- **Size**: 5 GB

### Post-Deploy

Ejecutar el script de índices para máxima performance:

```bash
# Conectar a Railway
railway run

# Ejecutar script de índices
sqlite3 /app/database/pld_contable.db < database/performance_indexes.sql
```

---

## 📖 Documentación Adicional

- [🎯 Mejoras Implementadas](./MEJORAS_IMPLEMENTADAS.md) - Detalles técnicos de las nuevas funcionalidades
- [⚡ Recomendaciones de Optimización](./RECOMENDACIONES_OPTIMIZACION.md) - Guía completa de performance
- [📊 Script de Índices](./database/performance_indexes.sql) - Optimización de base de datos

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Copyright © 2026 Angelo Serna Simeon

---

## 📞 Soporte

- **Email**: aangelo2555@gmail.com
- **Versión**: 1.1.0
- **Última actualización**: Junio 2026

---

## 🌟 Features Destacados

- ✅ Multi-empresa y multi-usuario
- ✅ Sincronización automática con SUNAT
- ✅ Facturación electrónica UBL 2.1
- ✅ Cumplimiento tributario peruano
- ✅ Reportes financieros profesionales
- ✅ Optimizado para Railway con 5GB Volume
- ✅ Compresión GZIP automática
- ✅ Índices de base de datos para máxima velocidad

---

## 🎨 Stack Tecnológico

- **Frontend**: React 19 + TypeScript + TailwindCSS
- **Backend**: Node.js + Express.js
- **Base de Datos**: SQLite (better-sqlite3)
- **Automatización**: Playwright (Web Scraping)
- **Deploy**: Railway + Volume persistente
- **Desktop**: Electron (opcional)

---

## 📈 Rendimiento

Con las optimizaciones implementadas:

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tiempo de carga (10k registros) | 5-10s | <1s | **10x** |
| Tamaño de respuesta JSON | 5MB | 1MB | **80%** |
| Memoria del navegador | 500MB | 150MB | **70%** |
| Consultas SQL | 2-5s | 0.1-0.3s | **20x** |

---

**Desarrollado con ❤️ en Perú 🇵🇪**
