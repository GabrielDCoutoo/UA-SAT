// backend/data-integration/tinygs-stations-scraper.js
// Script Playwright para extrair coordenadas das stations do mapa TinyGS

const { chromium } = require('playwright');

class TinyGSStationsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('[Stations Scraper] Launching browser...');
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });

    this.page = await this.browser.newPage({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    console.log('[Stations Scraper] ✅ Browser launched');
  }

  async scrapeStations() {
    try {
      console.log('[Stations Scraper] Navigating to TinyGS stations map...');
      
      // Navegar para página de stations
      await this.page.goto('https://tinygs.com/stations', {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      console.log('[Stations Scraper] ✅ Page loaded');
      
      // Aguardar mapa carregar (esperar elemento do mapa Leaflet)
      await this.page.waitForSelector('.leaflet-container', { timeout: 30000 });
      console.log('[Stations Scraper] ✅ Map container found');

      // Aguardar markers aparecerem
      await this.page.waitForTimeout(5000);

      // Extrair dados das stations do JavaScript do mapa
      const stations = await this.page.evaluate(() => {
        const stationsData = [];
        
        // Tentar extrair do objeto global (se existir)
        if (window.stations) {
          return window.stations;
        }
        
        // Alternativa: extrair dos markers Leaflet
        const markers = document.querySelectorAll('.leaflet-marker-icon');
        
        markers.forEach((marker, index) => {
          // Extrair coordenadas do transform CSS
          const transform = marker.style.transform;
          const match = transform.match(/translate3d\((-?\d+)px,\s*(-?\d+)px,\s*0px\)/);
          
          if (match) {
            const x = parseInt(match[1]);
            const y = parseInt(match[2]);
            
            // Tentar encontrar popup associado
            const popup = marker.nextElementSibling;
            let stationName = `Station_${index}`;
            
            if (popup && popup.classList.contains('leaflet-popup')) {
              const content = popup.textContent;
              const nameMatch = content.match(/Station:\s*(.+)/);
              if (nameMatch) {
                stationName = nameMatch[1].trim();
              }
            }
            
            stationsData.push({
              id: `marker_${index}`,
              name: stationName,
              pixelX: x,
              pixelY: y
            });
          }
        });
        
        return stationsData;
      });

      console.log(`[Stations Scraper] Found ${stations.length} markers`);

      // Se não conseguiu extrair dados, tentar API interna
      if (stations.length === 0) {
        console.log('[Stations Scraper] Trying API interception...');
        
        const stationsFromAPI = await this.interceptStationsAPI();
        return stationsFromAPI;
      }

      return stations;

    } catch (error) {
      console.error('[Stations Scraper] Error:', error.message);
      throw error;
    }
  }

  async interceptStationsAPI() {
    const stationsData = [];
    
    // Interceptar chamadas API
    this.page.on('response', async (response) => {
      try {
        const url = response.url();
        
        // Procurar endpoint de stations
        if ((url.includes('api.tinygs.com') || url.includes('tinygs.com')) && 
            (url.includes('stations') || url.includes('station'))) {
          
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            console.log(`[Stations Scraper] 📡 Intercepted API: ${url}`);
            
            // Processar dados conforme estrutura
            if (Array.isArray(data)) {
              data.forEach(station => {
                if (station.location || (station.lat && station.lng)) {
                  stationsData.push({
                    id: station.id || station.station_id || station.name,
                    name: station.name || station.station_name,
                    lat: station.location?.lat || station.lat,
                    lng: station.location?.lng || station.lng || station.lon,
                    status: station.status || 'unknown',
                    lastSeen: station.last_seen || station.lastSeen
                  });
                }
              });
            } else if (data.stations && Array.isArray(data.stations)) {
              data.stations.forEach(station => {
                if (station.location || (station.lat && station.lng)) {
                  stationsData.push({
                    id: station.id || station.station_id || station.name,
                    name: station.name || station.station_name,
                    lat: station.location?.lat || station.lat,
                    lng: station.location?.lng || station.lng || station.lon,
                    status: station.status || 'unknown',
                    lastSeen: station.last_seen || station.lastSeen
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    });

    // Recarregar página para capturar API calls
    await this.page.reload({ waitUntil: 'networkidle', timeout: 60000 });
    await this.page.waitForTimeout(10000); // Aguardar todas as chamadas API

    return stationsData;
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    console.log('[Stations Scraper] Browser closed');
  }

  async run() {
    try {
      await this.initialize();
      const stations = await this.scrapeStations();
      await this.close();
      return stations;
    } catch (error) {
      await this.close();
      throw error;
    }
  }
}

// ============================================
// TESTE STANDALONE
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS Stations Scraper\n');

  (async () => {
    const scraper = new TinyGSStationsScraper();
    
    try {
      const stations = await scraper.run();
      
      console.log(`\n✅ Scraped ${stations.length} stations!\n`);
      
      // Mostrar primeiros 5
      stations.slice(0, 5).forEach((station, idx) => {
        console.log(`${idx + 1}. ${station.name}`);
        console.log(`   ID: ${station.id}`);
        if (station.lat && station.lng) {
          console.log(`   Location: ${station.lat.toFixed(4)}, ${station.lng.toFixed(4)}`);
        }
        if (station.status) {
          console.log(`   Status: ${station.status}`);
        }
        console.log('');
      });
      
      // Guardar em ficheiro JSON
      const fs = require('fs');
      fs.writeFileSync('tinygs-stations.json', JSON.stringify(stations, null, 2));
      console.log('💾 Saved to tinygs-stations.json');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TinyGSStationsScraper;
