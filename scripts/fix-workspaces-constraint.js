const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

async function fixWorkspacesConstraint() {
    console.log('🔄 Conectando a PostgreSQL...');
    
    try {
        // Verificar conexión
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL');
        
        // Agregar constraint UNIQUE a workspaces
        console.log('🔧 Agregando constraint UNIQUE (ruc, user_id) a workspaces...');
        
        await pool.query(`
            ALTER TABLE workspaces 
            ADD CONSTRAINT workspaces_ruc_user_id_unique 
            UNIQUE (ruc, user_id);
        `);
        
        console.log('✅ Constraint agregada exitosamente');
        
    } catch (error) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
            console.log('ℹ️  Constraint ya existe, saltando...');
        } else {
            console.error('❌ Error:', error.message);
            throw error;
        }
    } finally {
        await pool.end();
        console.log('✅ Conexión cerrada');
    }
}

fixWorkspacesConstraint().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
