require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const { authenticateToken, login, loginLimiter, verifyToken, authenticateWebSocket } = require('./auth');
const tinygsRoutes = require('./routes/tinygs-routes');
const thingspeakRoutes = require('./routes/thingspeak-routes');

// 2. Import MQTT clients
const UASATMQTTClient = require('./modules/uasat-mqtt-client');
const UAVBackscatterMQTTClient = require('./modules/uav-mqtt-client');
const MQTTBridge = require('./modules/mqtt-bridge');

// 3. Import routes
const uasatRoutes = require('./routes/uasat-routes');
const uavBackscatterRoutes = require('./routes/uav-backscatter-routes');
const gnssRoutes = require('./routes/gnss-routes');
const dashboardRoutes = require('./routes/dashboard-routes');
const SatNOGSClient = require('./data-integration/satnogs-client');
const DataNormalizer = require('./data-integration/data-normalizer');
const TinyGSRestClient = require('./data-integration/tinygs-rest');
const TinyGSMQTTClient = require('./data-integration/tinygs-mqtt');
const TinyGSPlaywrightClient = require('./data-integration/tinygs-playwright');
const satnogsPassesRoutes = require('./routes/satnogs-passes-routes');

const { testConnection } = require('./config/database');
const { TinyGSPacket, SatNOGSObservation, BalloonTelemetry, UASATTelemetry, UAVBackscatter, syncDatabase } = require('./models');

const app = express();
require('./config/trust-proxy')(app); // TRUST_PROXY: ver .env.example
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use('/api/tinygs', tinygsRoutes);
app.use('/api/thingspeak', thingspeakRoutes);
app.use('/api/satnogs', satnogsPassesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uasat', uasatRoutes);
app.use('/api/uav-backscatter', uavBackscatterRoutes);
app.use('/api/gnss', gnssRoutes(io));
app.use('/api/stream', require('./routes/stream-routes'));
// Configuration
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  // Só o próprio computador por omissão; em produção o acesso externo é pelo proxy reverso (nginx).
  // HOST=0.0.0.0 expõe o Node em todas as interfaces.
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',

  // tinygs: {
  //   enabled: process.env.ENABLE_TINYGS === 'true',
  //   // ✅ CORRETO
  //   broker: (process.env.TINYGS_BROKER || 'mqtts://mqtt.tinygs.com').replace(/:\d+$/, ''),
  //   useSSL: (process.env.TINYGS_BROKER || 'mqtts://mqtt.tinygs.com').startsWith('mqtts://'),
  //   port: parseInt(process.env.TINYGS_PORT, 10) || 8883,
  //   credentials: [
  //     {
  //       user: process.env.TINYGS_USER_PRIMARY,
  //       pass: process.env.TINYGS_PASS_PRIMARY,
  //       label: 'Primary (UA Ground Station)'
  //     },
  //     {
  //       user: process.env.TINYGS_USER_SECONDARY,
  //       pass: process.env.TINYGS_PASS_SECONDARY,
  //       label: 'Secondary (Backup)'
  //     }
  //   ].filter(c => c.user && c.pass),
  //   topics: {
  //     myStation: process.env.MQTT_TOPIC_MY_STATION || (process.env.TINYGS_USER_PRIMARY ? `tinygs/${process.env.TINYGS_USER_PRIMARY}/packets` : ''),
  //     allPublic: process.env.MQTT_TOPIC_ALL_PUBLIC || 'tinygs/packets/#'
  //   }
  // },
  tinygs: {
    enabled: process.env.ENABLE_TINYGS === 'true',
    pollInterval: parseInt(process.env.TINYGS_POLL_INTERVAL, 10) || 15000,
    mqtt: {
      enabled: process.env.TINYGS_MQTT_ENABLED === 'true',
      broker: 'mqtts://mqtt.tinygs.com:8883',
      username: process.env.TINYGS_USER_SECONDARY || process.env.TINYGS_USER_PRIMARY,
      password: process.env.TINYGS_PASS_SECONDARY || process.env.TINYGS_PASS_PRIMARY
    },
    playwright: {
          enabled: process.env.TINYGS_PLAYWRIGHT_ENABLED === 'true',
          pollInterval: parseInt(process.env.TINYGS_PLAYWRIGHT_INTERVAL, 10) || 30000
    }
  },
  // ✅ ADICIONAR CONFIGURAÇÃO SATNOGS
  satnogs: {
    enabled: process.env.ENABLE_SATNOGS === 'true',
    stationId: process.env.SATNOGS_STATION_ID,
    apiToken: process.env.SATNOGS_API_TOKEN,
    pollInterval: parseInt(process.env.SATNOGS_POLL_INTERVAL, 10) || 60000
  },

  station: {
    id: process.env.MY_STATION_ID || null,
    latitude: process.env.MY_STATION_LAT ? parseFloat(process.env.MY_STATION_LAT) : null,
    longitude: process.env.MY_STATION_LNG ? parseFloat(process.env.MY_STATION_LNG) : null,
    altitude: process.env.MY_STATION_ALTITUDE ? parseFloat(process.env.MY_STATION_ALTITUDE) : null
  },

  balloon: {
    name: process.env.BALLOON_NAME || 'UNKNOWN',
    frequency: process.env.BALLOON_FREQUENCY ? parseInt(process.env.BALLOON_FREQUENCY, 10) : 433175000,
    callSign: process.env.BALLOON_CALL_SIGN || null
  },

  data: {
    maxPackets: process.env.MAX_PACKETS_IN_MEMORY ? parseInt(process.env.MAX_PACKETS_IN_MEMORY, 10) : 100
  },

  mock: process.env.MOCK_DATA === 'true'
};

// Validation
// if (config.tinygs.enabled && config.tinygs.credentials.length === 0) {
//   console.error('❌ ERROR: TinyGS enabled but no valid credentials found!');
//   process.exit(1);
// }

// ✅ ADICIONAR VALIDAÇÃO SATNOGS
if (config.satnogs.enabled && !config.satnogs.stationId) {
  console.error('❌ ERROR: SatNOGS enabled but SATNOGS_STATION_ID not configured!');
  process.exit(1);
}

// Startup log
console.log('\n📋 Configuration:');
console.log(`  Port: ${config.port}`);
console.log(`  TinyGS: ${config.tinygs.enabled ? '✅ Enabled' : '❌ Disabled'}`);

console.log(`  SatNOGS: ${config.satnogs.enabled ? '✅ Enabled' : '❌ Disabled'}`); // ✅ ADICIONAR
if (config.satnogs.enabled) {
  console.log(`    Station ID: ${config.satnogs.stationId}`);
}
console.log(`  My Station: ${config.station.id || '⚠️  Not configured'}`);
console.log(`  Balloon: ${config.balloon.name}`);
console.log('');

// ✅ DEFINIR BUFFERS E NORMALIZER
const packetHistory = [];
const memoryBuffer = []; // Buffer unificado para todos os dados
let tinygsClient = null;
let tinygsMqttClient = null;
let bridgeClient = null;
let tinygsPlaywrightClient = null;
const normalizer = new DataNormalizer();

const MAX_CONNECT_ATTEMPTS = 3;
const CONNECTION_TIMEOUT_MS = 10000;

let dbConnected = false;

async function initializeDatabase() {
  console.log('[Database] Initializing...');
  
  const connected = await testConnection();
  if (!connected) {
    console.error('[Database] ❌ Connection failed - running without database');
    console.error('[Database]    Data will be stored in memory only');
    return false;
  }

  try {
    await syncDatabase({ alter: true }); // Use alter para dev, force para reset completo
    dbConnected = true;
    console.log('[Database] ✅ Ready\n');
    return true;
  } catch (error) {
    console.error('[Database] ❌ Sync failed:', error.message);
    return false;
  }
}
// ✅ INICIALIZAR SATNOGS (código melhorado)
let satnogsClient = null;
if (config.satnogs.enabled) {
  try {
    satnogsClient = new SatNOGSClient();
    
    console.log(`[SatNOGS] Starting polling for station ${config.satnogs.stationId}...`);
    
    satnogsClient.startPolling((data) => {
      const normalized = normalizer.normalizeSatNOGS(data);
      
      if (normalized) {
        // Adicionar ao buffer
        memoryBuffer.push(normalized);
        while (memoryBuffer.length > config.data.maxPackets) {
          memoryBuffer.shift();
        }
        
        // Emitir via WebSocket
        io.emit('satnogs:data', normalized);
        
        // Log condicional
        if (normalized.type === 'station_status') {
          const status = normalized.online ? '🟢 ONLINE' : '🔴 OFFLINE';
          console.log(`[SatNOGS] Station ${status} - ${normalized.statistics.total_observations} observations`);
        } else if (normalized.type === 'observations') {
          console.log(`[SatNOGS] Received ${normalized.data.length} new observations`);
        } else {
          console.log(`[SatNOGS] ${normalized.type} received`);
        }
      }
    });
    
    console.log('[SatNOGS] ✅ Polling started successfully');
  } catch (error) {
    console.error('[SatNOGS] ❌ Failed to initialize:', error.message);
  }
} else {
  console.log('[SatNOGS] ⚠️  Disabled in configuration');
}
let tinygsRestClient = null;

if (config.tinygs.enabled) {
  try {
    console.log('[TinyGS REST] Initializing client...');
    
    tinygsRestClient = new TinyGSRestClient({
      pollInterval: config.tinygs.pollInterval
    });

    tinygsRestClient.startPolling(async (packet) => {
      try {
        // Check if it's from my station or balloon
        const isMyStation = !!(
          config.station.id && 
          packet.station && 
          packet.station.toString() === config.station.id.toString()
        );
        
        const isMyBalloon = !!(
          config.balloon.name && 
          packet.satellite && 
          packet.satellite.toLowerCase().includes(config.balloon.name.toLowerCase())
        );

        // Log packet
        const logPrefix = isMyStation ? '🎯' : isMyBalloon ? '🎈' : '📦';
        console.log(`\n${logPrefix} ${packet.satellite} via ${packet.stationName || packet.station}`);
        console.log(`   Mode: ${packet.mode}, Freq: ${packet.frequency} MHz`);
        if (packet.rssi) console.log(`   RSSI: ${packet.rssi} dBm`);
        if (packet.snr) console.log(`   SNR: ${packet.snr} dB`);

        // Save to database
        if (dbConnected) {
          try {
            await TinyGSPacket.create({
              satellite_name: packet.satellite,
              norad_id: packet.norad,
              station_id: packet.station,
              station_name: packet.stationName,
              station_lat: packet.satPos?.lat || null,
              station_lon: packet.satPos?.lng || null,
              rssi: packet.rssi,
              snr: packet.snr,
              frequency: packet.frequency,
              mode: packet.mode,
              spreading_factor: packet.sf,
              bandwidth: packet.bw,
              coding_rate: packet.cr,
              packet_data: packet.raw || null,
              parsed_data: packet.parsed || {},
              satellite_lat: packet.satPos?.lat || null,
              satellite_lon: packet.satPos?.lng || null,
              satellite_alt: packet.satPos?.alt || null,
              is_my_station: isMyStation,
              is_balloon: isMyBalloon,
              packet_timestamp: new Date(packet.timestamp),
              received_at: new Date()
            });

            console.log('   💾 Saved to database');

          } catch (dbError) {
            console.error('   ❌ Database error:', dbError.message);
          }
        } else {
          // Fallback to memory
          const normalized = {
            source: 'tinygs',
            timestamp: packet.timestamp,
            satellite: packet.satellite,
            station: packet.stationName || packet.station,
            isMyStation,
            isMyBalloon,
            rssi: packet.rssi,
            snr: packet.snr,
            raw: packet
          };
          
          packetHistory.push(normalized);
          while (packetHistory.length > config.data.maxPackets) {
            packetHistory.shift();
          }
        }

        // Emit via WebSocket
        io.emit('satellite-data', {
          source: 'tinygs',
          timestamp: packet.timestamp,
          satellite: packet.satellite,
          station: packet.stationName || packet.station,
          isMyStation,
          isMyBalloon,
          rssi: packet.rssi,
          snr: packet.snr,
          frequency: packet.frequency,
          mode: packet.mode,
          satPos: packet.satPos,
          raw: packet
        });

        if (isMyBalloon) {
          io.emit('balloon-data', {
            satellite: packet.satellite,
            station: packet.stationName || packet.station,
            rssi: packet.rssi,
            snr: packet.snr,
            satPos: packet.satPos,
            parsed: packet.parsed,
            timestamp: packet.timestamp
          });
        }

      } catch (error) {
        console.error('[TinyGS REST] Error processing packet:', error.message);
      }
    });

    // Error handler
    tinygsRestClient.on('error', (error) => {
      console.error('[TinyGS REST] Error:', error.message);
    });

    console.log('[TinyGS REST] ✅ Polling started successfully');

  } catch (error) {
    console.error('[TinyGS REST] ❌ Failed to initialize:', error.message);
  }
} else {
  console.log('[TinyGS REST] ⚠️  Disabled in configuration');
}

// ============================================
// TinyGS MQTT Client
// ============================================
async function initializeTinyGSMQTT() {
  if (!config.tinygs.enabled) {
    console.log('[TinyGS MQTT] ⚠️  TinyGS disabled');
    return;
  }

  if (!config.tinygs.mqtt.enabled) {
    console.log('[TinyGS MQTT] ⚠️  MQTT disabled - using REST only');
    return;
  }

  try {
    console.log('[TinyGS MQTT] Initializing client...');
    
    tinygsMqttClient = new TinyGSMQTTClient({
      debug: process.env.NODE_ENV === 'development'
    });

    tinygsMqttClient.on('packet', async (packet) => {
      try {
        const isMyStation = !!(
          config.station.id && 
          packet.station && 
          packet.station.toString() === config.station.id.toString()
        );
        
        const isMyBalloon = !!(
          config.balloon.name && 
          packet.satellite && 
          packet.satellite.toLowerCase().includes(config.balloon.name.toLowerCase())
        );

        const logPrefix = isMyStation ? '🎯' : isMyBalloon ? '🎈' : '📦';
        console.log(`\n${logPrefix} [MQTT] ${packet.satellite} via ${packet.stationName || packet.station}`);
        console.log(`   Mode: ${packet.mode}, Freq: ${packet.frequency} MHz`);
        if (packet.rssi) console.log(`   RSSI: ${packet.rssi} dBm`);
        if (packet.snr) console.log(`   SNR: ${packet.snr} dB`);

        if (dbConnected) {
          try {
            await TinyGSPacket.create({
              satellite_name: packet.satellite,
              norad_id: packet.norad,
              station_id: packet.station,
              station_name: packet.stationName,
              rssi: packet.rssi,
              snr: packet.snr,
              frequency: packet.frequency,
              mode: packet.mode,
              spreading_factor: packet.sf,
              bandwidth: packet.bw,
              coding_rate: packet.cr,
              packet_data: packet.raw || null,
              parsed_data: packet.parsed || {},
              satellite_lat: packet.satPos?.lat || null,
              satellite_lon: packet.satPos?.lng || null,
              satellite_alt: packet.satPos?.alt || null,
              is_my_station: isMyStation,
              is_balloon: isMyBalloon,
              packet_timestamp: new Date(packet.timestamp),
              received_at: new Date()
            });
            console.log('   💾 Saved to database (MQTT)');
          } catch (dbError) {
            console.error('   ❌ Database error:', dbError.message);
          }
        } else {
          const normalized = {
            source: 'tinygs-mqtt',
            timestamp: packet.timestamp,
            satellite: packet.satellite,
            station: packet.stationName || packet.station,
            isMyStation,
            isMyBalloon,
            rssi: packet.rssi,
            snr: packet.snr,
            raw: packet
          };
          packetHistory.push(normalized);
          while (packetHistory.length > config.data.maxPackets) {
            packetHistory.shift();
          }
        }

        io.emit('satellite-data', {
          source: 'tinygs-mqtt',
          timestamp: packet.timestamp,
          satellite: packet.satellite,
          station: packet.stationName || packet.station,
          isMyStation,
          isMyBalloon,
          rssi: packet.rssi,
          snr: packet.snr,
          frequency: packet.frequency,
          mode: packet.mode,
          raw: packet
        });

        if (isMyBalloon) {
          io.emit('balloon-data', {
            satellite: packet.satellite,
            station: packet.stationName || packet.station,
            rssi: packet.rssi,
            snr: packet.snr,
            parsed: packet.parsed,
            timestamp: packet.timestamp
          });
        }
      } catch (error) {
        console.error('[TinyGS MQTT] Error processing packet:', error.message);
      }
    });

    tinygsMqttClient.on('error', (error) => {
      console.error('[TinyGS MQTT] Error:', error.message);
    });

    tinygsMqttClient.connect();
    console.log('[TinyGS MQTT] ✅ Client started');

  } catch (error) {
    console.error('[TinyGS MQTT] ❌ Failed:', error.message);
  }
}
// ============================================
// TinyGS Playwright Client (Cloudflare bypass)
// ============================================
async function initializeTinyGSPlaywright() {
  if (!config.tinygs.enabled) {
    console.log('[TinyGS Playwright] ⚠️  TinyGS disabled');
    return;
  }

  if (!config.tinygs.playwright.enabled) {
    console.log('[TinyGS Playwright] ⚠️  Playwright disabled');
    return;
  }

  try {
    console.log('[TinyGS Playwright] Initializing client...');
    
    tinygsPlaywrightClient = new TinyGSPlaywrightClient({
      pollInterval: config.tinygs.playwright.pollInterval
    });

    tinygsPlaywrightClient.on('packet', async (packet) => {
      try {
        const satellite = packet.satellite || packet.sat || 'UNKNOWN';
        const station = packet.stationName || packet.station || packet.groundstation || null;
        const stationId = packet.stationNumber || packet.station_id || station;
        
        const isMyStation = !!(
          config.station.id && 
          stationId && 
          stationId.toString() === config.station.id.toString()
        );
        
        const isMyBalloon = !!(
          config.balloon.name && 
          satellite && 
          satellite.toLowerCase().includes(config.balloon.name.toLowerCase())
        );

        const logPrefix = isMyStation ? '🎯' : isMyBalloon ? '🎈' : '📦';
        console.log(`\n${logPrefix} [Playwright] ${satellite} via ${station || 'Unknown'}`);
        console.log(`   Mode: ${packet.mode}, Freq: ${packet.freq || packet.frequency} MHz`);
        if (packet.rssi) console.log(`   RSSI: ${packet.rssi} dBm`);
        if (packet.snr) console.log(`   SNR: ${packet.snr} dB`);

        if (dbConnected) {
          try {
            await TinyGSPacket.create({
              satellite_name: satellite,
              norad_id: packet.norad || packet.NORAD || null,
              station_id: stationId,
              station_name: station,
              rssi: packet.rssi !== undefined ? parseFloat(packet.rssi) : null,
              snr: packet.snr !== undefined ? parseFloat(packet.snr) : null,
              frequency: packet.freq || packet.frequency || null,
              mode: packet.mode || null,
              spreading_factor: packet.sf || null,
              bandwidth: packet.bw || packet.bandwidth || null,
              coding_rate: packet.cr || packet.codingRate || null,
              packet_data: packet.raw || packet.data || null,
              parsed_data: packet.parsed || packet.telemetry || {},
              satellite_lat: packet.satPos?.lat || null,
              satellite_lon: packet.satPos?.lng || packet.satPos?.lon || null,
              satellite_alt: packet.satPos?.alt || null,
              is_my_station: isMyStation,
              is_balloon: isMyBalloon,
              packet_timestamp: packet.serverTime ? new Date(packet.serverTime) : new Date(),
              received_at: new Date()
            });

            console.log('   💾 Saved to database (Playwright)');
          } catch (dbError) {
            console.error('   ❌ Database error:', dbError.message);
          }
        } else {
          const normalized = {
            source: 'tinygs-playwright',
            timestamp: packet.serverTime || new Date().toISOString(),
            satellite: satellite,
            station: station,
            isMyStation,
            isMyBalloon,
            rssi: packet.rssi,
            snr: packet.snr,
            raw: packet
          };
          
          packetHistory.push(normalized);
          while (packetHistory.length > config.data.maxPackets) {
            packetHistory.shift();
          }
        }

        io.emit('satellite-data', {
          source: 'tinygs-playwright',
          timestamp: packet.serverTime || new Date().toISOString(),
          satellite: satellite,
          station: station,
          isMyStation,
          isMyBalloon,
          rssi: packet.rssi,
          snr: packet.snr,
          frequency: packet.freq || packet.frequency,
          mode: packet.mode,
          raw: packet
        });

        if (isMyBalloon) {
          io.emit('balloon-data', {
            satellite: satellite,
            station: station,
            rssi: packet.rssi,
            snr: packet.snr,
            parsed: packet.parsed,
            timestamp: packet.serverTime || new Date().toISOString()
          });
        }

      } catch (error) {
        console.error('[TinyGS Playwright] Error processing packet:', error.message);
      }
    });

    tinygsPlaywrightClient.on('error', (error) => {
      console.error('[TinyGS Playwright] Error:', error.message);
    });

    const initialized = await tinygsPlaywrightClient.initialize();
    
    if (initialized) {
      await tinygsPlaywrightClient.startPolling();
      console.log('[TinyGS Playwright] ✅ Client started');
    } else {
      console.error('[TinyGS Playwright] ❌ Failed to initialize');
    }

  } catch (error) {
    console.error('[TinyGS Playwright] ❌ Failed:', error.message);
  }
}
// function connectToTinyGS(credentials, attempt = 1) {
//   if (!config.tinygs.enabled) return;
//   if (!credentials || credentials.length === 0) return;
//   if (attempt > MAX_CONNECT_ATTEMPTS) {
//     console.error('❌ Máximo de tentativas atingido');
//     return;
//   }
  
//   tryCredential(0, attempt);

//   function tryCredential(index, attempt) {
//     const cred = credentials[index];
//     if (!cred?.user || !cred?.pass) {
//       if (index + 1 < credentials.length) {
//         tryCredential(index + 1, attempt);
//       }
//       return;
//     }

//     console.log(`🔄 Conectando com credencial [${index + 1}/${credentials.length}] (${cred.label})...`);
    
//     tinygsClient = mqtt.connect(config.tinygs.broker, {
//       port: config.tinygs.port,
//       protocol: config.tinygs.useSSL ? 'mqtts' : 'mqtt',
//       username: cred.user,
//       password: cred.pass,
//       reconnectPeriod: 0,
//       connectTimeout: CONNECTION_TIMEOUT_MS,
//       keepalive: 60,
//       clean: true,
//       clientId: `groundstation_${cred.user}_${Date.now()}`,
//       rejectUnauthorized: false
//     });

//     let connectionTimeout = setTimeout(() => {
//       console.error(`❌ Timeout credencial [${index + 1}]`);
//       tinygsClient.end(true);
//       fallback();
//     }, CONNECTION_TIMEOUT_MS);

//     function fallback() {
//       if (index + 1 < credentials.length) {
//         tryCredential(index + 1, attempt);
//       } else {
//         setTimeout(() => {
//           connectToTinyGS(credentials, attempt + 1);
//         }, 3000);
//       }
//     }

//     tinygsClient.on('connect', () => {
//       clearTimeout(connectionTimeout);
//       console.log(`✅ Conectado ao TinyGS MQTT com credencial [${index + 1}] (${cred.label})`);
      
//       const topics = [config.tinygs.topics.myStation, config.tinygs.topics.allPublic].filter(Boolean);
//       topics.forEach(topic => {
//         tinygsClient.subscribe(topic, (err) => {
//           if (!err) console.log(`📬 Subscribed: ${topic}`);
//         });
//       });
//     });

//     tinygsClient.on('error', (err) => {
//       clearTimeout(connectionTimeout);
//       console.error(`❌ Erro credencial [${index + 1}]:`, err.message);
//       tinygsClient.end(true);
//       fallback();
//     });

//     tinygsClient.on('message', async (topic, message) => {
//       try {
//         const raw = JSON.parse(message.toString());
        
//         const satellite = raw.satellite || raw.norad_id || raw.sat || null;
//         const station = raw.station || raw.groundstation || raw.client || null;
//         const rssi = raw.rssi !== undefined ? parseFloat(raw.rssi) : null;
//         const snr = raw.snr !== undefined ? parseFloat(raw.snr) : null;
        
//         const isMyStation = !!(config.station.id && station && station.toString() === config.station.id.toString());
//         const isMyBalloon = !!(config.balloon.name && satellite && satellite.toString() === config.balloon.name.toString());
        
//         const normalized = {
//           source: 'tinygs',
//           timestamp: raw.timestamp || new Date().toISOString(),
//           satellite,
//           station,
//           isMyStation,
//           isMyBalloon,
//           rssi,
//           snr,
//           raw
//         };

//         if (isMyStation || isMyBalloon) {
//           console.log(`\n🎈 ${satellite} via ${station}`);
//           console.log(`   RSSI: ${rssi} dBm, SNR: ${snr} dB`);
//         }

//         // ⭐ ADICIONAR: Save to database
//         if (dbConnected) {
//           try {
//             await TinyGSPacket.create({
//               satellite_name: satellite,
//               norad_id: raw.norad_id || null,
//               station_id: station,
//               station_name: raw.stationName || station,
//               station_lat: raw.stationLat || null,
//               station_lon: raw.stationLon || null,
//               rssi: rssi,
//               snr: snr,
//               frequency: raw.frequency || null,
//               packet_data: JSON.stringify(raw.data || raw),
//               parsed_data: raw.parsed || {},
//               is_my_station: isMyStation,
//               is_balloon: isMyBalloon,
//               packet_timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
//               received_at: new Date()
//             });
            
//             console.log('   💾 Saved to database');
//           } catch (error) {
//             console.error('   ❌ Database save failed:', error.message);
//           }
//         } else {
//           // Fallback to in-memory if DB not connected
//           packetHistory.push(normalized);
//           while (packetHistory.length > config.data.maxPackets) packetHistory.shift();
//         }
        
//         io.emit('satellite-data', normalized);
//         if (isMyBalloon) io.emit('balloon-data', normalized);
//             io.emit('satellite-data', normalized);
//             if (isMyBalloon) io.emit('balloon-data', normalized);
            
//           } catch (error) {
//             console.error('❌ Error processing message:', error.message);
//           }
//         });
//       }
//     }

// WebSocket com auth opcional (dev mode)
io.use(authenticateWebSocket);

io.on('connection', (socket) => {
  console.log('🔗 Cliente WebSocket conectado:', socket.id);
  if (socket.user) {
    console.log('   User:', socket.user.username);
  }
  
  // Send initial data
  if (memoryBuffer.length > 0) {
    socket.emit('satnogs:history', memoryBuffer.filter(d => d.source === 'satnogs'));
  }
  
  // Send history from database if available
  if (dbConnected) {
    const { TinyGSPacket } = require('./models');
    TinyGSPacket.findAll({
      limit: 10,
      order: [['received_at', 'DESC']]
    }).then(packets => {
      packets.forEach(packet => {
        socket.emit('satellite-data', packet);
      });
    }).catch(err => {
      console.error('[WebSocket] Error sending history:', err.message);
    });
  }
  
  // ⭐ ADICIONAR: Handle heartbeat (ping/pong)
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (error) {
      // Ignore parse errors
    }
  });
  
  // ⭐ ADICIONAR: Periodic heartbeat from server
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat', { timestamp: Date.now() });
    }
  }, 30000); // Every 30 seconds
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectado:', socket.id, 'Reason:', reason);
    clearInterval(heartbeatInterval);
  });
  
  socket.on('error', (error) => {
    console.error('❌ WebSocket error:', socket.id, error.message);
  });
});

// ✅ ADICIONAR: Import das rotas SatNOGS
const satnogsRoutes = require('./routes/satnogsroutes');
// Proxy directo à SatNOGS Network API (evita CORS no browser)
// Registado ANTES do satnogsRoutes para que /observations e /stations
// sejam tratados aqui sem precisar do satnogsClient
const satnogsDomainRoutes = require('./routes/satnogs-proxy-routes');

// ✅ Disponibilizar satnogsClient para as rotas
app.locals.satnogsClient = satnogsClient;

// Proxy routes primeiro — funcionam sem satnogsClient
app.use('/api/satnogs', satnogsDomainRoutes);
// ✅ Usar rotas SatNOGS (sem autenticação por agora)
app.use('/api/satnogs', satnogsRoutes);
// Auth endpoints
app.post('/api/login', loginLimiter, login);
app.post('/api/verify', verifyToken);
app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// Protected endpoint
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Access granted',
    user: req.user
  });
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {                           
      connected: dbConnected,
      type: 'PostgreSQL'
    },
    tinygs: {
        enabled: config.tinygs.enabled,
        mqtt: {
          enabled: config.tinygs.mqtt?.enabled || false,
          connected: tinygsMqttClient?.connected || false,
          packetsReceived: tinygsMqttClient?.packetCount || 0
        },
        rest: {
          enabled: true,
          polling: tinygsRestClient !== null,
          packetsReceived: tinygsRestClient?.packetCount || 0
        },
        playwright: {
          enabled: config.tinygs.playwright?.enabled || false,
          active: tinygsPlaywrightClient?.getStats().browserActive || false,
          packetsReceived: tinygsPlaywrightClient?.getStats().packetCount || 0
      }
      },
    // ✅ ADICIONAR STATUS SATNOGS
    satnogs: {
      enabled: config.satnogs.enabled,
      stationId: config.satnogs.stationId,
      polling: satnogsClient !== null
    }
  });
});


// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    station: config.station,
    balloon: config.balloon,
    mock: config.mock,
    // ✅ ADICIONAR CONFIG SATNOGS
    satnogs: {
      enabled: config.satnogs.enabled,
      stationId: config.satnogs.stationId
    }
  });
});

// Get statistics from database
app.get('/api/tinygs/statistics', async (req, res) => {
  if (!dbConnected) {
    return res.json({
      success: true,
      data: {
        total_packets: packetHistory.length,
        source: 'memory'
      }
    });
  }
  
  try {
    const { hours = 24, myStation = false } = req.query;
    const { Op } = require('sequelize');
    
    const where = {
      received_at: {
        [Op.gte]: new Date(Date.now() - hours * 3600000)
      }
    };
    
    if (myStation === 'true') {
      where.is_my_station = true;
    }
    
    const total = await TinyGSPacket.count({ where });
    
    const { fn, col } = require('sequelize');
    const satellites = await TinyGSPacket.findAll({
      attributes: [[fn('DISTINCT', col('satellite_name')), 'satellite_name']],
      where,
      raw: true
    });
    
    const avgMetrics = await TinyGSPacket.findOne({
      attributes: [
        [fn('AVG', col('rssi')), 'avg_rssi'],
        [fn('AVG', col('snr')), 'avg_snr']
      ],
      where,
      raw: true
    });
    
    res.json({
      success: true,
      data: {
        total_packets: total,
        unique_satellites: satellites.length,
        avg_rssi: parseFloat(avgMetrics?.avg_rssi || 0).toFixed(2),
        avg_snr: parseFloat(avgMetrics?.avg_snr || 0).toFixed(2),
        hours: parseInt(hours)
      },
      source: 'database'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// MQTT Bridge (SSH tunnel forwarder)
// ============================================
function initializeBridge() {
  bridgeClient = new MQTTBridge();
  bridgeClient.connect();
}

// ============================================
// UASAT MQTT Client
// ============================================
let uasatClient = null;

async function initializeUASAT() {
  if (process.env.ENABLE_UASAT !== 'true') {
    console.log('[UASAT] ⚠️  Disabled in configuration');
    return;
  }

  try {
    console.log('[UASAT] Starting MQTT client...');
    
    uasatClient = new UASATMQTTClient({
      broker: process.env.UASAT_MQTT_BROKER,
      topic: process.env.UASAT_MQTT_TOPIC,
      username: process.env.UASAT_MQTT_USER,
      password: process.env.UASAT_MQTT_PASS
    });
    
    uasatClient.setModel(UASATTelemetry);
    
    uasatClient.on('connected', () => {
      console.log('[UASAT] ✅ MQTT connected');
    });
    
    uasatClient.on('telemetry', (data) => {
      console.log(`[UASAT] 📡 ${data.topic}`);
      if (io) io.emit('uasat:telemetry', data);
    });
    
    uasatClient.on('error', (error) => {
      console.error('[UASAT] ❌ Error:', error.message);
    });

    uasatClient.on('disconnected', () => {
      console.warn('[UASAT] ⚠️  Disconnected');
    });
    
    await uasatClient.connect();
    console.log('[UASAT] ✅ Ready\n');
    
  } catch (error) {
    console.error('[UASAT] ❌ Failed:', error.message);
  }
}


// ============================================
// UAV Backscatter MQTT Client
// ============================================
let uavClient = null;

async function initializeUAV() {
  if (process.env.ENABLE_UAV !== 'true') {
    console.log('[UAV] ⚠️  Disabled in configuration');
    return;
  }

  try {
    console.log('[UAV] Starting MQTT client...');

    uavClient = new UAVBackscatterMQTTClient({
      broker: process.env.UAV_MQTT_BROKER,
      topic: process.env.UAV_MQTT_TOPIC,
      username: process.env.UAV_MQTT_USER,
      password: process.env.UAV_MQTT_PASS
    });

    uavClient.setModel(UAVBackscatter);

    uavClient.on('connected', () => {
      console.log('[UAV] ✅ MQTT connected');
    });

    uavClient.on('telemetry', (data) => {
      console.log(`[UAV] 📡 ${data.topic}`);
      if (io) io.emit('uav:telemetry', data);
    });

    uavClient.on('error', (error) => {
      console.error('[UAV] ❌ Error:', error.message);
    });

    uavClient.on('disconnected', () => {
      console.warn('[UAV] ⚠️  Disconnected');
    });

    await uavClient.connect();
    console.log('[UAV] ✅ Ready\n');

  } catch (error) {
    console.error('[UAV] ❌ Failed:', error.message);
  }
}

// Start server
server.listen(config.port, config.host, async () => {
  console.log('🚀 Ground Station Backend started!');
  console.log(`📡 Server: http://${config.host}:${config.port}`);
  console.log(`🔌 WebSocket: ws://${config.host}:${config.port}`);
  console.log('');
  await initializeDatabase();
  initializeBridge();
  await initializeUASAT();
  if (uasatClient) uasatClient.setBridge(bridgeClient);
  await initializeUAV();
  if (uavClient) uavClient.setBridge(bridgeClient);
  await initializeTinyGSMQTT();
  if (tinygsMqttClient) tinygsMqttClient.setBridge(bridgeClient);
  await initializeTinyGSPlaywright();
  //connectToTinyGS(config.tinygs.credentials);
});

// ✅ MELHORAR CLEANUP
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');

  // Stop Bridge
  if (bridgeClient) {
    console.log('[Bridge] Disconnecting...');
    bridgeClient.disconnect();
  }

  // Stop UASAT
  if (uasatClient) {
    console.log('[UASAT] Disconnecting...');
    uasatClient.disconnect();
  }

  // Stop UAV
  if (uavClient) {
    console.log('[UAV] Disconnecting...');
    uavClient.disconnect();
  }
  
  // Stop SatNOGS
  if (satnogsClient) {
    console.log('[SatNOGS] Stopping polling...');
    satnogsClient.stopPolling();
  }
  // Stop TinyGS Playwright
  if (tinygsPlaywrightClient) {
    console.log('[TinyGS Playwright] Stopping...');
    await tinygsPlaywrightClient.stopPolling();
    const stats = tinygsPlaywrightClient.getStats();
    console.log(`[TinyGS Playwright] Total packets received: ${stats.packetCount}`);
  }
  // Stop TinyGS MQTTif (tinygsRestClient)
  if (tinygsMqttClient) {
    console.log('[TinyGS MQTT] Disconnecting...');
    tinygsMqttClient.disconnect();
    const stats = tinygsMqttClient.getStats();
    console.log(`[TinyGS MQTT] Total packets received: ${stats.packetCount}`);
  }
  // Stop TinyGS REST
  if (tinygsRestClient) {
    console.log('[TinyGS REST] Stopping polling...');
    tinygsRestClient.stopPolling();
    
    const stats = tinygsRestClient.getStats();
    console.log(`[TinyGS REST] Total packets received: ${stats.packetCount}`);
  }
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('⚠️  Forcing shutdown...');
    process.exit(1);
  }, 5000);
});