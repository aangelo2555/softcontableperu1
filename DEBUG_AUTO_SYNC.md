# 🔧 DEBUG AUTO-SINCRONIZACIÓN BUZÓN ELECTRÓNICO

## PROBLEMA REPORTADO
La auto-sincronización del buzón electrónico no está funcionando cuando se carga una empresa existente.

## ENDPOINTS DE DEBUG CREADOS

### 1. Verificar Credenciales
```
GET /api/debug/check-credentials/:ruc
```
**Uso**: Verificar si la empresa tiene credenciales SOL configuradas correctamente.

### 2. Ver Estado de Auto-Sync  
```
GET /api/debug/auto-sync-status/:ruc
```
**Uso**: Ver el estado actual del throttling y última sincronización.

### 3. Resetear Throttling
```
POST /api/debug/reset-throttling/:ruc
```
**Uso**: Resetear el throttling para permitir sincronización inmediata.

### 4. Forzar Auto-Sync
```
POST /api/debug/force-auto-sync/:ruc
```
**Uso**: Ejecutar auto-sincronización inmediatamente sin throttling.

## PASOS PARA DEBUG

### Paso 1: Verificar Credenciales
Abrir en navegador:
```
https://softcontable.up.railway.app/api/debug/check-credentials/TU_RUC
```

**Resultado esperado:**
```json
{
  "success": true,
  "credentials": {
    "sol": {
      "valid": true,
      "user": "***presente***",
      "pass": "***presente***"
    }
  }
}
```

### Paso 2: Ver Estado Actual
```
https://softcontable.up.railway.app/api/debug/auto-sync-status/TU_RUC
```

**Resultado esperado:**
```json
{
  "success": true,
  "status": {
    "canSyncBuzon": true,
    "elapsedSinceLastBuzon": "never"
  }
}
```

### Paso 3: Si está bloqueado por throttling, resetear
```
POST https://softcontable.up.railway.app/api/debug/reset-throttling/TU_RUC
```

### Paso 4: Forzar sincronización
```
POST https://softcontable.up.railway.app/api/debug/force-auto-sync/TU_RUC
```

## CAMBIOS IMPLEMENTADOS

### ✅ Mejoras al Throttling
- **Primera vez**: Omite throttling automáticamente
- **Debug mejorado**: Muestra tiempo transcurrido y estado detallado
- **Reset manual**: Permite resetear throttling para testing

### ✅ Auto-sync al Cargar Empresa
- Se ejecuta en `GET /api/db/workspace/:ruc`
- Solo si han pasado 10 minutos desde última sincronización
- Excepto en primera sincronización (sin throttling)

### ✅ Logs Mejorados
- `[AUTO SYNC ON LOAD]` para cargas de empresa
- `[FORCE AUTO SYNC]` para sincronización forzada
- Detalles de credenciales y estado

## PRÓXIMOS PASOS

1. **Probar endpoints de debug** con tu RUC
2. **Verificar credenciales SOL** están configuradas
3. **Forzar sincronización** si es necesario
4. **Revisar logs del servidor** para errores específicos

## NOTAS IMPORTANTES

- El throttling de 10 minutos es para evitar spam a SUNAT
- La primera sincronización siempre se ejecuta (sin throttling)  
- Auto-sync solo funciona si tienes credenciales SOL válidas
- Los logs se escriben en consola del servidor

---

**Archivo creado**: `r/server/app.js` líneas ~230-290
**Auto-sync mejorado**: `server/autoSyncService.js` líneas ~250-290