/**
 * Script de Carga Masiva (Seeding) de Conocimiento para la IA
 * Lee los archivos JSON por capas, genera embeddings locales y los inserta en PostgreSQL.
 */

const path = require('path');
const fs = require('fs');

// Cargar variables de entorno desde el archivo .env en la raíz
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES 
    ? require('../server/databasePostgres')
    : require('../server/databaseServer');
const embeddingService = require('../server/embeddingService');

// Configuración de capas y archivos correspondientes
const KNOWLEDGE_LAYERS = [
    { file: 'casos_practicos.json', tipo: 'CASO_PRACTICO' },
    { file: 'normas_niif_nic.json', tipo: 'NORMA_NIIF' },
    { file: 'leyes_tributarias.json', tipo: 'LEY_TRIBUTARIA' },
    { file: 'resoluciones_sunat.json', tipo: 'RESOLUCION_SUNAT' },
    { file: 'terminologia_contable.json', tipo: 'TERMINOLOGIA' },
    { file: 'reglas_operativas.json', tipo: 'REGLA_OPERATIVA' }
];

/**
 * Retorna el texto óptimo a ser vectorizado para búsqueda semántica.
 */
function getEmbeddableText(item) {
    const titulo = item.titulo || '';
    const tags = item.tags || '';
    
    switch (item.tipo) {
        case 'CASO_PRACTICO':
            return `${titulo}: ${item.premisa || ''} ${item.explicacion || ''} (Tags: ${tags})`;
            
        case 'NORMA_NIIF':
        case 'LEY_TRIBUTARIA':
        case 'RESOLUCION_SUNAT':
            return `${titulo}: ${item.contenido || ''} ${item.aplicacion_peru || ''} (Tags: ${tags})`;
            
        case 'TERMINOLOGIA':
        case 'REGLA_OPERATIVA':
            return `${titulo}: ${item.contenido || ''} (Tags: ${tags})`;
            
        default:
            return `${titulo}: ${item.contenido || item.premisa || ''} (Tags: ${tags})`;
    }
}

async function run() {
    console.log("=============================================================");
    console.log("🚀 INICIANDO SEMBRADO DE CONOCIMIENTO MULTI-CAPA PARA IA");
    console.log("=============================================================");

    try {
        // 1. Inicializar modelo de embeddings
        console.log("⏳ Inicializando modelo de embeddings locales...");
        await embeddingService.init();
        console.log("✅ Modelo de embeddings listo.");

        // 2. Procesar cada archivo JSON de capa
        const knowledgeDir = path.join(__dirname, '../server/knowledge');
        let totalCargados = 0;

        for (const layer of KNOWLEDGE_LAYERS) {
            const filePath = path.join(knowledgeDir, layer.file);
            console.log(`\n📂 Procesando capa: ${layer.tipo} (${layer.file})...`);

            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Archivo no encontrado: ${filePath}. Omitiendo.`);
                continue;
            }

            const rawData = fs.readFileSync(filePath, 'utf8');
            const dataObj = JSON.parse(rawData);
            const items = dataObj.cases || [];

            console.log(`   Encontrados ${items.length} elementos para importar.`);

            for (const item of items) {
                // Forzar el tipo correcto según la capa
                item.tipo = layer.tipo;

                // Generar texto para vectorizar
                const textToEmbed = getEmbeddableText(item);
                
                console.log(`   ⚡ Generando embedding para [${item.id}]: "${item.titulo}"...`);
                const embedding = await embeddingService.generateEmbedding(textToEmbed);

                if (!embedding) {
                    console.error(`   ❌ Error al generar embedding para ${item.id}. Se saltará este elemento.`);
                    continue;
                }

                // Guardar en base de datos con el embedding generado
                const dbItem = {
                    ...item,
                    embedding: embedding
                };

                const res = await db.saveAIKnowledge(dbItem);
                if (res.success) {
                    totalCargados++;
                } else {
                    console.error(`   ❌ Error al guardar en BD: ${res.error}`);
                }
            }
        }

        console.log("\n=============================================================");
        console.log(`✅ SEMBRADO COMPLETADO EXITOSAMENTE`);
        console.log(`   Total de registros cargados en PostgreSQL: ${totalCargados}`);
        console.log("=============================================================");
        
        // Finalizar el pool de conexiones para que el script termine limpiamente
        if (USE_POSTGRES && db.pool) {
            await db.pool.end();
        }
        process.exit(0);

    } catch (error) {
        console.error("\n❌ ERROR CRÍTICO DURANTE EL SEMBRADO:", error);
        process.exit(1);
    }
}

run();
