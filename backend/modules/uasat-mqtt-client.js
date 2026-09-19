// modules/uasat-mqtt-client.js - VERSÃO ATUALIZADA
const mqtt = require('mqtt');
const EventEmitter = require('events');

class UASATMQTTClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      broker: config.broker || process.env.UASAT_MQTT_BROKER || 'mqtt://localhost:1883',
      topic: config.topic || process.env.UASAT_MQTT_TOPIC || 'uasat/telemetry/#',
      clientId: config.clientId || `uasat_middleware_${Date.now()}`,
      username: config.username || process.env.UASAT_MQTT_USER,
      password: config.password || process.env.UASAT_MQTT_PASS,
      qos: config.qos || 0
    };

    this.client = null;
    this.connected = false;
    this.messageCount = 0;
    this.latestMessage = null;
    this.UASATTelemetry = null;
    this.bridge = null;

    console.log('[UASAT MQTT] Initialized with config:', {
      broker: this.config.broker,
      topic: this.config.topic
    });
  }

  setModel(model) {
    this.UASATTelemetry = model;
    console.log('[UASAT MQTT] Sequelize model injected');
  }

  setBridge(bridge) {
    this.bridge = bridge;
    console.log('[UASAT MQTT] Bridge injected');
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
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

        console.log(`[UASAT MQTT] Connecting to ${this.config.broker}...`);
        
        this.client = mqtt.connect(this.config.broker, options);

        this.client.on('connect', () => {
          console.log('[UASAT MQTT] ✅ Connected to broker');
          this.connected = true;

          this.client.subscribe(this.config.topic, { qos: this.config.qos }, (err) => {
            if (err) {
              console.error('[UASAT MQTT] ❌ Subscribe error:', err);
              reject(err);
            } else {
              console.log(`[UASAT MQTT] 📡 Subscribed to: ${this.config.topic}`);
              this.emit('connected');
              resolve();
            }
          });
        });

        this.client.on('message', async (topic, message) => {
          await this.handleMessage(topic, message);
        });

        this.client.on('error', (error) => {
          console.error('[UASAT MQTT] ❌ Connection error:', error);
          this.connected = false;
          this.emit('error', error);
        });

        this.client.on('close', () => {
          console.log('[UASAT MQTT] ⚠️ Connection closed');
          this.connected = false;
          this.emit('disconnected');
        });

        this.client.on('reconnect', () => {
          console.log('[UASAT MQTT] 🔄 Reconnecting...');
        });

      } catch (error) {
        console.error('[UASAT MQTT] ❌ Connection failed:', error);
        reject(error);
      }
    });
  }

  async handleMessage(topic, messageBuffer) {
    try {
      this.messageCount++;
      if (this.bridge) this.bridge.forward(topic, messageBuffer);
      const messageStr = messageBuffer.toString();
      
      console.log(`[UASAT MQTT] 📦 Message #${this.messageCount} on ${topic}`);

      // Parse JSON payload
      let payload;
      try {
        payload = JSON.parse(messageStr);
      } catch (parseError) {
        console.warn('[UASAT MQTT] ⚠️ Not JSON, treating as plain text');
        payload = { raw: messageStr };
      }

      // Prepare telemetry data with specific fields
      const telemetry = {
        // Metadata
        topic: topic,
        payload: payload,
        raw_message: messageStr,
        telemetry_timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
        received_at: new Date(),

        // Satellite ID & Status
        sat_id: payload.sat_id || payload.satellite_id || 'UNKNOWN',
        sat_status: payload.sat_status || payload.status || 'ok',

        // Frame / Gateway
        frame_type: payload.frame_type ?? null,
        gateway_id: this.parseInt(payload.gateway_id),
        gateway_status: payload.gateway_status ?? null,

        // Retrans-specific fields
        sat_battery_pct: this.parseInt(payload.sat_battery_pct),
        gw_battery_raw: this.parseInt(payload.gw_battery_raw),
        gw_battery_pct: this.parseFloat(payload.gw_battery_pct),
        gw_nodes: Array.isArray(payload.gw_nodes) ? payload.gw_nodes : null,

        // Battery
        battery_status: payload.battery_status ||
          (payload.frame_type === 'retrans'
            ? this.calculateBatteryStatusFromPct(payload.sat_battery_pct)
            : this.calculateBatteryStatus(payload.battery_voltage)),
        battery_voltage: payload.frame_type === 'retrans' ? null : this.parseFloat(payload.battery_voltage),

        // Telemetry
        temperature: this.parseInt(payload.temperature || payload.temp),
        humidity: this.parseFloat(payload.humidity),
        gas: this.parseFloat(payload.gas),
        pressure: this.parseFloat(payload.pressure),

        // GPS
        gps_latitude: this.parseFloat(payload.gps_latitude || payload.latitude || payload.lat),
        gps_longitude: this.parseFloat(payload.gps_longitude || payload.longitude || payload.lon || payload.lng),
        gps_altitude: this.parseFloat(payload.gps_altitude || payload.altitude || payload.alt),

        // IMU
        imu_accel_x: this.parseFloat(payload.imu_accel_x || payload.accel_x),
        imu_accel_y: this.parseFloat(payload.imu_accel_y || payload.accel_y),
        imu_accel_z: this.parseFloat(payload.imu_accel_z || payload.accel_z),
        imu_gyro_x: this.parseFloat(payload.imu_gyro_x || payload.gyro_x),
        imu_gyro_y: this.parseFloat(payload.imu_gyro_y || payload.gyro_y),
        imu_gyro_z: this.parseFloat(payload.imu_gyro_z || payload.gyro_z),

        // Sensors
        digital_nose: this.parseFloat(payload.digital_nose),
        spectrum_probe: this.parseFloat(payload.spectrum_probe),

        // Signal Quality
        rssi: this.parseFloat(payload.rssi),
        snr: this.parseFloat(payload.snr)
      };

      // Save to database
      await this.saveTelemetry(telemetry);

      // Store latest message
      this.latestMessage = telemetry;

      // Emit event for WebSocket broadcasting
      this.emit('telemetry', telemetry);

    } catch (error) {
      console.error('[UASAT MQTT] ❌ Error handling message:', error);
    }
  }

  // Helper: Calculate battery status from percentage (retrans frames)
  calculateBatteryStatusFromPct(pct) {
    if (pct == null) return null;
    const p = parseInt(pct);
    if (isNaN(p)) return null;
    if (p >= 75) return 'full';
    if (p >= 50) return 'half_full';
    if (p >= 25) return 'half_empty';
    return 'empty';
  }

  // Helper: Calculate battery status from voltage
  calculateBatteryStatus(voltage) {
    if (!voltage) return null;
    
    const v = parseFloat(voltage);
    if (v >= 3.7) return 'full';
    if (v >= 3.5) return 'half_full';
    if (v >= 3.3) return 'half_empty';
    return 'empty';
  }

  // Helper: Safe parseInt
  parseInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  }

  // Helper: Safe parseFloat
  parseFloat(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  async saveTelemetry(telemetry) {
    try {
      if (!this.UASATTelemetry) {
        console.error('[UASAT MQTT] ❌ Sequelize model not set!');
        return;
      }

      const record = await this.UASATTelemetry.create(telemetry);
      
      console.log(`[UASAT MQTT] ✅ Saved to DB: ${telemetry.sat_id} (ID: ${record.id.substring(0, 8)}...)`);

    } catch (error) {
      console.error('[UASAT MQTT] ❌ Database error:', error.message);
      
      if (error.name === 'SequelizeDatabaseError') {
        console.error('[UASAT MQTT] ⚠️ Run: npm run db:sync to create/update tables');
      }
    }
  }

  getLatestTelemetry() {
    return this.latestMessage;
  }

  getStats() {
    return {
      connected: this.connected,
      messageCount: this.messageCount,
      broker: this.config.broker,
      topic: this.config.topic
    };
  }

  disconnect() {
    if (this.client) {
      console.log('[UASAT MQTT] Disconnecting...');
      this.client.end();
      this.connected = false;
    }
  }
}

module.exports = UASATMQTTClient;
