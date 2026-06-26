/**
 * Script de Importación a PostgreSQL
 * 
 * Lee los datos exportados de SQLite e importa a PostgreSQL
 * 
 * REQUISITOS:
 * - npm install pg
 * - Tener DATABASE_URL configurado
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../migration-output/sqlite_export.json');

// Verificar que existe el archivo de datos
if (!fs.existsSync(DATA_PATH)) {
    console.error('❌ Error: No se encontró el archivo de exportación');
    console.error('   Ejecuta primero: node scripts/migrate-to-postgres.js');
    process.exit(1);
}

// Conectar a PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Error: Variable DATABASE_URL no configurada');
    console.error('   Ejemplo: DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

console.log('🔄 Iniciando importación a PostgreSQL...');
console.log(`📂 Archivo de datos: ${DATA_PATH}`);

async function importData() {
    const client = await pool.connect();
    
    try {
        // Leer datos exportados
        const exportData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        const tables = Object.keys(exportData);
        
        console.log(`📊 Tablas a importar: ${tables.length}\n`);
        
        // Deshabilitar triggers y constraints temporalmente
        await client.query('SET session_replication_role = replica;');
        
        let totalImported = 0;
        
        for (const tableName of tables) {
            const tableData = exportData[tableName];
            const rows = tableData.rows;
            
            if (rows.length === 0) {
                console.log(`⏭️  ${tableName}: Sin datos, omitiendo`);
                continue;
            }
            
            console.log(`📋 Importando ${tableName}...`);
            
            try {
                // Obtener nombres de columnas
                const columns = Object.keys(rows[0]);
                const columnList = columns.join(', ');
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                
                // Preparar query
                const insertQuery = `
                    INSERT INTO ${tableName} (${columnList})
                    VALUES (${placeholders})
                    ON CONFLICT DO NOTHING
                `;
                
                // Insertar en lotes de 100
                const BATCH_SIZE = 100;
                let imported = 0;
                
                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                    const batch = rows.slice(i, i + BATCH_SIZE);
                    
                    await client.query('BEGIN');
                    
                    for (const row of batch) {
                        const values = columns.map(col => row[col]);
                        await client.query(insertQuery, values);
                        imported++;
                    }
                    
                    await client.query('COMMIT');
                    
                    process.stdout.write(`\r   Progreso: ${imported}/${rows.length} (${Math.round(imported/rows.length*100)}%)`);
                }
                
                console.log(`\n   ✅ ${imported} registros importados`);
                totalImported += imported;
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`\n   ❌ Error en ${tableName}:`, error.message);
            }
        }
        
        // Restaurar triggers y constraints
        await client.query('SET session_replication_role = DEFAULT;');
        
        // Actualizar secuencias
        console.log('\n🔢 Actualizando secuencias...');
        
        for (const tableName of tables) {
            try {
                await client.query(`
                    SELECT setval(
                        pg_get_serial_sequence('${tableName}', 'id'),
                        COALESCE((SELECT MAX(id) FROM ${tableName}), 1)
                    )
                `);
            } catch (e) {
                // Ignorar si la tabla no tiene columna id
            }
        }
        
        console.log('\n✅ Importación completada!');
        console.log(`📊 Total de registros importados: ${totalImported}`);
        
        // Verificar integridad
        console.log('\n🔍 Verificando integridad...');
        
        for (const tableName of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
            const pgCount = parseInt(result.rows[0].count);
            const sqliteCount = exportData[tableName].rows.length;
            
            if (pgCount === sqliteCount) {
                console.log(`   ✅ ${tableName}: ${pgCount} registros (OK)`);
            } else {
                console.log(`   ⚠️  ${tableName}: PostgreSQL=${pgCount}, SQLite=${sqliteCount} (DIFERENCIA)`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error durante la importación:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Ejecutar importación
importData()
    .then(() => {
        console.log('\n✅ Proceso completado exitosamente');
        pool.end();
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        pool.end();
        process.exit(1);
    });
