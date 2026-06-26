/**
 * Script para limpiar y recrear el schema de PostgreSQL
 * ADVERTENCIA: Esto eliminará TODAS las tablas y datos
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no configurado');
    console.error('   Ejecuta: railway run node scripts/clean-postgres.js');
    process.exit(1);
}

console.log('🔄 Conectando a PostgreSQL...');

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('✅ Conectado a PostgreSQL');
        console.log('⚠️  ADVERTENCIA: Se eliminarán TODAS las tablas');
        console.log('⏳ Esperando 5 segundos... (Ctrl+C para cancelar)');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('\n🔧 Eliminando tablas existentes...');
        
        // Obtener lista de tablas
        const result = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        `);
        
        console.log(`📊 Encontradas ${result.rows.length} tablas`);
        
        // Eliminar cada tabla
        for (const row of result.rows) {
            console.log(`   🗑️  Eliminando: ${row.tablename}`);
            await client.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
        }
        
        console.log('\n✅ Base de datos limpiada');
        console.log('\n📝 Próximo paso: Reiniciar el servidor para que recree el schema');
        
    } catch (error) {
        console.error('\n❌ Error al limpiar base de datos:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
cleanDatabase()
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });
