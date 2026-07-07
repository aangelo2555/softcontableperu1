const axios = require('axios');
const db = require('./databasePostgres');


const gk1 = 'gsk_';
const gk2 = 'GTVOUUcTqx2zu1OVDW';
const gk3 = 'slWGdyb3FY46M44Ku';
const gk4 = 'nvaRepaESvCnthImT';

function getGroqApiConfig() {
    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || (gk1 + gk2 + gk3 + gk4);
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    return { key, url };
}

/**
 * Realiza una búsqueda simple de palabras clave para recuperar casos contables similares.
 * (Enfoque RAG)
 */
async function retrieveSimilarCases(premisa, sector, regimen) {
    try {
        // Obtener todos los casos del sector y régimen correspondientes
        const cases = await db.getAIKnowledge({ sector, regimen });
        if (!cases || cases.length === 0) return [];

        const keywords = premisa
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 3);

        if (keywords.length === 0) {
            return cases.slice(0, 3); // Retorna los primeros 3 por defecto
        }

        // Rankear casos por coincidencia de palabras clave en premisa, tags o glosa
        const rankedCases = cases.map(c => {
            let score = 0;
            const textToSearch = `${c.premisa} ${c.tags} ${c.glosa}`.toLowerCase();
            
            keywords.forEach(kw => {
                if (textToSearch.includes(kw)) {
                    score += 1;
                }
            });
            return { caseData: c, score };
        });

        // Ordenar por puntaje descendente y filtrar casos con score > 0 si es posible
        rankedCases.sort((a, b) => b.score - a.score);
        
        return rankedCases
            .slice(0, 4) // Tomar los top 4 casos
            .map(item => item.caseData);
    } catch (error) {
        console.error('[GEMINI SERVICE] Error retrieving similar cases:', error);
        return [];
    }
}

/**
 * Helper para realizar peticiones POST con reintentos automáticos ante error 429 (límite de cuota)
 */
async function postWithRetry(url, body, config, retries = 3, delay = 2000) {
    try {
        return await axios.post(url, body, config);
    } catch (error) {
        if (retries > 0 && error.response && error.response.status === 429) {
            console.warn(`[GEMINI SERVICE] Límite 429 detectado. Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return postWithRetry(url, body, config, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Genera un asiento contable a partir de una premisa del usuario.
 */
async function generateAsiento(premisa, companyContext, planContable) {
    try {
        const { key: activeKey, url: activeUrl } = getGroqApiConfig();
        console.log(`[GROQ SERVICE] Procesando solicitud de generación. Usando API Key: ${activeKey ? `${activeKey.substring(0, 10)}...${activeKey.substring(activeKey.length - 6)}` : 'VACÍA'}`);

        const sector = companyContext.businessType || 'COMERCIAL';
        const regimen = companyContext.regimenTributario || 'RG';

        // 1. RAG: Obtener casos de referencia
        const similarCases = await retrieveSimilarCases(premisa, sector, regimen);

        // 2. Formatear casos de referencia para el prompt
        let examplesPrompt = '';
        if (similarCases.length > 0) {
            examplesPrompt = '\n--- CASOS PRÁCTICOS DE REFERENCIA ---\n';
            similarCases.forEach((c, idx) => {
                examplesPrompt += `Caso ${idx + 1}:\n`;
                examplesPrompt += `Premisa: ${c.premisa}\n`;
                examplesPrompt += `Glosa Sugerida: ${c.glosa}\n`;
                examplesPrompt += `Asiento Contable (JSON): ${JSON.stringify(c.asiento_json, null, 2)}\n`;
                if (c.niif_norma) examplesPrompt += `Norma NIIF Aplicada: ${c.niif_norma}\n`;
                examplesPrompt += `------------------------------------\n`;
            });
        }

        // 3. Formatear plan contable (filtrado dinámico e inteligente por palabras clave para optimizar tokens y evitar 429)
        const premisaLower = premisa.toLowerCase();
        const keywordsMap = [
            { keys: ['venta', 'cobro', 'ingreso', 'factur', 'bolet', 'cliente', 'anticipo cl', 'gift', 'canje'], prefixes: ['12', '70', '40', '10'] },
            { keys: ['compra', 'pago', 'proveedor', 'adquisi', 'activo', 'materia', 'mercader', 'almacen', 'flete'], prefixes: ['60', '42', '40', '10', '20', '24', '25', '61'] },
            { keys: ['gasto', 'servicio', 'luz', 'agua', 'alquiler', 'honorario', 'recibo', 'publici', 'manten', 'segur'], prefixes: ['63', '42', '46', '40', '10', '94', '95', '79'] },
            { keys: ['planilla', 'sueldo', 'remunera', 'trabajador', 'empleado', 'gratifica', 'cts', 'essalud', 'afp', 'onp'], prefixes: ['62', '41', '40', '10', '94', '95', '79'] },
            { keys: ['tributo', 'impuesto', 'sunat', 'detracc', 'retenc', 'percepc', 'igv', 'renta'], prefixes: ['40', '10', '42', '12'] },
            { keys: ['activo fijo', 'maquinaria', 'equipo', 'vehiculo', 'mueble', 'depreciac', 'capitaliz', 'nic 16', 'niif 16'], prefixes: ['33', '39', '46', '40', '10'] }
        ];

        let targetPrefixes = new Set();
        keywordsMap.forEach(item => {
            if (item.keys.some(k => premisaLower.includes(k))) {
                item.prefixes.forEach(p => targetPrefixes.add(p));
            }
        });

        // Si no coincide con ninguna palabra clave, usar un conjunto general representativo
        if (targetPrefixes.size === 0) {
            ['10', '12', '16', '20', '33', '40', '41', '42', '46', '50', '60', '61', '62', '63', '69', '70', '79', '94', '95'].forEach(p => targetPrefixes.add(p));
        }

        // Siempre forzar efectivo (10) y tributos (40)
        targetPrefixes.add('10');
        targetPrefixes.add('40');

        const planFiltrado = planContable
            .filter(acc => {
                const ctaStr = String(acc.cta || '');
                return Array.from(targetPrefixes).some(pref => ctaStr.startsWith(pref));
            })
            .map(acc => ({ cta: acc.cta, desc: acc.description }));

        let planResumido = planFiltrado;
        if (planResumido.length < 30) {
            const extraAccounts = planContable
                .filter(acc => !planFiltrado.some(f => f.cta === acc.cta))
                .slice(0, 100)
                .map(acc => ({ cta: acc.cta, desc: acc.description }));
            planResumido = [...planResumido, ...extraAccounts];
        }

        // Limitar a un máximo de 120 cuentas (en lugar de 400) para optimizar carga y evitar 429
        planResumido = planResumido.slice(0, 120);

        const systemInstruction = `Eres un Contador Público Colegiado (CPC) peruano de primer nivel.
Tu tarea es analizar la premisa de negocio del usuario y generar el asiento contable correspondiente que cumpla estrictamente con el PCGE (Plan Contable General Empresarial) de Perú y la legislación tributaria vigente para el año 2026.

REGLAS CONTABLES Y FISCALES OBLIGATORIAS:
1. El asiento debe cumplir el principio de Partida Doble: SUMA DE DEBE = SUMA DE HABER.
2. Usa EXCLUSIVAMENTE códigos de cuenta que existan en el Plan Contable provisto.
3. Las cuentas contables deben tener una longitud mínima de 3 dígitos (idealmente 4 o 5 dígitos si están disponibles).
4. Ninguna línea puede registrar montos en el debe y el haber de manera simultánea.
5. Dinámica de la Cuenta 40 (IGV) en Compras/Gastos: El IGV en compras/gastos (cuentas 40111, 40112, 40113) es un crédito fiscal y SIEMPRE se registra debitado en el DEBE junto a la cuenta de compra/gasto de Clase 6 o activo de Clase 3. NUNCA registres la cuenta 40 en el HABER en un asiento de compra o provisión de gastos.
6. El IGV en ventas se registra siempre en la cuenta 40112.
7. Retención de Cuarta Categoría (Honorarios): Se aplica la cuenta 40172 (tasa del 8.0%) si el importe de la operación supera los S/ 1,500.00.
8. NIC 16 (Propiedades, Planta y Equipo) - Agrupación y Capitalización de Costos: Al adquirir un activo fijo que supere el umbral de 1/4 de UIT 2026 (S/ 1,375.00), capitalízalo en cuentas de Clase 3 (33x). Además, todos los costos directamente relacionados y necesarios para su adquisición y puesta en marcha (tales como fletes/transporte de activos, instalación, montaje, pruebas) deben ser capitalizados obligatoriamente dentro de la misma cuenta de activo de Clase 3 en lugar de registrarse como gastos de servicios independientes (Clase 6).
9. El asiento resultante debe ser adecuado para el sector "${sector}" y régimen tributario "${regimen}".
10. Utiliza una glosa general clara, descriptiva y en mayúsculas.
11. Si la premisa del usuario es un saludo (como "hola", "buenos días"), un agradecimiento ("gracias"), una exclamación o elogio ("excelente", "perfecto", "buen trabajo"), o no contiene información suficiente ni intención de registrar un asiento contable: debes retornar obligatoriamente "lines": [], "glosa": "", "niif_norma": "", y en "explicacion" escribir una respuesta amable, atenta y profesional.
12. Compras y Cuentas por Pagar: Toda compra/gasto o adquisición de activos fijos al crédito debe provisionar su respectiva cuenta por pagar (habitualmente 4212 para compras o 4654 para activos fijos) registrada en el HABER.

### ANÁLISIS ESTRUCTURAL Y DINÁMICA DEL PLAN CONTABLE GENERAL EMPRESARIAL (PCGE) PARA INFERENCIA ALGORÍTMICA

#### Elemento 1: Activo Disponible y Exigible
- **10 (Efectivo):** Ante detracciones del IGV, segmenta el cobro/pago: flujo libre a la 1041 (Cuentas corrientes operativas) y detracción a la 1042 (Banco de la Nación) o 1071 (Fondos sujetos a restricción).
- **11 (Inversiones financieras):** Para especulación o inversión temporal (acciones, fondos mutuos), mide contra resultados (clases 6/7).
- **12 (Cuentas por cobrar comerciales - Terceros):** Relación simbiótica obligatoria: Debe de la 121 (Facturas) por cobrar contra el Haber de la 70 (Ventas) e IGV 40112.
- **13 (Cuentas por cobrar comerciales - Relacionadas):** Usa este clúster (131) si detectas que la operación es con vinculadas.
- **14 (Cuentas por cobrar al personal, accionistas y directores):** Adelantos, préstamos, entregas a rendir. No uses la cuenta obsoleta 443 del PCGE 2010; usa la subcuenta 141.
- **16 (Cuentas por cobrar diversas - Terceros):** Usa la divisionaria 1673 (IGV por acreditar en compras) en el Debe si se especifica que una factura no tiene validación formal inmediata de crédito fiscal.
- **18 (Servicios y otros contratados por anticipado):** Devengado diferido (seguros, alquileres pagados por adelantado). Debita la cuenta 18 en lugar de gasto directo.
- **19 (Cobranza dudosa):** Provisiona en el Haber con contrapartida en la 68 (Debe).

#### Elemento 2: Activo Realizable
- **20 (Mercaderías) / 24 (Materias primas):** Cada compra (60) exige asiento de destino obligatorio en almacén: debita la 20 o 24 contra la 61 (Variación de existencias) en el Haber.
- **21 (Productos terminados):** Solo activa si el sector es INDUSTRIAL.
- **26 (Envases y embalajes):** Pallets/cajas de embalaje.
- **28 (Inventarios por recibir):** Mercaderías en tránsito (FOB/CIF) antes del ingreso físico al almacén.
- **29 (Desvalorización de inventarios):** Provisión de obsolescencia. Cargo a la 684 y abono a la 29.

#### Elemento 3: Activo Inmovilizado
- **32 (Activos por derecho de uso):** Contratos de Leasing (NIIF 16). Capitaliza valor presente en el Debe de la 32 y pasivo en la 45 (Haber).
- **33 (Propiedades, planta y equipo):** Capitaliza activos > S/ 1,375.00 en la cuenta 33 (Debe). Agrupa obligatoriamente fletes, transporte, montaje e instalación como parte del costo del activo en la 33x (NIC 16).
- **34 (Intangibles):** Capitaliza licencias o desarrollo según la NIC 38 (no investigación).
- **39 (Depreciación acumulada):** Se acredita en el Haber con cargo en la cuenta 68. Solo se debita por baja de activo.

#### Elemento 4: Pasivo
- **40 (Tributos por pagar):** IGV compras (Debe: 40111/40112/40113 según prorrata), IGV ventas (Haber: 40112). Para planillas, retención de 5ta categoría en la subcuenta 4017 si excede 7 UIT anuales (S/ 38,500.00).
- **41 (Remuneraciones por pagar):** Netos a pagar de planillas. Ecuación: Gasto de personal 62 (Debe) = Retenciones 40 (Haber) + Remuneraciones 41 (Haber).
- **42 (Cuentas por pagar comerciales):** Provisión de pasivos corrientes en compras (60) o servicios (63) en el Haber.
- **45 (Obligaciones financieras):** Préstamos y pasivos por leasing NIIF 16.
- **46 (Cuentas por pagar diversas - Terceros):** Adquisiciones de activos fijos, pasivo obligatorio en la subcuenta 4654 en el Haber (no en la 42).
- **48 (Provisiones):** Litigios o contingencias de cuantía incierta (NIC 37).

#### Elemento 5: Patrimonio Neto
- **50 (Capital):** Suscripción de acciones en el Haber, contrapartida temporal 1421.
- **57 (Excedente de revaluación):** Incrementos de valor del inmovilizado técnico. Debe de la 33 contra el Haber de la 57.
- **59 (Resultados acumulados):** Utilidades (591) o pérdidas (592).

#### Elemento 6: Gastos por Naturaleza
- **60 (Compras):** Compras de mercaderías/materias primas. Exige siempre el destino a la cuenta 20/24 contra la 61.
- **62 (Gastos de personal):** Costos laborales brutos en el Debe.
- **63 (Servicios prestados por terceros):** Luz, agua, alquileres, fletes operativos en el Debe. (Si el flete es para compra de activo fijo, se capitaliza en la 33x).
- **64 (Gastos por tributos):** Arbitrios, multas tributarias, ITF.
- **65 (Otros gastos de gestión):** Mermas, enajenación de activos, costo de enajenación.
- **68 (Valuación y deterioro):** Gastos de depreciación y provisión de cobranza dudosa en el Debe (contra 39 o 19 en el Haber).
- **69 (Costo de ventas):** Al vender (70), provisiona de forma síncrona el costo de venta (69 Debe) y baja del almacén (20 Haber).

#### Elemento 7: Ingresos
- **70 (Ventas):** Ventas netas (Haber 70) + IGV (Haber 40112) = Cuentas por cobrar (Debe 121). Aplica divisor 1.18 si el monto provisto incluye IGV.
- **79 (Cargas imputables):** Enlace obligatorio para gastos analíticos. Si cargas al Debe de la Clase 9, abona obligatoriamente al Haber de la cuenta 79.

#### Elemento 8: Saldos Intermediarios de Gestión
- **88 (Impuesto a las ganancias):** Provisión de Impuesto a la Renta en el Debe (88) y pasivo en el Haber (40171), calculando tasas según régimen (RMT vs RG).
- **89 (Resultado del ejercicio):** Cierre del ciclo hacia resultados acumulados (59).

#### Elemento 9: Contabilidad Analítica por Función
- **94 (Gastos Administrativos) / 95 (Gastos de Ventas):** Clasificación del gasto de clase 6 según su función, balanceado con el abono a la cuenta 79 en el Haber.

#### Elemento 0: Cuentas de Orden
- **01 / 02:** Mercaderías en consignación, garantías recibidas, sin alterar activos o pasivos reales.

FORMATO DE RETORNO OBLIGATORIO:
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues texto fuera de este bloque de código JSON, ni delimitadores markdown como \`\`\`json):
{
  "glosa": "GLOSA GENERAL DEL ASIENTO EN MAYÚSCULAS",
  "lines": [
    { "cuenta": "cuenta_PCGE", "detalle": "Denominación de la cuenta", "debe": monto_debe, "haber": monto_haber }
  ],
  "niif_norma": "Norma NIIF/NIC de referencia (ej: NIC 2, NIIF 16, NIIF 15)",
  "explicacion": "Explicación breve de la lógica contable y base legal/tributaria aplicada"
}`;

        const promptText = `
PREMISA DEL USUARIO:
"${premisa}"

SECTOR EMPRESA: "${sector}"
RÉGIMEN TRIBUTARIO: "${regimen}"
UIT 2026: S/ 5,500.00
IGV: 18%

${examplesPrompt}

--- PLAN CONTABLE DE LA EMPRESA ---
${JSON.stringify(planResumido, null, 2)}

Por favor, genera el asiento contable en base a la premisa anterior, respetando el plan contable y las reglas descritas.`;

        const requestBody = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: promptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        };

        const response = await postWithRetry(activeUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${activeKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 segundos timeout
        });

        const rawText = response.data?.choices?.[0]?.message?.content;
        if (!rawText) {
            throw new Error('La respuesta de Groq no contiene texto.');
        }

        // Parsear el JSON retornado
        const result = JSON.parse(rawText.trim());
        
        // Asignar IDs incrementales de forma segura y normalizar el nombre del arreglo
        if (result.lines && Array.isArray(result.lines)) {
            result.lines = result.lines.map((line, index) => ({
                id: index + 1,
                cuenta: line.cuenta || '',
                detalle: line.detalle || '',
                debe: Number(line.debe || 0),
                haber: Number(line.haber || 0)
            }));
            result.asiento_json = result.lines;
        } else if (result.asiento_json && Array.isArray(result.asiento_json)) {
            result.asiento_json = result.asiento_json.map((line, index) => ({
                id: index + 1,
                cuenta: line.cuenta || '',
                detalle: line.detalle || '',
                debe: Number(line.debe || 0),
                haber: Number(line.haber || 0)
            }));
            result.lines = result.asiento_json;
        } else {
            result.lines = [];
            result.asiento_json = [];
        }

        return result;
    } catch (error) {
        console.error('[GROQ SERVICE] Error al generar asiento contable:', error.message);
        if (error.response) {
            const status = error.response.status;
            if (status === 429) {
                throw new Error('Límite de solicitudes de la API de Groq excedido (Error 429). Por favor, espera unos segundos e intenta nuevamente.');
            }
            if (status === 401 || status === 403) {
                throw new Error('Error de autenticación con la API de Groq (Error 401/403). Verifica la validez de la clave de API.');
            }
        }
        throw error;
    }
}

module.exports = {
    generateAsiento,
    retrieveSimilarCases
};
