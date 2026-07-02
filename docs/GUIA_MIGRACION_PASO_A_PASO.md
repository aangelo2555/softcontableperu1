# 🚀 GUÍA DE MIGRACIÓN PASO A PASO

## Railway: SQLite → PostgreSQL + Arquitectura Separada

---

## ✅ PREREQUISITOS

- [x] Servicio duplicado eliminado en Railway
- [ ] Railway CLI instalado: `npm install -g @railway/cli`
- [ ] Backup completo de base de datos actual
- [ ] Git repository limpio (sin cambios sin commit)

---

## 📅 DÍA 1: PostgreSQL Setup (4-6 horas)

### PASO 1: Backup de SQLite (15 min)

```bash
# En tu máquina local
cd C:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY

# Crear backup
mkdir backups
copy database\pld_contable.db backups\pld_contable_backup_20260626.db

# Verificar
dir backups
```

✅ **Checkpoint**: Archivo de backup creado y verificado

---

### PASO 2: Exportar Datos de SQLite (15 min)

```bash
# Instalar dependencia si no existe
npm install better-sqlite3

# Ejecutar script de exportación
node scripts/migrate-to-postgres.js

# Verificar archivos generados
dir migration-output
# Debes ver:
# - sqlite_export.json (datos)
# - postgres_schema.sql (schema)
# - migration_stats.json (estadísticas)
```

✅ **Checkpoint**: Archivos de exportación generados

---

### PASO 3: Crear Servicio PostgreSQL en Railway (20 min)

#### 3.1 Desde Railway Dashboard:

1. Ve a tu proyecto en Railway
2. Click en **"+ New"**
3. Selecciona **"Database" → "PostgreSQL"**
4. Espera a que el servicio se cree (~2-3 min)

#### 3.2 Obtener credenciales:

```bash
# Login en Railway CLI
railway login

# Link al proyecto
railway link

# Ver variables
railway variables

# Copiar DATABASE_URL
# Formato: postgresql://user:pass@host:port/railway
```

✅ **Checkpoint**: PostgreSQL creado y DATABASE_URL obtenida

---

### PASO 4: Crear Schema en PostgreSQL (30 min)

```bash
# Instalar dependencia
npm install pg

# Conectar y crear schema
# Opción A: Usando Railway CLI
railway run psql < migration-output/postgres_schema.sql

# Opción B: Usando psql local
set DATABASE_URL=postgresql://user:pass@host:port/railway
psql %DATABASE_URL% < migration-output\postgres_schema.sql

# Verificar tablas creadas
railway run psql -c "\dt"
```

✅ **Checkpoint**: Todas las tablas creadas en PostgreSQL

---

### PASO 5: Importar Datos (45-60 min)

```bash
# Configurar DATABASE_URL
set DATABASE_URL=postgresql://user:pass@host:port/railway

# Ejecutar importación
node scripts/import-to-postgres.js

# Salida esperada:
# ✅ Importando workspaces... 10 registros
# ✅ Importando purchases... 500 registros
# ✅ Importando sales... 400 registros
# ... etc
```

**IMPORTANTE**: Este proceso puede tardar 30-60 minutos dependiendo de la cantidad de datos.

✅ **Checkpoint**: Todos los datos importados y verificados

---

### PASO 6: Crear Índices Optimizados (20 min)

```bash
# Crear archivo de índices
```

Crear `migration-output/create_indexes.sql`:

```sql
-- Índices críticos para performance

-- Workspaces
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_ruc_user ON workspaces(ruc, user_id);

-- Purchases
CREATE INDEX idx_purchases_workspace_user ON purchases(workspace_id, user_id);
CREATE INDEX idx_purchases_fecha ON purchases(fecha DESC);
CREATE INDEX idx_purchases_estado_sire ON purchases(estado_sire);

-- Sales
CREATE INDEX idx_sales_workspace_user ON sales(workspace_id, user_id);
CREATE INDEX idx_sales_fecha ON sales(fecha DESC);
CREATE INDEX idx_sales_estado_sire ON sales(estado_sire);

-- Journal
CREATE INDEX idx_journal_workspace_user ON journal(workspace_id, user_id);
CREATE INDEX idx_journal_fecha ON journal(fecha DESC);
CREATE INDEX idx_journal_asiento ON journal(asiento);
CREATE INDEX idx_journal_cta ON journal(cta);

-- Entities
CREATE INDEX idx_entities_workspace_user ON entities(workspace_id, user_id);
CREATE INDEX idx_entities_doc_num ON entities(doc_num);

-- Products
CREATE INDEX idx_products_workspace_user ON products(workspace_id, user_id);

-- Plan Global
CREATE INDEX idx_plan_global_user_id ON plan_global(user_id);
CREATE INDEX idx_plan_global_cta ON plan_global(cta);

-- Analyze para optimizar
ANALYZE;
```

```bash
# Ejecutar
railway run psql < migration-output\create_indexes.sql

# Verificar índices
railway run psql -c "\di"
```

✅ **Checkpoint**: Índices creados y base de datos optimizada

---

## 📅 DÍA 2: Backend con PostgreSQL (6-8 horas)

### PASO 7: Instalar Dependencias PostgreSQL (5 min)

```bash
# Instalar pg
npm install pg

# Instalar rate limiting
npm install express-rate-limit

# Actualizar package.json
npm install --save
```

---

### PASO 8: Actualizar server/app.js para usar PostgreSQL (30 min)

Modificar `server/app.js`:

```javascript
// ANTES:
// const db = require('./databaseServer');

// DESPUÉS:
const db = process.env.USE_POSTGRES === 'true' 
    ? require('./databasePostgres')
    : require('./databaseServer');

console.log('[DB] Using:', process.env.USE_POSTGRES === 'true' ? 'PostgreSQL' : 'SQLite');
```

---

### PASO 9: Agregar Variables de Entorno en Railway (10 min)

En Railway Dashboard → Variables:

```env
# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}
USE_POSTGRES=true

# Node
NODE_ENV=production
PORT=8080

# Security
JWT_SECRET=tu-secret-key-cambialo
ENCRYPTION_KEY=softcontable-2026-encryption-key

# Features
ENABLE_RATE_LIMIT=true
CACHE_TTL=1800000
```

✅ **Checkpoint**: Variables configuradas en Railway

---

### PASO 10: Deploy Backend con PostgreSQL (20 min)

```bash
# Commit cambios
git add .
git commit -m "feat: migrar a PostgreSQL con architecture separada"

# Push a Railway
git push origin main

# Monitorear logs
railway logs

# Verificar health
curl https://softcontable.up.railway.app/api/health
```

✅ **Checkpoint**: Backend funcionando con PostgreSQL

---

## 📅 DÍA 3: Separar Frontend (Pendiente)

(Continuará en próxima sesión...)

---

## 🆘 TROUBLESHOOTING

### Error: "No se puede conectar a PostgreSQL"

```bash
# Verificar DATABASE_URL
railway variables | findstr DATABASE_URL

# Test conexión
railway run psql -c "SELECT NOW()"
```

### Error: "Too many connections"

Reducir max connections en databasePostgres.js:
```javascript
max: 10, // Reducir de 20 a 10
```

### Error: "Query timeout"

Aumentar timeout:
```javascript
connectionTimeoutMillis: 30000, // 30 segundos
```

---

## 📊 VERIFICACIÓN POST-MIGRACIÓN

```bash
# 1. Verificar cantidad de registros
railway run psql -c "SELECT 'workspaces' as table, COUNT(*) FROM workspaces
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'sales', COUNT(*) FROM sales;"

# 2. Test de latencia
curl -w "@curl-format.txt" https://softcontable.up.railway.app/api/health

# 3. Ver logs en tiempo real
railway logs --tail 100
```

---

## ✅ CHECKLIST DÍA 1

- [ ] Backup SQLite creado
- [ ] Datos exportados a JSON
- [ ] PostgreSQL creado en Railway
- [ ] Schema PostgreSQL creado
- [ ] Datos importados
- [ ] Índices creados
- [ ] Variables de entorno configuradas
- [ ] Backend deployado con PostgreSQL
- [ ] Health check pasando
- [ ] Datos verificados

---

**Tiempo Total Estimado DÍA 1**: 4-6 horas  
**Próximo Paso**: Continuar con separación de Frontend
