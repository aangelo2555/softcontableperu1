/**
 * Script para crear el schema de PostgreSQL
 * Ejecuta el archivo postgres_schema.sql en Railway
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, '../migration-output/postgres_schema.sql');

// DATABASE_URL debe venir de las variables de entorno de Railway
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no configurado');
    console.error('   Ejecuta: railway run node scripts/create-schema.js');
    process.exit(1);
}

console.log('🔄 Conectando a PostgreSQL...');

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createSchema() {
    const client = await pool.connect();
    
    try {
        console.log('✅ Conectado a PostgreSQL');
        console.log('📂 Leyendo archivo de schema...');
        
        const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
        
        console.log('🔧 Ejecutando schema SQL...');
        console.log('   (Esto puede tardar 1-2 minutos)\n');
        
        // Ejecutar el SQL completo
        await client.query(sql);
        
        console.log('\n✅ Schema creado exitosamente!');
        console.log('\n📊 Verificando tablas creadas...');
        
        // Verificar tablas
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log(`\n✅ ${result.rows.length} tablas creadas:\n`);
        
        result.rows.forEach((row, i) => {
            console.log(`   ${(i + 1).toString().padStart(2, '0')}. ${row.table_name}`);
        });
        
    } catch (error) {
        console.error('\n❌ Error al crear schema:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
createSchema()
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
