// backend/data-integration/tinygs-stations-scraper-v2.js
// Scraper melhorado - foca em interceptar API calls

const { chromium } = require('playwright');

class TinyGSStationsScraperV2 {
  constructor() {
    this.browser = null;
    this.page = null;
    this.stations = [];
  }

  async initialize() {
    console.log('[Scraper V2] Launching browser...');
    
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    this.page = await this.browser.newPage({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    });

    console.log('[Scraper V2] ✅ Browser launched');
  }

  async interceptAPIStations() {
    return new Promise((resolve) => {
      let resolved = false;
      
      // Interceptar responses
      this.page.on('response', async (response) => {
        try {
          const url = response.url();
          
          // Procurar por endpoints de stations
          if (url.includes('api.tinygs.com') || url.includes('/stations')) {
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('application/json') && response.status() === 200) {
              console.log(`[Scraper V2] 📡 API intercepted: ${url}`);
              
              const data = await response.json();
              
              // Processar dados
              let extracted = [];
              
              if (Array.isArray(data)) {
                extracted = this.processStationsArray(data);
              } else if (data.stations && Array.isArray(data.stations)) {
                extracted = this.processStationsArray(data.stations);
              } else if (data.data && Array.isArray(data.data)) {
                extracted = this.processStationsArray(data.data);
              }
              
              if (extracted.length > 0) {
                this.stations = extracted;
                console.log(`[Scraper V2] ✅ Found ${extracted.length} stations from API`);
                
                if (!resolved) {
                  resolved = true;
                  resolve(extracted);
                }
              }
            }
          }
        } catch (error) {
          // Ignore parse errors
        }
      });

      // Timeout após 60 segundos
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[Scraper V2] ⚠️ Timeout - returning collected stations');
          resolve(this.stations);
        }
      }, 60000);
    });
  }

  processStationsArray(array) {
    const stations = [];
    
    array.forEach(item => {
      // Diferentes formatos possíveis
      const lat = item.location?.lat || item.lat || item.latitude;
      const lng = item.location?.lng || item.lng || item.lon || item.longitude;
      
      if (lat && lng) {
        stations.push({
          id: item.id || item.station_id || item.userId || item.name,
          name: item.name || item.station_name || item.stationName || `Station_${item.id}`,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          status: item.status || item.online ? 'online' : 'unknown',
          lastSeen: item.last_seen || item.lastSeen || item.lastPacket
        });
      }
    });
    
    return stations;
  }

  async scrapeViaStationsPage() {
    try {
      console.log('[Scraper V2] Method 1: Stations page...');
      
      const interceptPromise = this.interceptAPIStations();
      
      await this.page.goto('https://tinygs.com/stations', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      console.log('[Scraper V2] ✅ Stations page loaded');
      
      // Aguardar API calls
      const stations = await interceptPromise;
      
      return stations;
      
    } catch (error) {
      console.error('[Scraper V2] Error on stations page:', error.message);
      return [];
    }
  }

  async scrapeViaPacketsPage() {
    try {
      console.log('[Scraper V2] Method 2: Packets page...');
      
      this.stations = []; // Reset
      const interceptPromise = this.interceptAPIStations();
      
      await this.page.goto('https://tinygs.com/packets', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      console.log('[Scraper V2] ✅ Packets page loaded');
      
      const stations = await interceptPromise;
      
      return stations;
      
    } catch (error) {
      console.error('[Scraper V2] Error on packets page:', error.message);
      return [];
    }
  }

  async tryDirectAPI() {
    try {
      console.log('[Scraper V2] Method 3: Direct API call...');
      
      const response = await this.page.goto('https://api.tinygs.com/v2/stations', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (response.status() === 200) {
        const data = await response.json();
        const stations = this.processStationsArray(Array.isArray(data) ? data : data.stations || []);
        
        if (stations.length > 0) {
          console.log(`[Scraper V2] ✅ Direct API worked! Found ${stations.length} stations`);
          return stations;
        }
      }
      
    } catch (error) {
      console.log('[Scraper V2] Direct API blocked or failed');
    }
    
    return [];
  }

  async run() {
    try {
      await this.initialize();
      
      // Tentar Método 1: Página stations
      let stations = await this.scrapeViaStationsPage();
      
      if (stations.length === 0) {
        // Método 2: Página packets
        stations = await this.scrapeViaPacketsPage();
      }
      
      if (stations.length === 0) {
        // Método 3: API direta
        stations = await this.tryDirectAPI();
      }
      
      await this.close();
      
      return stations;
      
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    console.log('[Scraper V2] Browser closed');
  }
}

// ============================================
// TESTE STANDALONE
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS Stations Scraper V2\n');

  (async () => {
    const scraper = new TinyGSStationsScraperV2();
    
    try {
      const stations = await scraper.run();
      
      if (stations.length === 0) {
        console.log('\n❌ No stations found! API may have changed.');
        console.log('💡 Using fallback: loading sample stations...\n');
        
        // Fallback: carregar stations conhecidas
        const fs = require('fs');
        const fallbackPath = __dirname + '/tinygs-stations-fallback.json';
        
        if (fs.existsSync(fallbackPath)) {
          const fallbackStations = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
          console.log(`✅ Loaded ${fallbackStations.length} fallback stations`);
          
          fs.writeFileSync('tinygs-stations.json', JSON.stringify(fallbackStations, null, 2));
          console.log('💾 Saved to tinygs-stations.json');
        } else {
          console.log('⚠️  No fallback file found');
        }
        
        process.exit(1);
      }
      
      console.log(`\n✅ Scraped ${stations.length} stations!\n`);
      
      // Mostrar primeiros 5
      stations.slice(0, 5).forEach((station, idx) => {
        console.log(`${idx + 1}. ${station.name}`);
        console.log(`   ID: ${station.id}`);
        console.log(`   Location: ${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}`);
        if (station.status) console.log(`   Status: ${station.status}`);
        console.log('');
      });
      
      // Guardar JSON
      const fs = require('fs');
      fs.writeFileSync('tinygs-stations.json', JSON.stringify(stations, null, 2));
      console.log('💾 Saved to tinygs-stations.json');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TinyGSStationsScraperV2;
