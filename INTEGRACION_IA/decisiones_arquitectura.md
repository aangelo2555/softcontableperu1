# Decisiones de Arquitectura — SoftPremium

> Documento de referencia para justificar decisiones ya tomadas. Si en el 
> futuro alguien (incluido tú mismo, seis meses después) se pregunta 
> "¿por qué está hecho así?", este documento responde antes de que se 
> reabra la discusión sin necesidad.

**Última actualización**: 05 de agosto de 2026

---

## Decisión 1: Schema separado en la misma Postgres, NO base de datos distinta

### La pregunta original
¿SoftPremium debería vivir en una base de datos PostgreSQL completamente 
separada de SOFTCONTABLE SAAS, para evitar que sobrecargue el sistema core?

### La decisión
**No.** Mismo motor Postgres, schema `premium` separado del schema `public` 
del core, con un **pool de conexiones independiente**.

### Por qué se descartó la base de datos separada

1. **Duplicación de identidad**: el core ya tiene `users` y `workspaces` 
   con JWT y roles. Una BD separada obliga a replicar auth o inventar un 
   mecanismo de sincronización — complejidad sin beneficio.

2. **Transacciones rotas**: activar Premium para un usuario implica 
   escribir en dos lugares (registro de suscripción + flag de activación). 
   Con una sola BD, esto es una transacción atómica (`BEGIN...COMMIT`). 
   Con dos BDs, se necesita un patrón de transacción distribuida (2PC, 
   sagas, etc.) que es complejidad de nivel enterprise para un problema 
   que no la necesita todavía.

3. **Latencia de JOIN vs. latencia de red**: Premium necesita leer datos 
   del core constantemente (asientos, compras, ventas) para sus análisis. 
   Con schema separado en la misma instancia, esto es un JOIN SQL normal. 
   Con BD separada, cada lectura cruza la red como llamada HTTP a una API 
   interna — más lento, más código, más puntos de fallo.

4. **Duplicación de superficie operativa**: una BD separada significa 
   otro backup que monitorear, otra instancia que puede caerse, otro 
   punto de configuración en Railway. Para una startup en esta etapa, 
   cada pieza de infraestructura adicional es costo de mantenimiento que 
   compite con tiempo de desarrollo de producto.

### Por qué el schema separado sí resuelve la preocupación real 
(que el sistema "no se lagee")

El problema real detrás de la pregunta de Angelo no era "¿debo usar dos 
bases de datos?" — era **"¿cómo evito que las queries pesadas de IA/
forecasting de Premium compitan por recursos con las transacciones del 
día a día del core (compras, ventas, asientos)?"**

Esa pregunta se resuelve con **pools de conexión separados**, no con 
servidores de base de datos separados:

```
Pool A (core):    max: 20 conexiones — prioridad alta, transaccional
Pool B (premium): max: 10 conexiones — aislado, para queries analíticas 
                  pesadas (IA, forecasting, scoring de riesgo)
```

Si el pool de Premium se satura (ej. 10 workspaces corriendo análisis de 
riesgo tributario simultáneamente), eso NO afecta al pool del core — las 
compras y ventas del día siguen fluyendo sin fricción. Esto es el 
aislamiento real que se buscaba, logrado sin pagar el costo de una 
arquitectura distribuida.

### Camino de escalamiento si en el futuro sí se necesita separación física

Si Premium crece al punto de necesitar su propia instancia (ej. cientos 
de miles de workspaces con Premium activo, contención real de CPU/IO en 
Postgres), migrar un schema completo a otra instancia es una operación 
estándar (`pg_dump --schema=premium` + `pg_restore` a la nueva instancia, 
actualizar el connection string de `server-premium/`). Es un cambio de 
configuración, no una reescritura de arquitectura — por eso no hay 
urgencia de hacerlo desde el día uno.

---

## Decisión 2: Frontend y backend completamente separados del core

### La decisión
`server-premium/` como aplicación Express independiente. Frontend de 
SoftPremium como bundle React separado, con su propio branding, nunca 
mezclado entre los 42 componentes de `src/components/` del core.

### Por qué
- **Deploy independiente**: un bug en Premium no debe requerir 
  redesplegar el core completo, y viceversa.
- **Branding real**: el flyer de marketing (ASCONTRI, "IA para 
  Contadores") sugiere una experiencia premium diferenciada — mezclar 
  visualmente Premium dentro del dashboard del core diluye esa 
  percepción de valor adicional.
- **Equipos futuros**: si Angelo contrata desarrolladores dedicados a 
  Premium más adelante, la separación de código evita que toquen el core 
  por accidente.

---

## Decisión 3: Regla de acoplamiento — lectura sí, escritura no (con una excepción)

### La decisión
Premium lee del schema `public` exclusivamente vía funciones de servicio 
controladas (nunca queries SQL ad-hoc dispersas por el código de 
Premium). Premium **nunca** escribe en `public`, con la única excepción 
de `workspaces.premium_enabled` y `workspaces.premium_tiers`, actualizados 
solo desde el flujo de activación/cancelación de suscripción.

### Por qué
Esto es lo que realmente protege al core de Premium, más allá de la 
separación de schema. Si Premium tuviera permiso de escribir libremente 
en `journal`, `purchases`, o `sales`, un bug en Premium podría corromper 
datos contables del core — que es el activo más sensible del negocio 
completo (son los libros oficiales que se declaran a SUNAT). 

La única excepción (el flag de activación) se permite porque es un 
campo de control de acceso, no un dato contable — el radio de daño de un 
bug ahí es "usuario ve/no ve Premium", nunca "el asiento contable está mal".

---

## Decisión 4: Separación entre pilares "analíticos" (Tributación) y 
"transaccionales" (Planillas)

### La decisión
El Pilar 1 (Tributación con IA) nunca genera asientos contables 
automáticamente — solo alertas y hallazgos. El Pilar 2 (Planillas con IA) 
sí puede generar asientos automáticos para cálculos determinísticos 
(gratificación, CTS), pero todo documento legal generado (contratos, 
adendas) requiere revisión humana explícita antes de ser válido.

### Por qué
La diferencia no es arbitraria — es sobre **el tipo de juicio involucrado**:

- Clasificar si un gasto es deducible bajo el Art. 37 de la LIR, o si un 
  patrón de compras/ventas amerita preocupación ante SUNAT, es **juicio 
  profesional discrecional**. Automatizar el asiento ahí significa que el 
  software está tomando una decisión tributaria que legalmente 
  corresponde al contador colegiado. Alto riesgo legal para el producto.

- Calcular una gratificación bajo la Ley 27735, o una CTS, es **aplicación 
  determinística de una fórmula normada**. No hay ambigüedad de criterio 
  — dado el sueldo y los meses trabajados, el resultado es matemáticamente 
  único. Automatizar el asiento ahí es equivalente a lo que ya hace el 
  motor de asientos del core para el resto de operaciones contables.

- Generar un contrato de trabajo o una adenda con IA sí involucra 
  redacción legal con espacio de interpretación — de ahí la exigencia de 
  `reviewed_by_human = true` como campo obligatorio antes de considerar 
  el documento válido para uso.

Esta distinción debe mantenerse como principio de diseño en cualquier 
pilar nuevo que se agregue en el futuro — la pregunta a hacerse siempre 
es: "¿esto es una fórmula normada sin ambigüedad, o es juicio 
profesional/legal?"
