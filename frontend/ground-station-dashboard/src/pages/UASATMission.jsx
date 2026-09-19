// UASATMission.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Rocket, Activity, Radio, Battery, Thermometer, Droplets, Wind,
  Gauge, Target, Signal, RefreshCw, MapPin, Server, AlertCircle,
  Satellite, Router, Wifi, WifiOff, Clock, RotateCw, Radar,
} from 'lucide-react';
import { StationMap } from '../components/StationMap';
import {
  batteryPct, batteryColor, batteryBarColor, rssiColor, snrColor,
  fmtVal, fmtTemp, fmtHum, fmtTime, fmtRelative, fmtGas,
} from '../utils/telemetry';
import Header from '../components/layout/Header';

// GPS coordinates known to be hardcoded in RAK transmitter firmware
const HARDCODED_GPS = { lat: 41.161797, lon: -8.583900 };
const fmtGPS = v => v != null ? Number(v).toFixed(6) : '—';
const fmtIMU = v => v != null ? Number(v).toFixed(4) : 'N/A';
const vectorMagnitude = (x, y, z) => {
  if (x == null || y == null || z == null) return null;
  return Math.sqrt(Number(x) ** 2 + Number(y) ** 2 + Number(z) ** 2);
};
const isHardcodedGPS = (lat, lon) =>
  lat != null && lon != null &&
  Math.abs(Number(lat) - HARDCODED_GPS.lat) < 0.0001 &&
  Math.abs(Number(lon) - HARDCODED_GPS.lon) < 0.0001;

// Gateway nodes are numbered 1–4 in firmware (not 0-indexed); fill gaps where omitted
// ATUALIZADO: Suporta os 6 nós reais do array (0 a 5) vindos do loop do ESP32
const normalizeNodes = (gw_nodes) => {
  const map = Object.fromEntries((gw_nodes || []).map(n => [n.id, n]));
  return [0, 1, 2, 3, 4, 5].map(id => map[id] ?? { id, status: null, value: null });
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const STACK_LIMIT = 5;

// ─── Frame badge ──────────────────────────────────────────────────────────────
const FRAME_BADGE = {
  frame0:  { label: 'frame0',  cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  frame1:  { label: 'frame1',  cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  retrans: { label: 'retrans', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
};
const FrameBadge = ({ type }) => {
  const b = FRAME_BADGE[type];
  if (!b) return null;
  return <span className={`text-xs px-2 py-0.5 rounded border font-mono ${b.cls}`}>{b.label}</span>;
};

const fmtPct = v => v != null ? `${Number(v).toFixed(1)}%` : '—';

// Card-specific thresholds (deliberately different from the Signal Quality panel's)
const rssiDotColor   = v => v > -80 ? 'bg-green-500' : v > -95 ? 'bg-yellow-500' : 'bg-red-500';
const snrValueColor  = v => v > 8   ? 'text-green-400' : v > 3 ? 'text-yellow-400' : 'text-red-400';

const FRAME_ACCENT = {
  frame0:  'border-l-blue-500',
  frame1:  'border-l-purple-500',
  retrans: 'border-l-orange-500',
};

// ─── Packet row (compact card used in the three FIFO stacks) ──────────────────
const PacketRow = ({ packet, isSelected, isPinned, onClick }) => {
  const rssi      = parseFloat(packet.rssi) || 0;
  const snr       = parseFloat(packet.snr)  || 0;
  const timestamp = packet.received_at || packet.packet_timestamp || packet.timestamp;
  const accent    = FRAME_ACCENT[packet.frame_type] || 'border-l-gray-600';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-l-4 ${accent} p-3.5 flex flex-col gap-2 cursor-pointer transition-all duration-200 animate-fade-in border-gray-700 ${
        isSelected
          ? 'bg-blue-500/10 shadow-[0_0_12px_2px_rgba(59,130,246,0.45)]'
          : 'bg-gray-800 hover:bg-gray-700/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <FrameBadge type={packet.frame_type} />
        {isSelected && isPinned && <span title="Manually pinned" className="text-xs">📌</span>}
      </div>
      <div className="text-[10px] text-gray-500 flex items-center gap-1">
        <Clock size={10} className="flex-shrink-0" />
        {fmtRelative(timestamp)}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rssiDotColor(rssi)}`} />
        {rssi.toFixed(0)} <span className="text-gray-400 font-normal">dBm</span>
      </div>
      <div className={`text-xs font-bold ${snrValueColor(snr)}`}>{snr.toFixed(0)} <span className="text-gray-400 font-normal">dB</span></div>
    </div>
  );
};

// ─── Stack column (GW PACKETS / UA_SAT FRAME0 / UA_SAT FRAME1) ────────────────
const LIVE_WINDOW_MS = 30 * 1000;

const STACK_META = {
  retrans: { title: 'GW PACKETS',    color: 'text-orange-400', badgeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/30', Icon: Router },
  frame0:  { title: 'UA_SAT FRAME0', color: 'text-blue-400',   badgeCls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',       Icon: Satellite },
  frame1:  { title: 'UA_SAT FRAME1', color: 'text-purple-400', badgeCls: 'bg-purple-500/15 text-purple-300 border-purple-500/30', Icon: Satellite },
};

const PacketStack = ({ type, packets, selectedId, isPinned, onSelect, now }) => {
  const { title, color, badgeCls, Icon } = STACK_META[type];
  const latestTs = packets[0]?.received_at || packets[0]?.timestamp;
  const isLive = latestTs && (now - new Date(latestTs)) < LIVE_WINDOW_MS;

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 mb-2.5 flex-shrink-0">
        <Icon size={15} className={color} />
        <h3 className={`text-xs font-bold tracking-wide truncate ${color}`}>{title}</h3>
        <span
          title={isLive ? 'Receiving live data' : 'No recent packets'}
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}
        />
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border flex-shrink-0 ml-auto ${badgeCls}`}>
          {packets.length}/{STACK_LIMIT}
        </span>
      </div>
      <div className="space-y-2.5 min-h-[460px]">
        {packets.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
            <p className="text-gray-500 text-[11px]">Waiting…</p>
          </div>
        ) : (
          packets.map(pkt => (
            <PacketRow
              key={pkt._id}
              packet={pkt}
              isSelected={selectedId === pkt._id}
              isPinned={isPinned}
              onClick={() => onSelect(pkt)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const UASATMission = () => {
  const serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  const [wsConnected, setWsConnected] = useState(false);
  const [mqttOnline,  setMqttOnline]  = useState(false);
  const socketRef = useRef(null);

  const [stats, setStats] = useState({
    total_messages: 0, active_satellites: 0, healthy_satellites: 0, messages_per_hour: 0,
  });
  const [loading, setLoading] = useState(true);

  // ── Three FIFO stacks: gateway (retrans) / satellite frame0 / satellite frame1 ──
  const [gwPackets,         setGwPackets]         = useState([]); // max 5, newest first
  const [satFrame0Packets,  setSatFrame0Packets]  = useState([]); // max 5, newest first
  const [satFrame1Packets,  setSatFrame1Packets]  = useState([]); // max 5, newest first
  const [selectedPacket,    setSelectedPacket]    = useState(null); // drives the Data panel
  const [pinnedId,          setPinnedId]          = useState(null); // non-null when user manually selected a packet
  const pinnedIdRef = useRef(null);
  useEffect(() => { pinnedIdRef.current = pinnedId; }, [pinnedId]);

  // Ticks every 5s so "time ago" labels and the live/stale dot stay accurate
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  const isRetrans = (d) => d?.frame_type === 'retrans';
  const isFrame0  = (d) => d?.frame_type === 'frame0';
  const isFrame1  = (d) => d?.frame_type === 'frame1';

  const selectPacket = (pkt) => {
    setSelectedPacket(pkt);
    setPinnedId(pkt._id);
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const withId = (arr) => (arr || []).map(p => ({
        ...p, _id: p.id || `rest-${p.received_at}-${Math.random().toString(36).slice(2, 6)}`,
      }));

      const [f0Res, f1Res, gwRes, statRes] = await Promise.all([
        fetch(`${serverUrl}/api/uasat/telemetry?frame_type=frame0&limit=${STACK_LIMIT}`),
        fetch(`${serverUrl}/api/uasat/telemetry?frame_type=frame1&limit=${STACK_LIMIT}`),
        fetch(`${serverUrl}/api/uasat/telemetry?frame_type=retrans&limit=${STACK_LIMIT}`),
        fetch(`${serverUrl}/api/uasat/stats?hours=24`),
      ]);
      const [f0Data, f1Data, gwData, statData] = await Promise.all([
        f0Res.json(), f1Res.json(), gwRes.json(), statRes.json(),
      ]);

      const f0 = f0Data.success ? withId(f0Data.data) : [];
      const f1 = f1Data.success ? withId(f1Data.data) : [];
      const gw = gwData.success ? withId(gwData.data) : [];

      setSatFrame0Packets(f0);
      setSatFrame1Packets(f1);
      setGwPackets(gw);

      const newest = [f0[0], f1[0], gw[0]]
        .filter(Boolean)
        .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))[0];
      setSelectedPacket(prev => prev || newest || null);

      if (statData.success) setStats(statData.stats);
    } catch (err) {
      console.error('[UASAT Mission] REST error:', err);
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const socket = io(serverUrl, { reconnection: true, reconnectionDelay: 3000, timeout: 10000 });
    socketRef.current = socket;

    socket.on('connect',    () => setWsConnected(true));
    socket.on('disconnect', () => { setWsConnected(false); setMqttOnline(false); });

    socket.on('uasat:telemetry', (data) => {
      const pkt = { ...data, _id: data.id || `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
      setMqttOnline(true);

      if (pkt.frame_type === 'retrans') {
        setGwPackets(prev => prev.some(p => p._id === pkt._id) ? prev : [pkt, ...prev].slice(0, STACK_LIMIT));
      } else if (pkt.frame_type === 'frame0') {
        setSatFrame0Packets(prev => prev.some(p => p._id === pkt._id) ? prev : [pkt, ...prev].slice(0, STACK_LIMIT));
      } else if (pkt.frame_type === 'frame1') {
        setSatFrame1Packets(prev => prev.some(p => p._id === pkt._id) ? prev : [pkt, ...prev].slice(0, STACK_LIMIT));
      }

      // Auto-select the newest packet unless the user has pinned a different one
      setSelectedPacket(prev => (pinnedIdRef.current ? prev : pkt));
    });

    return () => socket.disconnect();
  }, [serverUrl]);

  // Newest packet across all three stacks — drives "online" status and the pin indicator
  const latestOverall = [gwPackets[0], satFrame0Packets[0], satFrame1Packets[0]]
    .filter(Boolean)
    .sort((a, b) => new Date(b.received_at || b.timestamp || 0) - new Date(a.received_at || a.timestamp || 0))[0];
  const lastActivity = latestOverall ? new Date(latestOverall.received_at || latestOverall.timestamp) : null;
  const isOnline = lastActivity && (Date.now() - lastActivity) < ONLINE_WINDOW_MS;
  const isPinned = pinnedId != null && selectedPacket && (!latestOverall || selectedPacket._id !== latestOverall._id);

  const resumeLive = () => {
    setPinnedId(null);
    if (latestOverall) setSelectedPacket(latestOverall);
  };

  return (
    <div className="w-full min-h-screen flex flex-col p-6">

      {/* ── Header ── */}
      <Header
        title="UASAT Mission"
        subtitle="Real-time satellite telemetry from ESP32"
      >
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button
            onClick={loadHistory}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-sm font-semibold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className={`flex items-center gap-1.5 text-sm ${wsConnected ? 'text-blue-400' : 'text-gray-500'}`}>
            {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>WebSocket</span>
          </div>
          <div className={`flex items-center gap-1.5 text-sm ${mqttOnline ? 'text-orange-400' : 'text-gray-500'}`}>
            <Radio size={14} />
            <span>MQTT {mqttOnline ? '(live)' : '(waiting)'}</span>
          </div>
          {lastActivity && (
            <span className="text-gray-500 text-xs">Last packet: {fmtRelative(lastActivity)}</span>
          )}
          {isPinned && (
            <span className="flex items-center gap-2 text-xs ml-auto">
              <span className="text-yellow-400">📌 Pinned</span>
              <button onClick={resumeLive} className="text-blue-400 hover:text-blue-300 underline">
                Resume live
              </button>
            </span>
          )}
        </div>
      </Header>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-400">{stats.total_messages}</div>
          <div className="text-sm text-gray-400">Total Messages</div>
        </div>
        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{stats.active_satellites}</div>
          <div className="text-sm text-gray-400">Active Satellites</div>
        </div>
        <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-400">{stats.healthy_satellites}</div>
          <div className="text-sm text-gray-400">Healthy</div>
        </div>
        <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-400">
            {(Number(stats.messages_per_hour) || 0).toFixed(0)}
          </div>
          <div className="text-sm text-gray-400">Messages/Hour</div>
        </div>
      </div>

      {/* ── Three stacks + Data panel ── */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <RefreshCw className="mx-auto mb-4 text-blue-500 animate-spin" size={48} />
          <p className="text-gray-400">Loading packets…</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[13%_13%_13%_1fr] gap-4">

          <PacketStack
            type="retrans"
            packets={gwPackets}
            selectedId={selectedPacket?._id}
            isPinned={isPinned}
            onSelect={selectPacket}
            now={now}
          />
          <PacketStack
            type="frame0"
            packets={satFrame0Packets}
            selectedId={selectedPacket?._id}
            isPinned={isPinned}
            onSelect={selectPacket}
            now={now}
          />
          <PacketStack
            type="frame1"
            packets={satFrame1Packets}
            selectedId={selectedPacket?._id}
            isPinned={isPinned}
            onSelect={selectPacket}
            now={now}
          />

          {/* ════ RIGHT — Data panel ════ */}
          <div className="flex flex-col gap-4 min-w-0">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="text-green-400" size={24} />
              Data
            </h2>

            {!selectedPacket ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 flex-1">
                <Rocket className="mx-auto mb-4 text-gray-600" size={48} />
                <p className="text-gray-400">No packet selected</p>
                <p className="text-sm text-gray-500 mt-2">Waiting for satellite data…</p>
              </div>
            ) : (
              <>
                {/* Title card */}
                <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-bold text-orange-400">
                      {isRetrans(selectedPacket) ? `GW-${selectedPacket.gateway_id ?? '?'}` : selectedPacket.sat_id}
                    </h3>
                    <div className="flex items-center gap-2">
                      <FrameBadge type={selectedPacket.frame_type} />
                      {isRetrans(selectedPacket) ? (
                        <div className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-500/20 text-gray-300 border border-gray-500/30">
                          {selectedPacket.gateway_status ?? 'N/A'}
                        </div>
                      ) : (
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedPacket.sat_status === 'ok'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : selectedPacket.sat_status === 'not_ok'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {selectedPacket.sat_status === 'ok' ? '✅ OK'
                            : selectedPacket.sat_status === 'not_ok' ? '⚠️ NOT OK'
                            : '⏳ N/A'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 mt-1 border-t border-white/10 text-sm text-gray-400">
                    Timestamp: {fmtTime(selectedPacket.received_at)}
                  </div>
                </div>

                {/* ── frame0: Battery + environmental + GPS ── */}
                {isFrame0(selectedPacket) && (() => {
                  // Only trust a battery_status-derived % when we actually have a voltage reading
                  const pct = selectedPacket.battery_voltage != null ? batteryPct(selectedPacket.battery_status) : null;
                  const hardcoded = isHardcodedGPS(selectedPacket.gps_latitude, selectedPacket.gps_longitude);
                  const hasGPS = selectedPacket.gps_latitude != null && selectedPacket.gps_longitude != null;
                  return (
                    <>
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Battery className="text-yellow-400" size={24} />
                            <h3 className="text-lg font-semibold">Battery</h3>
                          </div>
                          <span className="text-sm text-gray-400">
                            {selectedPacket.battery_voltage != null ? `${selectedPacket.battery_voltage} V` : '—'}
                          </span>
                        </div>
                        <div className={`text-4xl font-bold mb-3 ${pct !== null ? batteryColor(selectedPacket.battery_status) : 'text-gray-500'}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </div>
                        {pct !== null && (
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${batteryBarColor(selectedPacket.battery_status)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Thermometer className="text-red-400" size={20} />
                            <span className="text-sm text-gray-400">Temperature</span>
                          </div>
                          <div className="text-3xl font-bold text-red-400">{fmtTemp(selectedPacket.temperature)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Droplets className="text-blue-400" size={20} />
                            <span className="text-sm text-gray-400">Humidity</span>
                          </div>
                          <div className="text-3xl font-bold text-blue-400">{fmtHum(selectedPacket.humidity)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Gauge className="text-purple-400" size={20} />
                            <span className="text-sm text-gray-400">Pressure</span>
                          </div>
                          <div className="text-2xl font-bold text-purple-400">{fmtVal(selectedPacket.pressure, ' hPa')}</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Wind className="text-green-400" size={20} />
                            <span className="text-sm text-gray-400">Gas</span>
                          </div>
                          <div className="text-2xl font-bold text-green-400">{fmtGas(selectedPacket.gas)}</div>
                        </div>
                      </div>

                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="text-blue-400" size={24} />
                          <div>
                            <h3 className="text-lg font-semibold">GPS Location</h3>
                            <div className="text-sm text-gray-400">RAK Transmitter · Satellite</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="bg-gray-900 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Latitude</div>
                            <div className="text-xl font-semibold text-blue-300 font-mono">{fmtGPS(selectedPacket.gps_latitude)}</div>
                          </div>
                          <div className="bg-gray-900 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">Longitude</div>
                            <div className="text-xl font-semibold text-blue-300 font-mono">{fmtGPS(selectedPacket.gps_longitude)}</div>
                          </div>
                        </div>
                        {hardcoded && (
                          <div className="flex items-center gap-1.5 text-[11px] text-yellow-400/90 mb-3">
                            <AlertCircle size={11} className="flex-shrink-0" />
                            <span>GPS may be hardcoded in firmware</span>
                          </div>
                        )}
                        {!hasGPS && (
                          <div className="text-sm text-gray-500 mb-3">No GPS data in this packet</div>
                        )}
                        {hasGPS && (
                          <StationMap
                            lat={parseFloat(selectedPacket.gps_latitude)}
                            lng={parseFloat(selectedPacket.gps_longitude)}
                            label="UASAT"
                            sublabel="GPS from transmitter"
                            height={220}
                          />
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* ── frame1: Battery voltage + IMU + Gyro + Spectrum probe ── */}
                {isFrame1(selectedPacket) && (
                  <>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Battery className="text-yellow-400" size={24} />
                        <h3 className="text-lg font-semibold">Battery</h3>
                      </div>
                      <div className="text-3xl font-bold text-yellow-400">
                        {selectedPacket.battery_voltage != null ? `${selectedPacket.battery_voltage} V` : '—'}
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="text-cyan-400" size={24} />
                        <h3 className="text-lg font-semibold">IMU (3 Axis)</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Accel X:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_accel_x)} m/s²</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Accel Y:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_accel_y)} m/s²</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Accel Z:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_accel_z)} m/s²</span>
                        </div>
                        {vectorMagnitude(selectedPacket.imu_accel_x, selectedPacket.imu_accel_y, selectedPacket.imu_accel_z) != null && (
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-700/60">
                            <span className="text-gray-400">Total Acceleration:</span>
                            <span className="font-semibold font-mono text-cyan-300">
                              {vectorMagnitude(selectedPacket.imu_accel_x, selectedPacket.imu_accel_y, selectedPacket.imu_accel_z).toFixed(3)} m/s²
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <RotateCw className="text-cyan-400" size={24} />
                        <h3 className="text-lg font-semibold">Gyro (3 Axis)</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Gyro X:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_gyro_x)} deg/s</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Gyro Y:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_gyro_y)} deg/s</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Gyro Z:</span>
                          <span className="font-semibold font-mono">{fmtIMU(selectedPacket.imu_gyro_z)} deg/s</span>
                        </div>
                        {vectorMagnitude(selectedPacket.imu_gyro_x, selectedPacket.imu_gyro_y, selectedPacket.imu_gyro_z) != null && (
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-700/60">
                            <span className="text-gray-400">Angular Rate:</span>
                            <span className="font-semibold font-mono text-cyan-300">
                              {vectorMagnitude(selectedPacket.imu_gyro_x, selectedPacket.imu_gyro_y, selectedPacket.imu_gyro_z).toFixed(3)} deg/s
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Radar className="text-green-400" size={20} />
                        <span className="text-sm text-gray-400">Spectrum Probe</span>
                      </div>
                      <div className="text-2xl font-bold">{fmtVal(selectedPacket.spectrum_probe, ' dBm/Hz')}</div>
                    </div>
                  </>
                )}

                {/* ── retrans: Gateway/Satellite battery + Nodes ── */}
                {isRetrans(selectedPacket) && (
                  <>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Battery className="text-yellow-400" size={24} />
                        <h3 className="text-lg font-semibold">Battery</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Gateway Battery</div>
                          <div className="text-4xl font-bold mb-2 text-green-400">{fmtPct(selectedPacket.gw_battery_pct)}</div>
                          {selectedPacket.gw_battery_pct != null && (
                            <div className="w-full bg-gray-700 rounded-full h-3">
                              <div
                                className="h-3 rounded-full bg-green-400 transition-all"
                                style={{ width: `${Math.min(selectedPacket.gw_battery_pct, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="pt-4 border-t border-gray-700/60">
                          <div className="text-xs text-gray-400 mb-1">Satellite Battery</div>
                          <div className="text-2xl font-bold text-yellow-400 mb-2">
                            {selectedPacket.sat_battery_pct != null ? `${selectedPacket.sat_battery_pct}%` : '—'}
                          </div>
                          {selectedPacket.sat_battery_pct != null && (
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-yellow-400 transition-all"
                                style={{ width: `${selectedPacket.sat_battery_pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Server className="text-teal-400" size={24} />
                        <h3 className="text-lg font-semibold">Gateway Nodes</h3>
                        <span className="text-sm text-gray-400 ml-auto">GW #{selectedPacket.gateway_id ?? '—'}</span>
                      </div>
                      <div className="space-y-2">
                        {normalizeNodes(selectedPacket.gw_nodes).map(node => (
                          <div key={node.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                node.status === 'ok' ? 'bg-green-500' : node.status == null ? 'bg-gray-600' : 'bg-red-500'
                              }`} />
                              <span className="text-gray-300 text-sm">Node {node.id}</span>
                              {node.status != null && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  node.status === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {node.status}
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-teal-300 font-mono">
                              {node.value != null ? Number(node.value).toFixed(2) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Signal Quality — always shown ── */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Signal className="text-green-400" size={24} />
                    <h3 className="text-lg font-semibold">Signal Quality</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">RSSI</div>
                      <div className={`text-4xl font-bold ${rssiColor(parseFloat(selectedPacket.rssi) || 0)}`}>
                        {fmtVal(selectedPacket.rssi, ' dBm')}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">SNR</div>
                      <div className={`text-4xl font-bold ${snrColor(parseFloat(selectedPacket.snr) || 0)}`}>
                        {fmtVal(selectedPacket.snr, ' dB')}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UASATMission;
