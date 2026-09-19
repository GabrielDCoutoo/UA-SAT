// tinygs-playwright.js
// Cliente Playwright para TinyGS (bypassa Cloudflare!)

const { chromium } = require('playwright');
const EventEmitter = require('events');

class TinyGSPlaywrightClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pollInterval = options.pollInterval || 30000; // 30 segundos
    this.browser = null;
    this.page = null;
    this.polling = false;
    this.packetCount = 0;
    this.lastPacketId = null;
    this.errorCount = 0;
  }

  /**
   * Initialize browser and navigate to TinyGS
   */
  async initialize() {
    try {
      console.log('[TinyGS Playwright] Launching browser...');
      
      this.browser = await chromium.launch({
        headless: true,  // true = invisível
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security'
        ]
      });

      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      console.log('[TinyGS Playwright] Browser launched');

      // Interceptar requests API
      this.page.on('response', async (response) => {
        try {
          const url = response.url();
          
          // Capturar packets API
          if (url.includes('api.tinygs.com/v') && 
              url.includes('packets') && 
              response.status() === 200) {
            
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              
              if (data.packets && Array.isArray(data.packets)) {
                console.log(`[TinyGS Playwright] 📦 Intercepted ${data.packets.length} packets from API`);
                
                for (const packet of data.packets) {
                  // Verificar se é novo (evitar duplicados)
                  const packetId = packet.id || packet.serverTime;
                  
                  if (!this.lastPacketId || packetId !== this.lastPacketId) {
                    this.packetCount++;
                    this.emit('packet', packet);
                  }
                }
                
                // Atualizar último packet ID
                if (data.packets.length > 0) {
                  const lastPacket = data.packets[0];
                  this.lastPacketId = lastPacket.id || lastPacket.serverTime;
                }
              }
            }
          }
        } catch (error) {
          // Ignore parse errors (nem todas as responses são JSON)
        }
      });

      // Navegar para TinyGS packets page
      console.log('[TinyGS Playwright] Navigating to https://tinygs.com/packets...');
      
      await this.page.goto('https://tinygs.com/packets', {
        waitUntil: 'networkidle',
        timeout: 60000 // 60 segundos timeout
      });

      console.log('[TinyGS Playwright] ✅ Page loaded successfully');
      console.log('[TinyGS Playwright] ✅ Cloudflare bypassed!');

      return true;

    } catch (error) {
      console.error('[TinyGS Playwright] ❌ Initialization failed:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Start polling (refresh page periodically)
   */
  async startPolling() {
    if (this.polling) {
      console.log('[TinyGS Playwright] Already polling');
      return;
    }

    if (!this.page) {
      console.error('[TinyGS Playwright] ❌ Not initialized! Call initialize() first');
      return;
    }

    this.polling = true;
    console.log(`[TinyGS Playwright] Starting polling every ${this.pollInterval}ms`);

    const poll = async () => {
      if (!this.polling) return;

      try {
        console.log('[TinyGS Playwright] 🔄 Refreshing page...');
        
        // Reload page para obter novos packets
        await this.page.reload({ 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        console.log('[TinyGS Playwright] ✅ Page refreshed');

      } catch (error) {
        this.errorCount++;
        console.error('[TinyGS Playwright] ❌ Poll error:', error.message);
        this.emit('error', error);

        // Se muitos erros, tentar reinicializar
        if (this.errorCount > 5) {
          console.log('[TinyGS Playwright] Too many errors, reinitializing...');
          await this.stopPolling();
          await this.initialize();
          await this.startPolling();
          this.errorCount = 0;
        }
      }

      // Agendar próximo poll
      if (this.polling) {
        setTimeout(poll, this.pollInterval);
      }
    };

    // Primeiro poll imediato (página já carregada)
    setTimeout(poll, this.pollInterval);
  }

  /**
   * Stop polling and close browser
   */
  async stopPolling() {
    this.polling = false;
    
    if (this.page) {
      try {
        await this.page.close();
      } catch (error) {
        console.error('[TinyGS Playwright] Error closing page:', error.message);
      }
      this.page = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.error('[TinyGS Playwright] Error closing browser:', error.message);
      }
      this.browser = null;
    }

    console.log(`[TinyGS Playwright] Stopped (${this.packetCount} packets total)`);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      packetCount: this.packetCount,
      errorCount: this.errorCount,
      polling: this.polling,
      browserActive: this.browser !== null
    };
  }
}

// ============================================
// TESTE STANDALONE
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS Playwright Client\n');

  const client = new TinyGSPlaywrightClient({
    pollInterval: 30000 // 30 segundos
  });

  // Listen for packets
  client.on('packet', (packet) => {
    console.log(`\n📦 PACKET RECEIVED:`);
    console.log(`   Satellite: ${packet.satellite || packet.sat}`);
    console.log(`   Station: ${packet.stationName || packet.station}`);
    console.log(`   Mode: ${packet.mode}`);
    console.log(`   Frequency: ${packet.freq || packet.frequency} MHz`);
    if (packet.rssi) console.log(`   RSSI: ${packet.rssi} dBm`);
    if (packet.snr) console.log(`   SNR: ${packet.snr} dB`);
  });

  // Listen for errors
  client.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  // Initialize and start
  (async () => {
    const initialized = await client.initialize();
    
    if (initialized) {
      await client.startPolling();
      
      // Stats every 60 seconds
      setInterval(() => {
        const stats = client.getStats();
        console.log(`\n📊 Stats: ${stats.packetCount} packets | Errors: ${stats.errorCount}\n`);
      }, 60000);
    } else {
      console.error('Failed to initialize, exiting...');
      process.exit(1);
    }
  })();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await client.stopPolling();
    const stats = client.getStats();
    console.log(`📊 Final stats: ${stats.packetCount} packets received`);
    process.exit(0);
  });

  console.log('💡 Press Ctrl+C to stop\n');
}

module.exports = TinyGSPlaywrightClient;
