/**
 * Servicio de Caché en Memoria
 * Reduce carga en la base de datos para consultas frecuentes
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutos por defecto
    
    // Limpiar cache expirado cada minuto
    setInterval(() => this.cleanExpired(), 60000);
  }

  /**
   * Obtener valor del cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Verificar si expiró
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Guardar valor en cache
   */
  set(key, value, customTTL = null) {
    const ttl = customTTL || this.ttl;
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  /**
   * Invalidar una clave específica
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidar todas las claves que coincidan con un patrón
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[CACHE] Limpiadas ${cleaned} entradas expiradas`);
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl_seconds: this.ttl / 1000
    };
  }
}

// Singleton
const cacheService = new CacheService();

module.exports = cacheService;
