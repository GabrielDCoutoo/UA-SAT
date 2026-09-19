import os
try:
    from dotenv import load_dotenv
    load_dotenv()  # lê o .env se python-dotenv estiver instalado; senão, exporta as variáveis no shell
except ImportError:
    pass
import paho.mqtt.client as mqtt
import json
import time
import random
import math
from datetime import datetime, timezone

# ─── BROKER CONFIG ────────────────────────────────────────────────────────────
BROKER_HOST = os.environ.get("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = 1883
BROKER_USER = os.environ.get("MQTT_BROKER_USER")
BROKER_PASS = os.environ.get("MQTT_BROKER_PASS")
if not BROKER_USER or not BROKER_PASS:
    raise SystemExit("MQTT_BROKER_USER / MQTT_BROKER_PASS não definidos (ver .env.example; MQTT_BROKER_HOST é opcional)")
TOPIC_BASE  = "uasat/telemetry"

PUBLISH_INTERVAL = 3.0  # segundos entre ciclos completos
SAT_DELAY        = 0.2  # segundos entre cada satélite dentro do ciclo

# ─── PERFIS DOS SATÉLITES ─────────────────────────────────────────────────────
# Campos GPS usam prefixo gps_ para corresponder exatamente ao modelo UASATTelemetry.
SATELLITES = [
    {
        "sat_id": "sat-1",
        "lat": 40.655000, "lon": -8.654000, "alt": 2345.0,
        "batt": 8.00, "temp": 29, "hum": 80.2, "gas": 245.0, "pres": 1010.0,
        "ax": 0.150, "ay": -0.040, "az": 9.800,
        "gx": 0.010, "gy": -0.005, "gz": 0.002,
        "nose": 478.9, "spec": -87.2, "rssi": -105.0, "snr": 9.2,
        "orb_r": 0.010, "orb_spd": 0.050, "phase": 0.0,
    },
    {
        "sat_id": "sat-2",
        "lat": 41.150000, "lon": -8.610000, "alt": 3100.0,
        "batt": 7.60, "temp": 25, "hum": 72.5, "gas": 210.0, "pres": 985.0,
        "ax": 0.210, "ay": -0.080, "az": 9.750,
        "gx": 0.020, "gy":  0.008, "gz": -0.003,
        "nose": 395.0, "spec": -91.0, "rssi": -112.0, "snr": 7.8,
        "orb_r": 0.015, "orb_spd": 0.040, "phase": 1.0,
    },
    {
        "sat_id": "sat-3",
        "lat": 38.720000, "lon": -9.140000, "alt": 5500.0,
        "batt": 6.80, "temp": 18, "hum": 55.0, "gas": 180.0, "pres": 945.0,
        "ax": -0.050, "ay": 0.120, "az": 9.820,
        "gx": -0.015, "gy": 0.010, "gz": 0.005,
        "nose": 312.4, "spec": -79.5, "rssi": -98.0, "snr": 11.3,
        "orb_r": 0.020, "orb_spd": 0.060, "phase": 2.1,
    },
    {
        "sat_id": "sat-4",
        "lat": 37.100000, "lon": -7.930000, "alt": 1800.0,
        "batt": 9.10, "temp": 33, "hum": 88.0, "gas": 290.0, "pres": 1020.0,
        "ax": 0.300, "ay": 0.010, "az": 9.780,
        "gx": 0.012, "gy": -0.007, "gz": 0.004,
        "nose": 520.1, "spec": -83.7, "rssi": -118.0, "snr": 6.5,
        "orb_r": 0.008, "orb_spd": 0.070, "phase": 3.7,
    },
    {
        "sat_id": "sat-5",
        "lat": 39.430000, "lon": -8.020000, "alt": 4200.0,
        "batt": 7.20, "temp": 22, "hum": 65.8, "gas": 225.0, "pres": 962.0,
        "ax": -0.100, "ay": -0.150, "az": 9.810,
        "gx": -0.008, "gy": 0.015, "gz": -0.006,
        "nose": 410.6, "spec": -95.0, "rssi": -108.0, "snr": 8.9,
        "orb_r": 0.018, "orb_spd": 0.030, "phase": 0.8,
    },
    {
        "sat_id": "sat-6",
        "lat": 41.550000, "lon": -8.420000, "alt": 6800.0,
        "batt": 5.50, "temp": 12, "hum": 42.0, "gas": 155.0, "pres": 910.0,
        "ax": 0.080, "ay": 0.050, "az": 9.770,
        "gx": 0.003, "gy": -0.002, "gz": 0.001,
        "nose": 280.3, "spec": -75.1, "rssi": -94.0, "snr": 13.1,
        "orb_r": 0.025, "orb_spd": 0.080, "phase": 5.2,
    },
    {
        "sat_id": "sat-7",
        "lat": 40.200000, "lon": -7.500000, "alt": 3750.0,
        "batt": 8.40, "temp": 27, "hum": 76.3, "gas": 260.0, "pres": 975.0,
        "ax": -0.200, "ay": 0.080, "az": 9.790,
        "gx": -0.018, "gy": 0.006, "gz": -0.009,
        "nose": 445.7, "spec": -89.3, "rssi": -110.0, "snr": 8.0,
        "orb_r": 0.012, "orb_spd": 0.045, "phase": 1.5,
    },
    {
        "sat_id": "sat-8",
        "lat": 38.000000, "lon": -8.800000, "alt": 2900.0,
        "batt": 6.30, "temp": 31, "hum": 84.5, "gas": 275.0, "pres": 990.0,
        "ax": 0.120, "ay": -0.060, "az": 9.810,
        "gx": 0.009, "gy": -0.004, "gz": 0.007,
        "nose": 490.2, "spec": -85.6, "rssi": -115.0, "snr": 7.2,
        "orb_r": 0.014, "orb_spd": 0.055, "phase": 4.1,
    },
    {
        "sat_id": "sat-9",
        "lat": 40.900000, "lon": -8.000000, "alt": 7200.0,
        "batt": 4.80, "temp": 8, "hum": 35.0, "gas": 130.0, "pres": 895.0,
        "ax": 0.060, "ay": 0.030, "az": 9.760,
        "gx": 0.005, "gy": 0.002, "gz": -0.001,
        "nose": 260.8, "spec": -72.4, "rssi": -90.0, "snr": 14.5,
        "orb_r": 0.030, "orb_spd": 0.090, "phase": 2.8,
    },
    {
        "sat_id": "sat-10",
        "lat": 39.700000, "lon": -9.500000, "alt": 1500.0,
        "batt": 9.50, "temp": 35, "hum": 91.0, "gas": 310.0, "pres": 1025.0,
        "ax": 0.400, "ay": -0.100, "az": 9.770,
        "gx": 0.022, "gy": -0.011, "gz": 0.008,
        "nose": 560.0, "spec": -82.0, "rssi": -120.0, "snr": 6.0,
        "orb_r": 0.006, "orb_spd": 0.035, "phase": 6.0,
    },
    {
        "sat_id": "sat-11",
        "lat": 41.800000, "lon": -7.200000, "alt": 4600.0,
        "batt": 7.90, "temp": 20, "hum": 60.0, "gas": 198.0, "pres": 955.0,
        "ax": -0.130, "ay": 0.070, "az": 9.800,
        "gx": -0.011, "gy": 0.007, "gz": -0.004,
        "nose": 370.5, "spec": -93.8, "rssi": -106.0, "snr": 9.7,
        "orb_r": 0.022, "orb_spd": 0.042, "phase": 3.3,
    },
    {
        "sat_id": "sat-12",
        "lat": 37.900000, "lon": -8.300000, "alt": 8500.0,
        "batt": 3.90, "temp": 4, "hum": 25.0, "gas": 105.0, "pres": 870.0,
        "ax": 0.040, "ay": 0.015, "az": 9.750,
        "gx": 0.002, "gy": 0.001, "gz": -0.001,
        "nose": 230.1, "spec": -68.0, "rssi": -85.0, "snr": 16.0,
        "orb_r": 0.035, "orb_spd": 0.100, "phase": 0.3,
    },
]

# Estado interno (fase orbital + desgaste bateria)
sat_state = {s["sat_id"]: {"phase": s["phase"], "batt_drain": 0.0} for s in SATELLITES}


def jitter(base, pct=0.05):
    return base + base * random.uniform(-pct, pct)


def drift(amount):
    return random.uniform(-amount, amount)


def build_payload(sat):
    sid   = sat["sat_id"]
    state = sat_state[sid]

    # Posição orbital
    state["phase"] += sat["orb_spd"]
    phi = state["phase"]
    lat = sat["lat"] + sat["orb_r"] * math.sin(phi)
    lon = sat["lon"] + sat["orb_r"] * math.cos(phi * 0.7)
    alt = sat["alt"] + drift(sat["alt"] * 0.02)

    # Bateria
    state["batt_drain"] += random.uniform(0, 0.002)
    batt = max(3.3, sat["batt"] - state["batt_drain"] + drift(0.05))

    return {
        # -- Identificação --
        "timestamp":       datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sat_id":          sid,
        "sat_status":      "ok",

        # -- Bateria --
        "battery_voltage": round(batt, 2),

        # -- Telemetria ambiental --
        "temperature":     int(round(jitter(sat["temp"], 0.04))),
        "humidity":        round(jitter(sat["hum"],  0.05), 2),
        "gas":             round(jitter(sat["gas"],  0.08), 2),
        "pressure":        round(jitter(sat["pres"], 0.02), 2),

        # -- GPS (nomes exatos do modelo UASATTelemetry) --
        "gps_latitude":    round(lat, 6),
        "gps_longitude":   round(lon, 6),
        "gps_altitude":    round(alt, 2),

        # -- IMU acelerómetro --
        "imu_accel_x":     round(sat["ax"] + drift(0.05), 3),
        "imu_accel_y":     round(sat["ay"] + drift(0.05), 3),
        "imu_accel_z":     round(sat["az"] + drift(0.05), 3),

        # -- IMU giroscópio --
        "imu_gyro_x":      round(sat["gx"] + drift(0.005), 3),
        "imu_gyro_y":      round(sat["gy"] + drift(0.005), 3),
        "imu_gyro_z":      round(sat["gz"] + drift(0.005), 3),

        # -- Sensores especiais --
        "digital_nose":    round(jitter(sat["nose"], 0.06), 2),
        "spectrum_probe":  round(jitter(sat["spec"], 0.04), 2),

        # -- Qualidade de sinal --
        "rssi":            round(sat["rssi"] + drift(3.0), 2),
        "snr":             round(sat["snr"]  + drift(0.8), 2),
    }


# ─── MQTT ─────────────────────────────────────────────────────────────────────
client = mqtt.Client(client_id="uasat_simulator")
client.username_pw_set(BROKER_USER, BROKER_PASS)
client.connect(BROKER_HOST, BROKER_PORT, 60)
client.loop_start()

print(f"Simulador UASAT — {len(SATELLITES)} satelites — broker {BROKER_HOST}:{BROKER_PORT}")
print("-" * 65)

cycle = 0
try:
    while True:
        cycle += 1
        print(f"\nCiclo #{cycle}  {datetime.now().strftime('%H:%M:%S')}")

        for sat in SATELLITES:
            payload = build_payload(sat)
            topic   = f"{TOPIC_BASE}/{sat['sat_id']}"
            client.publish(topic, json.dumps(payload), qos=0)

            print(
                f"  {sat['sat_id']:8s}  batt={payload['battery_voltage']:.2f}V"
                f"  T={payload['temperature']}C"
                f"  ({payload['gps_latitude']:.4f},{payload['gps_longitude']:.4f})"
                f"  RSSI={payload['rssi']}dBm"
            )
            time.sleep(SAT_DELAY)

        time.sleep(PUBLISH_INTERVAL)

except KeyboardInterrupt:
    print("\nParado.")

finally:
    client.loop_stop()
    client.disconnect()
