// frontend/src/pages/TinyGSMyStation.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  MapPin, Radio, Activity, Signal, Clock, Battery, Thermometer,
  Droplets, Gauge, Wind, Target, Filter, RefreshCw, ChevronDown,
  Download, Wifi, WifiOff, AlertCircle, Server,
} from 'lucide-react';
import { StationMap } from '../components/StationMap';
import {
  batteryPct, batteryColor, batteryBarColor,
  rssiColor, snrColor,
  fmtVal, fmtTemp, fmtHum, fmtTime, fmtRelative, fmtGas,
} from '../utils/telemetry';

// GPS coordinates known to be hardcoded in RAK transmitter firmware
const HARDCODED_GPS = { lat: 41.161797, lon: -8.583900 };
const fmtGPS = v => v != null ? Number(v).toFixed(6) : '—';
const fmtIMU = v => v != null ? Number(v).toFixed(4) : 'N/A';
const isHardcodedGPS = (lat, lon) =>
  lat != null && lon != null &&
  Math.abs(Number(lat) - HARDCODED_GPS.lat) < 0.0001 &&
  Math.abs(Number(lon) - HARDCODED_GPS.lon) < 0.0001;
const normalizeNodes = (gw_nodes) => {
  const map = Object.fromEntries((gw_nodes || []).map(n => [n.id, n]));
  return [0, 1, 2, 3, 4, 5].map(id => map[id] ?? { id, status: null, value: null });
};

// ─── Station config ───────────────────────────────────────────────────────────
const MY_STATION_ID    = 'UA_Aveiro_GS';
const TINYGS_ID        = '672048118';
const GS_LOCATION      = { lat: 40.6331, lng: -8.6595 };
const GS_LABEL         = 'Instituto de Telecomunicações · Aveiro';
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const PAGE_SIZE        = 50;

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

// ─── Battery helpers ──────────────────────────────────────────────────────────
const gwBattColor    = pct => pct >= 50 ? 'text-green-400' : pct >= 25 ? 'text-yellow-400' : 'text-red-400';
const gwBattBarColor = pct => pct >= 50 ? 'bg-green-400'   : pct >= 25 ? 'bg-yellow-400'   : 'bg-red-400';
const fmtPct         = v   => v != null ? `${Number(v).toFixed(1)}%` : 'N/A';

// ─── Compact selectable packet row ───────────────────────────────────────────
const PacketRow = ({ packet, isSelected, onClick }) => {
  const isUASAT   = packet._source === 'uasat';
  const isRetrans = isUASAT && packet.frame_type === 'retrans';

  const satName = isUASAT
    ? (isRetrans ? `GW-${packet.gateway_id ?? '?'}` : (packet.sat_id || 'UNKNOWN'))
    : (packet.satellite_name || packet.satellite || 'Unknown');

  const rssi      = parseFloat(packet.rssi) || 0;
  const snr       = parseFloat(packet.snr)  || 0;
  const timestamp = packet.received_at || packet.packet_timestamp || packet.timestamp;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 flex items-center gap-3 cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
          : 'bg-gray-800 border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        isUASAT ? (packet.sat_status === 'ok' ? 'bg-green-500' : 'bg-red-500') : 'bg-blue-500'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{satName}</span>
          {isUASAT  && <FrameBadge type={packet.frame_type} />}
          {!isUASAT && <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">TinyGS</span>}
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Clock size={10} />
          <span>{fmtRelative(timestamp)}</span>
        </div>
      </div>
      <div className="text-right text-xs flex-shrink-0">
        <div className={`font-bold ${rssiColor(rssi)}`}>{rssi.toFixed(1)} <span className="text-gray-400 font-normal">dBm</span></div>
        <div className={`font-bold ${snrColor(snr)}`}>{snr.toFixed(1)} <span className="text-gray-400 font-normal">dB</span></div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const TinyGSMyStation = ({ theme = 'dark' }) => {
  const serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  const [wsConnected,     setWsConnected]     = useState(false);
  const [mqttOnline,      setMqttOnline]      = useState(false);
  const socketRef = useRef(null);

  const [packets,         setPackets]         = useState([]);
  const [latestTelemetry, setLatestTelemetry] = useState(null); // drives online status in header
  const [selectedPacket,  setSelectedPacket]  = useState(null); // drives right panel
  const [pinnedId,        setPinnedId]        = useState(null); // non-null = user pinned a historical packet
  const pinnedIdRef = useRef(null);
  useEffect(() => { pinnedIdRef.current = pinnedId; }, [pinnedId]);

  const [stats,        setStats]        = useState({
    total_messages: 0, active_satellites: 0, healthy_satellites: 0, messages_per_hour: 0,
  });
  const [filterSource, setFilterSource] = useState('all');
  const [sortBy,       setSortBy]       = useState('newest');
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [dbOffset,     setDbOffset]     = useState(0);

  const isRetrans = (d) => d?.frame_type === 'retrans';

  const selectPacket = (pkt) => {
    setSelectedPacket(pkt);
    setPinnedId(pkt._id);
  };

  const resumeLive = () => {
    setPinnedId(null);
    // Prefer the most recent packet already in memory
    if (packets.length > 0) {
      const newest = [...packets].sort(
        (a, b) => new Date(b.received_at || b.timestamp || 0) - new Date(a.received_at || a.timestamp || 0)
      )[0];
      setSelectedPacket(newest);
    }
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [telRes, statRes] = await Promise.all([
        fetch(`${serverUrl}/api/uasat/telemetry?limit=${PAGE_SIZE}&offset=0`),
        fetch(`${serverUrl}/api/uasat/stats?hours=24`),
      ]);
      const telData  = await telRes.json();
      const statData = await statRes.json();

      if (telData.success) {
        const withSource = telData.data.map(p => ({
          ...p, _source: 'uasat', _id: p.id || `rest-${p.received_at}`,
        }));
        setPackets(withSource);
        setDbOffset(withSource.length);
        setHasMore(telData.data.length === PAGE_SIZE);

        if (withSource.length > 0) {
          setLatestTelemetry(telData.data[0]);
          if (!pinnedIdRef.current) setSelectedPacket(withSource[0]);
        }
      }
      if (statData.success) setStats(statData.stats);
    } catch (err) {
      console.error('[MyStation] REST error:', err);
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res  = await fetch(`${serverUrl}/api/uasat/telemetry?limit=${PAGE_SIZE}&offset=${dbOffset}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const newPkts = data.data.map(p => ({
          ...p, _source: 'uasat', _id: p.id || `rest-${p.received_at}`,
        }));
        setPackets(prev => {
          const ids = new Set(prev.map(p => p._id));
          return [...prev, ...newPkts.filter(p => !ids.has(p._id))];
        });
        setDbOffset(prev => prev + newPkts.length);
        setHasMore(data.data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[MyStation] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [serverUrl, dbOffset]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const socket = io(serverUrl, { reconnection: true, reconnectionDelay: 3000, timeout: 10000 });
    socketRef.current = socket;

    socket.on('connect',    () => setWsConnected(true));
    socket.on('disconnect', () => { setWsConnected(false); setMqttOnline(false); });

    socket.on('uasat:telemetry', (data) => {
      const pkt = {
        ...data,
        _source: 'uasat',
        _id: data.id || `ws-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      };
      setLatestTelemetry(data);
      setMqttOnline(true);
      setPackets(prev => {
        if (prev.some(p => p._id === pkt._id)) return prev;
        return [pkt, ...prev].slice(0, 500);
      });
      // Auto-select the newest live packet unless user has pinned a historical one
      setSelectedPacket(prev => (pinnedIdRef.current ? prev : pkt));
    });

    socket.on('satellite-data', (data) => {
      const isMyStation = data.isMyStation || (data.station && data.station.toString() === MY_STATION_ID);
      if (!isMyStation) return;
      const pkt = {
        ...data,
        _source: 'tinygs',
        _id: data.id || `tinygs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        satellite_name: data.satellite || data.satellite_name,
        received_at: data.timestamp || data.received_at || new Date().toISOString(),
      };
      setPackets(prev => {
        if (prev.some(p => p._id === pkt._id)) return prev;
        return [pkt, ...prev].slice(0, 500);
      });
    });

    return () => socket.disconnect();
  }, [serverUrl]);

  const lastActivity = latestTelemetry
    ? new Date(latestTelemetry.received_at)
    : (packets.length > 0 ? new Date(packets[0].received_at || packets[0].timestamp) : null);
  const isOnline = lastActivity && (Date.now() - lastActivity) < ONLINE_WINDOW_MS;
  const isPinned = pinnedId != null && selectedPacket?._id === pinnedId;

  let displayed = packets.filter(p => filterSource === 'all' ? true : p._source === filterSource);
  if (sortBy === 'newest') {
    displayed = [...displayed].sort((a, b) =>
      new Date(b.received_at || b.timestamp || 0) - new Date(a.received_at || a.timestamp || 0));
  } else {
    displayed = [...displayed].sort((a, b) =>
      new Date(a.received_at || a.timestamp || 0) - new Date(b.received_at || b.timestamp || 0));
  }

  const uasatCount  = packets.filter(p => p._source === 'uasat').length;
  const tinygsCount = packets.filter(p => p._source === 'tinygs').length;
  const avgRSSI     = packets.length > 0
    ? (packets.reduce((acc, p) => acc + (parseFloat(p.rssi) || 0), 0) / packets.length).toFixed(1)
    : 0;

  // Only offer "Load more" for UASAT packets (paginated from DB); TinyGS-only view has no DB pagination
  const showLoadMore = hasMore && filterSource !== 'tinygs';

  const exportData = () => {
    const blob = new Blob([JSON.stringify(displayed, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `my-ground-station-${new Date().toISOString()}.json`; a.click();
  };

  return (
    <div className="w-full min-h-screen flex flex-col p-6 bg-gray-200 text-gray-900
      [&_h1]:text-gray-900 [&_h2]:text-gray-900 [&_h3]:text-gray-900 [&_p]:text-gray-800
      [&_.text-gray-400]:text-gray-700 [&_.text-gray-500]:text-gray-800 [&_.text-gray-300]:text-gray-900
      [&_.bg-gray-800]:bg-white [&_.bg-gray-800]:border-gray-300 [&_.border-gray-700]:border-gray-300
      [&_.bg-gray-900]:bg-gray-100 [&_select]:bg-white [&_select]:text-gray-900 [&_select]:border-gray-300">

      {/* ── Header ── */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
              <MapPin className="text-green-500" size={34} />
              My Ground Station
            </h1>
            <p className="text-gray-400 text-sm">{MY_STATION_ID} · TinyGS ID: {TINYGS_ID} · {GS_LABEL}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadHistory}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportData}
              disabled={packets.length === 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors text-sm"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        <div className={`mt-3 p-3 rounded-lg flex items-center justify-between text-sm ${
          isOnline ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800 border border-gray-700'
        }`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className="font-semibold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${wsConnected ? 'text-blue-400' : 'text-gray-500'}`}>
              {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>WebSocket</span>
            </div>
            <div className={`flex items-center gap-1.5 ${mqttOnline ? 'text-orange-400' : 'text-gray-500'}`}>
              <Radio size={14} />
              <span>MQTT {mqttOnline ? '(live)' : '(waiting)'}</span>
            </div>
            {lastActivity && (
              <span className="text-gray-500 text-xs">Last packet: {fmtRelative(lastActivity)}</span>
            )}
          </div>
          <a
            href={`https://tinygs.com/station/${TINYGS_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
          >
            View on TinyGS →
          </a>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-400">{stats.total_messages || uasatCount}</div>
          <div className="text-xs text-gray-400">Total Messages</div>
        </div>
        <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{tinygsCount}</div>
          <div className="text-xs text-gray-400">TinyGS Packets</div>
        </div>
        <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-400">
            {(Number(stats.messages_per_hour) || 0).toFixed(0)}
          </div>
          <div className="text-xs text-gray-400">Msgs / Hour</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-400">{avgRSSI} <span className="text-sm font-normal">dBm</span></div>
          <div className="text-xs text-gray-400">Avg RSSI</div>
        </div>
      </div>

      {/* ── Split screen ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ════ LEFT — Packet list ════ */}
        <div className="flex flex-col">
          <div className="bg-gray-800 rounded-lg p-3 mb-3 border border-gray-700 flex-shrink-0 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600"
            >
              <option value="all">All ({packets.length})</option>
              <option value="uasat">UASAT ({uasatCount})</option>
              <option value="tinygs">TinyGS ({tinygsCount})</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <Radio className="text-blue-400" size={18} />
            <h2 className="text-base font-semibold">
              Packets ({displayed.length}{showLoadMore ? '+' : ''})
            </h2>
            {wsConnected && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">live</span>
            )}
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                <RefreshCw className="mx-auto mb-3 text-blue-500 animate-spin" size={36} />
                <p className="text-gray-400">Loading packets…</p>
              </div>
            ) : displayed.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                {!isOnline ? (
                  <>
                    <AlertCircle className="mx-auto mb-3 text-yellow-500" size={40} />
                    <p className="text-gray-300 font-medium mb-1">Station offline</p>
                    <p className="text-gray-500 text-sm">Waiting for packets from MQTT broker</p>
                  </>
                ) : (
                  <>
                    <Radio className="mx-auto mb-3 text-gray-600 animate-pulse" size={40} />
                    <p className="text-gray-400">No packets for this filter</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {displayed.map((pkt) => (
                  <PacketRow
                    key={pkt._id}
                    packet={pkt}
                    isSelected={selectedPacket?._id === pkt._id}
                    onClick={() => selectPacket(pkt)}
                  />
                ))}

                {showLoadMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full py-3 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700
                               flex items-center justify-center gap-2 text-sm text-gray-300 transition-colors
                               disabled:opacity-50"
                  >
                    {loadingMore
                      ? <><RefreshCw size={14} className="animate-spin" /> Loading…</>
                      : <><ChevronDown size={14} /> Load more</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ════ RIGHT — Live Dashboard ════ */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="text-green-400" size={22} />
              <h2 className="text-base font-semibold">Live Dashboard</h2>
            </div>
            {isPinned && (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-yellow-400">📌 Historical packet</span>
                <button onClick={resumeLive} className="text-blue-400 hover:text-blue-300 underline">
                  Resume live
                </button>
              </span>
            )}
          </div>

          {!selectedPacket ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
              <Radio className="mx-auto mb-3 text-gray-600" size={40} />
              <p className="text-gray-400">Select a packet from the list</p>
              <p className="text-gray-500 text-sm mt-1">or wait for a live packet to arrive</p>
            </div>
          ) : (
            <>
              {/* Title card */}
              <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-5 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-2xl font-bold text-orange-400">
                    {isRetrans(selectedPacket)
                      ? `GW-${selectedPacket.gateway_id ?? '?'}`
                      : selectedPacket.sat_id || '—'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedPacket?.frame_type && <FrameBadge type={selectedPacket.frame_type} />}
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedPacket?.sat_status === 'ok'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : selectedPacket?.sat_status === 'not_ok'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {selectedPacket?.sat_status === 'ok' ? '✅ OK'
                        : selectedPacket?.sat_status === 'not_ok' ? '⚠️ NOT OK'
                        : '⏳ N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">Last update: {fmtTime(selectedPacket?.received_at)}</div>
              </div>

              {/* Battery */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Battery className="text-yellow-400" size={22} />
                    <h3 className="font-semibold">Battery</h3>
                  </div>
                  {!isRetrans(selectedPacket) && (
                    <span className="text-sm text-gray-400">{fmtVal(selectedPacket?.battery_voltage, ' V')}</span>
                  )}
                </div>

                {isRetrans(selectedPacket) ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Gateway Battery</div>
                      <div className={`text-3xl font-bold mb-2 ${gwBattColor(selectedPacket.gw_battery_pct)}`}>
                        {fmtPct(selectedPacket.gw_battery_pct)}
                      </div>
                      {selectedPacket.gw_battery_pct != null && (
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${gwBattBarColor(selectedPacket.gw_battery_pct)}`}
                            style={{ width: `${Math.min(selectedPacket.gw_battery_pct, 100)}%` }}
                          />
                        </div>
                      )}
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-500 font-mono">
                        <span>raw: {selectedPacket.gw_battery_raw ?? 'N/A'}</span>
                        <span>·</span>
                        <span>pct: {fmtPct(selectedPacket.gw_battery_pct)}</span>
                        <span className="text-gray-600">
                          (raw/255×100 = {selectedPacket.gw_battery_raw != null
                            ? ((selectedPacket.gw_battery_raw / 255) * 100).toFixed(1)
                            : 'N/A'}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Satellite Battery</div>
                      <div className="text-2xl font-bold text-yellow-400 mb-2">
                        {selectedPacket.sat_battery_pct != null ? `${selectedPacket.sat_battery_pct}%` : 'N/A'}
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
                ) : (
                  (() => {
                    const pct = batteryPct(selectedPacket?.battery_status);
                    return (
                      <>
                        <div className={`text-3xl font-bold mb-2 ${batteryColor(selectedPacket?.battery_status)}`}>
                          {pct !== null ? `${pct}%` : 'N/A'}
                        </div>
                        {pct !== null && (
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full transition-all ${batteryBarColor(selectedPacket?.battery_status)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>

              {/* Telemetry grid — frame0 / frame1 only */}
              {!isRetrans(selectedPacket) && (
                <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                  <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Thermometer className="text-red-400" size={18} />
                      <span className="text-xs text-gray-400">Temperature</span>
                    </div>
                    <div className="text-2xl font-bold text-red-400">{fmtTemp(selectedPacket?.temperature)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Droplets className="text-blue-400" size={18} />
                      <span className="text-xs text-gray-400">Humidity</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{fmtHum(selectedPacket?.humidity)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Gauge className="text-purple-400" size={18} />
                      <span className="text-xs text-gray-400">Pressure</span>
                    </div>
                    <div className="text-xl font-bold text-purple-400">{fmtVal(selectedPacket?.pressure, ' hPa')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wind className="text-green-400" size={18} />
                      <span className="text-xs text-gray-400">Gas</span>
                    </div>
                    <div className="text-xl font-bold text-green-400">{fmtGas(selectedPacket?.gas)}</div>
                  </div>
                </div>
              )}

              {/* Gateway Nodes — retrans only */}
              {/* Gateway Nodes — retrans only */}
              {isRetrans(selectedPacket) && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="text-teal-400" size={20} />
                    <h3 className="font-semibold">Gateway Nodes</h3>
                    <span className="text-sm text-gray-400 ml-auto">GW #{selectedPacket.gateway_id ?? '—'}</span>
                  </div>
                  <div className="space-y-2">
                    {normalizeNodes(selectedPacket.gw_nodes).map(node => (
                      <div key={node.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            node.status === 'ok' ? 'bg-green-500' : node.status == null ? 'bg-gray-600' : 'bg-red-500'
                          }`} />
                          {/* CORREÇÃO: Usa diretamente node.id sem somar 1 */}
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
              )}
              {/* GPS + map — always shown */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="text-blue-400" size={20} />
                  <div>
                    <h3 className="font-semibold">GPS Location</h3>
                    <div className="text-xs text-gray-400">{GS_LABEL}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-900 rounded-lg p-2.5">
                    <div className="text-xs text-gray-400 mb-1">Latitude</div>
                    <div className="text-lg font-semibold text-blue-300">{GS_LOCATION.lat}</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-2.5">
                    <div className="text-xs text-gray-400 mb-1">Longitude</div>
                    <div className="text-lg font-semibold text-blue-300">{GS_LOCATION.lng}</div>
                  </div>
                </div>
                <StationMap
                  lat={GS_LOCATION.lat}
                  lng={GS_LOCATION.lng}
                  label={MY_STATION_ID}
                  sublabel={GS_LABEL}
                  height={180}
                  fillColor="#16a34a"
                  strokeColor="#4ade80"
                />
              </div>

              {/* IMU — frame0 / frame1 only */}
              {!isRetrans(selectedPacket) && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="text-cyan-400" size={20} />
                    <h3 className="font-semibold">IMU (3 Axis)</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Accel X', key: 'imu_accel_x' },
                      { label: 'Accel Y', key: 'imu_accel_y' },
                      { label: 'Accel Z', key: 'imu_accel_z' },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">{label}:</span>
                        <span className="font-semibold text-sm font-mono">{fmtIMU(selectedPacket?.[key])} m/s²</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special sensors — frame0 / frame1 only */}
              {!isRetrans(selectedPacket) && (
                <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1.5">Digital Nose</div>
                    <div className="text-xl font-bold">{fmtVal(selectedPacket?.digital_nose)}</div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1.5">Spectrum Probe</div>
                    <div className="text-xl font-bold">{fmtVal(selectedPacket?.spectrum_probe, ' dBm/Hz')}</div>
                  </div>
                </div>
              )}

              {/* Signal quality — always shown */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Signal className="text-green-400" size={20} />
                  <h3 className="font-semibold">Signal Quality</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">RSSI</div>
                    <div className={`text-2xl font-bold ${rssiColor(parseFloat(selectedPacket?.rssi) || 0)}`}>
                      {fmtVal(selectedPacket?.rssi, ' dBm')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">SNR</div>
                    <div className={`text-2xl font-bold ${snrColor(parseFloat(selectedPacket?.snr) || 0)}`}>
                      {fmtVal(selectedPacket?.snr, ' dB')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-4 flex-shrink-0" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TinyGSMyStation;
