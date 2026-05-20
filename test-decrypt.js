const Database = require('better-sqlite3');
const path = require('path');
const { decrypt } = require('./server/cryptoUtils');

const dbPath = path.join(process.cwd(), 'database', 'pld_contable.db');
console.log('Ruta DB:', dbPath);

try {
    const db = new Database(dbPath);
    const rows = db.prepare('SELECT ruc, name, sol_user, sol_pass, sunatClientId, sunatClientSecret FROM workspaces').all();
    console.log(`Encontrados ${rows.length} workspaces:`);
    for (const r of rows) {
        console.log('-----------------------------');
        console.log('RUC:', r.ruc);
        console.log('Razón Social:', r.name);
        
        console.log('sol_user (raw):', r.sol_user);
        console.log('sol_user (decrypted):', decrypt(r.sol_user));
        
        console.log('sol_pass (raw):', r.sol_pass);
        console.log('sol_pass (decrypted):', decrypt(r.sol_pass));
        
        console.log('sunatClientId (raw):', r.sunatClientId);
        console.log('sunatClientId (decrypted):', decrypt(r.sunatClientId));
        
        console.log('sunatClientSecret (raw):', r.sunatClientSecret);
        console.log('sunatClientSecret (decrypted):', decrypt(r.sunatClientSecret));
    }
} catch (e) {
    console.error('Error:', e);
}
