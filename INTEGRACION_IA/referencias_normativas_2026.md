# Referencias Normativas 2026 — Bitácora de Verificación

> Este documento registra cada dato normativo usado en el diseño de 
> SoftPremium, con su fuente y fecha de verificación. La normativa 
> peruana cambia con frecuencia (ver el caso de la Ley 32563 más abajo, 
> promulgada a mitad del mismo año que este documento) — por eso cada 
> entrada tiene fecha, para que puedas evaluar si necesita 
> re-verificación antes de confiar en ella para un cálculo en producción.

**Última verificación general**: 05 de agosto de 2026

---

## UIT 2026

**Valor**: S/5,500
**Norma**: Decreto Supremo N° 301-2025-EF, publicado 17 de diciembre de 2025
**Variación**: +2.80% vs. S/5,350 (UIT 2025)

**Nota de discrepancia encontrada**: durante la búsqueda se encontró una 
fuente aislada (modelo.pe) citando S/5,350 para 2026 bajo un decreto 
distinto (D.S. 309-2025-EF). Esta cifra fue descartada porque el peso de 
evidencia (EY Perú, Buk, Interseguro, perugestiona.pe) converge en S/5,500 
citando el mismo número de decreto (301-2025-EF) de forma consistente. 
Antes de usar este valor en cualquier cálculo que afecte dinero real de 
un cliente, se recomienda verificación directa en El Peruano o el portal 
de SUNAT — una discrepancia de S/150 en la UIT altera multas, tramos de 
IR, y topes MYPE en cascada.

**Fuentes consultadas**: EY Perú, Buk.pe, Interseguro, perugestiona.pe, 
modelo.pe (descartada)

---

## Gratificación de Fiestas Patrias / Navidad (régimen privado)

**Norma base**: Ley N° 27735
**Bonificación extraordinaria**: Ley N° 29714 — 9% (o 6.75% si el 
empleador está afecto a EsSalud vía EPS)
**Fórmula**: remuneración computable completa si laboró el semestre 
completo; proporcional por sextos (meses/6) si no

**Fuente**: Zegel (blog educativo) — se recomienda contrastar con texto 
de la ley directamente para el detalle de la bonificación extraordinaria, 
dado que la fuente consultada es de carácter divulgativo, no normativo 
primario.

---

## CTS (régimen privado)

**Fórmula**: remuneración computable = sueldo mensual + (1/6 de la 
última gratificación percibida)
**Cálculo semestral**: remuneración computable × (meses trabajados en el 
semestre / 12)
**Depósito**: semestral, mayo y noviembre

**Fuentes**: Infobae (citando a Álvaro Gálvez, Cámara de Comercio de 
Lima, y Germán Lora, ESAN Business Law), Yo Soy Mentoría (para el caso 
específico de empresas REMYPE)

**Pendiente de verificar**: el tratamiento específico de CTS para 
empresas acogidas a REMYPE (régimen especial de pequeñas empresas) 
mencionaba una fórmula distinta en una de las fuentes — si SoftPremium va 
a atender empresas MYPE/REMYPE, este caso necesita su propia 
verificación normativa dedicada antes de codificarse.

---

## Régimen CAS — Gratificación y CTS (CAMBIO NORMATIVO RECIENTE)

**Norma**: Ley N.° 32563
**Fecha de promulgación**: 23 de marzo de 2026
**Contenido**: 
- Gratificaciones de Fiestas Patrias y Navidad para trabajadores CAS 
  (Decreto Legislativo N.° 1057), cada una equivalente a una 
  remuneración mensual íntegra
- Monto mínimo de S/300 por gratificación, fijado posteriormente por la 
  Comisión Permanente del Congreso vía Ley de Crédito Suplementario para 
  el Año Fiscal 2026
- CTS calculada sobre el 100% de la remuneración mensual por año de 
  servicio, con carácter CANCELATORIO — se paga solo al término del 
  vínculo laboral, a diferencia del régimen privado (semestral)
- Financiamiento: las entidades públicas deben cubrir esto con su propio 
  presupuesto institucional, sin recursos adicionales del Tesoro Público
- Implementación: gradual, cada entidad según su propio presupuesto — 
  al 10 de julio de 2026, el debate presupuestario aún no había concluido

**Por qué esto importa para SoftPremium**: esta es una norma promulgada 
DESPUÉS del inicio de este mismo año fiscal (marzo 2026), y su 
implementación seguía en debate presupuestario hasta julio 2026. Es el 
ejemplo más claro de por qué el motor de Planillas no puede tener 
fórmulas de CAS "quemadas" sin un mecanismo de actualización — la norma 
literalmente cambió mientras SOFTCONTABLE ya estaba en producción.

**Acción recomendada**: si SoftPremium va a ofrecer cálculo de planillas 
para el sector público o mixto, verificar el estado de implementación 
presupuestal de esta ley antes de habilitar el cálculo para un cliente 
real — la gradualidad mencionada significa que no todas las entidades 
están pagando esto todavía en la misma fecha.

**Fuentes**: Buk.pe, NubeCont, asesorescontablesaym.com

---

## PLAME — Cronograma de vencimientos

**Regla**: vence según el último dígito del RUC del empleador, entre los 
días 13 y 21 de cada mes (ej. RUC terminado en 0 vence el día 13, 
terminado en 9 vence el día 21)

**Fuente**: SueldoJusto.pe

**Nota de implementación**: este es el dato exacto que el Pilar 3 
(Finanzas con IA) necesita para el cruce de calendario SUNAT vs. 
proyección de flujo de caja — confirmar que la tabla completa de 
dígito-RUC → fecha de vencimiento esté en `sunatCatalogs.ts` del core, 
ya que Premium debería reutilizar ese catálogo existente en vez de 
duplicarlo.

---

## Cómo mantener esta bitácora

1. Antes de cada sprint que toque el motor de Planillas o Tributación, 
   revisar si hay actualización normativa posterior a la fecha de 
   verificación de este documento.
2. Priorizar la verificación del régimen CAS (Ley 32563) dado que su 
   implementación seguía en curso a julio 2026 — es la entrada con mayor 
   probabilidad de cambiar en el corto plazo.
3. Cualquier valor usado en un cálculo real de producción que provenga 
   de una fuente de carácter divulgativo (blogs, no el texto legal 
   directo) debería, idealmente, contrastarse contra el texto oficial 
   (El Peruano, portal SUNAT, portal SUNAFIL) antes de ir a producción 
   con clientes reales — las fuentes usadas aquí son suficientes para 
   diseño de arquitectura, no necesariamente para el valor final que se 
   audita ante SUNAT.
