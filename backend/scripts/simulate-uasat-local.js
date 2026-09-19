#!/usr/bin/env node
/**
 * UASAT Telemetry Local Simulator
 * Publishes fake frame0 / frame1 / retrans packets over MQTT so the
 * Mission Data / My Station pages can be exercised without real hardware.
 *
 * Requires a local MQTT broker (mosquitto) on mqtt://localhost:1883.
 * The backend's UASAT_MQTT_BROKER must point at the same broker for
 * these packets to actually reach it — see the note printed on start.
 *
 * Usage:  node backend/scripts/simulate-uasat-local.js
 */

const mqtt = require('mqtt');

const BROKER       = process.env.SIM_MQTT_BROKER || 'mqtt://localhost:1883';
const TOPIC_BASE    = 'uasat/telemetry';
const INTERVAL_MS   = 3000;
const SAT_ID        = 'UASAT-1';
const GATEWAY_IDS   = [1, 2];

const rand    = (min, max) => Math.random() * (max - min) + min;
const round   = (v, d = 2) => +v.toFixed(d);
const pick    = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildFrame0() {
  return {
    sat_id: SAT_ID,
    sat_status: Math.random() > 0.15 ? 'ok' : 'not_ok',
    frame_type: 'frame0',
    battery_status: pick(['full', 'half_full', 'half_empty', 'empty']),
    battery_voltage: round(rand(3.3, 4.1)),
    temperature: Math.round(rand(15, 35)),
    humidity: round(rand(30, 80)),
    gas: round(rand(100, 500)),
    pressure: round(rand(950, 1050)),
    gps_latitude: 41.161797,
    gps_longitude: -8.583900,
    gps_altitude: round(rand(0, 50)),
    rssi: round(rand(-110, -70)),
    snr: round(rand(-5, 15)),
    timestamp: new Date().toISOString(),
  };
}

function buildFrame1() {
  return {
    sat_id: SAT_ID,
    sat_status: Math.random() > 0.15 ? 'ok' : 'not_ok',
    frame_type: 'frame1',
    battery_voltage: round(rand(3.3, 4.1)),
    imu_accel_x: round(rand(-2, 2), 4),
    imu_accel_y: round(rand(-2, 2), 4),
    imu_accel_z: round(rand(8, 10), 4),
    imu_gyro_x: round(rand(-50, 50), 4),
    imu_gyro_y: round(rand(-50, 50), 4),
    imu_gyro_z: round(rand(-50, 50), 4),
    spectrum_probe: round(rand(-100, -40)),
    rssi: round(rand(-110, -70)),
    snr: round(rand(-5, 15)),
    timestamp: new Date().toISOString(),
  };
}

function buildRetrans(gatewayId) {
  const gwRaw = Math.floor(rand(50, 255));
  return {
    sat_id: SAT_ID,
    sat_status: 'ok',
    frame_type: 'retrans',
    gateway_id: gatewayId,
    gateway_status: Math.random() > 0.1 ? 'ok' : 'degraded',
    sat_battery_pct: Math.floor(rand(20, 100)),
    gw_battery_raw: gwRaw,
    gw_battery_pct: round((gwRaw / 255) * 100, 1),
    gw_nodes: [1, 2, 3, 4].map(id => ({
      id,
      status: Math.random() > 0.8 ? null : (Math.random() > 0.15 ? 'ok' : 'fault'),
      value: Math.random() > 0.3 ? round(rand(0, 100)) : null,
    })),
    rssi: round(rand(-110, -70)),
    snr: round(rand(-5, 15)),
    timestamp: new Date().toISOString(),
  };
}

const client = mqtt.connect(BROKER, { clientId: `uasat_sim_${Date.now()}`, clean: true });

client.on('connect', () => {
  console.log(`[SIM] Connected to ${BROKER}`);
  console.log(`[SIM] Publishing frame0 / frame1 / retrans every ${INTERVAL_MS / 1000}s\n`);
  console.log('[SIM] ⚠️  Make sure backend/.env has UASAT_MQTT_BROKER pointing at this same');
  console.log(`[SIM]     broker (${BROKER}) and ENABLE_UASAT=true, then restart the backend.\n`);

  let step = 0;

  const publish = () => {
    let topic, payload;
    const kind = step % 3;

    if (kind === 0) {
      topic = `${TOPIC_BASE}/${SAT_ID}`;
      payload = buildFrame0();
    } else if (kind === 1) {
      topic = `${TOPIC_BASE}/${SAT_ID}`;
      payload = buildFrame1();
    } else {
      const gatewayId = pick(GATEWAY_IDS);
      topic = `${TOPIC_BASE}/gw-${gatewayId}`;
      payload = buildRetrans(gatewayId);
    }

    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error(`[SIM] ❌ Publish error: ${err.message}`);
        return;
      }
      console.log(
        `[SIM] ✅ ${new Date().toLocaleTimeString()}  ${topic}  frame_type=${payload.frame_type}` +
        `  RSSI=${payload.rssi}dBm  SNR=${payload.snr}dB`
      );
    });

    step++;
  };

  publish(); // fire immediately on connect
  setInterval(publish, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error(`[SIM] ❌ MQTT error: ${err.message}`);
  console.error(`[SIM]    Check a broker is running at ${BROKER}`);
  process.exit(1);
});

client.on('close',     () => console.warn('[SIM] Connection closed'));
client.on('reconnect', () => console.log('[SIM] Reconnecting...'));

process.on('SIGINT', () => {
  console.log('\n[SIM] Stopped.');
  client.end();
  process.exit(0);
});
