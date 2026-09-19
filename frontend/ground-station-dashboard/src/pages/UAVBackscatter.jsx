import React, { useState, useEffect, useRef } from 'react';
import { Radio, MapPin, RefreshCw, Signal } from 'lucide-react';
import { io } from 'socket.io-client';
import { StationMap } from '../components/StationMap';
import Header from '../components/layout/Header';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/uav-backscatter';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
const IT_AVEIRO = { lat: 40.6331, lng: -8.6595 };

const formatTime = (ts) => {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

function StatusDot({ status }) {
  const colors = { ok: 'bg-green-500', warning: 'bg-yellow-400', error: 'bg-red-500' };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || colors.ok} animate-pulse`} />
  );
}

function StatusBadge({ status }) {
  const map = {
    ok:      'bg-green-900/60 text-green-400 border border-green-700',
    warning: 'bg-yellow-900/60 text-yellow-400 border border-yellow-700',
    error:   'bg-red-900/60 text-red-400 border border-red-700'
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[status] || map.ok}`}>
      {status}
    </span>
  );
}

export default function UAVBackscatter() {
  const [stats, setStats]       = useState({ total_messages: 0, active_tags: 0, messages_per_hour: 0 });
  const [packets, setPackets]   = useState([]);
  const [latestTags, setLatestTags] = useState([]);
  const [connected, setConnected]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const socketRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchPackets(), fetchLatest()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('uav:telemetry', (event) => {
      const pkt = event.data;
      setPackets(prev => [pkt, ...prev].slice(0, 50));
      setLatestTags(prev => {
        const others = prev.filter(t => t.tag_id !== pkt.tag_id);
        return [pkt, ...others];
      });
      fetchStats();
    });
    return () => socket.disconnect();
  }, []);

  async function fetchStats() {
    try {
      const r = await fetch(`${API_BASE}/stats`);
      const j = await r.json();
      if (j.success) setStats(j.stats);
    } catch { /* ignore */ }
  }

  async function fetchPackets() {
    try {
      const r = await fetch(`${API_BASE}/telemetry?limit=50`);
      const j = await r.json();
      if (j.success) setPackets(j.data);
    } catch { /* ignore */ }
  }

  async function fetchLatest() {
    try {
      const r = await fetch(`${API_BASE}/latest`);
      const j = await r.json();
      if (j.success) setLatestTags(j.data);
    } catch { /* ignore */ }
  }

  const latestData = latestTags[0] || null;

  return (
    <div className="w-full min-h-screen flex flex-col p-6">

      <Header
        title={
          <div className="flex items-center gap-3">
            <img
              src="/logos/drone_icon1.webp"
              alt="UAV"
              style={{ height: 40, width: 40, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' }}
            />
            UAV Backscatter
          </div>
        }
        subtitle="Real-time Backscatter Communication [5.8 GHz] · IT Aveiro"
      >
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className={connected ? 'text-cyan-400' : 'text-gray-500'}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </Header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-cyan-400">{stats.total_messages ?? 0}</div>
          <div className="text-sm text-gray-400">Total Messages (24h)</div>
        </div>
        <div className="bg-gradient-to-r from-violet-500/20 to-violet-600/10 border border-violet-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-violet-400">{stats.active_tags ?? 0}</div>
          <div className="text-sm text-gray-400">Active Tags</div>
        </div>
        <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-emerald-400">
            {(Number(stats.messages_per_hour) || 0).toFixed(1)}
          </div>
          <div className="text-sm text-gray-400">Msgs / Hour</div>
        </div>
        <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-400">{packets.length}</div>
          <div className="text-sm text-gray-400">Received Tags</div>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — Packets */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Radio className="text-cyan-400" size={22} />
            Tags ({packets.length})
          </h2>

          <div className="space-y-3">
            {packets.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                <img
                  src="/logos/drone_icon1.webp"
                  alt="UAV"
                  className="mx-auto mb-4 opacity-30"
                  style={{ height: 48, filter: 'grayscale(1)' }}
                />
                <p className="text-gray-400">Waiting for MQTT data...</p>
                <p className="text-sm text-gray-500 mt-1">Topic: uav/backscatter/#</p>
              </div>
            ) : (
              packets.map((pkt, i) => (
                <div
                  key={pkt.id || i}
                  className="bg-gray-800 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <StatusDot status={pkt.status || 'ok'} />
                        <div>
                          <div className="font-bold text-lg text-cyan-400">{pkt.tag_id}</div>
                          <div className="text-sm text-gray-400">{formatTime(pkt.received_at)}</div>
                        </div>
                      </div>
                      <StatusBadge status={pkt.status || 'ok'} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Temperature</div>
                        <div className="text-2xl font-bold text-red-400">
                          {pkt.temperature != null ? `${pkt.temperature.toFixed(1)}°C` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">UAV</div>
                        <div className="text-lg font-bold text-blue-400 truncate">
                          {pkt.uav_id || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                      <span>RSSI: <span className="text-cyan-300 font-semibold">{pkt.rssi != null ? `${pkt.rssi.toFixed(1)} dBm` : 'N/A'}</span></span>
                      <span>SNR: <span className="text-cyan-300 font-semibold">{pkt.snr != null ? `${pkt.snr.toFixed(1)} dB` : 'N/A'}</span></span>
                      <span>Freq: <span className="text-cyan-300 font-semibold">{pkt.frequency ?? 5.8} GHz</span></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT — GPS + Info */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="text-blue-400" size={22} />
            GPS Location
          </h2>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="text-blue-400" size={22} />
              <div>
                <div className="font-semibold text-lg">Instituto de Telecomunicações</div>
                <div className="text-sm text-gray-400">Aveiro, Portugal</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Latitude</div>
                <div className="text-xl font-semibold text-blue-300">{IT_AVEIRO.lat}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Longitude</div>
                <div className="text-xl font-semibold text-blue-300">{IT_AVEIRO.lng}</div>
              </div>
            </div>
            <StationMap
              lat={IT_AVEIRO.lat}
              lng={IT_AVEIRO.lng}
              label="Instituto de Telecomunicações"
              sublabel="Aveiro, Portugal"
              height={220}
              fillColor="#0e7490"
              strokeColor="#22d3ee"
            />
          </div>

          <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-5 flex items-center gap-4">
            <Signal className="text-violet-400" size={28} />
            <div>
              <div className="text-sm text-gray-400">Standard Frequency</div>
              <div className="text-2xl font-bold text-violet-400">5.8 GHz</div>
            </div>
          </div>

          {latestData && (
            <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-5">
              <div className="font-semibold mb-3 text-cyan-300">Latest Reading</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tag:</span>
                  <span className="font-bold text-cyan-400">{latestData.tag_id}</span>
                </div>
                {latestData.uav_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">UAV:</span>
                    <span className="font-semibold text-blue-400">{latestData.uav_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Temperature:</span>
                  <span className="font-bold text-red-400">
                    {latestData.temperature != null ? `${latestData.temperature.toFixed(1)}°C` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">RSSI:</span>
                  <span className="font-semibold text-cyan-300">
                    {latestData.rssi != null ? `${latestData.rssi.toFixed(1)} dBm` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time:</span>
                  <span className="text-gray-300">{formatTime(latestData.received_at)}</span>
                </div>
              </div>
            </div>
          )}

          {latestTags.length > 1 && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
              <div className="font-semibold mb-3 text-gray-300">Active Tags</div>
              <div className="space-y-2">
                {latestTags.map(tag => (
                  <div key={tag.tag_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatusDot status={tag.status || 'ok'} />
                      <span className="text-cyan-400 font-semibold">{tag.tag_id}</span>
                    </div>
                    <span className="text-gray-400">
                      {tag.temperature != null ? `${tag.temperature.toFixed(1)}°C` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
