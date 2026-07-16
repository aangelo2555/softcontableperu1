const crypto = require('crypto');

// La clave debe venir de una variable de entorno en producción
if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_KEY) {
    throw new Error('FATAL: La variable de entorno ENCRYPTION_KEY es obligatoria en producción por motivos de seguridad.');
}
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'softcontable_secret_key_32_chars_!!'; 
const IV_LENGTH = 16;

/**
 * Cifra un texto usando AES-256-GCM
 */
function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return Buffer.from(iv.toString('hex') + ':' + authTag + ':' + encrypted);
    } catch (error) {
        console.error('[CRYPTO] Error al cifrar:', error.message);
        throw new Error('Error al cifrar datos: ' + error.message);
    }
}

/**
 * Descifra un buffer usando AES-256-GCM
 */
function decrypt(buffer) {
    if (!buffer || buffer.length === 0) return '';
    try {
        const text = buffer.toString();
        if (!text.includes(':')) return text; // Si no tiene el formato, devolver original

        const [ivHex, authTagHex, encryptedHex] = text.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.warn('[CRYPTO] Error al descifrar (posible cambio de clave o dato no cifrado):', error.message);
        return buffer.toString();
    }
}

module.exports = { encrypt, decrypt };
