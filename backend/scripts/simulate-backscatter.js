#!/usr/bin/env node
/**
 * UAV Backscatter MQTT Simulator
 * Publishes fake sensor readings to uav/backscatter/{tag_id} every 2 s.
 *
 * Usage:  node backend/scripts/simulate-backscatter.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mqtt = require('mqtt');

const BROKER = process.env.UAV_MQTT_BROKER || 'mqtt://localhost:1883';
const INTERVAL_MS = 2000;

const TAGS = [
  { tag_id: 'TAG-001', uav_id: 'UAV-Alpha' },
  { tag_id: 'TAG-002', uav_id: 'UAV-Beta'  },
  { tag_id: 'TAG-003', uav_id: 'UAV-Alpha' },
];

const rand = (min, max) => +(Math.random() * (max - min) + min).toFixed(4);

function buildPayload(tag) {
  return {
    tag_id:      tag.tag_id,
    uav_id:      tag.uav_id,
    temperature: +rand(20, 35).toFixed(1),
    latitude:    +(40.6331 + rand(-0.002, 0.002)).toFixed(6),
    longitude:   +(-8.6595 + rand(-0.002, 0.002)).toFixed(6),
    altitude:    +rand(5, 50).toFixed(1),
    rssi:        +rand(-90, -40).toFixed(1),
    snr:         +rand(5, 15).toFixed(1),
    frequency:   5.8,
    status:      'ok',
    timestamp:   new Date().toISOString(),
  };
}

const client = mqtt.connect(BROKER, { clientId: `backscatter_sim_${Date.now()}`, clean: true });

client.on('connect', () => {
  console.log(`[SIM] Connected to ${BROKER}`);
  console.log(`[SIM] Publishing every ${INTERVAL_MS / 1000}s → tags: ${TAGS.map(t => t.tag_id).join(', ')}\n`);

  let index = 0;

  const publish = () => {
    const tag     = TAGS[index % TAGS.length];
    const payload = buildPayload(tag);
    const topic   = `uav/backscatter/${tag.tag_id}`;

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`[SIM] ❌ Publish error: ${err.message}`);
        return;
      }
      console.log(
        `[SIM] ✅ ${new Date().toLocaleTimeString()}  ${topic}` +
        `  T=${payload.temperature}°C` +
        `  RSSI=${payload.rssi}dBm` +
        `  SNR=${payload.snr}dB` +
        `  Alt=${payload.altitude}m`
      );
    });

    index++;
  };

  publish(); // fire immediately on connect
  setInterval(publish, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error(`[SIM] ❌ MQTT error: ${err.message}`);
  console.error(`[SIM]    Check broker is running at ${BROKER}`);
  process.exit(1);
});

client.on('close',    () => console.warn('[SIM] Connection closed'));
client.on('reconnect',() => console.log('[SIM] Reconnecting...'));

process.on('SIGINT', () => {
  console.log('\n[SIM] Stopped.');
  client.end();
  process.exit(0);
});
