# ✅ CHECKLIST DE VALIDACIÓN - PostgreSQL Migration

## 📋 FASE 1: DESPLIEGUE (Ejecutar AHORA)

### 1.1 Hacer Commit y Push
```bash
cd c:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY
git add .
git commit -m "fix: schemas PostgreSQL completos"
git push origin main
```

- [ ] Commit realizado sin errores
- [ ] Push exitoso a GitHub
- [ ] Confirmación de Railway deployment iniciado

---

### 1.2 Monitorear Despliegue Railway
```bash
railway logs --service softcontableperu1 -f
```

**Buscar en logs (DEBE APARECER):**
- [ ] `[POSTGRES] Nueva conexión establecida`
- [ ] `[POSTGRES] ✅ Conectado exitosamente`
- [ ] `[POSTGRES] Verificando schema y constraints...`
- [ ] `[POSTGRES] ✅ Schema y constraints verificados`
- [ ] `[DB PERFORMANCE] ✅ Índices optimizados creados`
- [ ] `[SERVER] SOFTCONTABLE 2 ONLINE en puerto 8080`

**NO DEBE APARECER:**
- [ ] ❌ `column "tipoper" does not exist`
- [ ] ❌ `column "ctaGasto" does not exist`
- [ ] ❌ `column "moneda" does not exist`
- [ ] ❌ `db.prepare is not a function`
- [ ] ❌ `undefined.filter()`

**Tiempo de despliegue:** 2-5 minutos

---

### 1.3 Verificar Schema PostgreSQL (OPCIONAL)
```bash
railway connect Postgres
```

Ejecutar en PostgreSQL:
```sql
-- Ver todas las tablas
\dt

-- Ver estructura de purchases (debe tener 35+ columnas)
\d+ purchases

-- Ver estructura de sales (debe tener 30+ columnas)
\d+ sales

-- Verificar columnas específicas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchases' 
AND column_name IN ('tipoper', 'ctagasto', 'moneda', 'detraccion');
```

**Resultado esperado:**
```
 column_name | data_type 
-------------+-----------
 tipoper     | text
 ctagasto    | text
 moneda      | text
 detraccion  | numeric
(4 rows)
```

- [ ] Tabla purchases tiene todas las columnas
- [ ] Tabla sales tiene todas las columnas
- [ ] No hay errores de sintaxis

---

## 🧪 FASE 2: TESTING FUNCIONAL (20 min)

### 2.1 Test Básico: Login y Carga Inicial

**URL:** https://softcontable.up.railway.app

- [ ] La página carga sin errores
- [ ] Login con `aangelo2555@gmail.com` exitoso
- [ ] Dashboard se muestra correctamente
- [ ] No hay errores en consola del navegador (F12)
- [ ] Sidebar se carga con todos los módulos

---

### 2.2 Test Crítico: Configuración de Empresa

**Pasos:**
1. Ir a menú → **Configuración Empresa** (o botón de empresa)
2. Observar si los datos actuales se cargan

**Verificar datos visibles:**
- [ ] RUC se muestra
- [ ] Nombre de empresa se muestra
- [ ] Régimen tributario se muestra
- [ ] Período actual se muestra

**Modificar datos:**
3. Cambiar nombre de empresa a: `TEST MIGRACION POSTGRES`
4. Cambiar UIT de `0` a `5150`
5. Cambiar régimen tributario
6. Click en **GUARDAR**

**Validaciones:**
- [ ] Se muestra mensaje de éxito "Datos guardados"
- [ ] No hay errores en consola (F12)
- [ ] No hay errores en Network tab (F12)

**Prueba de persistencia:**
7. **Recargar la página completa** (F5 o Ctrl+R)
8. Volver a "Configuración Empresa"

**Verificar persistencia:**
- [ ] ✅ Nombre sigue siendo `TEST MIGRACION POSTGRES`
- [ ] ✅ UIT sigue siendo `5150`
- [ ] ✅ Régimen tributario se mantuvo
- [ ] ✅ Los datos NO volvieron a valores anteriores

**🚨 SI LOS DATOS NO PERSISTEN:** Hay un problema con el save o con el user_id

---

### 2.3 Test: Crear Compra (Purchase)

**Pasos:**
1. Ir a módulo **Compras** o **Registro de Compras**
2. Click en **Nueva Compra** o **Agregar**

**Llenar formulario:**
- Fecha: Hoy
- Tipo Doc: `01 - Factura`
- Serie: `F001`
- Número: `00000001`
- RUC Proveedor: `20123456789`
- Nombre: `PROVEEDOR TEST SA`
- **TipOper:** `COMPRA INTERNA GRAVADA` ⭐ NUEVO
- **Moneda:** `SOLES` ⭐ NUEVO
- **Cuenta Gasto:** `6011 - Mercaderías` ⭐ NUEVO
- **Cuenta Abono:** `4212 - Facturas por pagar` ⭐ NUEVO
- Base Imponible: `1000.00`
- IGV: `180.00`
- Total: `1180.00`

3. Click en **GUARDAR**

**Validaciones:**
- [ ] Se guarda sin errores
- [ ] Mensaje de éxito aparece
- [ ] La compra aparece en la lista
- [ ] No hay error `column "tipoper" does not exist` en logs

**Verificar datos guardados:**
4. Recargar la página (F5)
5. Buscar la compra recién creada

- [ ] ✅ La compra aparece en la lista
- [ ] ✅ Todos los campos se mantienen
- [ ] ✅ tipOper se guardó correctamente
- [ ] ✅ Cuentas contables se guardaron

**🚨 SI HAY ERROR:** Revisar logs de Railway para ver el error exacto

---

### 2.4 Test: Crear Venta (Sale)

**Pasos:**
1. Ir a módulo **Ventas** o **Registro de Ventas**
2. Click en **Nueva Venta**

**Llenar formulario:**
- Fecha: Hoy
- Tipo Doc: `01 - Factura`
- Serie: `F001`
- Número: `00000001`
- RUC Cliente: `20987654321`
- Nombre: `CLIENTE TEST SAC`
- **TipOper:** `VENTA INTERNA GRAVADA` ⭐ NUEVO
- **Moneda:** `SOLES` ⭐ NUEVO
- **Cuenta Cargo:** `1212 - Facturas por cobrar` ⭐ NUEVO
- **Cuenta Ingreso:** `70111 - Ventas` ⭐ NUEVO
- Base Imponible: `2000.00`
- IGV: `360.00`
- Total: `2360.00`

3. Click en **GUARDAR**

**Validaciones:**
- [ ] Se guarda sin errores
- [ ] La venta aparece en la lista
- [ ] Recargar página (F5)
- [ ] La venta persiste con todos los datos

---

### 2.5 Test: Libro Diario (SI DISPONIBLE)

**⚠️ ESTE MÓDULO PUEDE FALLAR** porque usa `db.prepare()` (API SQLite)

**Pasos:**
1. Ir a **Libro Diario** o **Formato 5.2**
2. Intentar ver asientos del período actual

**Resultados esperados:**
- [ ] ✅ Si funciona: Se muestran asientos sin error
- [ ] ⚠️ Si falla con `db.prepare is not a function`: Es esperado, necesita migración (Fase 2)

**Si falla:**
- Anotar el error exacto
- Continuar con otros tests
- Este módulo se migrará en la siguiente fase

---

## 🎯 FASE 3: VALIDACIÓN DE LOGS (10 min)

### 3.1 Revisar Logs de Aplicación

```bash
railway logs --service softcontableperu1 --tail 100
```

**Buscar indicadores positivos:**
- [ ] `[SAAS DB REWRITE] Inyectado user_id` (aparece al guardar)
- [ ] `[CACHE] Invalidando cache` (aparece después de operaciones)
- [ ] Sin errores de columnas faltantes
- [ ] Sin errores de `undefined` en arrays

**Buscar indicadores de problemas:**
- [ ] ❌ `column "..." does not exist`
- [ ] ❌ `relation "..." does not exist`
- [ ] ❌ `db.prepare is not a function`
- [ ] ❌ `Cannot read property 'filter' of undefined`

---

### 3.2 Revisar Logs de PostgreSQL

```bash
railway logs --service Postgres --tail 50
```

**Verificar:**
- [ ] Conexiones establecidas sin errores
- [ ] No hay errores de sintaxis SQL
- [ ] No hay warnings de constraints

---

## 📊 FASE 4: MÉTRICAS DE ÉXITO

### Criterios de Aceptación

**✅ ÉXITO COMPLETO si:**
1. ✅ Despliegue sin errores
2. ✅ Login funciona
3. ✅ Configuración de empresa se guarda Y persiste
4. ✅ Compras se guardan con tipOper, moneda, cuentas contables
5. ✅ Ventas se guardan con todos los campos nuevos
6. ✅ No hay errores de columnas faltantes en logs

**⚠️ ÉXITO PARCIAL si:**
1. ✅ Despliegue OK
2. ✅ CRUD básico funciona (compras, ventas)
3. ⚠️ Libro Diario falla con `db.prepare` (esperado, se arregla en Fase 2)
4. ✅ Datos persisten correctamente

**❌ FALLA si:**
1. ❌ Errores de columnas faltantes persisten
2. ❌ Datos no persisten al recargar
3. ❌ No se pueden guardar compras/ventas
4. ❌ Configuración de empresa no se guarda

---

## 🔧 TROUBLESHOOTING

### Problema: "column does not exist"

**Diagnóstico:**
```sql
-- Conectar a Postgres
railway connect Postgres

-- Ver columnas de la tabla
\d+ purchases
```

**Solución:**
Si falta una columna, ejecutar:
```sql
ALTER TABLE purchases ADD COLUMN nombre_columna TEXT;
```

---

### Problema: Datos no persisten

**Diagnóstico:**
- Revisar logs: buscar mensajes de `[SAAS DB REWRITE]`
- Verificar que `user_id` se está inyectando correctamente

**Posible causa:**
- Query UPDATE no está incluyendo user_id en el WHERE
- Cache no se está invalidando

**Solución:**
Revisar `server/app.js` - middleware de SAAS rewrite

---

### Problema: "db.prepare is not a function"

**Diagnóstico:**
Servicio legacy intentando usar API de SQLite en PostgreSQL

**Solución:**
Este error es **ESPERADO** para:
- `libroDiario52Service.js`
- `retenciones41Service.js`
- Otros servicios legacy

Se arreglará en **Fase 2: Migración de Servicios Legacy**

**Workaround temporal:**
Evitar usar esos módulos hasta la migración

---

## 📝 REPORTE FINAL

**Fecha de validación:** _________________

**Ejecutado por:** _________________

**Resultado general:**
- [ ] ✅ ÉXITO COMPLETO
- [ ] ⚠️ ÉXITO PARCIAL (especificar problemas abajo)
- [ ] ❌ FALLA (especificar problemas críticos abajo)

**Problemas encontrados:**
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

**Módulos funcionales:**
- [ ] Login
- [ ] Dashboard
- [ ] Configuración Empresa
- [ ] Compras
- [ ] Ventas
- [ ] Libro Diario
- [ ] SIRE
- [ ] Productos
- [ ] Planillas

**Próximos pasos:**
_________________________________________________________
_________________________________________________________
_________________________________________________________

---

**Versión:** 1.0
**Última actualización:** 2026-06-26
**Autor:** Kiro AI Assistant
