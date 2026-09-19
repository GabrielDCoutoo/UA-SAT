// src/pages/TelemetryCharts.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import {
  LineChart, Line,
  PieChart, Pie, Cell,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { io } from 'socket.io-client';
import Header from '../components/layout/Header';

// ── Palette & constants ────────────────────────────────────────────────────────

const C = {
  frame0:  '#3b82f6',
  frame1:  '#a855f7',
  retrans: '#f97316',
  green:   '#22c55e',
};

const BATTERY_PCT = { full: 100, half_full: 75, half_empty: 25, empty: 0 };

const CHART_HEIGHT = 300;

const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    fontSize: 13,
    padding: '10px 14px',
  },
  labelStyle: { color: '#9ca3af', marginBottom: 6, fontSize: 12 },
  itemStyle:  { color: '#e5e7eb', fontSize: 13 },
};

const AXIS = {
  stroke:   '#4b5563',
  tick:     { fill: '#9ca3af', fontSize: 12 },
  tickLine: false,
};

const LEGEND_STYLE = {
  wrapperStyle: { color: '#d1d5db', fontSize: 14, fontWeight: 600, paddingTop: 8 },
};

const TIME_RANGES = [
  { id: '5m',  label: '5 min',  ms: 5 * 60 * 1000 },
  { id: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { id: '1h',  label: '1 hour', ms: 60 * 60 * 1000 },
  { id: 'all', label: 'All',    ms: null },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const toNum = (v) => (v == null ? null : Number(v));

const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

// ── SVG illustrations ──────────────────────────────────────────────────────────

const SatelliteSVG = () => (
  <svg viewBox="0 0 120 100" style={{ width: 80, height: 64 }}>
    <rect x="2"  y="38" width="36" height="24" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" rx="2"/>
    <line x1="20" y1="38" x2="20" y2="62" stroke="#3b82f6" strokeWidth="1" opacity="0.5"/>
    <rect x="82" y="38" width="36" height="24" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" rx="2"/>
    <line x1="100" y1="38" x2="100" y2="62" stroke="#3b82f6" strokeWidth="1" opacity="0.5"/>
    <rect x="38" y="28" width="44" height="44" fill="#1e40af" stroke="#3b82f6" strokeWidth="2" rx="3"/>
    <rect x="44" y="34" width="32" height="14" fill="#1d4ed8" rx="1"/>
    <rect x="44" y="52" width="32" height="14" fill="#1d4ed8" rx="1"/>
    <line x1="60" y1="28" x2="60" y2="8" stroke="#60a5fa" strokeWidth="2"/>
    <circle cx="60" cy="5" r="3.5" fill="#60a5fa"/>
  </svg>
);

const GatewaySVG = () => (
  <svg viewBox="0 0 120 100" style={{ width: 80, height: 64 }}>
    <polygon points="52,92 68,92 64,34 56,34" fill="#ea580c"/>
    <rect x="36" y="92" width="48" height="6" fill="#9a3412" rx="2"/>
    <path d="M 38,32 Q 60,16 82,32" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round"/>
    <line x1="60" y1="32" x2="60" y2="46" stroke="#f97316" strokeWidth="2"/>
    <path d="M 28,52 Q 44,34 60,52" fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.7"/>
    <path d="M 16,44 Q 38,20 60,44" fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.45"/>
    <path d="M  4,36 Q 32, 4 60,36" fill="none" stroke="#f97316" strokeWidth="1"   opacity="0.25"/>
  </svg>
);

// ── Live badge ─────────────────────────────────────────────────────────────────

const LiveBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 10, verticalAlign: 'middle' }}>
    <span className="telemetry-live-dot" />
    <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>LIVE</span>
  </span>
);

// ── Chart card ─────────────────────────────────────────────────────────────────

const ChartCard = ({ title, children, fullWidth = false, empty = false, isLive = false }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-lg p-5 ${fullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
    <h3 style={{
      fontSize: 16,
      fontWeight: 700,
      color: '#d1d5db',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
    }}>
      {title}
      {isLive && <LiveBadge />}
    </h3>
    {empty
      ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: 14, height: CHART_HEIGHT }}>
          No data in selected time window
        </div>
      : children}
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────────

const TelemetryCharts = () => {
  const [rawData, setRawData]         = useState({ frame0: [], frame1: [], retrans: [] });
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filter, setFilter]           = useState('all');
  const [timeRange, setTimeRange]     = useState('15m');
  const [lastLiveAt, setLastLiveAt]   = useState(null);
  const [now, setNow]                 = useState(() => Date.now());

  const apiUrl = import.meta.env.VITE_API_URL || '';

  // ── Tick "now" every 10 s to slide the live window ─────────────────────────
  useEffect(() => {
    if (timeRange === 'all') return;
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, [timeRange]);

  // ── Socket.io — LIVE indicator + real-time data append ─────────────────────
  useEffect(() => {
    const socketUrl = apiUrl || 'http://localhost:3000';
    const socket = io(socketUrl, { reconnection: true, transports: ['websocket', 'polling'] });

    socket.on('uasat:telemetry', (data) => {
      setLastLiveAt(Date.now());
      const ft = data.frame_type;
      if (ft === 'frame0' || ft === 'frame1' || ft === 'retrans') {
        setRawData(prev => ({
          ...prev,
          [ft]: [...prev[ft], data].slice(-500),
        }));
      }
    });

    return () => socket.disconnect();
  }, [apiUrl]);

  const isLive = lastLiveAt != null && Date.now() - lastLiveAt < 60000;

  // ── REST polling ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const limit = timeRange === 'all' ? 500 : 300;
      const [r0, r1, rt] = await Promise.all([
        fetch(`${apiUrl}/api/uasat/telemetry?limit=${limit}&frame_type=frame0`),
        fetch(`${apiUrl}/api/uasat/telemetry?limit=${limit}&frame_type=frame1`),
        fetch(`${apiUrl}/api/uasat/telemetry?limit=${limit}&frame_type=retrans`),
      ]);
      const [d0, d1, dt] = await Promise.all([r0.json(), r1.json(), rt.json()]);
      setRawData({
        frame0:  d0.success ? d0.data : [],
        frame1:  d1.success ? d1.data : [],
        retrans: dt.success ? dt.data : [],
      });
      setLastRefresh(new Date());
      setNow(Date.now());
    } catch (err) {
      console.error('[TelemetryCharts] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, timeRange]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // ── Time window filtering ───────────────────────────────────────────────────
  const rangeMs = TIME_RANGES.find(r => r.id === timeRange)?.ms ?? null;
  const cutoff  = rangeMs ? now - rangeMs : null;
  const xDomain = cutoff ? [cutoff, now] : ['dataMin', 'dataMax'];

  const applyWindow = (arr) => {
    if (!cutoff) return arr;
    return arr.filter(d => d.ts >= cutoff);
  };

  // ── Source filter ───────────────────────────────────────────────────────────
  const f0  = (filter === 'all' || filter === 'satellite') ? rawData.frame0  : [];
  const f1  = (filter === 'all' || filter === 'satellite') ? rawData.frame1  : [];
  const frt = (filter === 'all' || filter === 'gateway')   ? rawData.retrans : [];

  // ── Chart datasets ──────────────────────────────────────────────────────────

  const tempData = applyWindow(
    f0.map(d => ({ ts: +new Date(d.received_at), sat_temp: toNum(d.temperature) }))
      .sort((a, b) => a.ts - b.ts)
  );

  const humPressData = applyWindow(
    f0.map(d => ({ ts: +new Date(d.received_at), humidity: toNum(d.humidity), pressure: toNum(d.pressure) }))
      .sort((a, b) => a.ts - b.ts)
  );

  const imuData = applyWindow(
    f1.filter(d => d.imu_accel_x != null && d.imu_accel_y != null && d.imu_accel_z != null)
      .map(d => ({
        ts:  +new Date(d.received_at),
        mag: parseFloat(Math.sqrt(d.imu_accel_x ** 2 + d.imu_accel_y ** 2 + d.imu_accel_z ** 2).toFixed(3)),
      }))
      .sort((a, b) => a.ts - b.ts)
  );

  const signalData = applyWindow(
    [
      ...f0.map(d => ({ ts: +new Date(d.received_at), rssi_f0: toNum(d.rssi), snr_f0: toNum(d.snr), rssi_f1: null, snr_f1: null, rssi_rt: null, snr_rt: null })),
      ...f1.map(d => ({ ts: +new Date(d.received_at), rssi_f0: null, snr_f0: null, rssi_f1: toNum(d.rssi), snr_f1: toNum(d.snr), rssi_rt: null, snr_rt: null })),
      ...frt.map(d => ({ ts: +new Date(d.received_at), rssi_f0: null, snr_f0: null, rssi_f1: null, snr_f1: null, rssi_rt: toNum(d.rssi), snr_rt: toNum(d.snr) })),
    ].sort((a, b) => a.ts - b.ts)
  );

  const battData = applyWindow(
    [
      ...f0.map(d => ({ ts: +new Date(d.received_at), batt_f0: BATTERY_PCT[d.battery_status] ?? null, batt_f1: null, batt_rt: null })),
      ...f1.map(d => ({ ts: +new Date(d.received_at), batt_f0: null, batt_f1: BATTERY_PCT[d.battery_status] ?? null, batt_rt: null })),
      ...frt.map(d => ({ ts: +new Date(d.received_at), batt_f0: null, batt_f1: null, batt_rt: d.sat_battery_pct != null ? toNum(d.sat_battery_pct) : (BATTERY_PCT[d.battery_status] ?? null) })),
    ].sort((a, b) => a.ts - b.ts)
  );

  const pieData = [
    { name: 'frame0',  value: rawData.frame0.length,  color: C.frame0  },
    { name: 'frame1',  value: rawData.frame1.length,  color: C.frame1  },
    { name: 'retrans', value: rawData.retrans.length, color: C.retrans },
  ].filter(d => d.value > 0);

  // ── Shared X-axis props ─────────────────────────────────────────────────────
  const xAxisProps = {
    dataKey:       'ts',
    type:          'number',
    domain:        xDomain,
    tickFormatter: fmtTime,
    tickCount:     5,
    ...AXIS,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes telemetryLivePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 5px 2px rgba(34,197,94,0.65); }
          50%       { opacity: 0.35; box-shadow: 0 0 12px 5px rgba(34,197,94,0.25); }
        }
        .telemetry-live-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          background-color: #22c55e;
          display: inline-block;
          animation: telemetryLivePulse 1.4s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full min-h-screen flex flex-col p-6">

        {/* ── Header ── */}
        <Header
          title={
            <div className="flex items-center gap-3">
              <LineChartIcon className="text-blue-400" size={32} />
              Telemetry Charts
            </div>
          }
          subtitle="Live telemetry — satellite vs gateway"
        >
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="text-xs text-gray-500">
              Auto-refresh every 15 s
              {lastRefresh && ` · Last: ${fmtTime(lastRefresh)}`}
            </span>
            {timeRange === 'all' && (
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors text-sm"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            )}
          </div>
        </Header>

        {/* ── Device cards ── */}
        <div className="grid grid-cols-2 gap-6 mb-6">

          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/30 rounded-lg p-5 flex items-center gap-6">
            <div className="flex-shrink-0 p-3 bg-blue-500/10 rounded-xl">
              <SatelliteSVG />
            </div>
            <div className="flex-1">
              <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">Satellite</div>
              <div className="text-xl font-bold text-white">UASAT CubeSat</div>
              <div className="text-sm text-gray-400 mt-1">Direct LoRa frames</div>
              <div className="flex gap-2 mt-3">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">frame0</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">frame1</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-400">{rawData.frame0.length + rawData.frame1.length}</div>
              <div className="text-xs text-gray-500">packets</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/5 border border-orange-500/30 rounded-lg p-5 flex items-center gap-6">
            <div className="flex-shrink-0 p-3 bg-orange-500/10 rounded-xl">
              <GatewaySVG />
            </div>
            <div className="flex-1">
              <div className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-1">Ground Gateway</div>
              <div className="text-xl font-bold text-white">Gateway Node</div>
              <div className="text-sm text-gray-400 mt-1">Relayed gateway frames</div>
              <div className="flex gap-2 mt-3">
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full border border-orange-500/30">retrans</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-400">{rawData.retrans.length}</div>
              <div className="text-xs text-gray-500">packets</div>
            </div>
          </div>
        </div>

        {/* ── Control bar ── */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">

          {/* Time range selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Window</span>
            {TIME_RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => { setTimeRange(r.id); setNow(Date.now()); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  timeRange === r.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-blue-500/50 hover:text-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Frame filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Filter</span>
            {[
              { id: 'all',       label: 'All Frames' },
              { id: 'satellite', label: 'Satellite' },
              { id: 'gateway',   label: 'Gateway' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-blue-500/50 hover:text-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Charts grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. Temperature (full width) */}
          <ChartCard title="Temperature over Time" fullWidth empty={tempData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis unit=" °C" {...AXIS} width={58} />
                <Tooltip labelFormatter={fmtTime} formatter={(v) => [`${v} °C`, 'Satellite Temp']} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line dataKey="sat_temp" name="Satellite Temp"
                  stroke={C.frame0} type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 2. Humidity & Pressure */}
          <ChartCard title="Humidity & Pressure (frame0)" empty={humPressData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <ComposedChart data={humPressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis yAxisId="left"  unit=" %"   domain={[0, 100]} {...AXIS} width={52} />
                <YAxis yAxisId="right" unit=" hPa" domain={['auto', 'auto']} orientation="right" {...AXIS} width={68} />
                <Tooltip labelFormatter={fmtTime} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line yAxisId="left"  dataKey="humidity" name="Humidity (%)"
                  stroke={C.frame0} type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
                <Line yAxisId="right" dataKey="pressure" name="Pressure (hPa)"
                  stroke={C.green}  type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 3. IMU Accel Magnitude */}
          <ChartCard title="IMU — Accel Magnitude (frame1)" empty={imuData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={imuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis unit=" m/s²" {...AXIS} width={62} />
                <Tooltip labelFormatter={fmtTime} formatter={(v) => [`${v} m/s²`, 'Accel |a|']} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line dataKey="mag" name="Accel |a| (m/s²)"
                  stroke={C.frame1} type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 4a. RSSI (full width) */}
          <ChartCard title="Signal Strength — RSSI (dBm)" fullWidth empty={signalData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={signalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis unit=" dBm" {...AXIS} width={68} />
                <Tooltip labelFormatter={fmtTime} formatter={(v, name) => [`${v} dBm`, name]} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line dataKey="rssi_f0" name="frame0"
                  stroke={C.frame0}  type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
                <Line dataKey="rssi_f1" name="frame1"
                  stroke={C.frame1}  type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
                <Line dataKey="rssi_rt" name="retrans"
                  stroke={C.retrans} type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 4b. SNR (full width) */}
          <ChartCard title="Signal Quality — SNR (dB)" fullWidth empty={signalData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={signalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis unit=" dB" {...AXIS} width={58} />
                <Tooltip labelFormatter={fmtTime} formatter={(v, name) => [`${v} dB`, name]} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line dataKey="snr_f0" name="frame0"
                  stroke={C.frame0}  type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} strokeDasharray="6 3" />
                <Line dataKey="snr_f1" name="frame1"
                  stroke={C.frame1}  type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} strokeDasharray="6 3" />
                <Line dataKey="snr_rt" name="retrans"
                  stroke={C.retrans} type="monotone" dot={false} connectNulls={false} strokeWidth={2.5} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 5. Battery Level */}
          <ChartCard title="Battery Level over Time" empty={battData.length === 0} isLive={isLive}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={battData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.7} />
                <XAxis {...xAxisProps} />
                <YAxis unit="%" domain={[0, 100]} ticks={[0, 25, 75, 100]}
                  tickFormatter={v => ({ 0: 'Empty', 25: 'Low', 75: 'Good', 100: 'Full' })[v] ?? v}
                  {...AXIS} width={52} />
                <Tooltip labelFormatter={fmtTime} {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
                <Line dataKey="batt_f0" name="Battery frame0"
                  stroke={C.frame0}  type="stepAfter" dot={false} connectNulls={false} strokeWidth={2.5} />
                <Line dataKey="batt_f1" name="Battery frame1"
                  stroke={C.frame1}  type="stepAfter" dot={false} connectNulls={false} strokeWidth={2.5} />
                <Line dataKey="batt_rt" name="Battery retrans"
                  stroke={C.retrans} type="stepAfter" dot={false} connectNulls={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 6. Frame distribution pie */}
          <ChartCard title="Frame Type Distribution" empty={pieData.length === 0}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#6b7280' }}
                  style={{ fontSize: 13 }}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend {...LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      </div>
    </>
  );
};

export default TelemetryCharts;
