# 🚨 SOLUCIÓN INMEDIATA - 2 Problemas Críticos

## ❌ PROBLEMA 1: Error "version is ambiguous" persiste

**Causa:** Railway NO ha redesplegado el fix porque NO hiciste push

**Solución:** Ejecutar estos comandos en PowerShell:

```powershell
cd c:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY

git status

git add .

git commit -m "fix: version ambiguity + schemas completos"

git push origin main
```

**Después del push:**
- Railway detecta automáticamente en 30 segundos
- Redespliegue toma 2-3 minutos
- Monitorear: `railway logs -f`

---

## ❌ PROBLEMA 2: UIT vuelve a 0 al recargar

**Causa:** El valor `annualIncomeUIT` posiblemente no se está guardando como número.

**Verificación:** El código en `databasePostgres.js` línea 315 muestra:

```javascript
annualIncomeUIT = $15
```

Esto debería funcionar, PERO... necesito verificar que el valor llegue como número.

### DEBUG TEMPORAL:

Abre Railway logs y busca cuándo guardas la empresa:

```bash
railway logs --tail 100
```

Buscar líneas como:
```
[POSTGRES QUERY] UPDATE workspaces SET ...
```

Verificar que `annualIncomeUIT` tenga un valor numérico, no string.

---

## 🔧 FIX ADICIONAL NECESARIO:

El componente `EmpresaView.tsx` tiene código duplicado en líneas 523 y 530:

```typescript
updateCompany({ annualIncomeUIT: val });
updateCompany({ annualIncomeUIT: val }); // ← DUPLICADO
```

Esto hace que se llame dos veces, lo cual puede causar race conditions.

### Solución:

Editar `src/components/EmpresaView.tsx` y eliminar las líneas duplicadas.

---

## 📋 CHECKLIST DE ACCIONES:

### 1. Hacer Push del Fix
- [ ] `cd c:\Users\aange\Desktop\SOFTCONTABLE_WEB_READY`
- [ ] `git add .`
- [ ] `git commit -m "fix: version + UIT persistence"`  
- [ ] `git push origin main`
- [ ] Esperar 3 minutos

### 2. Verificar Redespliegue
- [ ] `railway logs -f`
- [ ] Buscar: `✅ Schema y constraints verificados`
- [ ] NO debe aparecer: `column reference "version" is ambiguous`

### 3. Probar UIT
- [ ] Abrir https://softcontable.up.railway.app
- [ ] Ir a Configuración Empresa
- [ ] Cambiar UIT a `5150`
- [ ] Click fuera del input (trigger onBlur)
- [ ] **Esperar 2 segundos** (dar tiempo al API)
- [ ] Recargar página (F5)
- [ ] Verificar que UIT sigue siendo `5150`

### 4. Si UIT AÚN vuelve a 0:

Verificar en Railway logs al guardar:

```bash
railway logs --tail 50
```

Buscar el query UPDATE y verificar el valor de `$15` (annualIncomeUIT).

Si el valor es `0` o `null`, el problema está en el frontend.
Si el valor es correcto (ej: `5150`), el problema está en la query o el schema.

---

## 🎯 RESULTADO ESPERADO:

Después de hacer push y esperar el redespliegue:

✅ **Error "version is ambiguous"** → RESUELTO
✅ **UIT vuelve a 0** → Debe persistir correctamente

---

## 🆘 SI SIGUE FALLANDO:

1. **Verificar que el push se hizo:**
   ```bash
   git log --oneline -3
   ```
   Debe aparecer tu commit reciente.

2. **Verificar que Railway detectó el cambio:**
   - Ir a Railway dashboard
   - Ver la pestaña "Deployments"
   - Debe aparecer un deployment reciente

3. **Verificar el schema de workspaces:**
   ```bash
   railway connect Postgres
   ```
   ```sql
   \d+ workspaces
   ```
   Verificar que `annualincomeuit` existe y es tipo `numeric`.

---

**Fecha:** 2026-06-26 13:15 UTC
**Prioridad:** 🔴 CRÍTICA - Ejecutar AHORA
