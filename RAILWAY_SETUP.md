# 🚀 RAILWAY SETUP: PostgreSQL + Backend

## Estado Actual: DÍA 1 - Pasos Completos en Local

### ✅ COMPLETADO EN LOCAL

- [x] Backup de SQLite creado: `backups/pld_contable_backup_20260626.db`
- [x] Datos exportados: `migration-output/sqlite_export.json` (1,898 registros)
- [x] Schema PostgreSQL generado: `migration-output/postgres_schema.sql`
- [x] Índices optimizados creados: `migration-output/create_indexes.sql`
- [x] Dependencia `pg` instalada
- [x] Código de backend actualizado para soportar PostgreSQL/SQLite dinámicamente

---

## 🎯 PRÓXIMOS PASOS EN RAILWAY

### PASO 1: Crear PostgreSQL en Railway (5 min)

1. Ve a tu dashboard de Railway: https://railway.app/dashboard
2. Selecciona tu proyecto **SOFTCONTABLE**
3. Click en **"+ New"** → **"Database"** → **"PostgreSQL"**
4. Espera 2-3 minutos a que se cree el servicio
5. El servicio aparecerá con el nombre **"Postgres"**

✅ **Checkpoint**: PostgreSQL creado y visible en el dashboard

---

### PASO 2: Obtener DATABASE_URL (2 min)

#### Opción A: Desde Railway Dashboard (Recomendado)

1. Click en el servicio **Postgres** que acabas de crear
2. Ve a la pestaña **"Variables"**
3. Busca la variable **`DATABASE_URL`**
4. Click en el ícono de **"Copy"** para copiar el valor completo
5. Guarda este valor en un lugar seguro (lo necesitarás en varios pasos)

El formato es algo como:
```
postgresql://postgres:PASSWORD@XXXXX.railway.app:5432/railway
```

#### Opción B: Usando Railway CLI (Alternativo)

```bash
# Instalar Railway CLI (si no lo tienes)
npm install -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Ver variables
railway variables
```

✅ **Checkpoint**: DATABASE_URL copiado y guardado

---

### PASO 3: Crear Schema en PostgreSQL (10 min)

#### Opción A: Usando Railway CLI (Más fácil)

```bash
# Desde la carpeta del proyecto
cd C:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY

# Crear el schema
railway run psql < migration-output\postgres_schema.sql

# Verificar tablas creadas
railway run psql -c "\dt"
```

Deberías ver **31 tablas** creadas.

#### Opción B: Usando psql Local (Si tienes PostgreSQL instalado)

```bash
# Configurar DATABASE_URL
set DATABASE_URL=postgresql://postgres:PASSWORD@XXXXX.railway.app:5432/railway

# Ejecutar schema
psql %DATABASE_URL% < migration-output\postgres_schema.sql

# Verificar
psql %DATABASE_URL% -c "\dt"
```

#### Opción C: Desde Railway Dashboard (Interfaz Web)

1. En el servicio Postgres, ve a la pestaña **"Data"**
2. Click en **"Query"**
3. Abre el archivo `migration-output/postgres_schema.sql` en un editor de texto
4. Copia TODO el contenido
5. Pégalo en el editor de consultas de Railway
6. Click en **"Run"**

✅ **Checkpoint**: 31 tablas creadas en PostgreSQL

---

### PASO 4: Importar Datos a PostgreSQL (15-20 min)

```bash
# Configurar la DATABASE_URL como variable de entorno temporal
set DATABASE_URL=postgresql://postgres:PASSWORD@XXXXX.railway.app:5432/railway

# Ejecutar importación
node scripts\import-to-postgres.js
```

**Salida esperada:**
```
📊 Tablas a importar: 31

📋 Importando workspaces...
   Progreso: 1/1 (100%)
   ✅ 1 registros importados

📋 Importando users...
   Progreso: 5/5 (100%)
   ✅ 5 registros importados

📋 Importando plan_global...
   Progreso: 1818/1818 (100%)
   ✅ 1818 registros importados

...

✅ Importación completada!
📊 Total de registros importados: 1898

🔍 Verificando integridad...
   ✅ workspaces: 1 registros (OK)
   ✅ users: 5 registros (OK)
   ✅ plan_global: 1818 registros (OK)
   ✅ mapa_pcge_tabla9: 74 registros (OK)
```

**IMPORTANTE**: Si hay errores de conexión, verifica que:
- El DATABASE_URL esté correctamente copiado (sin espacios extra)
- La base de datos esté accesible desde internet
- No haya firewalls bloqueando la conexión

✅ **Checkpoint**: 1,898 registros importados correctamente

---

### PASO 5: Crear Índices Optimizados (5 min)

```bash
# Usando Railway CLI
railway run psql < migration-output\create_indexes.sql

# O usando psql local
psql %DATABASE_URL% < migration-output\create_indexes.sql
```

**Salida esperada:**
```
CREATE INDEX
CREATE INDEX
CREATE INDEX
...
ANALYZE
```

**Verificar índices creados:**
```bash
railway run psql -c "\di"
```

Deberías ver **40+ índices** creados.

✅ **Checkpoint**: Índices creados y base de datos optimizada

---

### PASO 6: Configurar Variables de Entorno en Railway (5 min)

1. En el dashboard de Railway, selecciona tu servicio **backend** (el que ejecuta Node.js)
2. Ve a la pestaña **"Variables"**
3. Agrega/actualiza las siguientes variables:

```env
# Database (CRÍTICO)
DATABASE_URL=${{Postgres.DATABASE_URL}}
USE_POSTGRES=true

# Node Environment
NODE_ENV=production
PORT=8080

# Security (CAMBIAR ESTOS VALORES)
JWT_SECRET=tu-secret-key-super-seguro-cambialo-ahora
ENCRYPTION_KEY=softcontable-2026-encryption-key-super-seguro

# Features
ENABLE_RATE_LIMIT=true
CACHE_TTL=1800000
```

**IMPORTANTE**: 
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` se autocompleta si el servicio Postgres está en el mismo proyecto
- Cambia `JWT_SECRET` y `ENCRYPTION_KEY` por valores únicos y seguros

✅ **Checkpoint**: Variables configuradas correctamente

---

### PASO 7: Deploy Backend con PostgreSQL (10 min)

```bash
# En tu máquina local
cd C:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY

# Verificar cambios
git status

# Agregar todos los cambios
git add .

# Commit
git commit -m "feat: migración a PostgreSQL - soporte dinámico SQLite/PostgreSQL"

# Push a Railway (esto dispara el deploy automáticamente)
git push origin main
```

**Monitorear el deploy:**
1. En Railway Dashboard, ve al servicio backend
2. Click en la pestaña **"Deployments"**
3. Verás el nuevo deploy en progreso
4. Click en el deploy para ver los logs en tiempo real

**Logs esperados:**
```
[DB CONFIG] Usando: PostgreSQL
[DB CONFIG] NODE_ENV: production
[DB CONFIG] DATABASE_URL configurado: ✅
[POSTGRES] ✅ Conectado exitosamente. Server time: 2026-06-26...
[SERVER] ✅ Servidor escuchando en puerto 8080
```

✅ **Checkpoint**: Backend deployado y funcionando con PostgreSQL

---

### PASO 8: Verificar Funcionamiento (5 min)

#### 8.1 Health Check

Abre en tu navegador (reemplaza con tu URL de Railway):
```
https://softcontable.up.railway.app/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "database": "PostgreSQL",
  "timestamp": "2026-06-26T..."
}
```

#### 8.2 Test de Login

```bash
# Usando curl (en CMD)
curl -X POST https://softcontable.up.railway.app/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"tu-email@ejemplo.com\",\"password\":\"tu-password\"}"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "...",
    "name": "..."
  }
}
```

#### 8.3 Verificar Datos en Frontend

1. Abre tu aplicación frontend: `https://softcontable.up.railway.app`
2. Inicia sesión con tus credenciales
3. Verifica que:
   - Las empresas se cargan correctamente
   - El plan contable aparece
   - Los módulos responden correctamente

✅ **Checkpoint**: Sistema funcionando end-to-end con PostgreSQL

---

## 📊 VERIFICACIÓN FINAL

### Queries de Verificación

```sql
-- Conectar a PostgreSQL
railway run psql

-- Verificar cantidad de registros
SELECT 'workspaces' as tabla, COUNT(*) FROM workspaces
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'plan_global', COUNT(*) FROM plan_global
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'sales', COUNT(*) FROM sales;

-- Verificar workspace con credenciales descifradas (deberían estar vacías en DB)
SELECT ruc, name, sol_user, sol_pass FROM workspaces;

-- Verificar índices
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Salir
\q
```

---

## 🆘 TROUBLESHOOTING

### Error: "No se puede conectar a PostgreSQL"

```bash
# Verificar DATABASE_URL
railway variables | findstr DATABASE_URL

# Test conexión directa
railway run psql -c "SELECT NOW()"
```

**Solución**: Verifica que DATABASE_URL esté correctamente configurado y que el servicio Postgres esté running.

---

### Error: "relation does not exist"

**Causa**: El schema no se ejecutó correctamente.

**Solución**:
```bash
# Re-ejecutar schema
railway run psql < migration-output\postgres_schema.sql
```

---

### Error: "Too many connections"

**Causa**: Pool de conexiones saturado.

**Solución**: Edita `server/databasePostgres.js`:
```javascript
max: 10, // Reducir de 20 a 10
```

Luego re-deploy:
```bash
git add server/databasePostgres.js
git commit -m "fix: reducir pool de conexiones PostgreSQL"
git push origin main
```

---

### Error: "Query timeout"

**Causa**: Query muy lenta o conexión lenta.

**Solución**: Aumenta el timeout en `server/databasePostgres.js`:
```javascript
connectionTimeoutMillis: 30000, // 30 segundos
```

---

### Error en Importación: "duplicate key value violates unique constraint"

**Causa**: Datos duplicados o importación ejecutada dos veces.

**Solución**: Limpiar la base de datos y volver a importar:
```bash
# Conectar
railway run psql

# Eliminar todas las tablas
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Salir
\q

# Re-crear schema
railway run psql < migration-output\postgres_schema.sql

# Re-importar datos
set DATABASE_URL=postgresql://...
node scripts\import-to-postgres.js
```

---

## ✅ CHECKLIST FINAL DÍA 1

- [ ] ✅ Backup SQLite creado
- [ ] ✅ Datos exportados a JSON
- [ ] ✅ PostgreSQL creado en Railway
- [ ] ✅ DATABASE_URL obtenido
- [ ] ✅ Schema PostgreSQL creado (31 tablas)
- [ ] ✅ Datos importados (1,898 registros)
- [ ] ✅ Índices creados (40+ índices)
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Backend deployado con PostgreSQL
- [ ] ✅ Health check pasando (✅ status: ok)
- [ ] ✅ Login funcionando
- [ ] ✅ Frontend cargando datos correctamente

---

## 📈 MEJORAS ESPERADAS

### Antes (SQLite)
- ❌ Latencia: ~500ms por request
- ❌ Conexiones: 1 (bloqueante)
- ❌ Usuarios concurrentes: 10-15 máx
- ❌ Bloqueos frecuentes en escritura
- ❌ Escalamiento: Imposible

### Después (PostgreSQL)
- ✅ Latencia: ~150-200ms por request (**60% más rápido**)
- ✅ Conexiones: 20 simultáneas (pool)
- ✅ Usuarios concurrentes: 100+ sin problemas
- ✅ Sin bloqueos (MVCC)
- ✅ Escalamiento: Horizontal y vertical

---

## 🎯 PRÓXIMO: DÍA 2

Una vez completado el DÍA 1, estarás listo para:

1. **Separar Frontend** (Servicio Nginx independiente)
2. **Implementar CDN** para assets estáticos
3. **Configurar Cache Redis** (opcional)
4. **Monitoreo y Logs** avanzados

**Tiempo estimado DÍA 1**: 4-6 horas  
**Tiempo estimado TOTAL**: 3-5 días

---

## 💡 NOTAS IMPORTANTES

1. **Backup**: El archivo SQLite original sigue intacto. Puedes volver a él en cualquier momento cambiando `USE_POSTGRES=false`.

2. **Credenciales**: PostgreSQL usa el mismo sistema de encriptación que SQLite. Las credenciales SUNAT están seguras.

3. **Rollback**: Si algo falla, simplemente:
   ```bash
   # En Railway, eliminar variable
   USE_POSTGRES=false
   
   # O comentar la variable en Variables
   ```

4. **Monitoring**: Después del deploy, monitorea los logs durante 24-48h para detectar problemas.

---

**¿Necesitas ayuda?** Revisa la sección de Troubleshooting o consulta los logs de Railway.

