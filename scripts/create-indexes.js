/**
 * Script para crear índices optimizados en PostgreSQL
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const INDEXES_FILE = path.join(__dirname, '../migration-output/create_indexes.sql');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no configurado');
    console.error('   Ejecuta: railway run node scripts/create-indexes.js');
    process.exit(1);
}

console.log('🔄 Conectando a PostgreSQL...');

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createIndexes() {
    const client = await pool.connect();
    
    try {
        console.log('✅ Conectado a PostgreSQL');
        console.log('📂 Leyendo archivo de índices...');
        
        const sql = fs.readFileSync(INDEXES_FILE, 'utf8');
        
        console.log('🔧 Creando índices optimizados...');
        console.log('   (Esto puede tardar 2-3 minutos)\n');
        
        // Ejecutar el SQL de índices
        await client.query(sql);
        
        console.log('\n✅ Índices creados exitosamente!');
        console.log('\n📊 Verificando índices...');
        
        // Verificar índices
        const result = await client.query(`
            SELECT 
                schemaname,
                tablename,
                indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);
        
        console.log(`\n✅ ${result.rows.length} índices creados\n`);
        
        // Agrupar por tabla
        const byTable = {};
        result.rows.forEach(row => {
            if (!byTable[row.tablename]) byTable[row.tablename] = [];
            byTable[row.tablename].push(row.indexname);
        });
        
        Object.keys(byTable).sort().forEach(table => {
            console.log(`   📋 ${table}: ${byTable[table].length} índices`);
        });
        
    } catch (error) {
        console.error('\n❌ Error al crear índices:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
createIndexes()
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
