// tinygs-global-map.js - Global map data integration
require('dotenv').config();
const axios = require('axios');
const EventEmitter = require('events');

class TinyGSGlobalMap extends EventEmitter {
  constructor() {
    super();
    
    this.baseUrl = 'https://api.tinygs.com/v4';
    this.sessionToken = process.env.TINYGS_SESSION_TOKEN;
    this.userId = process.env.TINYGS_USER_ID;
    
    // Cache
    this.stations = [];
    this.satellites = [];
    this.recentPackets = [];
    
    // Polling intervals
    this.stationsInterval = null;
    this.satellitesInterval = null;
    this.packetsInterval = null;
  }

  /**
   * Generate timestamp header
   */
  getTimestampHeader() {
    const now = Date.now().toString();
    return Buffer.from(now).toString('base64');
  }

  /**
   * Common headers for API requests
   */
  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'sessionToken': this.sessionToken,
      'userId': this.userId,
      'x-client-timestamp': this.getTimestampHeader(),
      'Origin': 'https://tinygs.com',
      'Referer': 'https://tinygs.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
  }

  /**
   * Fetch all active stations (last 24h)
   */
  async fetchStations() {
    try {
      const response = await axios.get(`${this.baseUrl}/stations`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const stations = response.data?.stations || response.data || [];
      
      this.stations = stations.map(s => ({
        id: s.userId || s.id,
        name: s.name || `Station ${s.userId}`,
        location: {
          lat: s.location?.lat || s.lat,
          lng: s.location?.lng || s.lng || s.lon
        },
        status: s.status || (s.lastPacketTime ? 'online' : 'offline'),
        lastPacket: s.lastPacketTime || s.last_packet_time,
        packetCount: s.packet_count || s.packets || 0,
        satellite: s.listening || s.tuned_satellite || null
      }));

      console.log(`[TinyGS Map] Fetched ${this.stations.length} stations`);
      this.emit('stations', this.stations);
      return this.stations;

    } catch (error) {
      console.error('[TinyGS Map] Error fetching stations:', error.message);
      return [];
    }
  }

  /**
   * Fetch satellite list with current positions
   */
  async fetchSatellites() {
    try {
      const response = await axios.get(`${this.baseUrl}/satellites`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const satellites = response.data?.satellites || response.data || [];
      
      this.satellites = satellites.map(sat => ({
        id: sat.id || sat.norad,
        name: sat.name || sat.satname,
        norad: sat.norad || sat.norad_id,
        position: {
          lat: sat.lat || sat.latitude,
          lng: sat.lng || sat.lon || sat.longitude,
          alt: sat.alt || sat.altitude
        },
        // TLE data for orbit propagation (if available)
        tle: {
          line1: sat.tle1 || sat.tle?.[0],
          line2: sat.tle2 || sat.tle?.[1]
        },
        active: sat.active !== undefined ? sat.active : true,
        frequency: sat.frequency || sat.freq,
        mode: sat.mode
      }));

      console.log(`[TinyGS Map] Fetched ${this.satellites.length} satellites`);
      this.emit('satellites', this.satellites);
      return this.satellites;

    } catch (error) {
      console.error('[TinyGS Map] Error fetching satellites:', error.message);
      return [];
    }
  }

  /**
   * Fetch recent packets (last 20)
   */
  async fetchRecentPackets() {
    try {
      const response = await axios.get(`${this.baseUrl}/packets?limit=20`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const packets = response.data?.packets || response.data || [];
      
      this.recentPackets = packets.map(p => ({
        id: p.id,
        satellite: p.satellite?.name || p.satname,
        norad: p.satellite?.norad_id || p.norad,
        station: p.station || p.userId,
        stationName: p.stationName,
        timestamp: p.serverTime || p.timestamp,
        // Position at time of reception
        satPos: p.satPos || null,
        stationPos: p.stationPos || null,
        // RF params
        frequency: p.frequency || p.freq,
        mode: p.mode,
        rssi: p.rssi,
        snr: p.snr
      }));

      console.log(`[TinyGS Map] Fetched ${this.recentPackets.length} recent packets`);
      this.emit('packets', this.recentPackets);
      return this.recentPackets;

    } catch (error) {
      console.error('[TinyGS Map] Error fetching packets:', error.message);
      return [];
    }
  }

  /**
   * Get current map state (all data)
   */
  getMapState() {
    return {
      stations: this.stations,
      satellites: this.satellites,
      recentPackets: this.recentPackets,
      stats: {
        totalStations: this.stations.length,
        onlineStations: this.stations.filter(s => s.status === 'online').length,
        totalSatellites: this.satellites.length,
        totalPackets: this.recentPackets.length
      }
    };
  }

  /**
   * Start polling for map data
   */
  startPolling() {
    console.log('[TinyGS Map] Starting data polling...');
    
    // Initial fetch
    this.fetchStations();
    this.fetchSatellites();
    this.fetchRecentPackets();

    // Poll stations every 30 seconds
    this.stationsInterval = setInterval(() => {
      this.fetchStations();
    }, 30000);

    // Poll satellites every 60 seconds (positions update)
    this.satellitesInterval = setInterval(() => {
      this.fetchSatellites();
    }, 60000);

    // Poll packets every 15 seconds
    this.packetsInterval = setInterval(() => {
      this.fetchRecentPackets();
    }, 15000);

    console.log('[TinyGS Map] ✅ Polling started');
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.stationsInterval) clearInterval(this.stationsInterval);
    if (this.satellitesInterval) clearInterval(this.satellitesInterval);
    if (this.packetsInterval) clearInterval(this.packetsInterval);
    
    console.log('[TinyGS Map] Polling stopped');
  }
}

// ============================================
// TESTE
// ============================================
if (require.main === module) {
  console.log('🗺️  Testing TinyGS Global Map Integration\n');

  const map = new TinyGSGlobalMap();

  // Listen for data updates
  map.on('stations', (stations) => {
    console.log(`\n📍 STATIONS (${stations.length}):`);
    stations.slice(0, 5).forEach(s => {
      console.log(`  - ${s.name} (${s.location.lat.toFixed(2)}, ${s.location.lng.toFixed(2)}) - ${s.status}`);
    });
  });

  map.on('satellites', (satellites) => {
    console.log(`\n🛰️  SATELLITES (${satellites.length}):`);
    satellites.slice(0, 5).forEach(s => {
      const pos = s.position.lat ? `(${s.position.lat.toFixed(2)}, ${s.position.lng.toFixed(2)})` : 'N/A';
      console.log(`  - ${s.name} NORAD:${s.norad} ${pos}`);
    });
  });

  map.on('packets', (packets) => {
    console.log(`\n📦 RECENT PACKETS (${packets.length}):`);
    packets.slice(0, 3).forEach(p => {
      const time = new Date(p.timestamp).toLocaleTimeString();
      console.log(`  - [${time}] ${p.satellite} via Station ${p.station}`);
    });
  });

  // Start polling
  map.startPolling();

  // Show stats every 30 seconds
  setInterval(() => {
    const state = map.getMapState();
    console.log(`\n📊 MAP STATS:`);
    console.log(`  Stations: ${state.stats.totalStations} (${state.stats.onlineStations} online)`);
    console.log(`  Satellites: ${state.stats.totalSatellites}`);
    console.log(`  Recent Packets: ${state.stats.totalPackets}\n`);
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    map.stopPolling();
    process.exit(0);
  });

  console.log('💡 Press Ctrl+C to stop\n');
}

module.exports = TinyGSGlobalMap;
