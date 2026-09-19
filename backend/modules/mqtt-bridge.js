// modules/mqtt-bridge.js
// Forwards received packets to a remote MQTT broker via SSH tunnel.
// Fails silently — if the tunnel endpoint is unreachable, the local
// pipeline is completely unaffected.

const mqtt = require('mqtt');

class MQTTBridge {
  constructor() {
    this.client = null;
    this.connected = false;

    const host = process.env.MQTT_BRIDGE_HOST || 'localhost';
    const port = parseInt(process.env.MQTT_BRIDGE_PORT, 10) || 1884;
    this.brokerUrl = `mqtt://${host}:${port}`;

    this.options = {
      clientId: `bridge_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 10000,  // retry every 10s
      connectTimeout: 5000
    };

    if (process.env.MQTT_BRIDGE_USER) {
      this.options.username = process.env.MQTT_BRIDGE_USER;
      this.options.password = process.env.MQTT_BRIDGE_PASS;
    }
  }

  connect() {
    try {
      console.log(`[Bridge] Connecting to ${this.brokerUrl}...`);
      this.client = mqtt.connect(this.brokerUrl, this.options);

      this.client.on('connect', () => {
        this.connected = true;
        console.log('[Bridge] ✅ Connected to remote broker');
      });

      this.client.on('error', (err) => {
        this.connected = false;
        console.warn(`[Bridge] ⚠️  Connection error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.connected = false;
        console.warn('[Bridge] ⚠️  Disconnected from remote broker (will retry)');
      });

      this.client.on('offline', () => {
        this.connected = false;
      });

    } catch (err) {
      console.warn(`[Bridge] ⚠️  Failed to initialize: ${err.message}`);
    }
  }

  forward(topic, message) {
    if (!this.client || !this.connected) return;
    try {
      this.client.publish(topic, message, { qos: 0 }, (err) => {
        if (err) console.warn(`[Bridge] ⚠️  Publish failed on ${topic}: ${err.message}`);
      });
    } catch (err) {
      console.warn(`[Bridge] ⚠️  Forward error: ${err.message}`);
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
    }
  }
}

module.exports = MQTTBridge;
