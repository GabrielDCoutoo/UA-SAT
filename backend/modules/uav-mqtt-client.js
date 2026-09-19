// modules/uav-mqtt-client.js - MQTT Client for UAV Backscatter
const mqtt = require('mqtt');
const EventEmitter = require('events');

class UAVBackscatterMQTTClient extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      broker: config.broker || 'mqtt://localhost:1883',
      topic: config.topic || 'uav/backscatter/#',
      username: config.username,
      password: config.password,
      clientId: `uav_mqtt_${Math.random().toString(16).slice(2, 8)}`
    };
    
    this.client = null;
    this.model = null;
    this.connected = false;
    this.bridge = null;
    
    console.log('[UAV MQTT] Initialized with config:', {
      broker: this.config.broker,
      topic: this.config.topic
    });
  }

  setModel(model) {
    this.model = model;
    console.log('[UAV MQTT] Sequelize model injected');
  }

  setBridge(bridge) {
    this.bridge = bridge;
    console.log('[UAV MQTT] Bridge injected');
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[UAV MQTT] Connecting to ${this.config.broker}...`);
        
        const options = {
          clientId: this.config.clientId,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000
        };

        if (this.config.username) {
          options.username = this.config.username;
          options.password = this.config.password;
        }

        this.client = mqtt.connect(this.config.broker, options);

        this.client.on('connect', () => {
          console.log('[UAV MQTT] ✅ Connected to broker');
          this.connected = true;
          
          this.client.subscribe(this.config.topic, { qos: 1 }, (err) => {
            if (err) {
              console.error('[UAV MQTT] ❌ Subscribe error:', err);
              reject(err);
            } else {
              console.log(`[UAV MQTT] 📡 Subscribed to: ${this.config.topic}`);
              this.emit('connected');
              resolve();
            }
          });
        });

        this.client.on('message', async (topic, message) => {
          try {
            await this.handleMessage(topic, message);
          } catch (error) {
            console.error('[UAV MQTT] ❌ Message handling error:', error);
            this.emit('error', error);
          }
        });

        this.client.on('error', (error) => {
          console.error('[UAV MQTT] ❌ Connection error:', error);
          this.emit('error', error);
        });

        this.client.on('close', () => {
          console.warn('[UAV MQTT] ⚠️  Connection closed');
          this.connected = false;
          this.emit('disconnected');
        });

        this.client.on('offline', () => {
          console.warn('[UAV MQTT] ⚠️  Client offline');
          this.connected = false;
        });

        this.client.on('reconnect', () => {
          console.log('[UAV MQTT] 🔄 Reconnecting...');
        });

      } catch (error) {
        console.error('[UAV MQTT] ❌ Connect error:', error);
        reject(error);
      }
    });
  }

  async handleMessage(topic, message) {
    try {
      if (this.bridge) this.bridge.forward(topic, message);
      const payload = JSON.parse(message.toString());
      
      console.log(`[UAV MQTT] 📡 ${topic}`);
      
      // Validate required fields
      if (!payload.tag_id) {
        console.warn('[UAV MQTT] ⚠️  Missing tag_id, skipping');
        return;
      }

      // Default values for IT Aveiro
      const telemetryData = {
        tag_id: payload.tag_id,
        uav_id: payload.uav_id || null,
        temperature: payload.temperature !== undefined ? parseFloat(payload.temperature) : null,
        latitude: payload.latitude || 40.6331,  // IT Aveiro default
        longitude: payload.longitude || -8.6595, // IT Aveiro default
        altitude: payload.altitude !== undefined ? parseFloat(payload.altitude) : null,
        rssi: payload.rssi !== undefined ? parseFloat(payload.rssi) : null,
        snr: payload.snr !== undefined ? parseFloat(payload.snr) : null,
        frequency: payload.frequency !== undefined ? parseFloat(payload.frequency) : 5.8,
        status: payload.status || 'ok',
        received_at: payload.timestamp ? new Date(payload.timestamp) : new Date()
      };

      // Store in database
      if (this.model) {
        await this.model.create(telemetryData);
        console.log('[UAV MQTT] 💾 Telemetry stored in DB');
      }

      // Emit event for WebSocket broadcasting
      this.emit('telemetry', {
        topic,
        data: telemetryData
      });

    } catch (error) {
      console.error('[UAV MQTT] ❌ Error parsing message:', error);
      console.error('[UAV MQTT] Raw message:', message.toString());
    }
  }

  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, {}, () => {
          console.log('[UAV MQTT] 👋 Disconnected');
          this.connected = false;
          resolve();
        });
      });
    }
  }

  isConnected() {
    return this.connected && this.client && this.client.connected;
  }

  publish(topic, message, options = {}) {
    if (!this.isConnected()) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, JSON.stringify(message), { qos: 1, ...options }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = UAVBackscatterMQTTClient;
