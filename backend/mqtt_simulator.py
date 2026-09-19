#!/usr/bin/env python3
"""
UASAT Multi-Satellite MQTT Simulator
Simula 12 satélites com valores realistas e variações contínuas.
"""

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

# ─── BROKER CONFIG ───────────────────────────────────────────────────────────
BROKER_HOST = os.environ.get("MQTT_BROKER_HOST", "localhost")
BROKER_PORT = 1883
BROKER_USER = os.environ.get("MQTT_BROKER_USER")
BROKER_PASS = os.environ.get("MQTT_BROKER_PASS")
if not BROKER_USER or not BROKER_PASS:
    raise SystemExit("MQTT_BROKER_USER / MQTT_BROKER_PASS não definidos (ver .env.example; MQTT_BROKER_HOST é opcional)")
TOPIC_BASE   = "uasat/telemetry"

# ─── INTERVALO ENTRE CICLOS (segundos) ───────────────────────────────────────
PUBLISH_INTERVAL = 3.0   # pausa entre cada ciclo completo de todos os sats
SAT_DELAY        = 0.2   # pausa entre cada satélite dentro do ciclo

# ─── DEFINIÇÃO DOS SATÉLITES (base values) ───────────────────────────────────
# Cada satélite tem perfis ligeiramente diferentes para simular diversidade.
SATELLITES = [
    {
        "sat_id":    "sat-1",
        "topic":     f"{TOPIC_BASE}/sat-1",
        "lat_base":  40.655000,  "lon_base": -8.654000, "alt_base": 2345.0,
        "batt_base": 8.00,  "temp_base": 29,  "hum_base": 80.2,
        "gas_base":  245.0, "pres_base": 1010.0,
        "ax_base":   0.150,  "ay_base": -0.040, "az_base": 9.800,
        "nose_base": 478.9,  "spec_base": -87.2,
        "rssi_base": -105.0, "snr_base":  9.2,
        "orbit_r":   0.01,   "orbit_speed": 0.05,  "phase": 0.0,
    },
    {
        "sat_id":    "sat-2",
        "topic":     f"{TOPIC_BASE}/sat-2",
        "lat_base":  41.150000,  "lon_base": -8.610000, "alt_base": 3100.0,
        "batt_base": 7.60,  "temp_base": 25,  "hum_base": 72.5,
        "gas_base":  210.0, "pres_base": 985.0,
        "ax_base":   0.210,  "ay_base": -0.080, "az_base": 9.750,
        "nose_base": 395.0,  "spec_base": -91.0,
        "rssi_base": -112.0, "snr_base":  7.8,
        "orbit_r":   0.015,  "orbit_speed": 0.04, "phase": 1.0,
    },
    {
        "sat_id":    "sat-3",
        "topic":     f"{TOPIC_BASE}/sat-3",
        "lat_base":  38.720000,  "lon_base": -9.140000, "alt_base": 5500.0,
        "batt_base": 6.80,  "temp_base": 18,  "hum_base": 55.0,
        "gas_base":  180.0, "pres_base": 945.0,
        "ax_base":  -0.050,  "ay_base":  0.120, "az_base": 9.820,
        "nose_base": 312.4,  "spec_base": -79.5,
        "rssi_base": -98.0,  "snr_base": 11.3,
        "orbit_r":   0.020,  "orbit_speed": 0.06, "phase": 2.1,
    },
    {
        "sat_id":    "sat-4",
        "topic":     f"{TOPIC_BASE}/sat-4",
        "lat_base":  37.100000,  "lon_base": -7.930000, "alt_base": 1800.0,
        "batt_base": 9.10,  "temp_base": 33,  "hum_base": 88.0,
        "gas_base":  290.0, "pres_base": 1020.0,
        "ax_base":   0.300,  "ay_base":  0.010, "az_base": 9.780,
        "nose_base": 520.1,  "spec_base": -83.7,
        "rssi_base": -118.0, "snr_base":  6.5,
        "orbit_r":   0.008,  "orbit_speed": 0.07, "phase": 3.7,
    },
    {
        "sat_id":    "sat-5",
        "topic":     f"{TOPIC_BASE}/sat-5",
        "lat_base":  39.430000,  "lon_base": -8.020000, "alt_base": 4200.0,
        "batt_base": 7.20,  "temp_base": 22,  "hum_base": 65.8,
        "gas_base":  225.0, "pres_base": 962.0,
        "ax_base":  -0.100,  "ay_base": -0.150, "az_base": 9.810,
        "nose_base": 410.6,  "spec_base": -95.0,
        "rssi_base": -108.0, "snr_base":  8.9,
        "orbit_r":   0.018,  "orbit_speed": 0.03, "phase": 0.8,
    },
    {
        "sat_id":    "sat-6",
        "topic":     f"{TOPIC_BASE}/sat-6",
        "lat_base":  41.550000,  "lon_base": -8.420000, "alt_base": 6800.0,
        "batt_base": 5.50,  "temp_base": 12,  "hum_base": 42.0,
        "gas_base":  155.0, "pres_base": 910.0,
        "ax_base":   0.080,  "ay_base":  0.050, "az_base": 9.770,
        "nose_base": 280.3,  "spec_base": -75.1,
        "rssi_base": -94.0,  "snr_base": 13.1,
        "orbit_r":   0.025,  "orbit_speed": 0.08, "phase": 5.2,
    },
    {
        "sat_id":    "sat-7",
        "topic":     f"{TOPIC_BASE}/sat-7",
        "lat_base":  40.200000,  "lon_base": -7.500000, "alt_base": 3750.0,
        "batt_base": 8.40,  "temp_base": 27,  "hum_base": 76.3,
        "gas_base":  260.0, "pres_base": 975.0,
        "ax_base":  -0.200,  "ay_base":  0.080, "az_base": 9.790,
        "nose_base": 445.7,  "spec_base": -89.3,
        "rssi_base": -110.0, "snr_base":  8.0,
        "orbit_r":   0.012,  "orbit_speed": 0.045, "phase": 1.5,
    },
    {
        "sat_id":    "sat-8",
        "topic":     f"{TOPIC_BASE}/sat-8",
        "lat_base":  38.000000,  "lon_base": -8.800000, "alt_base": 2900.0,
        "batt_base": 6.30,  "temp_base": 31,  "hum_base": 84.5,
        "gas_base":  275.0, "pres_base": 990.0,
        "ax_base":   0.120,  "ay_base": -0.060, "az_base": 9.810,
        "nose_base": 490.2,  "spec_base": -85.6,
        "rssi_base": -115.0, "snr_base":  7.2,
        "orbit_r":   0.014,  "orbit_speed": 0.055, "phase": 4.1,
    },
    {
        "sat_id":    "sat-9",
        "topic":     f"{TOPIC_BASE}/sat-9",
        "lat_base":  40.900000,  "lon_base": -8.000000, "alt_base": 7200.0,
        "batt_base": 4.80,  "temp_base":  8,  "hum_base": 35.0,
        "gas_base":  130.0, "pres_base": 895.0,
        "ax_base":   0.060,  "ay_base":  0.030, "az_base": 9.760,
        "nose_base": 260.8,  "spec_base": -72.4,
        "rssi_base": -90.0,  "snr_base": 14.5,
        "orbit_r":   0.030,  "orbit_speed": 0.09, "phase": 2.8,
    },
    {
        "sat_id":    "sat-10",
        "topic":     f"{TOPIC_BASE}/sat-10",
        "lat_base":  39.700000,  "lon_base": -9.500000, "alt_base": 1500.0,
        "batt_base": 9.50,  "temp_base": 35,  "hum_base": 91.0,
        "gas_base":  310.0, "pres_base": 1025.0,
        "ax_base":   0.400,  "ay_base": -0.100, "az_base": 9.770,
        "nose_base": 560.0,  "spec_base": -82.0,
        "rssi_base": -120.0, "snr_base":  6.0,
        "orbit_r":   0.006,  "orbit_speed": 0.035, "phase": 6.0,
    },
    {
        "sat_id":    "sat-11",
        "topic":     f"{TOPIC_BASE}/sat-11",
        "lat_base":  41.800000,  "lon_base": -7.200000, "alt_base": 4600.0,
        "batt_base": 7.90,  "temp_base": 20,  "hum_base": 60.0,
        "gas_base":  198.0, "pres_base": 955.0,
        "ax_base":  -0.130,  "ay_base":  0.070, "az_base": 9.800,
        "nose_base": 370.5,  "spec_base": -93.8,
        "rssi_base": -106.0, "snr_base":  9.7,
        "orbit_r":   0.022,  "orbit_speed": 0.042, "phase": 3.3,
    },
    {
        "sat_id":    "sat-12",
        "topic":     f"{TOPIC_BASE}/sat-12",
        "lat_base":  37.900000,  "lon_base": -8.300000, "alt_base": 8500.0,
        "batt_base": 3.90,  "temp_base":  4,  "hum_base": 25.0,
        "gas_base":  105.0, "pres_base": 870.0,
        "ax_base":   0.040,  "ay_base":  0.015, "az_base": 9.750,
        "nose_base": 230.1,  "spec_base": -68.0,
        "rssi_base": -85.0,  "snr_base": 16.0,
        "orbit_r":   0.035,  "orbit_speed": 0.10, "phase": 0.3,
    },
]

# ─── ESTADO INTERNO DOS SATÉLITES ────────────────────────────────────────────
# Guarda a fase orbital e drift acumulado de cada satélite ao longo do tempo.
sat_state = {s["sat_id"]: {"orbit_phase": s["phase"], "batt_drain": 0.0} for s in SATELLITES}

def jitter(base, pct=0.05):
    """Variação aleatória ±pct% sobre base."""
    return base + base * random.uniform(-pct, pct)

def drift(base, amount):
    """Variação aleatória absoluta ±amount."""
    return base + random.uniform(-amount, amount)

def build_payload(sat, t):
    """Constrói o payload JSON para um satélite no instante t."""
    sid   = sat["sat_id"]
    state = sat_state[sid]

    # Avança fase orbital
    state["orbit_phase"] += sat["orbit_speed"]
    phi = state["orbit_phase"]

    # Posição simulada (pequena órbita elíptica local)
    lat = sat["lat_base"] + sat["orbit_r"] * math.sin(phi)
    lon = sat["lon_base"] + sat["orbit_r"] * math.cos(phi * 0.7)
    alt = sat["alt_base"] + drift(0, sat["alt_base"] * 0.02)  # ±2% altitude

    # Bateria drena lentamente
    state["batt_drain"] += random.uniform(0, 0.002)
    batt = max(3.3, sat["batt_base"] - state["batt_drain"] + drift(0, 0.05))

    return {
        "timestamp":       datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sat_id":          sid,
        "sat_status":      "ok",

        # Bateria
        "battery_voltage": round(batt, 3),

        # Ambiente
        "temperature":     round(jitter(sat["temp_base"], 0.04)),
        "humidity":        round(jitter(sat["hum_base"],  0.05), 1),
        "gas":             round(jitter(sat["gas_base"],  0.08), 1),
        "pressure":        round(jitter(sat["pres_base"], 0.02), 1),

        # GPS
        "latitude":        round(lat, 6),
        "longitude":       round(lon, 6),
        "altitude":        round(alt, 1),

        # IMU
        "imu_accel_x":     round(drift(sat["ax_base"], 0.05), 3),
        "imu_accel_y":     round(drift(sat["ay_base"], 0.05), 3),
        "imu_accel_z":     round(drift(sat["az_base"], 0.05), 3),

        # Sensores especiais
        "digital_nose":    round(jitter(sat["nose_base"], 0.06), 1),
        "spectrum_probe":  round(jitter(sat["spec_base"], 0.04), 1),

        # Sinal RF
        "rssi":            round(drift(sat["rssi_base"], 3.0), 1),
        "snr":             round(drift(sat["snr_base"],  0.8), 1),
    }

# ─── MQTT ─────────────────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Conectado ao broker MQTT")
    else:
        print(f"❌ Falha na ligação, código: {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"⚠️  Desligado inesperadamente (rc={rc}), a tentar reconectar...")

client = mqtt.Client(client_id="uasat_simulator_v2")
client.username_pw_set(BROKER_USER, BROKER_PASS)
client.on_connect    = on_connect
client.on_disconnect = on_disconnect
client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
client.loop_start()

print(f"🛰️  UASAT Multi-Satellite Simulator")
print(f"   Broker : {BROKER_HOST}:{BROKER_PORT}")
print(f"   Sats   : {len(SATELLITES)}")
print(f"   Ciclo  : {PUBLISH_INTERVAL}s  |  Delay/sat: {SAT_DELAY}s")
print(f"   Topics : {TOPIC_BASE}/<sat-id>")
print("─" * 55)

cycle = 0
try:
    while True:
        cycle += 1
        t = time.time()
        print(f"\n📡 Ciclo #{cycle}  —  {datetime.now().strftime('%H:%M:%S')}")

        for sat in SATELLITES:
            payload = build_payload(sat, t)
            msg     = json.dumps(payload)
            result  = client.publish(sat["topic"], msg, qos=0)

            status = "✅" if result.rc == mqtt.MQTT_ERR_SUCCESS else "❌"
            print(
                f"  {status} {sat['sat_id']:8s} | "
                f"batt={payload['battery_voltage']:.2f}V "
                f"T={payload['temperature']}°C "
                f"pos=({payload['latitude']:.4f}, {payload['longitude']:.4f}) "
                f"RSSI={payload['rssi']}dBm"
            )

            time.sleep(SAT_DELAY)

        print(f"   ⏱  Próximo ciclo em {PUBLISH_INTERVAL}s...")
        time.sleep(PUBLISH_INTERVAL)

except KeyboardInterrupt:
    print("\n🛑 Simulador parado pelo utilizador.")

finally:
    client.loop_stop()
    client.disconnect()
    print("✅ Desligado do broker.")
