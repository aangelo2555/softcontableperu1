# 🔍 Diagnóstico: Problemas de Sincronización SIRE y Base de Datos

## Fecha: 26/06/2026

---

## 🚨 PROBLEMAS IDENTIFICADOS

### **PROBLEMA 1: Fallo en Importación SIRE → Frontend**

**Síntoma**: Después de descargar/centralizar SIRE, los datos no aparecen en el frontend

**Causa Raíz**:
1. **Race Condition en Cache**: El cache de 2 minutos en `/api/db/workspace/:ruc` puede servir datos OBSOLETOS
2. **Falta de Invalidación**: Al importar datos SIRE, NO se invalida el cache de workspace
3. **Sincronización Asíncrona**: `syncCurrentWorkspace()` se llama ANTES de que la transacción DB termine

**Ubicación del Código**:
```typescript
// src/components/SireView.tsx - Línea ~217
toast.success(`✅ Sincronización exitosa. Use el botón "CENTRALIZAR"...`);
await syncCurrentWorkspace(); // ⚠️ PROBLEMA: puede ejecutarse antes que DB termine
```

```javascript
// server/app.js - Línea ~131
cacheService.set(cacheKey, data, 2 * 60 * 1000); // ⚠️ Cache de 2 minutos
```

---

### **PROBLEMA 2: Datos de Empresas Eliminados/Corruptos**

**Síntoma**: Datos de empresas desaparecen o se mezclan entre usuarios

**Causas Potenciales**:

#### A) **Condición de Carrera en Escrituras Múltiples**
```javascript
// main/database.js - Sin transacciones en algunas operaciones
db.prepare('INSERT OR REPLACE INTO purchases...').run(...);
db.prepare('DELETE FROM journal WHERE...').run(...);
// ⚠️ Si falla entre estas 2 líneas, datos quedan inconsistentes
```

#### B) **Cache No Sincronizado con DB**
```javascript
// server/app.js - Línea ~119
cacheService.set(cacheKey, workspaces, 5 * 60 * 1000); // 5 minutos
// ⚠️ Si otro proceso modifica DB, cache sigue mostrando datos viejos
```

#### C) **Falta de user_id en Desktop (Electron)**
```javascript
// main/database.js - Línea 564
const wsInfo = db.prepare('SELECT * FROM workspaces WHERE ruc = ?').get(ruc);
// ⚠️ NO filtra por user_id, puede cargar datos de otro usuario
```

#### D) **Pérdida de Referencia al Cambiar Empresa**
```typescript
// src/store.ts - switchWorkspace puede causar pérdida de datos si:
// 1. Se cambia de empresa mientras hay escritura pendiente
// 2. El auto-sync global interfiere con carga manual
```

---

### **PROBLEMA 3: Lentitud en Compras/Ventas**

**Síntoma**: La comunicación entre DB y frontend es lenta

**Causas**:

#### A) **Consultas Sin Índices**
```sql
-- Consultas frecuentes SIN índices optimizados:
SELECT * FROM purchases WHERE workspace_id = ? AND user_id = ?
SELECT * FROM journal WHERE workspace_id = ? AND user_id = ?
```

#### B) **Cache Insuficiente**
- Cache de 2 minutos es MUY corto para datos que no cambian frecuentemente
- No hay cache local en el frontend (todo se consulta al servidor)

#### C) **Respuestas Sin Comprimir** (Ya solucionado con GZIP)
```javascript
// server/app.js - Línea 27 (YA IMPLEMENTADO ✅)
app.use(compression({ threshold: 1024, level: 6 }));
```

#### D) **Carga Completa en Cada Cambio**
```typescript
// src/store.ts - syncCurrentWorkspace carga TODO cada vez:
const data = await electron.dbGetWorkspaceData(ruc);
// Compras, Ventas, Diario, Asientos, etc. TODO junto
```

---

## 🔧 SOLUCIONES PROPUESTAS

### **SOLUCIÓN 1: Invalidación Inteligente de Cache**

**Prioridad**: 🔴 CRÍTICA

**Implementación**:

```javascript
// server/app.js - Agregar después de importar SIRE

// En endpoint de SIRE centralización:
app.post('/api/sire/centralizar', authMiddleware, async (req, res) => {
    try {
        // ... lógica de centralización ...
        
        // ✅ NUEVO: Invalidar cache después de modificar datos
        const ruc = req.body.ruc;
        cacheService.invalidate(`workspace_data_${ruc}_${req.targetUserId}`);
        cacheService.invalidate(`workspaces_${req.targetUserId}`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

### **SOLUCIÓN 2: Transacciones Atómicas**

**Prioridad**: 🔴 CRÍTICA

**Implementación**:

```javascript
// main/database.js - Envolver operaciones en transacciones

savePurchaseWithJournal: (ruc, purchase, journalEntries) => {
    // ✅ YA IMPLEMENTADO (línea 615)
    const transaction = db.transaction((p, j) => {
        // Todas las operaciones son atómicas
    });
    return transaction(purchase, journalEntries);
}
```

**VERIFICAR**: Que TODAS las operaciones críticas usen transacciones.

---

### **SOLUCIÓN 3: Índices de Base de Datos**

**Prioridad**: 🟡 ALTA

**Implementación**:

```sql
-- database/performance_indexes.sql (YA EXISTE ✅)
CREATE INDEX IF NOT EXISTS idx_purchases_workspace_user 
    ON purchases(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_journal_workspace_user 
    ON journal(workspace_id, user_id);
```

**VERIFICAR**: Que estos índices estén aplicados en producción.

---

### **SOLUCIÓN 4: Cache Local en Frontend**

**Prioridad**: 🟡 ALTA

**Implementación**:

```typescript
// src/store.ts - Agregar cache local con timestamp

interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number; // Time to live en ms
}

const localCache: Record<string, CacheEntry> = {};

syncCurrentWorkspace: async () => {
    const ruc = get().currentCompany?.ruc || '';
    const cacheKey = `workspace_${ruc}`;
    const now = Date.now();
    
    // ✅ Verificar cache local primero
    const cached = localCache[cacheKey];
    if (cached && (now - cached.timestamp) < cached.ttl) {
        set({ ...cached.data });
        return;
    }
    
    // Si no hay cache o expiró, consultar servidor
    const data = await electron.dbGetWorkspaceData(ruc);
    
    // Guardar en cache local
    localCache[cacheKey] = {
        data,
        timestamp: now,
        ttl: 5 * 60 * 1000 // 5 minutos
    };
    
    set({ ...data });
}
```

---

### **SOLUCIÓN 5: Carga Incremental**

**Prioridad**: 🟢 MEDIA

**Implementación**:

```typescript
// src/store.ts - Cargar solo lo necesario

syncModule: async (module: 'purchases' | 'sales' | 'journal') => {
    const ruc = get().currentCompany?.ruc || '';
    
    // Solo cargar el módulo solicitado
    const data = await electron.dbGetModuleData(ruc, module);
    
    // Actualizar solo ese módulo en el store
    set({ [module]: data });
}
```

---

### **SOLUCIÓN 6: Logging y Monitoreo**

**Prioridad**: 🟢 MEDIA

**Implementación**:

```typescript
// src/store.ts - Agregar logging detallado

syncCurrentWorkspace: async () => {
    const startTime = Date.now();
    console.log('[SYNC] Iniciando sincronización...', {
        ruc: get().currentCompany?.ruc,
        timestamp: new Date().toISOString()
    });
    
    try {
        const data = await electron.dbGetWorkspaceData(ruc);
        const loadTime = Date.now() - startTime;
        
        console.log('[SYNC] ✅ Sincronización completada', {
            loadTime: `${loadTime}ms`,
            purchases: data.purchases.length,
            sales: data.sales.length,
            journal: data.journal.length
        });
        
        set({ ...data });
    } catch (error) {
        console.error('[SYNC] ❌ Error en sincronización:', error);
        throw error;
    }
}
```

---

## 📋 PLAN DE ACCIÓN INMEDIATO

### **FASE 1: Fixes Críticos (1-2 horas)**

1. ✅ **Invalidar cache después de SIRE** - `server/app.js`
2. ✅ **Agregar logging detallado** - `src/store.ts`
3. ✅ **Verificar transacciones atómicas** - `main/database.js`

### **FASE 2: Optimizaciones (2-3 horas)**

4. ⏳ **Implementar cache local frontend** - `src/store.ts`
5. ⏳ **Verificar índices DB aplicados** - Producción
6. ⏳ **Aumentar TTL de cache** - `server/app.js` (de 2 min a 10 min)

### **FASE 3: Mejoras a Largo Plazo (1 semana)**

7. ⏳ **Carga incremental por módulos**
8. ⏳ **WebSockets para sincronización en tiempo real**
9. ⏳ **Service Worker para cache offline**

---

## 🧪 PRUEBAS RECOMENDADAS

### Test 1: Importación SIRE
```
1. Descargar RCE/RVIE de SUNAT
2. Centralizar datos
3. Verificar que aparecen en frontend SIN recargar
4. Verificar logs de cache invalidation
```

### Test 2: Cambio de Empresa
```
1. Cargar Empresa A (con datos)
2. Cambiar a Empresa B
3. Verificar que datos de A no aparecen
4. Volver a Empresa A
5. Verificar que datos siguen ahí
```

### Test 3: Concurrencia
```
1. Abrir 2 pestañas del sistema
2. En pestaña 1: agregar compra
3. En pestaña 2: refrescar
4. Verificar que nueva compra aparece
```

---

## 📊 MÉTRICAS DE ÉXITO

- ✅ Tiempo de carga < 2 segundos
- ✅ 0 pérdidas de datos en 24 horas
- ✅ Cache hit rate > 80%
- ✅ Sincronización SIRE 100% confiable

---

**Próximos Pasos**: Implementar FASE 1 inmediatamente.
