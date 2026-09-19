// tinygs-scraper.js - Last resort: scrape the website
const axios = require('axios');
const cheerio = require('cheerio'); // npm install cheerio

class TinyGSScraper {
  constructor() {
    this.baseUrl = 'https://tinygs.com';
    this.lastFetch = null;
  }

  /**
   * Scrape recent packets from TinyGS website
   */
  async scrapeRecentPackets() {
    try {
      console.log('🕷️  Scraping TinyGS website...');

      const response = await axios.get(`${this.baseUrl}/packets`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GroundStationBot/1.0)'
        }
      });

      const $ = cheerio.load(response.data);
      const packets = [];

      // Parse HTML structure (needs adjustment based on actual HTML)
      $('.packet-item, .packet-row, [data-packet]').each((i, elem) => {
        try {
          const satellite = $(elem).find('.satellite-name, [data-satellite]').text().trim();
          const station = $(elem).find('.station-name, [data-station]').text().trim();
          const rssi = $(elem).find('.rssi, [data-rssi]').text().trim();
          const timestamp = $(elem).find('.timestamp, time').text().trim();

          if (satellite) {
            packets.push({
              satellite,
              station: station || 'UNKNOWN',
              rssi: rssi ? parseFloat(rssi) : null,
              timestamp,
              source: 'scraper',
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          // Skip malformed packets
        }
      });

      this.lastFetch = new Date();
      console.log(`✅ Scraped ${packets.length} packets`);
      
      return packets;

    } catch (error) {
      console.error('❌ Scraping error:', error.message);
      return [];
    }
  }

  /**
   * Parse JSON from page (if embedded)
   */
  async extractEmbeddedJSON() {
    try {
      const response = await axios.get(`${this.baseUrl}/packets`, {
        timeout: 15000
      });

      // Look for embedded JSON in <script> tags
      const scriptMatches = response.data.match(/<script[^>]*>(.*?)<\/script>/gis);
      
      if (scriptMatches) {
        for (const script of scriptMatches) {
          // Look for patterns like: var packets = [...] or window.__DATA__ = {...}
          const jsonMatch = script.match(/(?:packets|data|__DATA__|window\.__INITIAL_STATE__)\s*=\s*(\[.*?\]|\{.*?\})/s);
          
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              console.log('✅ Found embedded JSON data!');
              return data;
            } catch (e) {
              continue;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ JSON extraction error:', error.message);
      return null;
    }
  }
}

// ============================================
// TESTE DO SCRAPER
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS Scraper\n');

  const scraper = new TinyGSScraper();

  (async () => {
    // Try JSON extraction first
    console.log('1️⃣  Trying embedded JSON extraction...\n');
    const jsonData = await scraper.extractEmbeddedJSON();

    if (jsonData) {
      console.log('✅ SUCCESS! Found JSON data');
      console.log('   Type:', Array.isArray(jsonData) ? 'Array' : 'Object');
      console.log('   Size:', Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length);
      console.log('   Sample:', JSON.stringify(jsonData).substring(0, 200));
    } else {
      console.log('❌ No embedded JSON found\n');
      
      // Fallback to HTML scraping
      console.log('2️⃣  Trying HTML scraping...\n');
      const packets = await scraper.scrapeRecentPackets();

      if (packets.length > 0) {
        console.log(`✅ Scraped ${packets.length} packets\n`);
        
        packets.slice(0, 3).forEach((packet, i) => {
          console.log(`Packet ${i + 1}:`);
          console.log(`  Satellite: ${packet.satellite}`);
          console.log(`  Station: ${packet.station}`);
          console.log(`  RSSI: ${packet.rssi || 'N/A'} dBm`);
          console.log('');
        });
      } else {
        console.log('❌ Scraping failed - HTML structure may have changed');
      }
    }
  })();
}

module.exports = TinyGSScraper;