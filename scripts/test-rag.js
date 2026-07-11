/**
 * Script de prueba para validar la búsqueda semántica y recuperación RAG
 */
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const geminiService = require('../server/geminiService');

async function testQuery(query) {
    console.log(`\n=============================================================`);
    console.log(`🔍 PROBANDO CONSULTA: "${query}"`);
    console.log(`=============================================================`);
    
    const sector = 'COMERCIAL';
    const regimen = 'RG';
    
    const start = Date.now();
    const result = await geminiService.retrieveSimilarCases(query, sector, regimen);
    const duration = Date.now() - start;
    
    console.log(`⏱️  Búsqueda completada en ${duration}ms\n`);
    
    console.log(`🟢 [CASOS PRÁCTICOS DE REFERENCIA RETORNADOS]: ${result.cases.length}`);
    result.cases.forEach((c, idx) => {
        const sim = c.similarity ? ` [${(c.similarity * 100).toFixed(1)}%]` : '';
        console.log(`   ${idx + 1}.${sim} Título: "${c.titulo}"`);
        console.log(`      Premisa: "${c.premisa.substring(0, 100)}..."`);
        console.log(`      Glosa: "${c.glosa}"`);
    });
    
    console.log(`\n🔵 [LEY/NORMATIVA/REGLA DE REFERENCIA RETORNADA]: ${result.regs.length}`);
    result.regs.forEach((r, idx) => {
        const sim = r.similarity ? ` [${(r.similarity * 100).toFixed(1)}%]` : '';
        console.log(`   ${idx + 1}.${sim} Tipo: ${r.tipo} | Título: "${r.titulo}"`);
        console.log(`      Contenido: "${(r.contenido || r.premisa || '').substring(0, 100)}..."`);
    });
}

async function run() {
    try {
        console.log("Iniciando prueba de búsqueda semántica con umbral corregido de 0.20...");
        
        // Prueba 1: Consulta sobre anticipos de clientes
        await testQuery("recibimos un adelanto de un cliente por venta futura");
        
        // Prueba 2: Consulta sobre depreciación o activos fijos
        await testQuery("adquirimos una laptop para la oficina de administración que cuesta 2000 soles");
        
        // Prueba 3: Consulta sobre detracciones
        await testQuery("pago del spot detracción del 12% del servicio de transporte");
        
        process.exit(0);
    } catch (error) {
        console.error("Error en el script de prueba:", error);
        process.exit(1);
    }
}

run();
