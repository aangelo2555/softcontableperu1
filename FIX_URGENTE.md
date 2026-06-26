# 🚨 FIX URGENTE - Error "column reference version is ambiguous"

## ❌ ERROR DETECTADO:

```
column reference "version" is ambiguous
```

**Query que falla:**
```sql
INSERT INTO period_versions (workspace_id, periodo, module, is_stale, last_sync, version)
VALUES ($1, $2, $3, 0, $4, 1)
ON CONFLICT(workspace_id, periodo, module, user_id)
DO UPDATE SET is_stale = 0, last_sync = $5, version = version + 1
```

## 🔍 CAUSA RAÍZ:

En PostgreSQL, cuando usas `ON CONFLICT ... DO UPDATE SET version = version + 1`, el motor de base de datos no sabe si te refieres a:
1. `period_versions.version` (la columna de la tabla)
2. `EXCLUDED.version` (el valor que intentaste insertar)

Por eso dice "ambiguous" (ambiguo).

## ✅ SOLUCIÓN APLICADA:

Modificado `translateSqliteToPostgres()` en `server/databasePostgres.js`:

1. **Detectar tabla `period_versions`:**
   ```javascript
   if (tableName === 'period_versions') {
       conflictColumns = 'workspace_id, periodo, module, user_id';
   }
   ```

2. **Calificar columna `version` explícitamente:**
   ```javascript
   if (tableName === 'period_versions' && col === 'version') {
       return `${col} = period_versions.${col} + 1`;  // ✅ Explícito
   }
   ```

Esto genera el query correcto:
```sql
DO UPDATE SET version = period_versions.version + 1
```

Ahora PostgreSQL sabe que debe tomar el valor actual de la tabla y sumarle 1.

## 🚀 DESPLIEGUE URGENTE:

```bash
git add server/databasePostgres.js FIX_URGENTE.md
git commit -m "fix: resolver ambiguedad en period_versions.version para PostgreSQL"
git push origin main
```

Railway redesplega automáticamente en 2-3 minutos.

## ✅ VALIDACIÓN:

Después del redespliegue:

1. Guardar un asiento contable
2. No debe aparecer el error "column reference version is ambiguous"
3. El asiento se debe guardar correctamente

---

**Aplicado:** 2026-06-26 13:00 UTC
**Estado:** Listo para desplegar
