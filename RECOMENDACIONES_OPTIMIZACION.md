# 📊 Recomendaciones de Optimización - Base de Datos y Performance

## 🎯 Objetivo
Evitar sobrecargar Railway y mantener la interfaz rápida con grandes volúmenes de datos.

---

## 1. 🗄️ Optimización de Base de Datos (SQLite en Railway)

### 1.1 Índices Estratégicos
Los índices ya implementados son correctos, pero es importante monitorear:

```sql
-- Índices actuales críticos para performance:
CREATE INDEX IF NOT EXISTS idx_journal_workspace ON journal(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ld52_periodo ON libro_diario_52(workspace_id, user_id, periodo);
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciled ON bank_statements(reconciled_journal_id);

-- Añadir índices adicionales si tienes queries lentas:
CREATE INDEX IF NOT EXISTS idx_purchases_fecha ON purchases(workspace_id, user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(workspace_id, user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_purchases_sire ON purchases(workspace_id, estado_sire, fecha);
CREATE INDEX IF NOT EXISTS idx_sales_sire ON sales(workspace_id, estado_sire, fecha);
```

**Ventaja**: Las consultas filtradas por fecha y usuario serán 10-100x más rápidas.

### 1.2 Paginación Obligatoria en el Frontend

**ANTES (Mal):**
```typescript
// Cargar TODO el histórico de compras (Puede ser 50,000+ registros)
const purchases = await electron.dbQueryAll('SELECT * FROM purchases WHERE workspace_id = ?', [ruc]);
```

**DESPUÉS (Bien):**
```typescript
// Cargar solo 100 registros por página
const limit = 100;
const offset = currentPage * limit;
const purchases = await electron.dbQueryAll(
  'SELECT * FROM purchases WHERE workspace_id = ? ORDER BY fecha DESC LIMIT ? OFFSET ?',
  [ruc, limit, offset]
);
```

**Implementar en:**
- `PurchasesView.tsx`
- `SalesView.tsx`
- `JournalView.tsx`
- `SireView.tsx`

---

## 2. 🚀 Optimización del Frontend

### 2.1 Virtual Scrolling para Tablas Grandes

Usar `react-window` o `@tanstack/react-virtual` para renderizar solo las filas visibles:

```bash
npm install @tanstack/react-virtual
```

**Ejemplo de implementación:**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const TableVirtualized = ({ data }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Altura estimada de cada fila
    overscan: 10 // Renderizar 10 filas extra arriba y abajo
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div key={virtualRow.index} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualRow.size,
            transform: `translateY(${virtualRow.start}px)`
          }}>
            {/* Renderizar fila data[virtualRow.index] */}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Beneficio**: Renderizar 50,000 filas sin congelar el navegador.

### 2.2 Memoización de Componentes Pesados

```typescript
import { memo, useMemo } from 'react';

// Memorizar filas de tabla para evitar re-renderizados innecesarios
const TableRow = memo(({ item }: { item: Purchase }) => {
  return (
    <tr>
      <td>{item.fecha}</td>
      <td>{item.doc_num}</td>
      <td>{item.total}</td>
    </tr>
  );
});

// Memorizar cálculos pesados
const ExpensiveComponent = ({ data }) => {
  const totalCalculation = useMemo(() => {
    return data.reduce((sum, item) => sum + item.total, 0);
  }, [data]); // Solo recalcular si data cambia

  return <div>Total: {totalCalculation}</div>;
};
```

### 2.3 Lazy Loading de Datos

Cargar datos solo cuando el usuario los necesite:

```typescript
const [dataLoaded, setDataLoaded] = useState(false);

useEffect(() => {
  // Cargar solo cuando la vista esté activa
  if (activeView === 'PURCHASES' && !dataLoaded) {
    loadPurchases();
    setDataLoaded(true);
  }
}, [activeView]);
```

---

## 3. 🌐 Optimización de Railway (Backend)

### 3.1 Compresión de Respuestas HTTP

Añadir en `server/app.js`:

```javascript
const compression = require('compression');

// Comprimir todas las respuestas con gzip
app.use(compression({
  threshold: 1024, // Solo comprimir respuestas > 1KB
  level: 6 // Nivel de compresión (1-9)
}));
```

Instalar:
```bash
npm install compression
```

**Beneficio**: Reducir el tamaño de las respuestas JSON en 70-80%.

### 3.2 Caché en Memoria para Consultas Frecuentes

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutos

app.get('/api/db/workspaces', async (req, res) => {
  const cacheKey = `workspaces_${req.targetUserId}`;
  
  // Verificar cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ success: true, workspaces: cached });
  }

  // Si no está en cache, consultar DB
  const workspaces = await db.getWorkspaces(req.targetUserId);
  cache.set(cacheKey, workspaces);
  
  res.json({ success: true, workspaces });
});
```

Instalar:
```bash
npm install node-cache
```

**Beneficio**: Respuestas instantáneas para datos que no cambian frecuentemente.

### 3.3 Límite de Timeout en Operaciones Pesadas

```javascript
// Configurar timeout global para peticiones
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 segundos máximo
  res.setTimeout(30000);
  next();
});
```

### 3.4 Procesamiento Asíncrono con Colas

Para operaciones muy pesadas (como SIRE masivo o generación de reportes):

```javascript
const Bull = require('bull');
const queue = new Bull('sire-download', process.env.REDIS_URL);

// Encolar tarea pesada
app.post('/api/sire/download-async', async (req, res) => {
  const job = await queue.add('download', req.body);
  res.json({ success: true, jobId: job.id });
});

// Procesador en segundo plano
queue.process('download', async (job) => {
  const result = await sireOrchestrator.ejecutarDescarga(job.data);
  return result;
});

// Consultar estado
app.get('/api/sire/job/:id', async (req, res) => {
  const job = await queue.getJob(req.params.id);
  res.json({ 
    status: await job.getState(),
    progress: job.progress(),
    result: job.returnvalue
  });
});
```

**Ventaja**: Las operaciones largas no bloquean el servidor.

---

## 4. 📦 Gestión del Volume de Railway

### 4.1 Configuración Actual
Según las imágenes:
- **Mount Path**: `/app/database`
- **Volume Size**: 5.00 GB
- **DATABASE_PATH**: `/app/database/pld_contable.db`

### 4.2 Limpieza Periódica de Datos

Crear un endpoint de mantenimiento:

```javascript
// Eliminar datos antiguos (>2 años)
app.post('/api/maintenance/cleanup', authMiddleware, async (req, res) => {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const cutoffDate = twoYearsAgo.toISOString().split('T')[0];

  try {
    db.run('DELETE FROM purchases WHERE fecha < ? AND workspace_id = ?', [cutoffDate, req.body.ruc]);
    db.run('DELETE FROM sales WHERE fecha < ? AND workspace_id = ?', [cutoffDate, req.body.ruc]);
    db.run('DELETE FROM journal WHERE fecha < ? AND workspace_id = ?', [cutoffDate, req.body.ruc]);
    
    // Compactar base de datos
    db.exec('VACUUM;');
    
    res.json({ success: true, message: 'Datos antiguos eliminados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.3 Backup Automático

```javascript
const cron = require('node-cron');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Backup diario a las 3 AM
cron.schedule('0 3 * * *', async () => {
  try {
    const backupPath = await db.backup();
    const fileContent = fs.readFileSync(backupPath);
    
    // Subir a S3 o servicio similar
    const s3 = new S3Client({ region: 'us-east-1' });
    await s3.send(new PutObjectCommand({
      Bucket: 'softcontable-backups',
      Key: `backup-${new Date().toISOString()}.db`,
      Body: fileContent
    }));
    
    console.log('[BACKUP] Completado exitosamente');
  } catch (error) {
    console.error('[BACKUP] Error:', error);
  }
});
```

---

## 5. 🔍 Monitoreo y Alertas

### 5.1 Métricas Clave a Monitorear

```javascript
// Middleware para medir performance
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 3000) {
      console.warn(`[SLOW QUERY] ${req.method} ${req.url} - ${duration}ms`);
    }
  });
  
  next();
});

// Endpoint de health check
app.get('/health', async (req, res) => {
  const dbSize = fs.statSync(dbPath).size / (1024 * 1024); // MB
  const memUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    database: {
      size_mb: dbSize.toFixed(2),
      max_size_gb: 5
    },
    memory: {
      rss_mb: (memUsage.rss / 1024 / 1024).toFixed(2),
      heap_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2)
    },
    uptime: process.uptime()
  });
});
```

---

## 6. 📋 Checklist de Implementación

### Prioridad Alta (Implementar YA)
- [ ] Añadir paginación en todas las vistas de tablas
- [ ] Implementar compresión gzip en el servidor
- [ ] Añadir índices de fecha en purchases y sales
- [ ] Configurar timeouts en peticiones

### Prioridad Media (Próximas semanas)
- [ ] Implementar virtual scrolling en tablas grandes
- [ ] Añadir cache en memoria para workspaces
- [ ] Crear endpoint de limpieza de datos antiguos
- [ ] Implementar memoización en componentes pesados

### Prioridad Baja (Cuando sea necesario)
- [ ] Sistema de colas para operaciones pesadas
- [ ] Backup automático a S3
- [ ] Monitoreo avanzado con métricas

---

## 7. 🎯 Resultados Esperados

Con estas optimizaciones:

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tiempo de carga (10k registros) | 5-10s | <1s | **10x** |
| Tamaño de respuesta JSON | 5MB | 1MB | **80%** |
| Memoria del navegador | 500MB | 150MB | **70%** |
| Uso de CPU en Railway | 80% | 30% | **62%** |
| Capacidad del Volume | 2GB usados | 1GB | **50%** |

---

## 📞 Soporte

Si tienes dudas sobre alguna implementación, consulta la documentación:
- [SQLite Performance](https://www.sqlite.org/quickstart.html)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Railway Best Practices](https://docs.railway.app/guides/optimize-your-service)

---

**Última actualización**: Junio 2026
