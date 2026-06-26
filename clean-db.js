const { Client } = require('pg');

// Obtén el DATABASE_URL de Railway
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
    console.error('❌ ERROR: Debes proporcionar DATABASE_URL');
    console.log('\nUso:');
    console.log('  node clean-db.js "postgresql://usuario:password@host:puerto/database"');
    console.log('\nObtén el DATABASE_URL desde Railway → Postgres → Variables → DATABASE_URL');
    process.exit(1);
}

async function cleanDatabase() {
    const client = new Client({ connectionString: DATABASE_URL });
    
    try {
        console.log('🔌 Conectando a PostgreSQL...');
        await client.connect();
        console.log('✅ Conectado exitosamente\n');
        
        console.log('🗑️  Eliminando schema público...');
        await client.query('DROP SCHEMA public CASCADE');
        console.log('✅ Schema eliminado\n');
        
        console.log('🏗️  Recreando schema público...');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO postgres');
        await client.query('GRANT ALL ON SCHEMA public TO public');
        console.log('✅ Schema recreado\n');
        
        console.log('🎉 ¡BASE DE DATOS LIMPIADA EXITOSAMENTE!');
        console.log('\n📝 Próximos pasos:');
        console.log('   1. Reinicia el servicio backend en Railway');
        console.log('   2. Las tablas se recrearán automáticamente con los schemas correctos');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

cleanDatabase();
