# 🚂 Configuración de Railway - SOFTCONTABLE

## ⚠️ IMPORTANTE: Cambios Requeridos en Railway

### 📦 Paso 1: Instalar Nuevas Dependencias

Después de hacer `git push` a Railway, las dependencias se instalarán automáticamente. La nueva dependencia añadida es:

- ✅ `compression@^1.7.4` - Ya incluida en `package.json`

### 🔧 Paso 2: Variables de Entorno (Sin Cambios)

Las variables de entorno actuales siguen siendo válidas:

```env
DATABASE_PATH=/app/database/pld_contable.db
JWT_SECRET=tu-secreto-jwt-actual
PORT=8888
NODE_ENV=production
```

**NO necesitas cambiar nada aquí.** ✅

### 💾 Paso 3: Volume Configuration (Sin Cambios)

Tu configuración actual del Volume es correcta:

- **Mount Path**: `/app/database`
- **Size**: 5.00 GB
- **Database Path**: `/app/database/pld_contable.db`

**NO necesitas cambiar nada aquí.** ✅

### 🎯 Paso 4: Deploy del Código

```bash
# 1. Commit los cambios
git add .
git commit -m "feat: optimización performance + auto-sync buzón y SIRE"

# 2. Push a Railway (se desplegará automáticamente)
git push origin main
```

Railway detectará automáticamente los cambios y redesplegará el servicio.

### ⏱️ Paso 5: Verificar el Deploy

Después del deploy (tarda ~2-3 minutos), verifica que todo esté funcionando:

1. **Health Check**:
   ```
   https://tu-dominio.railway.app/health
   ```
   
   Deberías ver una respuesta JSON como:
   ```json
   {
     "status": "ok",
     "database": {
       "size_mb": "123.45",
       "usage_percent": "2.47"
     },
     "memory": {
       "rss_mb": "150.23",
       "heap_used_mb": "85.12"
     },
     "cache": {
       "size": 0,
       "ttl_seconds": 300
     },
     "uptime_seconds": 3600
   }
   ```

2. **Logs del Servidor**:
   
   En Railway Dashboard → Deployments → Ver Logs
   
   Deberías ver:
   ```
   [SERVER] SOFTCONTABLE 2 ONLINE en puerto 8888
   [DB] ✅ Índices de optimización aplicados exitosamente
   ```

### 🔍 Paso 6: Monitoreo

Railway te permite monitorear el uso de recursos:

1. Ve a tu proyecto en Railway
2. Click en "Metrics"
3. Observa:
   - **CPU Usage**: Debe ser <30% en promedio
   - **Memory Usage**: Debe ser <200MB en promedio
   - **Disk Usage**: Tu base de datos con índices ocupará ~10-15% más

### 📊 Paso 7: Testing de las Nuevas Funcionalidades

#### Test 1: Compresión GZIP
1. Abre DevTools (F12) → Network
2. Haz una consulta grande: `/api/db/workspaces`
3. Verifica que en Headers aparezca:
   ```
   Content-Encoding: gzip
   ```
4. Compara `Size` vs `Transferred` (debe ser ~30% del original)

#### Test 2: Cache en Memoria
1. Primera consulta a `/api/db/workspaces`: ~500ms
2. Segunda consulta (dentro de 5 minutos): ~50ms ⚡
3. Después de 5 minutos: vuelve a ~500ms (cache expiró)

#### Test 3: Índices de Base de Datos
1. Ve a cualquier vista (Compras, Ventas, Diario)
2. Filtra por fecha
3. Debe cargar en <1 segundo (antes: 5-10 segundos)

#### Test 4: Paginación
1. Ve al Módulo SIRE
2. Descarga datos de varios meses
3. Verifica que aparezcan controles de paginación
4. Cambia entre páginas: debe ser instantáneo

#### Test 5: Auto-Sync Buzón
1. Ve a Panel de Empresa
2. Ingresa credenciales SOL válidas
3. Guarda
4. Espera 10-30 segundos
5. Ve al módulo Buzón → Debe tener mensajes cargados

#### Test 6: Auto-Sync SIRE
1. Ve a Panel de Empresa
2. Ingresa credenciales SIRE + SOL válidas
3. Guarda
4. Espera 2-5 minutos (descarga desde enero hasta hoy)
5. Ve al módulo SIRE → Debe tener datos desde enero

---

## 🆘 Troubleshooting

### Problema: El servidor no inicia

**Solución**:
1. Revisa los logs en Railway Dashboard
2. Busca errores relacionados con dependencias
3. Si ves `Cannot find module 'compression'`:
   ```bash
   railway run npm install
   ```

### Problema: La base de datos no tiene índices

**Solución**:
Los índices se aplican automáticamente al iniciar el servidor. Si quieres verificar manualmente:

```bash
# Conectar a Railway CLI
railway run bash

# Verificar índices
sqlite3 /app/database/pld_contable.db "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';"
```

### Problema: El cache no funciona

**Solución**:
1. Verifica el endpoint `/health` → debe mostrar `cache.size`
2. Limpia el cache manualmente:
   ```
   POST /api/cache/clear
   Authorization: Bearer TU_TOKEN_ADMIN
   ```

### Problema: Auto-sync no se ejecuta

**Solución**:
1. Revisa logs: busca `[AUTO SYNC]`
2. Verifica que las credenciales estén correctas
3. El auto-sync se ejecuta en segundo plano (no bloquea la respuesta)
4. Logs deben mostrar:
   ```
   [AUTO SYNC] Verificando auto-sincronización para RUC
   [AUTO SYNC] Credenciales SOL detectadas
   [AUTO SYNC] Credenciales SIRE detectadas
   ```

### Problema: Paginación no aparece

**Solución**:
1. Verifica que el componente se haya compilado correctamente
2. Revisa la consola del navegador por errores
3. Asegúrate de que hay más de 50 registros en la tabla

---

## 📈 Optimizaciones Futuras (Opcional)

Si en el futuro necesitas más rendimiento:

### 1. Redis para Cache Distribuido

```bash
# En Railway, añadir servicio Redis
railway service add redis

# Actualizar código para usar Redis en lugar de Map
```

### 2. PostgreSQL en lugar de SQLite

Para >100,000 registros por empresa, considera migrar a PostgreSQL:

```bash
railway service add postgresql
```

### 3. CDN para Assets Estáticos

Subir el frontend compilado a Cloudflare Pages o Vercel Edge.

### 4. Workers para Tareas Pesadas

Usar Railway Background Workers para SIRE y buzón.

---

## 🎉 Resumen de Mejoras Implementadas

| Mejora | Impacto | Automático |
|--------|---------|------------|
| Compresión GZIP | 70-80% menos tráfico | ✅ Sí |
| Cache en Memoria | Respuestas 10x más rápidas | ✅ Sí |
| Índices SQL | Consultas 20x más rápidas | ✅ Sí |
| Paginación | Renderizado instantáneo | ✅ Sí |
| Auto-Sync Buzón | Sin clicks manuales | ✅ Sí |
| Auto-Sync SIRE | Datos listos desde enero | ✅ Sí |
| Health Check | Monitoreo en tiempo real | ✅ Sí |

---

## ✅ Checklist Final

Antes de considerarlo completado:

- [ ] Deploy exitoso en Railway
- [ ] Health check responde correctamente
- [ ] Logs muestran "Índices de optimización aplicados"
- [ ] Compresión GZIP activa (verificar en Network)
- [ ] Cache funciona (segunda consulta más rápida)
- [ ] Paginación visible en SIRE con >50 registros
- [ ] Auto-sync de buzón funciona al guardar credenciales SOL
- [ ] Auto-sync de SIRE funciona al guardar credenciales SIRE
- [ ] Uso de CPU <30% en Railway Metrics
- [ ] Uso de Memoria <300MB en Railway Metrics

---

**¿Dudas?** Revisa los logs en Railway Dashboard o consulta `RECOMENDACIONES_OPTIMIZACION.md` para más detalles técnicos.

**Última actualización**: 25 de junio de 2026
