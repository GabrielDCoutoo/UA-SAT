// // tinygs-mqtt.js
// // Responsabilidade única: gerir ligações MQTT ao broker TinyGS.
// // Não faz parsing, não normaliza packets — emite mensagens raw.

// require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
// const mqtt = require('mqtt');
// const EventEmitter = require('events');

// const BROKER = 'mqtts://mqtt.tinygs.com:8883';

// const TOPICS = [
//   'tinygs/+/packets',
//   'tinygs/+/status',
//   'tinygs/global/packets',
// ];

// const CONNECT_OPTIONS = {
//   protocolVersion: 4,       // MQTT 3.1.1
//   clean: true,
//   keepalive: 60,
//   connectTimeout: 30000,
//   reconnectPeriod: 0,       // Sem reconnect automático — controla-se manualmente
//   rejectUnauthorized: false,
//   tls: true,
// };


// // ============================================
// // Single connection
// // ============================================
// class TinyGSConnection extends EventEmitter {
//   constructor(label, username, password) {
//     super();
//     this.label = label;
//     this.username = username;
//     this.password = password;
//     this.client = null;
//     this.connected = false;
//   }

//   connect() {
//     if (!this.username || !this.password) {
//       console.error(`[${this.label}] ❌ Credenciais em falta — verifica o .env`);
//       return;
//     }

//     console.log(`[${this.label}] A conectar como ${this.username}...`);

//     this.client = mqtt.connect(BROKER, {
//       ...CONNECT_OPTIONS,
//       username: this.username,
//       password: this.password,
//       clientId: `tinygs-${this.label.toLowerCase()}-${Math.random().toString(16).slice(2, 8)}`,
//     });

//     this.client.on('connect', () => {
//       this.connected = true;
//       console.log(`[${this.label}] ✅ Ligado`);

//       TOPICS.forEach((topic) => {
//         this.client.subscribe(topic, { qos: 0 }, (err) => {
//           if (err) console.error(`[${this.label}] ❌ Subscribe [${topic}]:`, err.message);
//           else      console.log(`[${this.label}] ✅ Subscribed: ${topic}`);
//         });
//       });
//     });

//     // Emite mensagem raw: { topic, payload (Buffer), label }
//     this.client.on('message', (topic, payload) => {
//       this.emit('message', { topic, payload, label: this.label });
//     });

//     this.client.on('error', (err) => {
//       console.error(`[${this.label}] ❌ ${err.message}`);
//       err._label = this.label;
//       this.emit('error', err);
//     });

//     this.client.on('close', () => {
//       this.connected = false;
//       console.log(`[${this.label}] ⚠️  Desligado`);
//       this.emit('disconnect', this.label);
//     });
//   }

//   disconnect() {
//     this.client?.end();
//   }
// }


// // ============================================
// // Dual-connection manager
// // ============================================
// class TinyGSMQTTClient extends EventEmitter {
//   constructor() {
//     super();

//     this.connections = [
//       new TinyGSConnection(
//         'GroundStation',
//         process.env.TINYGS_USER_PRIMARY,
//         process.env.TINYGS_PASS_PRIMARY
//       ),
//       new TinyGSConnection(
//         'Personal',
//         process.env.TINYGS_USER_SECONDARY,
//         process.env.TINYGS_PASS_SECONDARY
//       ),
//     ];

//     this.connections.forEach((conn) => {
//       // Re-emite tudo para cima — quem consome decide o que fazer
//       conn.on('message',    (msg) => this.emit('message', msg));
//       conn.on('error',      (err) => this.emit('error', err));
//       conn.on('disconnect', (label) => this.emit('disconnect', label));
//     });
//   }

//   // Ligações escalonadas 2s para evitar flood no broker
//   connect() {
//     console.log('[TinyGS] 🚀 A iniciar ligações (escalonadas 2s)...\n');
//     this.connections[0].connect();
//     setTimeout(() => this.connections[1].connect(), 2000);
//   }

//   disconnect() {
//     this.connections.forEach((c) => c.disconnect());
//   }

//   get status() {
//     return this.connections.map((c) => ({
//       label:     c.label,
//       connected: c.connected,
//     }));
//   }
// }


// module.exports = TinyGSMQTTClient;

// tinygs-mqtt.js - CORRIGIDO
// Cliente MQTT para TinyGS (bypassa Cloudflare!)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mqtt = require('mqtt');
const EventEmitter = require('events');

class TinyGSMQTTClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuração MQTT
    this.broker = 'mqtts://mqtt.tinygs.com:8883';
    this.username = process.env.TINYGS_USER_PRIMARY || process.env.TINYGS_USER_PRIMARY ;
    this.password = process.env.TINYGS_PASS_PRIMARY || process.env.TINYGS_PASS_PRIMARY ;
    
    console.log(`[TinyGS MQTT] Username: ${this.username}`);
    console.log(`[TinyGS MQTT] Password: ${this.password ? '***' + this.password.slice(-4) : 'NOT SET'}`);
    
    this.client = null;
    this.connected = false;
    this.packetCount = 0;
    this.reconnectAttempts = 0;
    this.debugMode = options.debug || false;
    this._connectedAt = null;
    this._connectTimeoutTimer = null;
    this.bridge = null;
  }

  /**
   * Connect to TinyGS MQTT broker
   */
  connect() {
    console.log('[TinyGS MQTT] Connecting to', this.broker);

    const options = {
      username: this.username,
      password: this.password,
      clientId: `ground-station-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      rejectUnauthorized: false
    };

    this.client = mqtt.connect(this.broker, options);

    // Timeout manual: dispara se não houver 'connect' dentro de connectTimeout ms
    this._connectTimeoutTimer = setTimeout(() => {
      if (!this.connected) {
        const ts = new Date().toISOString();
        console.error(`[TinyGS MQTT] ⏱️  [${ts}] Connection timeout after ${options.connectTimeout / 1000}s — broker não respondeu`);
        this.emit('timeout');
      }
    }, options.connectTimeout);

    // ========================================
    // EVENT: Connected
    // ========================================
    this.client.on('connect', () => {
      clearTimeout(this._connectTimeoutTimer);
      this.connected = true;
      this.reconnectAttempts = 0;
      this._connectedAt = Date.now();
      const ts = new Date().toISOString();
      console.log(`[TinyGS MQTT] ✅ [${ts}] Connected successfully`);

      // Subscribe to topics
      this.subscribeToTopics();
    });

    // ========================================
    // EVENT: Message received
    // ========================================
    this.client.on('message', (topic, message) => {
      // Debug: Log ALL messages in debug mode
      if (this.debugMode) {
        console.log(`\n📨 RAW MESSAGE:`);
        console.log(`   Topic: ${topic}`);
        console.log(`   Payload length: ${message.length} bytes`);
        console.log(`   First 200 chars: ${message.toString().substring(0, 200)}`);
      }

      if (this.bridge) this.bridge.forward(topic, message);

      try {
        const packet = this.parseMessage(topic, message);
        
        if (packet) {
          this.packetCount++;
          
          // Log first packet (depois fica silencioso)
          if (this.packetCount === 1) {
            console.log('[TinyGS MQTT] 🎉 First packet received!');
            console.log('Sample packet:', JSON.stringify(packet, null, 2));
          }
          
          this.emit('packet', packet);
        }
      } catch (error) {
        console.error('[TinyGS MQTT] Parse error:', error.message);
      }
    });

    // ========================================
    // EVENT: Error
    // ========================================
    this.client.on('error', (error) => {
      console.error('[TinyGS MQTT] ❌ Error:', error.message);
      this.emit('error', error);
    });

    // ========================================
    // EVENT: Reconnecting
    // ========================================
    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      const ts = new Date().toISOString();
      console.log(`[TinyGS MQTT] 🔄 [${ts}] Reconnecting... (attempt ${this.reconnectAttempts})`);
    });

    // ========================================
    // EVENT: Offline (perdeu rede antes do close)
    // ========================================
    this.client.on('offline', () => {
      const ts = new Date().toISOString();
      console.warn(`[TinyGS MQTT] 📴 [${ts}] Client went offline (sem rede ou broker inacessível)`);
    });

    // ========================================
    // EVENT: Disconnected
    // ========================================
    this.client.on('close', () => {
      const ts = new Date().toISOString();
      const uptime = this._connectedAt
        ? `${((Date.now() - this._connectedAt) / 1000).toFixed(1)}s ligado`
        : 'nunca chegou a ligar';
      console.warn(`[TinyGS MQTT] ⚠️  [${ts}] Disconnected — ${uptime} | packets recebidos: ${this.packetCount} | tentativas reconnect: ${this.reconnectAttempts}`);
      this.connected = false;
      this._connectedAt = null;
      this.emit('disconnect');
    });
  }

  /**
   * Subscribe to TinyGS topics
   */
  subscribeToTopics() {
    console.log('[TinyGS MQTT] 🔍 Subscribing to topics...');
    
    // Tópicos TinyGS conhecidos:
    const topics = [
      'tinygs/+/packets',      // Packets de todas as stations
      'tinygs/+/status',       // Status de todas as stations
      'tinygs/global/packets', // Packets globais (se existir)
      'packets/#',             // Alternativa (se TinyGS usar este formato)
      '#'                      // Wildcard total (último recurso para debug)
    ];

    // Subscribe a cada tópico
    topics.forEach(topic => {
      this.client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error(`[TinyGS MQTT] ❌ Failed to subscribe to ${topic}:`, err.message);
        } else {
          console.log(`[TinyGS MQTT] ✅ Subscribed to: ${topic}`);
        }
      });
    });

    console.log('[TinyGS MQTT] 📊 Waiting for messages... (may take 1-5 minutes)');
  }

  /**
   * Parse MQTT message to normalized packet format
   */
  parseMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());

      // Normalizar formato TinyGS
      return {
        // Identifiers
        id: data.id || data._id || `${Date.now()}-${Math.random()}`,
        satellite: data.satellite || data.satname || data.sat || 'UNKNOWN',
        norad: data.norad || data.norad_id || null,
        station: data.station || data.station_id || data.userId || null,
        stationName: data.stationName || data.station_name || `Station ${data.station}`,
        
        // Timestamp
        timestamp: data.serverTime || data.timestamp || new Date().toISOString(),
        serverTime: data.serverTime,
        
        // RF Parameters
        frequency: data.freq || data.frequency || null,
        mode: data.mode || null,
        rssi: data.rssi !== undefined ? parseFloat(data.rssi) : null,
        snr: data.snr !== undefined ? parseFloat(data.snr) : null,
        
        // LoRa specific
        sf: data.sf || null,
        bw: data.bw || data.bandwidth || null,
        cr: data.cr || data.codingRate || null,
        
        // Position
        satPos: data.satPos || data.position || null,
        
        // Data
        raw: data.raw || data.data || null,
        parsed: data.parsed || data.telemetry || null,
        
        // Metadata
        source: 'tinygs-mqtt',
        topic: topic,
        receivedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[TinyGS MQTT] Failed to parse message:', error.message);
      return null;
    }
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.client) {
      console.log(`[TinyGS MQTT] Disconnecting (received ${this.packetCount} packets total)`);
      this.client.end();
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connected: this.connected,
      packetCount: this.packetCount,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  setBridge(bridge) {
    this.bridge = bridge;
    console.log('[TinyGS MQTT] Bridge injected');
  }
}

// ============================================
// TESTE STANDALONE
// ============================================
if (require.main === module) {
  console.log('🧪 Testing TinyGS MQTT Client (CORRECTED VERSION)\n');

  // Create client with debug mode
  const client = new TinyGSMQTTClient({ debug: true });

  // Listen for packets
  client.on('packet', (packet) => {
    const time = new Date(packet.timestamp).toLocaleTimeString();
    console.log(`\n📦 PACKET RECEIVED:`);
    console.log(`   Satellite: ${packet.satellite} (NORAD: ${packet.norad})`);
    console.log(`   Station: ${packet.stationName || packet.station}`);
    console.log(`   Mode: ${packet.mode}`);
    console.log(`   Frequency: ${packet.frequency} MHz`);
    console.log(`   RSSI: ${packet.rssi} dBm | SNR: ${packet.snr} dB`);
    console.log(`   Time: ${time}`);
    console.log(`   Topic: ${packet.topic}`);
  });

  // Listen for errors
  client.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  // Connect
  client.connect();

  // Statistics every 60 seconds
  setInterval(() => {
    const stats = client.getStats();
    console.log(`\n📊 Stats: ${stats.packetCount} packets | Connected: ${stats.connected}\n`);
  }, 60000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    client.disconnect();
    const stats = client.getStats();
    console.log(`📊 Final stats: ${stats.packetCount} packets received`);
    process.exit(0);
  });

  console.log('💡 Press Ctrl+C to stop');
  console.log('⏱️  Wait 1-5 minutes for first packet (satellites pass overhead periodically)\n');
}

module.exports = TinyGSMQTTClient;