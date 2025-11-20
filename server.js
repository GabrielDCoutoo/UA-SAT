require('dotenv').config();

// DEBUG
console.log('🔍 Credenciais carregadas:');
console.log('   TINYGS_USER:', process.env.TINYGS_USER);
console.log('   TINYGS_PASS length:', process.env.TINYGS_PASS?.length || 0);
console.log('   ENABLE_TINYGS:', process.env.ENABLE_TINYGS);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const DATA_SOURCES = {
  tinygs: {
    enabled: process.env.ENABLE_TINYGS === 'true',
    mqtt: {
        broker: 'mqtts://mqtt.tinygs.com:8883',  // CORRIGIDO: usar mqtts:// e porta 8883
        username: process.env.TINYGS_USER || '',
        password: (process.env.TINYGS_PASS || '').replace(/^['"]|['"]$/g, ''),
        topics: [
          `tinygs/${process.env.TINYGS_USER}/packets`,
          'tinygs/packets/#'
        ]
    }
  },
  satnogs: {
    enabled: process.env.ENABLE_SATNOGS === 'true',
    api: {
      baseUrl: 'https://network.satnogs.org/api',
      stationId: process.env.SATNOGS_STATION_ID || '',
      pollInterval: parseInt(process.env.SATNOGS_POLL_INTERVAL) || 30000
    }
  }
};

let tinygsClient = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectTinyGS() {
  if (!DATA_SOURCES.tinygs.enabled) {
    console.log('📡 TinyGS desativado na configuração');
    return;
  }

  const { broker, username, password, topics } = DATA_SOURCES.tinygs.mqtt;
  
  console.log('🔌 Conectando ao TinyGS MQTT (SSL/TLS)...');
  console.log('   Broker:', broker);
  console.log('   Username:', username);
  console.log('   Password length:', password.length);
  
  tinygsClient = mqtt.connect(broker, {
    username,
    password,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60,
    clean: true,
    clientId: `groundstation_${username}_${Date.now()}`,
    rejectUnauthorized: false  // IMPORTANTE: Aceitar certificado self-signed do TinyGS
  });

  tinygsClient.on('connect', () => {
    console.log('✅ Conectado ao TinyGS MQTT (SSL/TLS)');
    reconnectAttempts = 0;
    
    topics.forEach(topic => {
      tinygsClient.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Erro ao subscrever ${topic}:`, err);
        } else {
          console.log(`📬 Subscrito ao tópico: ${topic}`);
        }
      });
    });
  });

  tinygsClient.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      
      const normalized = {
        source: 'tinygs',
        timestamp: new Date().toISOString(),
        satellite: data.satellite || data.norad_id || 'Unknown',
        rssi: data.rssi,
        snr: data.snr,
        frequency: data.frequency,
        raw: data
      };

      console.log('📦 TinyGS:', normalized.satellite, 'RSSI:', normalized.rssi);
      
      io.emit('satellite-data', normalized);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem TinyGS:', error);
    }
  });

  tinygsClient.on('error', (error) => {
    console.error('❌ Erro MQTT TinyGS:', error.message);
    console.error('   Detalhes:', error);
  });

  tinygsClient.on('close', () => {
    console.log('🔌 Desconectado do TinyGS MQTT');
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    }
  });

  tinygsClient.on('offline', () => {
    console.log('📴 TinyGS MQTT offline');
  });
}

let satnogsInterval = null;

async function fetchSatNOGS() {
  if (!DATA_SOURCES.satnogs.enabled) return;

  try {
    const { baseUrl, stationId } = DATA_SOURCES.satnogs.api;
    
    const response = await axios.get(`${baseUrl}/observations/`, {
      params: {
        ground_station: stationId,
        start: new Date(Date.now() - 3600000).toISOString(),
      },
      timeout: 10000
    });

    const observations = response.data;
    
    if (observations && observations.length > 0) {
      const latest = observations[0];
      
      const normalized = {
        source: 'satnogs',
        timestamp: latest.end || new Date().toISOString(),
        satellite: latest.norad_cat_id,
        observationId: latest.id,
        transmitter: latest.transmitter,
        mode: latest.mode,
        frequency: latest.frequency,
        waterfall: latest.waterfall,
        raw: latest
      };

      console.log('🛰️ SatNOGS:', normalized.satellite, 'Obs:', normalized.observationId);
      
      io.emit('satellite-data', normalized);
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Erro SatNOGS API:', error.response.status);
    } else {
      console.error('❌ Erro ao conectar SatNOGS:', error.message);
    }
  }
}

function startSatNOGSPolling() {
  if (!DATA_SOURCES.satnogs.enabled) {
    console.log('🛰️ SatNOGS desativado na configuração');
    return;
  }

  console.log('🔄 Iniciando polling SatNOGS...');
  
  fetchSatNOGS();
  
  satnogsInterval = setInterval(
    fetchSatNOGS, 
    DATA_SOURCES.satnogs.api.pollInterval
  );
}

io.on('connection', (socket) => {
  console.log('🔗 Cliente conectado:', socket.id);
  
  socket.emit('data-sources-status', {
    tinygs: DATA_SOURCES.tinygs.enabled,
    satnogs: DATA_SOURCES.satnogs.enabled
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });

  socket.on('request-update', () => {
    fetchSatNOGS();
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sources: {
      tinygs: {
        enabled: DATA_SOURCES.tinygs.enabled,
        connected: tinygsClient?.connected || false
      },
      satnogs: {
        enabled: DATA_SOURCES.satnogs.enabled,
        polling: satnogsInterval !== null
      }
    }
  });
});

app.get('/api/sources', (req, res) => {
  res.json(DATA_SOURCES);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 Ground Station Backend iniciado!');
  console.log(`📡 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔌 WebSocket disponível em ws://localhost:${PORT}`);
  console.log('');
  
  connectTinyGS();
  startSatNOGSPolling();
});

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  
  if (tinygsClient) {
    tinygsClient.end();
  }
  
  if (satnogsInterval) {
    clearInterval(satnogsInterval);
  }
  
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});