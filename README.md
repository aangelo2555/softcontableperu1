# 💼 SOFTCONTABLE - Sistema de Gestión Contable y Tributaria

> ERP corporativo especializado en contabilidad, facturación electrónica SUNAT, buzón SOL, libros electrónicos SIRE, reportes financieros y asistencia inteligente con IA para empresas peruanas.

---

## 🚀 Novedades - Versión 2.0.0 (Julio 2026)

### ⚡ Soporte Multi-Base de Datos (SQLite + PostgreSQL)
El sistema ahora soporta una arquitectura de base de datos híbrida para máxima flexibilidad:
- **Desarrollo/Local**: SQLite con modo **WAL (Write-Ahead Logging)** habilitado para permitir lecturas no bloqueantes y alta concurrencia de lectura.
- **Producción (Railway/SaaS)**: PostgreSQL con pool de conexiones optimizado, reconexión automática y **traducción dinámica de dialectos en tiempo de ejecución**. Esto permite ejecutar consultas complejas con compatibilidad cruzada de forma transparente.

### 🛡️ Hardening de Seguridad y Auditoría
- **Cifrado de Credenciales (AES-256-CBC)**: Cifrado y descifrado seguro de claves SOL y certificados digitales de SUNAT. Mandatorio el uso de claves ambientales en producción.
- **Seguridad en API**: Integración de cabeceras de seguridad HTTP con `helmet`, políticas de CORS restringidas y protección contra inyección SQL mediante validaciones dinámicas.
- **Rate Limiting**: Mitigación de fuerza bruta en logins y registros con límites estrictos de intentos por IP.
- **Frontend Seguro**: Contraseñas enmascaradas con inputs nativos y remoción de contraseñas guardadas en texto plano en `localStorage`.

### 🧠 Capa de Inteligencia Artificial (Asistente RAG Contable)
- Integración nativa con **Google Gemini (1.5 Flash/Pro)**.
- Base de conocimiento tributaria y contable indexada localmente para responder consultas complejas de tributación peruana (Régimen MYPE, Especial, General, Detracciones, Retenciones, etc.).
- Soporte para adjuntar capturas de pantalla de estados financieros o asientos para auditoría visual en tiempo real.

---

## 📦 Instalación

### Requisitos
- Node.js 20+
- NPM o Yarn
- PostgreSQL (opcional para producción)
- Windows/Linux/macOS

### Pasos de Despliegue Local

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/softcontable.git
# Entrar al directorio
cd softcontable

# Instalar dependencias
npm install

# Copiar configuración de variables de entorno
copy .env.example .env

# Iniciar en modo desarrollo (Frontend + Vite)
npm run dev

# Iniciar servidor backend
npm start
```

---

## 🔧 Variables de Entorno (.env)

El sistema lee las siguientes configuraciones desde el archivo `.env` o las variables de entorno de la plataforma de hosting (e.g. Railway):

```env
# Conexión a Base de Datos
USE_POSTGRES=true
DATABASE_URL=postgresql://postgres:password@localhost:5432/softcontable
DATABASE_PATH=./database/pld_contable.db

# Configuración del Entorno
NODE_ENV=production
PORT=3001

# Seguridad Crítica
JWT_SECRET=tu-secreto-jwt-altamente-seguro
ENCRYPTION_KEY=tu-clave-aes-de-32-caracteres-exactos

# Optimización y Ajustes
ENABLE_RATE_LIMIT=true
CACHE_TTL=1800000
STORAGE_PATH=/app/storage
```

---

## 📚 Estructura del Proyecto

```
SOFTCONTABLE_WEB_READY/
├── src/                    # Frontend React 19 + TypeScript
│   ├── components/         # Componentes de UI contable y paneles
│   ├── store.ts           # Estado global y orquestación con Zustand
│   └── App.tsx            # Componente raíz del cliente
├── server/                 # Backend Node.js + Express
│   ├── app.js             # Punto de entrada de la API Express
│   ├── databaseServer.js  # Conector local de SQLite
│   ├── databasePostgres.js# Conector de PostgreSQL y traductores SQL
│   ├── cryptoUtils.js     # Utilidades criptográficas AES-256
│   └── controllers/       # Controladores desacoplados de rutas
├── scripts/                # Scripts de automatización, migración y test
│   ├── test_phase3_validation.js # Tests de integración de BD
│   └── stress_test.js      # Pruebas de estrés concurrentes
└── package.json
```

---

## 🎯 Módulos del Sistema

1. **Operaciones**: Compras, Ventas, Honorarios, Asientos de Diario y Planilla de Sueldos (Normativa PLAME 2026).
2. **Tesorería**: Libro Caja, Conciliación Bancaria y control de Cuentas Corrientes.
3. **Libros Oficiales**: Libro Diario (Formato 5.2), Libro Mayor y Balance de Comprobación de 10 columnas.
4. **Estados Financieros**: Situación Financiera, Resultados Integrales, Cambios en el Patrimonio, Flujos de Efectivo y Notas NIIF (NIC 12 / NIC 16).
5. **SIRE SUNAT**: Descarga, conciliación SUNAT vs ERP y centralización directa.
6. **Buzón SOL**: Auditoría en tiempo real y descarga de resoluciones / notificaciones.

---

## 📖 Documentación Relacionada
- [Documentación Integral del Sistema](./C:/Users/aange/.gemini/antigravity/brain/e487026e-94d1-403b-b8c9-eaab57e43b0e/documentacion_sistema.md): Detalles sobre el flujo de centralización, diagramas y arquitectura contable.
- [Walkthrough de Auditoría](./C:/Users/aange/.gemini/antigravity/brain/e487026e-94d1-403b-b8c9-eaab57e43b0e/walkthrough.md): Registro de las vulnerabilidades parchadas y pruebas de rendimiento.

---
Copyright © 2026 Angelo Serna Simeon
**Desarrollado con ❤️ en Perú 🇵🇪**
