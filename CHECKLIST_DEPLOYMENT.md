# ✅ Checklist de Despliegue - SOFTCONTABLE v1.1.0

## 🎯 Pasos a Seguir (En Orden)

### Paso 1: Instalar Dependencias Localmente
```bash
npm install
```

**Verificar**:
- [ ] No hay errores en la consola
- [ ] Se instaló `compression@^1.7.4`
- [ ] Archivo `package-lock.json` actualizado

---

### Paso 2: Probar Localmente (Opcional pero Recomendado)

**Terminal 1** - Backend:
```bash
node server/app.js
```

**Verificar logs**:
- [ ] `[SERVER] SOFTCONTABLE 2 ONLINE en puerto 3001`
- [ ] `[DB] ✅ Índices de optimización aplicados exitosamente`
- [ ] Sin errores críticos

**Terminal 2** - Frontend:
```bash
npm run dev
```

**Verificar**:
- [ ] Abre en `http://localhost:5173`
- [ ] Sin errores en consola del navegador
- [ ] Puedes navegar por el sistema

**Probar Auto-Sync (Opcional)**:
- [ ] Ir a Panel de Empresa
- [ ] Ingresar credenciales SOL de prueba
- [ ] Guardar
- [ ] Revisar logs: debe aparecer `[AUTO SYNC] Verificando...`

---

### Paso 3: Commit y Push a Railway

```bash
# Ver archivos modificados
git status

# Añadir todos los cambios
git add .

# Commit con mensaje descriptivo
git commit -m "feat: optimización completa - auto-sync buzón/SIRE + performance"

# Push a Railway (main o tu rama principal)
git push origin main
```

**Verificar**:
- [ ] Push exitoso sin errores
- [ ] Railway detecta el deploy automáticamente

---

### Paso 4: Monitorear Deploy en Railway

1. Ir a [Railway Dashboard](https://railway.app)
2. Seleccionar tu proyecto
3. Click en "Deployments"
4. Ver el deploy en progreso

**Esperar**: 2-3 minutos

**Verificar logs en vivo**:
- [ ] `Building...`
- [ ] `Installing dependencies...`
- [ ] `Starting server...`
- [ ] `[SERVER] SOFTCONTABLE 2 ONLINE en puerto 8888`
- [ ] `[DB] ✅ Índices de optimización aplicados`
- [ ] **Deploy Status**: ✅ Success

---

### Paso 5: Verificar Health Check

Abrir en navegador:
```
https://softcontable.up.railway.app/health
```
(Reemplaza con tu dominio)

**Respuesta esperada**:
```json
{
  "status": "ok",
  "timestamp": "2026-06-25T...",
  "database": {
    "path": "/app/database/pld_contable.db",
    "size_mb": "123.45",
    "max_size_gb": 5,
    "usage_percent": "2.47"
  },
  "memory": {
    "rss_mb": "150.23",
    "heap_used_mb": "85.12",
    "heap_total_mb": "120.50"
  },
  "cache": {
    "size": 0,
    "ttl_seconds": 300
  },
  "uptime_seconds": 120,
  "node_version": "v20..."
}
```

**Verificar**:
- [ ] `status: "ok"`
- [ ] `database.size_mb` es razonable (<1000 MB)
- [ ] `memory.heap_used_mb` <200 MB
- [ ] Sin errores

---

### Paso 6: Testing de Funcionalidades

#### Test 1: Compresión GZIP ✅
1. Abrir DevTools (F12) → Network
2. Navegar a cualquier vista (Compras/Ventas)
3. Ver una petición a `/api/db/workspaces` o similar

**Verificar**:
- [ ] Headers incluyen `Content-Encoding: gzip`
- [ ] `Transferred` es ~30% del `Size` original

#### Test 2: Cache en Memoria ✅
1. Primera carga: Ir a Panel Principal
2. Tiempo de respuesta: ~500ms (normal)
3. Recargar página (F5)
4. Tiempo de respuesta: ~50ms (cache hit)

**Verificar**:
- [ ] Segunda carga es significativamente más rápida

#### Test 3: Paginación ✅
1. Ir a Módulo SIRE
2. Descargar datos de varios meses (>50 registros)

**Verificar**:
- [ ] Aparece barra de paginación en la parte inferior
- [ ] Selector de items por página (25, 50, 100, 250, 500)
- [ ] Botones de navegación funcionan
- [ ] Cambio de página es instantáneo

#### Test 4: Auto-Sync Buzón ✅
1. Ir a Panel de Empresa
2. Ingresar credenciales SOL válidas:
   - Usuario SOL: (tu usuario)
   - Clave SOL: (tu clave)
3. Click en "Guardar Empresa"
4. Esperar 10-30 segundos

**Verificar en logs de Railway**:
- [ ] `[AUTO SYNC] Verificando auto-sincronización para RUC...`
- [ ] `[AUTO SYNC] Credenciales SOL detectadas`
- [ ] `[SCRAPER] Iniciando consulta de buzón`

**Verificar en UI**:
- [ ] Ir a módulo Buzón → Debe tener mensajes cargados
- [ ] Sin necesidad de clic en "Consultar Buzón"

#### Test 5: Auto-Sync SIRE ✅
1. Ir a Panel de Empresa
2. Ingresar credenciales SIRE + SOL válidas:
   - Usuario SOL: (tu usuario)
   - Clave SOL: (tu clave)
   - Client ID (SIRE): (tu client ID)
   - Client Secret (SIRE): (tu secret)
3. Click en "Guardar Empresa"
4. Esperar 2-5 minutos (proceso largo)

**Verificar en logs de Railway**:
- [ ] `[AUTO SYNC] Credenciales SIRE detectadas`
- [ ] `[AUTO SYNC] Descargando SIRE desde 202601 hasta 202606`
- [ ] Sin errores de autenticación

**Verificar en UI**:
- [ ] Ir a Módulo SIRE
- [ ] Debe tener datos desde enero hasta hoy
- [ ] Botón "CENTRALIZAR" visible (NO se centralizó automáticamente)

#### Test 6: Centralización Manual ✅
1. En Módulo SIRE, después de descargar
2. Revisar mensaje: "Use el botón CENTRALIZAR..."
3. Click en botón "CENTRALIZAR"

**Verificar**:
- [ ] Mensaje NO dice "Centralizando automáticamente..."
- [ ] Usuario tiene control total
- [ ] Centralización solo ocurre al hacer clic

#### Test 7: Índices SQL ✅
1. Ir a vista de Compras o Ventas
2. Filtrar por rango de fechas amplio (1 año)
3. Observar tiempo de carga

**Verificar**:
- [ ] Carga en <1 segundo (antes: 5-10 segundos)
- [ ] Sin congelamiento del navegador

---

### Paso 7: Monitoreo de Railway Metrics

1. En Railway Dashboard → Click en tu proyecto
2. Click en "Metrics"

**Verificar**:
- [ ] CPU Usage: <30% en promedio
- [ ] Memory Usage: <300MB en promedio
- [ ] No hay picos anormales
- [ ] Network traffic reducido (por GZIP)

---

### Paso 8: Verificación de Logs

En Railway Dashboard → Deployments → View Logs

**Buscar estas líneas**:
- [ ] `[SERVER] SOFTCONTABLE 2 ONLINE en puerto 8888`
- [ ] `[DB] ✅ Índices de optimización aplicados`
- [ ] `[AUTO SYNC]` (cuando se guarden credenciales)
- [ ] `[CACHE]` (cuando expire cache)
- [ ] Sin errores críticos o warnings importantes

---

## 🎉 Confirmación Final

Si TODOS los checkboxes anteriores están marcados:

### ✅ DEPLOY EXITOSO

Tu sistema ahora tiene:
- ✅ Buzón automático
- ✅ SIRE automático (enero → hoy)
- ✅ Centralización manual
- ✅ Compresión GZIP (70-80% menos tráfico)
- ✅ Cache en memoria (10x más rápido)
- ✅ Índices SQL (20x más rápido)
- ✅ Paginación (renderizado instantáneo)
- ✅ Health Check para monitoreo

---

## ⚠️ Troubleshooting

### Problema: Deploy falla en Railway

**Soluciones**:
1. Revisar logs: buscar error específico
2. Verificar que `package.json` tenga `compression`
3. Ejecutar localmente para debugging:
   ```bash
   node server/app.js
   ```

### Problema: Auto-sync no funciona

**Verificar**:
1. Credenciales SOL/SIRE son correctas
2. Logs muestran `[AUTO SYNC] Verificando...`
3. El proceso se ejecuta en segundo plano (no bloquea)
4. Puede tardar 10-30 segundos (Buzón) o 2-5 minutos (SIRE)

### Problema: Paginación no aparece

**Verificar**:
1. Hay más de 50 registros en la tabla
2. Componente se compiló correctamente
3. Revisar consola del navegador por errores

### Problema: Cache no funciona

**Soluciones**:
1. Verificar `/health` → debe mostrar `cache.size`
2. Limpiar cache manualmente:
   ```bash
   POST /api/cache/clear
   Authorization: Bearer TU_TOKEN_ADMIN
   ```

---

## 📞 Soporte

**Documentación**:
- `RAILWAY_SETUP.md` - Instrucciones detalladas
- `RECOMENDACIONES_OPTIMIZACION.md` - Optimizaciones
- `MEJORAS_IMPLEMENTADAS.md` - Detalles técnicos

**Logs útiles**:
```bash
# Railway CLI (opcional)
railway logs --tail 100
```

---

## ✅ Checklist de Confirmación Final

- [ ] Dependencias instaladas (`npm install`)
- [ ] Tests locales pasaron (opcional)
- [ ] Commit y push a Railway exitoso
- [ ] Deploy completado sin errores
- [ ] Health check responde OK
- [ ] Compresión GZIP activa
- [ ] Cache funcionando
- [ ] Paginación visible en SIRE
- [ ] Auto-sync de Buzón funciona
- [ ] Auto-sync de SIRE funciona (descarga desde enero)
- [ ] Centralización es manual (correcto)
- [ ] CPU <30% en Railway Metrics
- [ ] Memoria <300MB en Railway Metrics
- [ ] Sin errores en logs

---

**Si todos los checkboxes están marcados**: 
# 🎉 ¡IMPLEMENTACIÓN COMPLETA Y EXITOSA! 🎉

---

**Fecha**: 25 de junio de 2026  
**Versión**: 1.1.0  
**Estado**: ✅ PRODUCCIÓN
