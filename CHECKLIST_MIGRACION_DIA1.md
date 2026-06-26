# ✅ CHECKLIST MIGRACIÓN DÍA 1 - PostgreSQL

## 📊 RESUMEN EJECUTIVO

- **Tiempo Total Estimado**: 4-6 horas
- **Complejidad**: Media
- **Reversibilidad**: Alta (100% reversible)
- **Riesgo**: Bajo (backup completo creado)

---

## 🎯 OBJETIVO

Migrar la base de datos de **SQLite** a **PostgreSQL** manteniendo el sistema completamente funcional y escalable para **100+ usuarios concurrentes**.

---

## ✅ PROGRESO ACTUAL

### COMPLETADO EN LOCAL ✅

- [x] **Backup SQLite creado**
  - Archivo: `backups/pld_contable_backup_20260626.db`
  - Tamaño: 487 KB
  - Estado: ✅ Verificado

- [x] **Exportación de datos completada**
  - Total registros: 1,898
  - Usuarios: 5
  - Empresas: 1
  - Plan contable: 1,818 registros
  - Archivo: `migration-output/sqlite_export.json` (903 KB)

- [x] **Schema PostgreSQL generado**
  - 31 tablas
  - Archivo: `migration-output/postgres_schema.sql`

- [x] **Índices optimizados creados**
  - 40+ índices de performance
  - Archivo: `migration-output/create_indexes.sql`

- [x] **Dependencias instaladas**
  - `pg` (PostgreSQL client) ✅
  - `better-sqlite3` (SQLite) ✅

- [x] **Código backend actualizado**
  - Soporte dinámico PostgreSQL/SQLite
  - Variable `USE_POSTGRES` para cambiar entre sistemas
  - Backward compatible con SQLite

---

## 🚀 PENDIENTE EN RAILWAY

### 1. Crear PostgreSQL ⏳
- [ ] Ir a Railway Dashboard
- [ ] Click en "+ New" → "Database" → "PostgreSQL"
- [ ] Esperar creación (2-3 min)
- [ ] Verificar que aparece servicio "Postgres"

**Tiempo**: 5 minutos

---

### 2. Obtener DATABASE_URL ⏳
- [ ] Click en servicio "Postgres"
- [ ] Ir a pestaña "Variables"
- [ ] Copiar valor de `DATABASE_URL`
- [ ] Guardar en lugar seguro

**Formato esperado**:
```
postgresql://postgres:PASSWORD@xxxxx.railway.app:5432/railway
```

**Tiempo**: 2 minutos

---

### 3. Crear Schema ⏳
- [ ] Abrir terminal en carpeta del proyecto
- [ ] Ejecutar: `railway run psql < migration-output\postgres_schema.sql`
- [ ] Verificar: `railway run psql -c "\dt"`
- [ ] Confirmar: 31 tablas creadas

**Tiempo**: 10 minutos

---

### 4. Importar Datos ⏳
- [ ] Configurar variable: `set DATABASE_URL=postgresql://...`
- [ ] Ejecutar: `node scripts\import-to-postgres.js`
- [ ] Verificar: 1,898 registros importados
- [ ] Confirmar integridad de datos

**Tiempo**: 15-20 minutos

---

### 5. Crear Índices ⏳
- [ ] Ejecutar: `railway run psql < migration-output\create_indexes.sql`
- [ ] Verificar: `railway run psql -c "\di"`
- [ ] Confirmar: 40+ índices creados

**Tiempo**: 5 minutos

---

### 6. Configurar Variables de Entorno ⏳
- [ ] Ir a Railway Dashboard → Servicio Backend → Variables
- [ ] Agregar: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- [ ] Agregar: `USE_POSTGRES=true`
- [ ] Agregar: `NODE_ENV=production`
- [ ] Agregar: `JWT_SECRET=CAMBIAR-POR-VALOR-SEGURO`
- [ ] Agregar: `ENCRYPTION_KEY=CAMBIAR-POR-VALOR-SEGURO`

**Tiempo**: 5 minutos

---

### 7. Deploy Backend ⏳
- [ ] Ejecutar: `git add .`
- [ ] Ejecutar: `git commit -m "feat: migración a PostgreSQL"`
- [ ] Ejecutar: `git push origin main`
- [ ] Monitorear deploy en Railway Dashboard
- [ ] Verificar logs: "✅ Conectado exitosamente"

**Tiempo**: 10 minutos

---

### 8. Verificar Funcionamiento ⏳
- [ ] Health check: `https://softcontable.up.railway.app/api/health`
- [ ] Respuesta esperada: `{"status":"ok","database":"PostgreSQL"}`
- [ ] Login en frontend
- [ ] Cargar empresa
- [ ] Verificar plan contable
- [ ] Verificar módulos (Compras, Ventas, SIRE)

**Tiempo**: 5 minutos

---

## 📊 BENEFICIOS ESPERADOS

| Métrica | Antes (SQLite) | Después (PostgreSQL) | Mejora |
|---------|----------------|----------------------|--------|
| **Latencia** | ~500ms | ~150-200ms | **60% más rápido** |
| **Conexiones** | 1 (bloqueante) | 20 simultáneas | **20x más** |
| **Usuarios concurrentes** | 10-15 máx | 100+ | **7x más** |
| **Bloqueos escritura** | Frecuentes | Ninguno (MVCC) | **100% mejor** |
| **Escalamiento** | Imposible | Horizontal/Vertical | **∞** |

---

## 🆘 SI ALGO FALLA

### Opción 1: Rollback Inmediato
```bash
# En Railway Variables
USE_POSTGRES=false

# O eliminar la variable USE_POSTGRES
```

El sistema volverá a usar SQLite automáticamente.

### Opción 2: Revisar Logs
```bash
railway logs --tail 100
```

### Opción 3: Verificar Conexión
```bash
railway run psql -c "SELECT NOW()"
```

---

## 📞 AYUDA ADICIONAL

- **Documento completo**: Ver `RAILWAY_SETUP.md`
- **Troubleshooting**: Ver sección en `RAILWAY_SETUP.md`
- **Arquitectura**: Ver `MIGRACION_ARQUITECTURA_SEPARADA.md`

---

## 🎯 SIGUIENTE FASE

Una vez completado el DÍA 1:

- **DÍA 2**: Separar Frontend (Nginx)
- **DÍA 3**: CDN y Cache
- **DÍA 4**: Monitoreo y Logs
- **DÍA 5**: Testing y Go-Live

---

## 💡 NOTAS IMPORTANTES

1. ✅ **Backup seguro**: SQLite original intacto en `backups/`
2. ✅ **100% reversible**: Cambiar `USE_POSTGRES=false` revierte todo
3. ✅ **Sin cambios de código**: Frontend no requiere cambios
4. ✅ **Credenciales seguras**: Misma encriptación AES-256
5. ✅ **Zero downtime**: Deploy sin interrumpir servicio

---

**Estado**: 🟡 En progreso - Local completado, Railway pendiente

**Próximo paso**: Crear PostgreSQL en Railway Dashboard

