# 🏗️ MIGRACIÓN A ARQUITECTURA SEPARADA - RAILWAY

## Fecha: 26/06/2026
## Objetivo: Separar Frontend, Backend y Base de Datos en servicios independientes

---

## 📊 ARQUITECTURA ACTUAL (Monolítica)

```
┌─────────────────────────────────────────────┐
│  Railway Service: softcontableperu1         │
│  ├── Frontend (Vite Build)                  │
│  ├── Backend API (Express)                  │
│  └── SQLite DB (Volume)                     │
│                                              │
│  Problemas:                                  │
│  - Todo en 1 proceso (CPU/RAM compartido)   │
│  - SQLite no soporta alta concurrencia      │
│  - Difícil escalar horizontalmente          │
│  - Servicio duplicado causando conflictos   │
└─────────────────────────────────────────────┘
```

---

## 🎯 ARQUITECTURA OBJETIVO (Microservicios)

```
┌────────────────────────────────┐
│  Railway Service 1: FRONTEND   │
│  - Static Files (Nginx)        │
│  - CDN Edge Caching            │
│  - Gzip Compression            │
│  Port: 80/443                  │
│  URL: softcontable.up.railway  │
└────────────┬───────────────────┘
             │ API Calls
             ▼
┌────────────────────────────────┐
│  Railway Service 2: BACKEND    │
│  - Node.js Express API         │
│  - Authentication              │
│  - Business Logic              │
│  - Rate Limiting               │
│  - Connection Pooling          │
│  Port: 8080                    │
│  URL: api-softcontable.railway │
└────────────┬───────────────────┘
             │ SQL Queries
             ▼
┌────────────────────────────────┐
│  Railway Service 3: POSTGRESQL │
│  - PostgreSQL 15               │
│  - Persistent Storage          │
│  - Automated Backups           │
│  - Read Replicas (futuro)      │
│  Port: 5432                    │
│  Internal URL: postgres.railway│
└────────────────────────────────┘
```

---

## 📅 CRONOGRAMA DE IMPLEMENTACIÓN

### **DÍA 1: Preparación y PostgreSQL (4-6 horas)**

#### Mañana (2-3 horas)
- ✅ Eliminar servicio duplicado en Railway
- ✅ Crear servicio PostgreSQL en Railway
- ✅ Exportar datos de SQLite
- ✅ Diseñar esquema PostgreSQL optimizado

#### Tarde (2-3 horas)
- ✅ Migrar datos SQLite → PostgreSQL
- ✅ Crear índices optimizados
- ✅ Validar integridad de datos
- ✅ Configurar backups automáticos

---

### **DÍA 2: Separar Backend API (6-8 horas)**

#### Mañana (3-4 horas)
- ✅ Crear servicio Backend separado en Railway
- ✅ Actualizar código para usar PostgreSQL
- ✅ Implementar connection pooling
- ✅ Agregar variables de entorno

#### Tarde (3-4 horas)
- ✅ Implementar paginación en endpoints
- ✅ Agregar rate limiting
- ✅ Optimizar queries SQL
- ✅ Testing de endpoints

---

### **DÍA 3: Separar Frontend (4-6 horas)**

#### Mañana (2-3 horas)
- ✅ Crear servicio Frontend separado (Nginx)
- ✅ Configurar build estático
- ✅ Actualizar URLs de API
- ✅ Configurar CORS

#### Tarde (2-3 horas)
- ✅ Implementar paginación en UI
- ✅ Optimizar bundle size
- ✅ Configurar CDN caching
- ✅ Testing frontend

---

### **DÍA 4: Optimización y Monitoreo (4-6 horas)**

#### Mañana (2-3 horas)
- ✅ Implementar health checks
- ✅ Configurar logging centralizado
- ✅ Agregar métricas de performance
- ✅ Setup alerts

#### Tarde (2-3 horas)
- ✅ Load testing
- ✅ Optimización de queries lentas
- ✅ Fine-tuning PostgreSQL
- ✅ Documentación

---

### **DÍA 5: Testing y Go-Live (4-6 horas)**

#### Mañana (2-3 horas)
- ✅ Testing de integración end-to-end
- ✅ Testing de carga (100+ usuarios)
- ✅ Rollback plan preparado
- ✅ Backup completo pre-migración

#### Tarde (2-3 horas)
- ✅ Go-live producción
- ✅ Monitoreo en vivo
- ✅ Ajustes post-lanzamiento
- ✅ Eliminar servicios viejos

---

## 🔧 TECNOLOGÍAS Y HERRAMIENTAS

### Backend
- **Node.js 20 LTS**
- **Express.js 4.18**
- **pg (node-postgres)** - Driver PostgreSQL
- **express-rate-limit** - Rate limiting
- **compression** - Gzip
- **helmet** - Security headers
- **morgan** - Logging

### Database
- **PostgreSQL 15**
- **pg-promise** o **Prisma** (ORM opcional)
- **pg-pool** - Connection pooling

### Frontend
- **Vite 5** - Build tool
- **React 18**
- **Nginx** - Static file server
- **@tanstack/react-query** - Data fetching

### DevOps
- **Railway CLI**
- **GitHub Actions** - CI/CD
- **Sentry** - Error tracking (opcional)

---

## 💰 COSTOS ESTIMADOS RAILWAY

### Plan Hobby (Gratis con límites)
- Frontend: ~$0-5/mes (static hosting)
- Backend: ~$5-10/mes (512MB RAM)
- PostgreSQL: ~$5-10/mes (1GB storage)
- **Total: $10-25/mes**

### Plan Pro (Recomendado para producción)
- Frontend: ~$5-10/mes
- Backend: ~$15-25/mes (1GB RAM)
- PostgreSQL: ~$15-25/mes (5GB storage + backups)
- **Total: $35-60/mes**

---

## ⚡ BENEFICIOS ESPERADOS

### Performance
- ✅ **Latencia reducida 50-70%** (de ~500ms a ~150-200ms)
- ✅ **Throughput aumentado 10x** (de 10 req/s a 100+ req/s)
- ✅ **Time to First Byte (TTFB) < 200ms**

### Escalabilidad
- ✅ **Horizontal scaling** - Múltiples instancias de backend
- ✅ **Soporta 100+ usuarios concurrentes**
- ✅ **Database connection pooling** (20-50 conexiones)

### Confiabilidad
- ✅ **Uptime 99.9%+**
- ✅ **Backups automáticos diarios**
- ✅ **Point-in-time recovery**
- ✅ **Zero-downtime deployments**

### Costos
- ✅ **Optimización de recursos** (cada servicio usa lo necesario)
- ✅ **Escala independiente** (solo escala lo que necesitas)
- ✅ **Sin recursos desperdiciados**

---

## 🚨 RIESGOS Y MITIGACIÓN

### Riesgo 1: Pérdida de datos durante migración
**Mitigación**: 
- Backup completo SQLite antes de migrar
- Validación de integridad post-migración
- Rollback plan con snapshot

### Riesgo 2: Downtime durante go-live
**Mitigación**: 
- Blue-green deployment
- Migración en horario de baja demanda
- Rollback automático si errores > 5%

### Riesgo 3: Incompatibilidades SQL
**Mitigación**: 
- Testing exhaustivo en ambiente staging
- Converter script de SQLite → PostgreSQL
- Validación de queries uno por uno

### Riesgo 4: Aumento de costos
**Mitigación**: 
- Monitoreo de uso desde día 1
- Configurar alerts de billing
- Optimizar antes de escalar

---

## 📝 CHECKLIST PRE-MIGRACIÓN

### Antes de empezar
- [ ] Backup completo de base de datos
- [ ] Backup del código actual (git tag)
- [ ] Inventario de todas las variables de entorno
- [ ] Lista de todos los endpoints API
- [ ] Documentación de queries SQL críticos
- [ ] Plan de rollback documentado

### Railway Account
- [ ] Verificar límites del plan actual
- [ ] Considerar upgrade a Pro si es necesario
- [ ] Configurar billing alerts
- [ ] Setup personal access token para CLI

### Equipo
- [ ] Notificar a usuarios de ventana de mantenimiento
- [ ] Coordinar horario de baja demanda
- [ ] Preparar soporte post-migración

---

## 🎯 MÉTRICAS DE ÉXITO

### Performance
- ✅ Latencia API < 200ms (p95)
- ✅ Time to Interactive (TTI) < 2s
- ✅ First Contentful Paint (FCP) < 1s

### Escalabilidad
- ✅ Soporta 100 usuarios concurrentes sin degradación
- ✅ Database connections estables < 50
- ✅ CPU < 70% bajo carga normal

### Confiabilidad
- ✅ Error rate < 0.1%
- ✅ Uptime > 99.9%
- ✅ Zero data loss

---

## 🚀 PRÓXIMO PASO

Comenzar con **FASE 0** y eliminar el servicio duplicado.

**Fecha de inicio**: 26/06/2026  
**Fecha objetivo de finalización**: 01/07/2026  
**Responsable**: Angelo Serna (con asistencia de Kiro AI)
