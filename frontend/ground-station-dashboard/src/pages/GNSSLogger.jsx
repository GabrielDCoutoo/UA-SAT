import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Satellite, Crosshair, Smartphone, Activity } from 'lucide-react';
import Header from '../components/layout/Header';
import { Card, StatCard } from '../components/ui/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL   = import.meta.env.VITE_WS_URL || API_BASE;

// Lookup by numeric Android type ID (GnssStatus.CONSTELLATION_*)
const CONSTELLATIONS_BY_ID = {
  1: { name: 'GPS',     color: '#3b82f6' },
  2: { name: 'SBAS',    color: '#6b7280' },
  3: { name: 'GLONASS', color: '#ef4444' },
  4: { name: 'QZSS',    color: '#ec4899' },
  5: { name: 'BEIDOU',  color: '#f97316' },
  6: { name: 'GALILEO', color: '#22c55e' },
  7: { name: 'NAVIC',   color: '#a855f7' },
};

// Lookup by string name (when the API already serialises it as "GPS" etc.)
const CONSTELLATIONS_BY_NAME = {
  GPS:     { name: 'GPS',     color: '#3b82f6' },
  GLONASS: { name: 'GLONASS', color: '#ef4444' },
  GALILEO: { name: 'GALILEO', color: '#22c55e' },
  BEIDOU:  { name: 'BEIDOU',  color: '#f97316' },
  SBAS:    { name: 'SBAS',    color: '#6b7280' },
  QZSS:    { name: 'QZSS',    color: '#ec4899' },
  NAVIC:   { name: 'NAVIC',   color: '#a855f7' },
};

// Accepts either a numeric ID (1) or a string name ("GPS")
const getConst = (type) => {
  if (type == null) return { name: 'UNKNOWN', color: '#6b7280' };
  if (typeof type === 'string') {
    return CONSTELLATIONS_BY_NAME[type.toUpperCase()] ?? { name: type.toUpperCase(), color: '#6b7280' };
  }
  return CONSTELLATIONS_BY_ID[type] ?? { name: 'UNKNOWN', color: '#6b7280' };
};

// Used by recharts Line colours
const LINE_COLORS = {
  GPS: '#3b82f6', GALILEO: '#22c55e', GLONASS: '#ef4444',
  BEIDOU: '#f97316', NAVIC: '#a855f7', SBAS: '#6b7280', QZSS: '#ec4899',
};

const bearingToCardinal = (b) => {
  if (b == null) return '';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
};

const fmtTime = (ts) => ts
  ? new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : '—';

// Leaflet icon fix — same pattern as StationMap.jsx
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GPS_ICON = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    '<circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#93c5fd" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="4" fill="#93c5fd"/></svg>'
  ),
  iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14],
});

// Normalize a satellite object — handles string names ("GPS") or numeric IDs (1)
function normalizeSat(s) {
  return {
    // Prefer the plain string "constellation" field, fall back to numeric type fields
    constellationType: s.constellation ?? s.constellation_type ?? s.constellationType,
    svid:              s.svid ?? s.prn,
    cn0DbHz:           parseFloat(s.cn0_db_hz ?? s.cn0DbHz ?? s.cn0) || null,
    elevationDegrees:  parseFloat(s.elevation_degrees ?? s.elevationDegrees ?? s.elevation) || null,
    azimuthDegrees:    parseFloat(s.azimuth_degrees   ?? s.azimuthDegrees   ?? s.azimuth)   || null,
    usedInFix:         s.used_in_fix ?? s.usedInFix ?? false,
  };
}

function formatDeviceId(id) {
  if (!id) return 'Android Device';
  // Truncate UUID (8-4-4-4-12 = 36 chars) to first 8 hex chars
  if (/^[0-9a-f]{8}-/i.test(id)) return id.slice(0, 8);
  return id.length > 12 ? id.slice(0, 12) + '…' : id;
}

// Normalize flat snake_case API response into internal camelCase shape
function normalizeApiData(raw) {
  if (!raw) return null;
  const satellites = (raw.satellites ?? raw.measurements ?? []).map(normalizeSat);
  return {
    deviceId:          formatDeviceId(raw.device_id ?? raw.deviceId ?? raw.id),
    timestamp:         raw.timestamp ?? raw.createdAt,
    satellites,
    satellitesVisible: raw.satellites_visible ?? satellites.length,
    satellitesUsed:    raw.satellites_used    ?? satellites.filter(s => s.usedInFix).length,
    location: {
      latitude:  raw.latitude  != null ? parseFloat(raw.latitude)  : null,
      longitude: raw.longitude != null ? parseFloat(raw.longitude) : null,
      altitude:  raw.altitude  != null ? parseFloat(raw.altitude)  : null,
      accuracy:  raw.accuracy  != null ? parseFloat(raw.accuracy)  : null,
      speed:     raw.speed     != null ? parseFloat(raw.speed)     : null,
      bearing:   raw.bearing   != null ? parseFloat(raw.bearing)   : null,
    },
  };
}

// Compute per-constellation average C/N0 for a satellite array
function buildCnoAverages(satellites) {
  const groups = {};
  for (const m of satellites) {
    if (m.cn0DbHz == null) continue;
    const name = getConst(m.constellationType).name;
    (groups[name] ??= []).push(m.cn0DbHz);
  }
  const out = {};
  for (const [name, vals] of Object.entries(groups)) {
    out[name] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }
  return out;
}

// Re-centers the Leaflet map when coordinates change
function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

// ——— Sky Plot (SVG polar chart) ———
function SkyPlot({ satellites }) {
  const SIZE = 300;
  const CX   = SIZE / 2;
  const CY   = SIZE / 2;
  const R    = SIZE / 2 - 24;

  // (elevation°, azimuth°) → SVG (x, y)
  // elevation 90° = center (zenith), 0° = edge (horizon)
  const toXY = (elev, az) => {
    const r     = R * (1 - elev / 90);
    const azRad = (az * Math.PI) / 180;
    return { x: CX + r * Math.sin(azRad), y: CY - r * Math.cos(azRad) };
  };

  return (
    <div className="w-full aspect-square max-w-[300px] mx-auto">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        {/* Filled background circle */}
        <circle cx={CX} cy={CY} r={R} fill="#0f172a" stroke="#374151" strokeWidth={1.5} />

        {/* Elevation rings at 30° and 60° */}
        {[30, 60].map(elev => (
          <circle key={elev} cx={CX} cy={CY} r={R * (1 - elev / 90)}
            fill="none" stroke="#374151" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Elevation labels */}
        <text x={CX + 4} y={CY - R + 12}                   fill="#4b5563" fontSize="9">0°</text>
        <text x={CX + 4} y={CY - R * (1 - 30 / 90) - 3}   fill="#4b5563" fontSize="9">30°</text>
        <text x={CX + 4} y={CY - R * (1 - 60 / 90) - 3}   fill="#4b5563" fontSize="9">60°</text>

        {/* Cardinal cross-hairs */}
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R}     stroke="#374151" strokeWidth={1} />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY}     stroke="#374151" strokeWidth={1} />

        {/* Cardinal labels */}
        <text x={CX}       y={CY - R - 8}  textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="600">N</text>
        <text x={CX}       y={CY + R + 16} textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="600">S</text>
        <text x={CX + R + 10} y={CY + 4}  textAnchor="start"  fill="#9ca3af" fontSize="12" fontWeight="600">E</text>
        <text x={CX - R - 10} y={CY + 4}  textAnchor="end"    fill="#9ca3af" fontSize="12" fontWeight="600">W</text>

        {/* Satellite dots */}
        {satellites.map((sat, i) => {
          if (sat.elevationDegrees == null || sat.azimuthDegrees == null) return null;
          const { x, y } = toXY(sat.elevationDegrees, sat.azimuthDegrees);
          const con  = getConst(sat.constellationType);
          // Dot radius scales with signal strength (C/N0)
          const dotR = Math.max(4, Math.min(9, 3 + ((sat.cn0DbHz ?? 0) / 50) * 6));
          return (
            <g key={`${sat.constellationType}-${sat.svid}-${i}`}>
              <circle cx={x} cy={y} r={dotR} fill={con.color}
                stroke={sat.usedInFix ? '#ffffff' : 'transparent'}
                strokeWidth={1.5} opacity={0.9} />
              <text x={x} y={y - dotR - 2} textAnchor="middle"
                fill={con.color} fontSize="9" fontWeight="600">
                {sat.svid}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ——— C/N0 progress bar ———
function CnoBar({ value }) {
  const pct   = Math.min(100, Math.max(0, (value / 50) * 100));
  const color = value >= 35 ? '#22c55e' : value >= 20 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-900 rounded h-1.5 overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color, height: '100%', transition: 'width 0.4s' }} />
      </div>
      <span style={{ color, minWidth: 44, fontSize: 11, fontWeight: 700 }}>{value.toFixed(1)}</span>
    </div>
  );
}

// ——— Main page ———
export default function GNSSLogger() {
  const [gnssData,     setGnssData]     = useState(null);
  const [chartHistory, setChartHistory] = useState([]);
  const [live,         setLive]         = useState(false);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const socketRef = useRef(null);
  const timerRef  = useRef(null);

  const pushChartEntry = useCallback((data) => {
    const entry = { time: fmtTime(new Date()), ...buildCnoAverages(data.satellites ?? []) };
    setChartHistory(prev => [...prev.slice(-49), entry]);
  }, []);

  // REST polling (latest + history)
  const fetchData = useCallback(async () => {
    try {
      const [latestRes, histRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/gnss/latest?t=${Date.now()}`),
        fetch(`${API_BASE}/api/gnss/history?limit=100&t=${Date.now()}`),
      ]);

      if (latestRes.status === 'fulfilled' && latestRes.value.ok) {
        const j       = await latestRes.value.json();
        const raw     = j?.data ?? j;
        if (raw?.satellites || raw?.latitude != null) {
          setGnssData(normalizeApiData(raw));
          setLastUpdate(new Date());
        }
      }

      if (histRes.status === 'fulfilled' && histRes.value.ok) {
        const j     = await histRes.value.json();
        const items = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        if (items.length > 0 && chartHistory.length === 0) {
          setChartHistory(items.slice(-50).map(item => {
            const norm = normalizeApiData(item);
            return {
              time: fmtTime(item.timestamp ?? item.createdAt ?? item.receivedAt),
              ...buildCnoAverages(norm?.satellites ?? []),
            };
          }));
        }
      }
    } catch { /* ignore network errors while waiting for device */ }
  }, [chartHistory.length]);

  // Socket.io — real-time updates
  useEffect(() => {
    const socket = io(WS_URL, { reconnection: true, reconnectionDelay: 3000, timeout: 10000 });
    socketRef.current = socket;

    socket.on('connect',       () => setLive(true));
    socket.on('disconnect',    () => setLive(false));
    socket.on('connect_error', () => setLive(false));

    socket.on('gnss:measurement', (data) => {
      const normalized = normalizeApiData(data);
      setGnssData(normalized);
      setLastUpdate(new Date());
      pushChartEntry(normalized);
    });

    return () => socket.disconnect();
  }, [pushChartEntry]);

  // Auto-refresh REST every 2 s
  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, 2000);
    return () => clearInterval(timerRef.current);
  }, [fetchData]);

  // Derived values — gnssData is always in normalized camelCase shape
  const satellites        = gnssData?.satellites        ?? [];
  const location          = gnssData?.location          ?? null;
  const deviceId          = gnssData?.deviceId          ?? '—';
  const satellitesVisible = gnssData?.satellitesVisible ?? 0;
  const satellitesUsed    = gnssData?.satellitesUsed    ?? 0;
  const hasData           = !!gnssData;
  const hasLocation       = location?.latitude != null && location?.longitude != null;

  const sortedSats = [...satellites].sort((a, b) => (b.cn0DbHz ?? 0) - (a.cn0DbHz ?? 0));

  // Constellations present in the chart (for line colours)
  const chartConstellations = [
    ...new Set(chartHistory.flatMap(h => Object.keys(h).filter(k => k !== 'time'))),
  ];

  return (
    <div className="w-full p-6 bg-gray-900 text-white min-h-screen">

      {/* Header */}
      <Header
        title={
          <div className="flex items-center gap-3">
            <Satellite size={28} className="text-blue-400" />
            GNSS Logger
          </div>
        }
        subtitle="Real-time GNSS measurements from Android device"
      >
        <div className="flex items-center gap-3 mt-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            live
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-700 text-gray-400 border border-gray-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {live ? 'Live' : 'Waiting'}
          </span>
          {lastUpdate && (
            <span className="text-xs text-gray-500">Last update: {fmtTime(lastUpdate)}</span>
          )}
        </div>
      </Header>

      {/* Empty state */}
      {!hasData && (
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-10 text-center">
          <Satellite size={52} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-300 font-semibold text-lg">Waiting for GPS fix...</p>
          <p className="text-gray-500 text-sm mt-1">
            Connect your Android device and open the GNSS logger app
          </p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Satellite size={20} className="text-blue-400" />}
          label="Satellites Visible"
          value={hasData ? satellitesVisible : '—'}
          color="blue"
        />
        <StatCard
          icon={<Activity size={20} className="text-green-400" />}
          label="Satellites in Fix"
          value={hasData ? satellitesUsed : '—'}
          color="green"
        />
        <StatCard
          icon={<Crosshair size={20} className="text-yellow-400" />}
          label="Accuracy"
          value={hasData && location?.accuracy != null ? `${location.accuracy.toFixed(1)} m` : '—'}
          color="yellow"
        />
        <StatCard
          icon={<Smartphone size={20} className="text-violet-400" />}
          label="Device ID"
          value={deviceId}
          color="violet"
        />
      </div>

      {/* Main grid: Sky Plot + Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Sky Plot */}
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Satellite size={14} className="text-blue-400" />
            Sky Plot
          </h2>

          {satellites.length > 0 ? (
            <>
              <SkyPlot satellites={satellites} />
              {/* Constellation legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
                {Object.values(CONSTELLATIONS_BY_NAME)
                  .filter(c => satellites.some(m => getConst(m.constellationType).name === c.name))
                  .map(c => (
                    <div key={c.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  ))
                }
              </div>
            </>
          ) : (
            <div className="aspect-square flex items-center justify-center">
              <p className="text-gray-500 text-sm">No satellite data</p>
            </div>
          )}
        </Card>

        {/* Location */}
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Crosshair size={14} className="text-green-400" />
            Location
          </h2>

          {hasLocation ? (
            <div className="space-y-4">
              {/* Lat / Lon */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Latitude</div>
                  <div className="text-xl font-bold text-white font-mono">{location.latitude.toFixed(6)}°</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Longitude</div>
                  <div className="text-xl font-bold text-white font-mono">{location.longitude.toFixed(6)}°</div>
                </div>
              </div>

              {/* Altitude / Speed / Bearing */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Altitude</div>
                  <div className="text-sm font-bold text-blue-300">
                    {location.altitude != null ? `${location.altitude.toFixed(1)} m` : '—'}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Speed</div>
                  <div className="text-sm font-bold text-green-300">
                    {location.speed != null ? `${(location.speed * 3.6).toFixed(1)} km/h` : '—'}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Bearing</div>
                  <div className="text-sm font-bold text-yellow-300">
                    {location.bearing != null
                      ? `${location.bearing.toFixed(0)}° ${bearingToCardinal(location.bearing)}`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Leaflet map */}
              <div className="rounded-lg overflow-hidden" style={{ height: 200 }}>
                <MapContainer
                  center={[location.latitude, location.longitude]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapRecenter lat={location.latitude} lng={location.longitude} />
                  <Marker position={[location.latitude, location.longitude]} icon={GPS_ICON}>
                    <Popup>
                      <strong>{deviceId}</strong><br />
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ minHeight: 340 }}>
              <p className="text-gray-500 text-sm">Waiting for GPS fix...</p>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom: Satellite table + C/N0 chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Satellite List */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2">
            <Satellite size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Satellite List</span>
            <span className="text-xs text-gray-500 ml-auto">{satellites.length} visible</span>
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left border-b border-gray-700">Constellation</th>
                  <th className="px-4 py-2.5 text-left border-b border-gray-700">PRN</th>
                  <th className="px-4 py-2.5 text-left border-b border-gray-700 min-w-[120px]">C/N0 (dB-Hz)</th>
                  <th className="px-4 py-2.5 text-left border-b border-gray-700">Elev</th>
                  <th className="px-4 py-2.5 text-left border-b border-gray-700">Az</th>
                  <th className="px-4 py-2.5 text-center border-b border-gray-700">Fix</th>
                </tr>
              </thead>
              <tbody>
                {sortedSats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500">No satellite data</td>
                  </tr>
                ) : sortedSats.map((sat, i) => {
                  const con = getConst(sat.constellationType);
                  return (
                    <tr
                      key={`${sat.constellationType}-${sat.svid}-${i}`}
                      className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors"
                      style={{ borderLeft: `3px solid ${con.color}55` }}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-xs" style={{ color: con.color }}>{con.name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{sat.svid}</td>
                      <td className="px-4 py-2.5">
                        {sat.cn0DbHz != null
                          ? <CnoBar value={sat.cn0DbHz} />
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-300 text-xs">
                        {sat.elevationDegrees != null ? `${sat.elevationDegrees.toFixed(0)}°` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-300 text-xs">
                        {sat.azimuthDegrees != null ? `${sat.azimuthDegrees.toFixed(0)}°` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {sat.usedInFix
                          ? <span className="text-green-400 font-bold text-base">✓</span>
                          : <span className="text-red-500 text-base">✗</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* C/N0 History Chart */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">C/N0 History</span>
            <span className="text-xs text-gray-500 ml-auto">{chartHistory.length} samples</span>
          </div>

          {chartHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 55]}
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  label={{ value: 'dB-Hz', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10, offset: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(val, name) => [`${val} dB-Hz`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                {chartConstellations.map(name => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LINE_COLORS[name] ?? '#9ca3af'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 320 }}>
              <p className="text-gray-500 text-sm">Waiting for GNSS measurements...</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
