# Manual Técnico: Dinámica del PCGE, Normas NIIF/NIC y Registro Contable por Separado

Este documento establece la base teórica contable y la lógica algorítmica para el entrenamiento y alimentación del motor RAG de Softcontable. Define de forma estricta cómo se deben desagregar las operaciones complejas y detalla la dinámica de débito y crédito de cada elemento del Plan Contable General Empresarial (PCGE) modificado de Perú.

---

## ⚖️ 1. Principio de Registro por Separado (Desagregación Contable)

En la práctica contable peruana bajo las Normas Internacionales de Información Financiera (NIIF), **está prohibido consolidar o mezclar fases independientes de un hecho económico en un solo asiento contable con una única glosa**. Una transacción comercial completa (como una compra al crédito) se compone de tres hechos contables distintos y secuenciales que deben registrarse en asientos separados:

```
[ PASO 1: PROVISIÓN (Obligación) ] 
       │
       ▼
[ PASO 2: DESTINO (Consumo/Almacén) ] 
       │
       ▼
[ PASO 3: CANCELACIÓN (Flujo de Caja) ]
```

### 1.1 La Provisión (El Devengado)
*   **Propósito:** Registrar el nacimiento de la obligación (gasto o activo inmovilizado) y el pasivo correspondiente frente al proveedor, o el derecho de cobro y el ingreso frente al cliente.
*   **Cuentas involucradas:** Clase 6 (Gastos) o Clase 3 (Activos) en el Debe, Clase 40 (Tributos) en el Debe/Haber, y Clase 42/46 (Pasivos) o Clase 12 (Activos) en el Haber/Debe.
*   **Glosa Estándar:** `"POR LA PROVISIÓN DE LA COMPRA/SERVICIO SEGÚN COMPROBANTE XXX"` o `"POR EL RECONOCIMIENTO DE LA VENTA SEGÚN FACTURA YYY"`.

### 1.2 El Destino (La Transferencia de Costo / Ingreso al Almacén)
*   **Propósito:** Transferir el costo por naturaleza al destino correspondiente en los estados financieros (costos de producción, gastos administrativos, gastos de venta o inventarios físicos).
*   **Cuentas involucradas:**
    *   *Para Compras de Existencias (Clase 60):* Debe de la Clase 20/24/25 contra el Haber de la cuenta `61` (Variación de Existencias).
    *   *Para Gastos por Servicios/Personal (Clases 62/63/64/65/68):* Debe de la Clase 9 (`94`/`95`/`90` para producción) contra el Haber de la cuenta `791` (Cargas Imputables a Cuentas de Costos y Gastos).
*   **Glosa Estándar:** `"POR EL DESTINO DEL GASTO A CUENTAS DE FUNCIÓN"` o `"POR EL INGRESO DE LAS EXISTENCIAS AL ALMACÉN"`.

### 1.3 La Cancelación (El Flujo de Efectivo)
*   **Propósito:** Registrar el pago de la obligación de pasivo o el cobro del derecho de activo disponible.
*   **Cuentas involucradas:** Cuenta `42`/`46` (Debe para pago) o Cuenta `12` (Haber para cobro) contra la cuenta `10` (Efectivo y Equivalentes de Efectivo).
*   **Glosa Estándar:** `"POR EL PAGO DE LA FACTURA XXX AL PROVEEDOR"` o `"POR EL COBRO DE LA FACTURA YYY AL CLIENTE"`.

---

## 📊 2. Dinámica Contable Detallada por Elemento (Elementos 1 a 9 y 0)

### 🟩 Elemento 1: Activo Disponible y Exigible
*   **Naturaleza:** Deudora.
*   **Alcance:** Comprende los fondos de caja y bancos, las inversiones financieras temporales, y los derechos de cobro a clientes, personal, accionistas o terceros.
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Por los ingresos de efectivo a caja o abonos en cuentas bancarias.
        *   Por la emisión de facturas o boletas de venta (derecho de cobro).
        *   Por préstamos otorgados al personal o a accionistas.
        *   Por reclamos o reembolsos de tributos pendientes por cobrar.
        *   Por las ganancias por diferencia de cambio (revaluación de activos en moneda extranjera).
    *   **Se Acredita (Haber):**
        *   Por las salidas de efectivo para pagos a proveedores, planilla o tributos.
        *   Por la cobranza de facturas a clientes.
        *   Por el castigo de cuentas incobrables (cruce con la cuenta `19`).
        *   Por las pérdidas por diferencia de cambio.

### 🟩 Elemento 2: Activo Realizable (Inventarios)
*   **Naturaleza:** Deudora.
*   **Alcance:** Comprende los bienes adquiridos para su reventa (mercaderías), materias primas, productos terminados, productos en proceso y repuestos.
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Por el ingreso físico de bienes al almacén valorizados a su costo de adquisición o costo de producción (cruce con la cuenta `61` o `71`).
        *   Por las devoluciones de bienes realizadas por los clientes.
        *   Por el excedente de inventarios detectado en inventarios físicos.
    *   **Se Acredita (Haber):**
        *   Por la salida de bienes del almacén por concepto de venta (costo de ventas - cruce con la cuenta `69`).
        *   Por el retiro de materias primas para su consumo en el proceso de producción.
        *   Por las mermas o desmedros debidamente acreditados que implican destrucción de existencias.

### 🟩 Elemento 3: Activo Inmovilizado
*   **Naturaleza:** Deudora (las cuentas de depreciación/amortización acumulada `39` tienen naturaleza acreedora por ser correctoras).
*   **Alcance:** Comprende las inversiones a largo plazo, propiedades de inversión, propiedad, planta y equipo (maquinarias, vehículos, equipos), intangibles (software, licencias) y los activos por derechos de uso (leasing).
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Por la adquisición de activos fijos valorizados a su costo de adquisición (precio de compra + fletes + aranceles + gastos de instalación).
        *   Por las mejoras capitalizables que incrementan la vida útil o capacidad productiva del activo.
        *   Por el reconocimiento del derecho de uso por contratos de arrendamiento financiero (NIIF 16).
    *   **Se Acredita (Haber):**
        *   Por la venta o baja de activos fijos.
        *   Por retiros o pérdidas de activos por obsolescencia o destrucción.
        *   *En el caso de la cuenta `39` (Haber):* Por la provisión de la depreciación del periodo (cruce con la cuenta `68`).

### 🟥 Elemento 4: Pasivo
*   **Naturaleza:** Acreedora.
*   **Alcance:** Obligaciones presentes de la empresa surgidas de transacciones pasadas (tributos por pagar, remuneraciones, cuentas por pagar comerciales, obligaciones financieras).
*   **Lógica de Registro:**
    *   **Se Debita (Debe) - Disminuye:**
        *   Por el pago total o parcial de obligaciones a proveedores, trabajadores o SUNAT.
        *   Por la aplicación de anticipos otorgados.
        *   Por las notas de crédito emitidas por los proveedores que reducen la deuda comercial.
    *   **Se Acredita (Haber) - Aumenta:**
        *   Por la provisión de facturas de compras o servicios recibidos.
        *   Por el devengamiento de planillas de sueldos o tributos del periodo.
        *   Por la obtención de préstamos o financiamientos de entidades bancarias.

### 🟥 Elemento 5: Patrimonio Neto
*   **Naturaleza:** Acreedora.
*   **Alcance:** Representa el valor residual de la empresa (capital social aportado, reservas legales, utilidades acumuladas, excedentes de revaluación).
*   **Lógica de Registro:**
    *   **Se Debita (Debe) - Disminuye:**
        *   Por la capitalización de pérdidas acumuladas.
        *   Por la distribución y pago de dividendos a los socios.
        *   Por la reducción del capital social.
    *   **Se Acredita (Haber) - Aumenta:**
        *   Por el aporte o suscripción de capital inicial de los accionistas.
        *   Por la transferencia de la utilidad del ejercicio (cruce con la cuenta `89`).
        *   Por la constitución de la reserva legal.

### 🟩 Elemento 6: Gastos por Naturaleza
*   **Naturaleza:** Deudora.
*   **Alcance:** Cuentas que acumulan las compras de existencias, consumos de servicios, planilla de personal, tributos municipales, gastos financieros, y provisiones por deterioro o depreciación del periodo.
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Por el registro inicial de compras de bienes o servicios.
        *   Por los gastos de personal devengados.
        *   Por los cargos de depreciación y provisiones del periodo.
    *   **Se Acredita (Haber):**
        *   Únicamente al cierre del ejercicio contable para trasladar los saldos a las cuentas de cierre del Elemento 8.

### 🟥 Elemento 7: Ingresos
*   **Naturaleza:** Acreedora.
*   **Alcance:** Agrupa las ventas de mercaderías o servicios, ingresos financieros, ganancias por medición a valor razonable, y otros ingresos de gestión.
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Únicamente al cierre del ejercicio contable para trasladar los saldos a las cuentas de cierre del Elemento 8.
    *   **Se Acredita (Haber):**
        *   Por la facturación de ventas de bienes o prestación de servicios al cliente.
        *   Por los intereses ganados en cuentas bancarias.
        *   Por subsidios o indemnizaciones ganadas.

### 🟨 Elemento 8: Saldos Intermediarios de Gestión
*   **Naturaleza:** Mixta (cuentas puente de balance de pérdidas y ganancias).
*   **Alcance:** Cuentas utilizadas para cerrar los elementos de ingresos y gastos de forma ordenada al final del año.
*   **Lógica de Registro:**
    *   Recibe los traslados de saldos del Elemento 6 en el Debe y los saldos del Elemento 7 en el Haber para determinar el Margen Comercial, Valor Agregado y el Impuesto a la Renta.

### 🟩 Elemento 9: Contabilidad Analítica (Gastos por Función)
*   **Naturaleza:** Deudora.
*   **Alcance:** Permite clasificar la estructura de gastos según el área funcional responsable (`90` Costo de producción, `94` Gastos Administrativos, `95` Gastos de Ventas).
*   **Lógica de Registro:**
    *   **Se Debita (Debe):**
        *   Por el destino del gasto registrado en el Elemento 6 (cruce con la cuenta `791` en el Haber).
    *   **Se Acredita (Haber):**
        *   Al cierre del ejercicio para saldar la contabilidad de costos.

### 🟨 Elemento 0: Cuentas de Orden
*   **Naturaleza:** Doble (01/02 contrapartidas).
*   **Alcance:** Control de contingencias (litigios), mercaderías recibidas en consignación o cartas fianza que no alteran el balance general de la empresa pero implican riesgos futuros.

---

## 📝 3. Casos Prácticos con Registro por Separado (Formato de Ingesta RAG)

A continuación se estructuran los casos modelo que el RAG utilizará para entrenar e inyectar propuestas al usuario. Cada operación se desglosa en sus asientos específicos e individuales.

### Caso 1: Compra de Mercadería al Crédito (S/ 10,000 + IGV)

#### Asiento 1.1: Provisión de la Compra (Obligación)
*   **Glosa:** `"POR LA PROVISIÓN DE LA COMPRA DE MERCADERÍA SEGÚN FACTURA F001-9874"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **60111** | Mercaderías manufacturadas - Costo | 10,000.00 | 0.00 |
    | **40111** | IGV - Cuenta propia | 1,800.00 | 0.00 |
    | **4212** | Emitidas (Facturas por pagar) | 0.00 | 11,800.00 |

#### Asiento 1.2: Ingreso a Almacén (Destino)
*   **Glosa:** `"POR EL INGRESO DE LA MERCADERÍA AL ALMACÉN"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **20111** | Mercaderías manufacturadas - Costo | 10,000.00 | 0.00 |
    | **6111** | Mercaderías manufacturadas | 0.00 | 10,000.00 |

#### Asiento 1.3: Pago al Proveedor (Cancelación)
*   **Glosa:** `"POR EL PAGO CON TRANSFERENCIA BANCARIA DE LA FACTURA F001-9874"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **4212** | Emitidas (Facturas por pagar) | 11,800.00 | 0.00 |
    | **1041** | Cuentas corrientes operativas | 0.00 | 11,800.00 |

---

### Caso 2: Planilla de Personal de Administración (S/ 5,000 bruto)

#### Asiento 2.1: Provisión de la Planilla (Gasto y Obligaciones)
*   **Glosa:** `"POR LA PROVISIÓN DE LA PLANILLA DE REMUNERACIONES DEL MES"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **6211** | Sueldos y salarios | 5,000.00 | 0.00 |
    | **6271** | Régimen de prestaciones de salud (EsSalud 9%) | 450.00 | 0.00 |
    | **4031** | ESSALUD | 0.00 | 450.00 |
    | **4032** | ONP (Retención 13%) | 0.00 | 650.00 |
    | **4111** | Sueldos y salarios por pagar | 0.00 | 4,350.00 |

#### Asiento 2.2: Destino del Gasto Administrativo
*   **Glosa:** `"POR EL DESTINO DE LOS GASTOS DE PLANILLA DE ADMINISTRACIÓN"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **941** | Gastos Administrativos | 5,450.00 | 0.00 |
    | **791** | Cargas imputables a cuentas de costos y gastos | 0.00 | 5,450.00 |

#### Asiento 2.3: Pago de Sueldos Neto a Trabajadores
*   **Glosa:** `"POR EL PAGO DE HABERES DEL PERSONAL VÍA TRANSFERENCIA"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **4111** | Sueldos y salarios por pagar | 4,350.00 | 0.00 |
    | **1041** | Cuentas corrientes operativas | 0.00 | 4,350.00 |

---

### Caso 3: Adquisición de Activo Fijo (Maquinaria) con Flete Capitalizado (> 1/4 UIT - NIC 16)

#### Asiento 3.1: Provisión de la Compra de Maquinaria
*   **Glosa:** `"POR LA ADQUISICIÓN DE MAQUINARIA INDUSTRIAL SEGÚN FACTURA F055-1234"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **33311** | Maquinarias y equipos de explotación - Costo | 15,000.00 | 0.00 |
    | **40111** | IGV - Cuenta propia | 2,700.00 | 0.00 |
    | **4654** | Propiedades, planta y equipo (Cuentas por pagar) | 0.00 | 17,700.00 |

#### Asiento 3.2: Capitalización de Flete (NIC 16 - Costo de Activo)
*   **Glosa:** `"POR EL FLETE DE TRANSPORTE E INSTALACIÓN DE MAQUINARIA INDUSTRIAL SEGÚN NIC 16"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **33311** | Maquinarias y equipos (Flete capitalizado) | 1,500.00 | 0.00 |
    | **40111** | IGV - Cuenta propia | 270.00 | 0.00 |
    | **4654** | Propiedades, planta y equipo (Cuentas por pagar) | 0.00 | 1,770.00 |

#### Asiento 3.3: Pago de la Adquisición de Activo y Flete
*   **Glosa:** `"POR EL PAGO DE LA FACTURA DE ADQUISICIÓN DE MAQUINARIA Y FLETE"`
*   **Asiento Contable:**
    | Cuenta | Denominación de la Cuenta | Debe (S/) | Haber (S/) |
    | :--- | :--- | :--- | :--- |
    | **4654** | Propiedades, planta y equipo (Cuentas por pagar) | 19,470.00 | 0.00 |
    | **1041** | Cuentas corrientes operativas | 0.00 | 19,470.00 |
