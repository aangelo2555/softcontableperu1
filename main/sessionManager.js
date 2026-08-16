const { chromium } = require('playwright');
const logger = require('./logger_web');
const config = require('./config');

class SessionManager {
  constructor() {
    this.browser = null;
    this.sessions = new Map(); // ruc -> context
  }

  async getBrowser() {
    if (!this.browser) {
      logger.info('[SESSION MANAGER] Lanzando instancia compartida de Chromium...');
      this.browser = await chromium.launch({
        headless: config.PLAYWRIGHT?.headless ?? true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1366,768'
        ]
      });
    }
    return this.browser;
  }

  async getContextForRuc(ruc) {
    if (this.sessions.has(ruc)) {
      return this.sessions.get(ruc);
    }
    return null;
  }

  async createOrUpdateContext(ruc) {
    if (this.sessions.has(ruc)) {
       return this.sessions.get(ruc);
    }

    const browser = await this.getBrowser();
    logger.info(`[SESSION MANAGER] Creando nuevo contexto de navegador para RUC: ${ruc}`);
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Connection': 'keep-alive'
      }
    });

    this.sessions.set(ruc, context);
    return context;
  }

  async closeContext(ruc) {
    if (this.sessions.has(ruc)) {
      const context = this.sessions.get(ruc);
      await context.close().catch(() => {});
      this.sessions.delete(ruc);
      logger.info(`[SESSION MANAGER] Contexto cerrado y eliminado para RUC: ${ruc}`);
    }
  }

  async closeAll() {
    for (const [ruc, context] of this.sessions.entries()) {
      await context.close().catch(() => {});
    }
    this.sessions.clear();
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    logger.info('[SESSION MANAGER] Todas las sesiones cerradas.');
  }
}

module.exports = new SessionManager();
