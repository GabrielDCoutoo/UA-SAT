// tinygs-rest-client-FINAL.js - Cliente REST com parser correto
const axios = require('axios');
const EventEmitter = require('events');

class TinyGSRestClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.baseUrl = 'https://api.tinygs.com/v4';
    this.pollInterval = options.pollInterval || 15000; // 15 segundos
    this.lastPacketId = null;
    this.polling = false;
    this.pollTimer = null;
    this.packetCount = 0;
    this.errorCount = 0;
  }

  /**
   * Fetch recent packets from TinyGS API
   * API retorna: { packets: [...], templates: [...] }
   */
async getRecentPackets(limit = 20) {
  try {
    const url = `${this.baseUrl}/packets?limit=${limit}`;
    
    // Geração dinâmica do timestamp (O segredo do Patch)
    const now = Date.now().toString();
    const encodedTimestamp = Buffer.from(now).toString('base64');

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'sessionToken': process.env.TINYGS_SESSION_TOKEN,
        'userId': process.env.TINYGS_USER_ID,
        'x-client-timestamp': encodedTimestamp,
        'Origin': 'https://tinygs.com',
        'Referer': 'https://tinygs.com/',
        // Headers de "Fingimento" de Browser (Essenciais para evitar o Timeout)
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      }
    });

    console.log(`✅ [TinyGS] Pedido com sucesso às ${new Date().toLocaleTimeString()}`);
    return response.data?.packets || [];

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Timeout: A Cloudflare ainda te está a bloquear. Tenta reiniciar o Router ou usar VPN.');
    } else {
      console.error('❌ Erro na API:', error.response?.status || error.message);
    }
    return [];
  }
}
  /**
   * Parse TinyGS packet to normalized format
   */
  parsePacket(packet) {
    try {
      // Extract station info (pode estar em múltiplos campos)
      let stationId = null;
      let stationName = null;
      
      if (packet.stationNumber) {
        stationId = packet.stationNumber.toString();
      } else if (packet.station) {
        stationId = packet.station.toString();
      } else if (packet.groundstation) {
        stationId = packet.groundstation.toString();
      }

      // Try to get station name from ID or other fields
      if (packet.stationName) {
        stationName = packet.stationName;
      } else if (stationId) {
        stationName = `Station ${stationId}`;
      }

      // Parse timestamp
      let timestamp = new Date();
      if (packet.serverTime) {
        timestamp = new Date(packet.serverTime);
      } else if (packet.timestamp) {
        timestamp = new Date(packet.timestamp);
      }

      // Extract RSSI/SNR (pode não estar sempre presente)
      const rssi = packet.rssi !== undefined ? parseFloat(packet.rssi) : null;
      const snr = packet.snr !== undefined ? parseFloat(packet.snr) : null;

      return {
        // Identifiers
        id: packet.id,
        satellite: packet.satellite || packet.satDisplayName || 'UNKNOWN',
        norad: packet.norad || null,
        station: stationId,
        stationName: stationName,
        
        // Timestamp
        timestamp: timestamp.toISOString(),
        serverTime: packet.serverTime,
        
        // RF Parameters
        frequency: packet.freq || null,
        mode: packet.mode || null, // LoRa, FSK, etc
        rssi: rssi,
        snr: snr,
        
        // LoRa specific
        sf: packet.sf || null,
        bw: packet.bw || null,
        cr: packet.cr || null,
        
        // FSK specific
        bitrate: packet.bitrate || null,
        freqDev: packet.freqDev || null,
        rxBw: packet.rxBw || null,
        
        // Position
        satPos: packet.satPos || null, // { lat, lng, alt }
        sunLit: packet.sunLit !== undefined ? packet.sunLit : null,
        
        // Data
        raw: packet.raw || null, // Base64
        parsed: packet.parsed || null, // Telemetria parseada
        
        // Metadata
        source: 'tinygs-rest',
        receivedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[TinyGS] Error parsing packet:', error.message);
      return null;
    }
  }

  /**
   * Start polling for new packets
   */
  startPolling(callback) {
    if (this.polling) {
      console.log('[TinyGS REST] Already polling');
      return;
    }

    this.polling = true;
    console.log(`[TinyGS REST] Starting polling every ${this.pollInterval}ms`);
    console.log(`[TinyGS REST] Endpoint: ${this.baseUrl}/packets`);

    const poll = async () => {
      try {
        const packets = await this.getRecentPackets(20);

        if (packets.length > 0) {
          // Filter only NEW packets
          const newPackets = this.lastPacketId
            ? packets.filter(p => {
                // Use serverTime or id for comparison
                const packetId = p.serverTime || p.id;
                const lastId = this.lastPacketId;
                
                if (typeof packetId === 'number' && typeof lastId === 'number') {
                  return packetId > lastId;
                } else if (typeof packetId === 'string' && typeof lastId === 'string') {
                  return packetId > lastId;
                }
                
                return true; // If can't compare, consider it new
              })
            : packets;

          if (newPackets.length > 0) {
            // Update lastPacketId
            const lastPacket = packets[0];
            this.lastPacketId = lastPacket.serverTime || lastPacket.id;

            console.log(`[TinyGS REST] 📦 ${newPackets.length} new packets`);

            // Process each new packet
            for (const packet of newPackets) {
              const parsed = this.parsePacket(packet);
              
              if (parsed) {
                this.packetCount++;
                
                // Call callback
                callback(parsed);
                
                // Emit event
                this.emit('packet', parsed);
              }
            }
          }
          
        } else {
          // No packets - might be slow period
          if (this.packetCount === 0) {
            console.log('[TinyGS REST] ⏳ No packets yet (might be slow period)');
          }
        }

      } catch (error) {
        this.emit('error', error);
      }

      // Schedule next poll
      if (this.polling) {
        this.pollTimer = setTimeout(poll, this.pollInterval);
      }
    };

    // Start first poll
    poll();
  }

  /**
   * Stop polling
   */
  stopPolling() {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log(`[TinyGS REST] Stopped polling (received ${this.packetCount} packets total)`);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      packetCount: this.packetCount,
      errorCount: this.errorCount,
      polling: this.polling,
      lastPacketId: this.lastPacketId
    };
  }
}

// ============================================
// TESTE
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS REST Client (FINAL)\n');

  const client = new TinyGSRestClient({
    pollInterval: 15000 // 15 seconds
  });

  // Test 1: Get packets once
  (async () => {
    console.log('📡 Fetching recent packets...\n');
    const packets = await client.getRecentPackets(10);

    if (packets.length > 0) {
      console.log(`✅ SUCCESS! Got ${packets.length} packets!\n`);

      // Show first 3 packets
      packets.slice(0, 3).forEach((packet, i) => {
        const parsed = client.parsePacket(packet);
        
        console.log(`Packet ${i + 1}:`);
        console.log(`  Satellite: ${parsed.satellite} (NORAD: ${parsed.norad})`);
        console.log(`  Station: ${parsed.stationName || parsed.station || 'UNKNOWN'}`);
        console.log(`  Mode: ${parsed.mode}`);
        console.log(`  Frequency: ${parsed.frequency} MHz`);
        console.log(`  SF: ${parsed.sf}, BW: ${parsed.bw}, CR: ${parsed.cr}`);
        console.log(`  RSSI: ${parsed.rssi !== null ? parsed.rssi + ' dBm' : 'N/A'}`);
        console.log(`  SNR: ${parsed.snr !== null ? parsed.snr + ' dB' : 'N/A'}`);
        console.log(`  Position: ${parsed.satPos ? `${parsed.satPos.lat.toFixed(2)}, ${parsed.satPos.lng.toFixed(2)}` : 'N/A'}`);
        console.log(`  Time: ${new Date(parsed.timestamp).toLocaleString()}`);
        console.log('');
      });

      // Start polling
      console.log('🔄 Starting continuous polling...\n');
      
      client.startPolling((packet) => {
        const time = new Date(packet.timestamp).toLocaleTimeString();
        console.log(`📦 [${time}] ${packet.satellite} via ${packet.stationName || packet.station} | Mode: ${packet.mode} | Freq: ${packet.frequency} MHz`);
      });

      // Statistics every 60 seconds
      setInterval(() => {
        const stats = client.getStats();
        console.log(`\n📊 Stats: ${stats.packetCount} packets received, ${stats.errorCount} errors\n`);
      }, 60000);

    } else {
      console.log('❌ No packets received');
      console.log('This is unexpected since the API responded with data earlier.');
      console.log('Check network connection or API rate limits.\n');
    }
  })();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    client.stopPolling();
    const stats = client.getStats();
    console.log(`📊 Final stats: ${stats.packetCount} packets received`);
    process.exit(0);
  });

  console.log('💡 Press Ctrl+C to stop\n');
}

module.exports = TinyGSRestClient;