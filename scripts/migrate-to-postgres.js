/**
 * Script de Migración SQLite → PostgreSQL
 * 
 * Exporta todos los datos de SQLite y los prepara para PostgreSQL
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, '../database/pld_contable.db');
const OUTPUT_DIR = path.join(__dirname, '../migration-output');

// Crear directorio de salida
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔄 Iniciando migración SQLite → PostgreSQL...');
console.log(`📂 Base de datos: ${SQLITE_PATH}`);

// Conectar a SQLite
const db = new Database(SQLITE_PATH, { readonly: true });

// Obtener lista de tablas
const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`).all();

console.log(`📊 Tablas encontradas: ${tables.length}`);

const exportData = {};
const stats = {};

// Exportar cada tabla
for (const { name } of tables) {
    try {
        console.log(`\n📋 Exportando tabla: ${name}`);
        
        // Obtener estructura
        const columns = db.prepare(`PRAGMA table_info(${name})`).all();
        
        // Obtener datos
        const rows = db.prepare(`SELECT * FROM ${name}`).all();
        
        exportData[name] = {
            columns: columns,
            rows: rows
        };
        
        stats[name] = {
            columns: columns.length,
            rows: rows.length
        };
        
        console.log(`   ✅ ${rows.length} registros exportados (${columns.length} columnas)`);
    } catch (error) {
        console.error(`   ❌ Error en tabla ${name}:`, error.message);
    }
}

// Guardar datos en JSON
const dataPath = path.join(OUTPUT_DIR, 'sqlite_export.json');
fs.writeFileSync(dataPath, JSON.stringify(exportData, null, 2));

console.log(`\n✅ Datos exportados a: ${dataPath}`);

// Generar SQL para PostgreSQL
console.log('\n🔧 Generando schema PostgreSQL...');

let sqlSchema = `-- Schema PostgreSQL generado desde SQLite
-- Fecha: ${new Date().toISOString()}
-- Base de datos original: pld_contable.db

`;

for (const { name } of tables) {
    const tableData = exportData[name];
    
    sqlSchema += `\n-- Tabla: ${name}\n`;
    sqlSchema += `DROP TABLE IF EXISTS ${name} CASCADE;\n`;
    sqlSchema += `CREATE TABLE ${name} (\n`;
    
    const columnDefs = tableData.columns.map(col => {
        let pgType = sqliteToPgType(col.type);
        let nullable = col.notnull === 0 ? 'NULL' : 'NOT NULL';
        let defaultVal = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
        
        return `    ${col.name} ${pgType} ${nullable} ${defaultVal}`.trim();
    });
    
    sqlSchema += columnDefs.join(',\n');
    sqlSchema += `\n);\n\n`;
    
    // Agregar índices si existen
    try {
        const indexes = db.prepare(`PRAGMA index_list(${name})`).all();
        for (const idx of indexes) {
            if (!idx.name.startsWith('sqlite_')) {
                const indexInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all();
                const columns = indexInfo.map(i => i.name).join(', ');
                const unique = idx.unique ? 'UNIQUE' : '';
                sqlSchema += `CREATE ${unique} INDEX ${idx.name} ON ${name}(${columns});\n`;
            }
        }
    } catch (e) {
        // Ignorar errores de índices
    }
    
    sqlSchema += '\n';
}

// Función helper: Convertir tipos SQLite → PostgreSQL
function sqliteToPgType(sqliteType) {
    const type = (sqliteType || '').toUpperCase();
    
    if (type.includes('INT')) return 'BIGINT';
    if (type.includes('TEXT') || type.includes('CHAR')) return 'TEXT';
    if (type.includes('REAL') || type.includes('DOUBLE') || type.includes('FLOAT')) return 'DOUBLE PRECISION';
    if (type.includes('BLOB')) return 'BYTEA';
    if (type.includes('NUMERIC') || type.includes('DECIMAL')) return 'NUMERIC';
    if (type.includes('BOOL')) return 'BOOLEAN';
    if (type.includes('DATE')) return 'DATE';
    if (type.includes('TIME')) return 'TIMESTAMP';
    
    return 'TEXT'; // Default
}

const schemaPath = path.join(OUTPUT_DIR, 'postgres_schema.sql');
fs.writeFileSync(schemaPath, sqlSchema);

console.log(`✅ Schema generado en: ${schemaPath}`);

// Generar estadísticas
console.log('\n📊 Estadísticas de migración:');
console.log('═'.repeat(60));

let totalRows = 0;
for (const [table, stat] of Object.entries(stats)) {
    console.log(`${table.padEnd(30)} ${stat.rows.toString().padStart(8)} registros`);
    totalRows += stat.rows;
}

console.log('═'.repeat(60));
console.log(`${'TOTAL'.padEnd(30)} ${totalRows.toString().padStart(8)} registros`);

// Guardar stats
const statsPath = path.join(OUTPUT_DIR, 'migration_stats.json');
fs.writeFileSync(statsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTables: tables.length,
    totalRows: totalRows,
    tables: stats
}, null, 2));

console.log(`\n📈 Estadísticas guardadas en: ${statsPath}`);

// Cerrar conexión
db.close();

console.log('\n✅ Migración completada exitosamente!');
console.log('\n📝 Próximos pasos:');
console.log('1. Crear base de datos PostgreSQL en Railway');
console.log('2. Ejecutar postgres_schema.sql en PostgreSQL');
console.log('3. Importar datos usando el script import-to-postgres.js');
