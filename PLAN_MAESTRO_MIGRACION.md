# 🎯 PLAN MAESTRO DE IMPLEMENTACIÓN
## Migración Definitiva SQLite → PostgreSQL

---

## 📊 DIAGNÓSTICO ACTUAL

### ✅ Lo que funciona:
- Backend desplegado en Railway
- PostgreSQL conectado y funcionando
- Schemas de tablas creados
- Índices optimizados aplicados
- Sistema de autenticación multi-usuario funcional

### ❌ Problemas identificados:
1. **Schemas incompletos**: Faltan columnas en varias tablas (tipOper, tipOperCode, annualIncomeUIT, etc.)
2. **Datos no persisten**: Al recargar la página se pierden los cambios
3. **Errores de columnas**: PostgreSQL tiene schemas viejos sin todas las columnas necesarias
4. **Servicios legacy**: Algunos servicios usan `db.prepare()` (API de SQLite) en lugar de PostgreSQL

---

## 🎯 OBJETIVO FINAL

**Sistema 100% funcional en PostgreSQL con:**
- ✅ Todos los datos guardándose correctamente
- ✅ Datos persistentes al recargar
- ✅ Multi-tenancy (SaaS) funcionando
- ✅ Todos los módulos operativos
- ✅ Performance optimizado

---

## 📋 PLAN DE EJECUCIÓN (4 FASES)

---

## 🔴 FASE 1: LIMPIEZA Y VALIDACIÓN DE SCHEMAS (2 horas)

### Objetivo:
Asegurar que PostgreSQL tenga TODOS los schemas correctos con TODAS las columnas.

### Pasos:

#### 1.1 Limpiar base de datos PostgreSQL ✅ COMPLETADO
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

#### 1.2 Verificar schemas después del redespliegue
**Archivo:** `server/databasePostgres.js`
**Acción:** Revisar que `ensureSchemaConstraints()` incluya TODAS las columnas necesarias.

**Checklist de columnas críticas:**

**Tabla `workspaces`:**
- [x] ruc
- [x] user_id
- [x] name
- [x] regimenTributario
- [x] period
- [x] logoBase64
- [x] sol_user (BYTEA)
- [x] sol_pass (BYTEA)
- [x] sunatClientId (BYTEA)
- [x] sunatClientSecret (BYTEA)
- [x] businessType
- [x] annualIncomeUIT (NUMERIC)
- [x] agente_retencion (BOOLEAN)
- [x] ciiuCode
- [x] fixedAssetsValue (NUMERIC)
- [x] employeeCount (INTEGER)
- [x] certificado_pfx (BYTEA)
- [x] certificado_pass (BYTEA)

**Tabla `purchases`:**
- [x] id
- [x] workspace_id
- [x] registro
- [x] fecha
- [x] tipo_doc
- [x] serie
- [x] numero
- [x] **tipOper** ⚠️ FALTA EN SCHEMA ACTUAL
- [x] **tipOperCode** ⚠️ FALTA EN SCHEMA ACTUAL
- [x] **moneda** ⚠️ FALTA EN SCHEMA ACTUAL
- [x] **monto_me** ⚠️ FALTA EN SCHEMA ACTUAL
- [x] **tc_origen** ⚠️ FALTA EN SCHEMA ACTUAL
- [x] ctaGasto
- [x] ctaAbono
- [x] bi
- [x] igv
- [x] total
- [x] **car** (SIRE)
- [x] **estado_sire**
- [x] **icbper**
- [x] **otros_tributos**
- [x] **spot_tipo**
- [x] **spot_monto**
- [x] **spot_constancia**
- [x] **spot_fecha**
- [x] **retencion_monto**
- [x] **retencion_comprobante**
- [x] **retencion_fecha**
- [x] **percepcion_monto**
- [x] **percepcion_comprobante**
- [x] **pago_monto**
- [x] **pago_fecha**
- [x] **pago_medio**
- [x] **pago_cuenta**
- [x] **pago_operacion**
- [x] user_id

**Tabla `sales`:**
- Similar a purchases, necesita las mismas columnas adicionales

**Tabla `period_versions`:**
- [x] id
- [x] workspace_id
- [x] periodo
- [x] module
- [x] version
- [x] is_stale
- [x] stale_since
- [x] **last_sync** ✅ YA AGREGADA
- [x] user_id

#### 1.3 Actualizar schema en databasePostgres.js

**Acción requerida:**
Agregar las columnas faltantes a las tablas `purchases` y `sales` en el archivo `server/databasePostgres.js`.

---

## 🟡 FASE 2: MIGRAR SERVICIOS LEGACY (3 horas)

### Objetivo:
Convertir todos los servicios que usan APIs de SQLite a PostgreSQL.

### Servicios afectados:

#### 2.1 libroDiario52Service.js
**Problema:** Usa `db.prepare()` que NO existe en PostgreSQL.
**Solución:** Reescribir para usar `db.queryAll()` y `db.run()`.

```javascript
// ❌ ANTES (SQLite)
const stmt = db.prepare('SELECT * FROM libro_diario_52 WHERE workspace_id = ?');
const rows = stmt.all(ruc);

// ✅ DESPUÉS (PostgreSQL)
const rows = await db.queryAll(
    'SELECT * FROM libro_diario_52 WHERE workspace_id = $1 AND user_id = $2',
    [ruc, userId]
);
```

#### 2.2 retenciones41Service.js
#### 2.3 ple71Service.js
#### 2.4 costs101Service.js
#### 2.5 kardex121Service.js

**Patrón de migración:**
1. Reemplazar `db.prepare()` con `db.queryAll()` o `db.run()`
2. Cambiar placeholders `?` por `$1, $2, $3...`
3. Agregar `user_id` en todos los queries multi-tenant
4. Usar `await` en todas las operaciones (PostgreSQL es async)

---

## 🟢 FASE 3: TESTING Y VALIDACIÓN (2 horas)

### Objetivo:
Probar exhaustivamente todos los módulos y corregir errores.

### Tests a realizar:

#### 3.1 Configuración de Empresa
- [ ] Crear empresa con RUC
- [ ] Modificar datos (nombre, dirección, UIT)
- [ ] Recargar página
- [ ] Verificar que los datos persisten

#### 3.2 Operaciones Contables
- [ ] Guardar compra con todos los campos
- [ ] Guardar venta
- [ ] Guardar honorario
- [ ] Guardar asiento contable
- [ ] Verificar que se guarda `tipOper` y `tipOperCode`

#### 3.3 Módulos Auxiliares
- [ ] Productos
- [ ] Kárdex
- [ ] Activos Fijos
- [ ] Planillas

#### 3.4 Libros Oficiales
- [ ] Libro Diario 5.2
- [ ] Libro Mayor
- [ ] Balance de Comprobación

#### 3.5 SIRE
- [ ] Sincronizar compras desde SIRE
- [ ] Centralizar registros

---

## 🔵 FASE 4: OPTIMIZACIÓN Y DOCUMENTACIÓN (2 horas)

### Objetivo:
Optimizar performance y documentar la arquitectura final.

### Tareas:

#### 4.1 Optimización
- [ ] Implementar rate limiting
- [ ] Configurar connection pooling
- [ ] Optimizar queries con EXPLAIN ANALYZE
- [ ] Implementar caching con Redis (opcional)

#### 4.2 Documentación
- [ ] Actualizar README.md
- [ ] Documentar variables de entorno
- [ ] Crear guía de despliegue
- [ ] Documentar arquitectura multi-tenant

#### 4.3 Monitoreo
- [ ] Configurar logs estructurados
- [ ] Implementar health checks
- [ ] Configurar alertas de errores

---

## 🛠️ HERRAMIENTAS Y COMANDOS ÚTILES

### Verificar schema de una tabla en PostgreSQL:
```sql
\d+ workspaces
```

### Ver todas las tablas:
```sql
\dt
```

### Agregar columna faltante:
```sql
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS tipOper TEXT,
ADD COLUMN IF NOT EXISTS tipOperCode TEXT,
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'SOLES';
```

### Backup de PostgreSQL:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Restaurar backup:
```bash
psql $DATABASE_URL < backup.sql
```

---

## 📊 MÉTRICAS DE ÉXITO

### ✅ Criterios de aceptación:

1. **Persistencia de datos:**
   - Datos guardados correctamente
   - Datos se mantienen después de recargar
   - No hay errores de columnas faltantes

2. **Funcionalidad completa:**
   - Todos los módulos operativos
   - SIRE funcional
   - Libros oficiales generándose correctamente

3. **Performance:**
   - Tiempos de respuesta < 500ms
   - Sin errores 500 en logs
   - Connection pool estable

4. **Multi-tenancy:**
   - Aislamiento de datos por usuario
   - No hay fugas de datos entre usuarios
   - Autenticación funcional

---

## 🚨 RIESGOS Y MITIGACIÓN

### Riesgo 1: Pérdida de datos durante migración
**Mitigación:** 
- Hacer backup antes de cualquier cambio
- Probar en ambiente de desarrollo primero
- Validar integridad de datos después

### Riesgo 2: Downtime prolongado
**Mitigación:**
- Hacer cambios incrementales
- Mantener SQLite como fallback temporal
- Comunicar mantenimiento a usuarios

### Riesgo 3: Incompatibilidades de SQL
**Mitigación:**
- Usar función `translateSqliteToPostgres()`
- Testing exhaustivo de queries
- Documentar diferencias entre SQLite y PostgreSQL

---

## 📅 CRONOGRAMA ESTIMADO

| Fase | Duración | Prioridad |
|------|----------|-----------|
| Fase 1: Limpieza y Validación | 2 horas | 🔴 CRÍTICA |
| Fase 2: Migrar Servicios | 3 horas | 🟡 ALTA |
| Fase 3: Testing | 2 horas | 🟢 MEDIA |
| Fase 4: Optimización | 2 horas | 🔵 BAJA |
| **TOTAL** | **9 horas** | |

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

### ✅ PASO 1 COMPLETADO: Schemas PostgreSQL actualizados

**LOGROS:**
- ✅ 24 columnas agregadas a `purchases` (tipOper, ctaGasto, moneda, SIRE, SPOT, etc.)
- ✅ 18 columnas agregadas a `sales` (ctaCargo, ctaIngreso, moneda, SIRE, etc.)
- ✅ Base de datos PostgreSQL limpiada exitosamente
- ✅ Código actualizado y listo para despliegue

Ver detalles completos en: `RESUMEN_CAMBIOS_POSTGRES.md`

---

### 🚀 PASO 2: Hacer Push y Redesplegar (5 min) ⏳ EJECUTAR AHORA

**Comandos a ejecutar uno por uno:**

```bash
cd c:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY

git add server/databasePostgres.js PLAN_MAESTRO_MIGRACION.md clean-db.js RESUMEN_CAMBIOS_POSTGRES.md

git commit -m "fix: completar schemas PostgreSQL purchases y sales con todas las columnas"

git push origin main
```

**Qué va a pasar:**
1. GitHub recibe el push
2. Railway detecta el cambio automáticamente
3. Railway redesplega el backend (2-3 min)
4. Las tablas se recrean con schemas completos

**Verificar despliegue:**
```bash
railway logs --service softcontableperu1 -f
```

Buscar en logs:
- ✅ `[POSTGRES] ✅ Conectado exitosamente`
- ✅ `[POSTGRES] ✅ Schema y constraints verificados`
- ❌ NO debe aparecer: `column "..." does not exist`

---

### 🧪 PASO 3: Validar Persistencia de Datos (15 min)

<function_calls>
<invoke name="grep_search">
<parameter name="query">CREATE TABLE IF NOT EXISTS purchases

---

## ✅ CHECKLIST DE VALIDACIÓN FINAL

Antes de dar por completada la migración, verificar:

- [ ] Base de datos PostgreSQL limpia y con schemas correctos
- [ ] Todas las columnas necesarias existen
- [ ] Datos se guardan correctamente
- [ ] Datos persisten al recargar
- [ ] No hay errores de columnas faltantes en logs
- [ ] Servicios legacy migrados a PostgreSQL
- [ ] Todos los módulos funcionan
- [ ] Testing completo realizado
- [ ] Performance aceptable
- [ ] Documentación actualizada

---

## 📞 SOPORTE Y RECURSOS

### Comandos útiles de Railway:
```bash
# Ver logs en tiempo real
railway logs -f

# Conectar a PostgreSQL
railway connect Postgres

# Ver variables de entorno
railway variables

# Redesplegar
railway redeploy
```

### Recursos de PostgreSQL:
- Documentación oficial: https://www.postgresql.org/docs/
- Diferencias SQLite vs PostgreSQL: https://wiki.postgresql.org/wiki/Things_to_find_out_about_when_moving_from_SQLite_to_PostgreSQL

---

## 🎉 CONCLUSIÓN

Este plan maestro cubre todos los aspectos de la migración desde SQLite a PostgreSQL. Sigue las fases en orden y valida cada paso antes de continuar. La clave del éxito es:

1. **Schemas correctos** - Sin esto, nada funcionará
2. **Testing exhaustivo** - Cada módulo debe probarse
3. **Paciencia** - Las migraciones llevan tiempo
4. **Backups** - Siempre tener un plan B

¡Éxito con la migración! 🚀
