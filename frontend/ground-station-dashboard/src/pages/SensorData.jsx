import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Header from '../components/layout/Header';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/uav-backscatter';

const formatTime = (ts) => {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

function TempBar({ value }) {
  const pct = Math.min(100, Math.max(0, ((value - 0) / 60) * 100));
  const color = value > 40 ? '#f87171' : value > 25 ? '#fbbf24' : '#34d399';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-900 rounded h-2 overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color, height: '100%', borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <span style={{ color, minWidth: 56, fontSize: 13, fontWeight: 700 }}>
        {value.toFixed(1)} °C
      </span>
    </div>
  );
}

function SignalBar({ rssi, snr }) {
  const rssiPct = Math.min(100, Math.max(0, ((rssi + 120) / 80) * 100));
  const snrPct = Math.min(100, Math.max(0, (snr / 20) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 w-8">RSSI</span>
        <div className="flex-1 bg-gray-900 rounded h-1.5">
          <div style={{ width: `${rssiPct}%`, backgroundColor: '#22d3ee', height: '100%', borderRadius: 4 }} />
        </div>
        <span className="text-cyan-300 w-16 text-right">{rssi?.toFixed(1)} dBm</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400 w-8">SNR</span>
        <div className="flex-1 bg-gray-900 rounded h-1.5">
          <div style={{ width: `${snrPct}%`, backgroundColor: '#a78bfa', height: '100%', borderRadius: 4 }} />
        </div>
        <span className="text-violet-300 w-16 text-right">{snr?.toFixed(1)} dB</span>
      </div>
    </div>
  );
}

export default function SensorData() {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [readings, setReadings] = useState([]);
  const [tagStats, setTagStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchTags(); }, []);
  useEffect(() => { if (selectedTag) fetchTagDetail(selectedTag); }, [selectedTag]);

  async function fetchTags() {
    try {
      const r = await fetch(`${API_BASE}/tags`);
      const j = await r.json();
      if (j.success) {
        setTags(j.data);
        if (j.data.length > 0 && !selectedTag) setSelectedTag(j.data[0].tag_id);
      }
    } catch { /* ignore */ }
  }

  async function fetchTagDetail(tagId) {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/tag/${tagId}?limit=30`);
      const j = await r.json();
      if (j.success) {
        setReadings(j.readings);
        setTagStats(j.stats);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div className="w-full h-screen flex flex-col p-6 bg-gray-900 text-white">

      {/* Header com ícone sensor + logo IT */}
      <Header
        title={
          <div className="flex items-center gap-3">
            <img
              src="/logos/sensor_icon1.webp"
              alt="Sensor"
              style={{ height: 38, width: 38, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' }}
            />
            Sensor Data
          </div>
        }
        subtitle="Dados detalhados por tag · UAV Backscatter"
      >
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={fetchTags}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </Header>

      {/* Split Screen */}
      <div className="flex-1 grid grid-cols-[260px_1fr] gap-6 overflow-hidden">

        {/* ESQUERDA — Cards de Tags */}
        <div className="flex flex-col overflow-hidden">
          <h2 className="text-base font-semibold mb-3 text-gray-300 flex items-center gap-2">
            <img src="/logos/sensor_icon1.webp" alt="Sensor" style={{ height: 18, width: 18, objectFit: 'contain' }} />
            Tags Disponíveis
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {tags.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                <img
                  src="/logos/sensor_icon1.webp"
                  alt="Sensor"
                  className="mx-auto mb-3 opacity-25"
                  style={{ height: 44, filter: 'grayscale(1)' }}
                />
                <p className="text-gray-500 text-sm">Nenhuma tag encontrada</p>
                <p className="text-gray-600 text-xs mt-1">Aguardando dados MQTT...</p>
              </div>
            ) : (
              tags.map(tag => {
                const total = tag.dataValues?.total_readings ?? tag.total_readings ?? 0;
                const lastSeen = tag.dataValues?.last_seen ?? tag.last_seen ?? null;
                const isSelected = selectedTag === tag.tag_id;
                return (
                  <button
                    key={tag.tag_id}
                    onClick={() => setSelectedTag(tag.tag_id)}
                    className={`w-full text-left rounded-lg border transition-all duration-200
                      ${isSelected
                        ? 'bg-cyan-900/40 border-cyan-500/60 shadow-lg shadow-cyan-900/20'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
                      }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan-800/60' : 'bg-gray-700'}`}>
                          <img
                            src="/logos/sensor_icon1.webp"
                            alt="Tag"
                            style={{ height: 22, width: 22, objectFit: 'contain' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold text-base truncate ${isSelected ? 'text-cyan-400' : 'text-gray-100'}`}>
                            {tag.tag_id}
                          </div>
                          <div className="text-xs text-gray-500">{total} leituras</div>
                        </div>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                        )}
                      </div>
                      {lastSeen && (
                        <div className="text-xs text-gray-600 border-t border-gray-700/50 pt-2">
                          Última: {new Date(lastSeen).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* DIREITA — Detalhe da Tag */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {!selectedTag ? (
            <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Seleciona uma tag para ver os detalhes</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {tagStats && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                  <h2 className="text-xl font-bold text-cyan-400 mb-4">{selectedTag}</h2>
                  <div className="grid grid-cols-3 gap-5">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Temp Média</div>
                      {tagStats.avg_temperature != null
                        ? <TempBar value={tagStats.avg_temperature} />
                        : <span className="text-gray-600 text-sm">Sem dados</span>}
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Sinal Médio</div>
                      {tagStats.avg_rssi != null
                        ? <SignalBar rssi={tagStats.avg_rssi} snr={0} />
                        : <span className="text-gray-600 text-sm">Sem dados</span>}
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Leituras</div>
                      <div className="text-2xl font-bold text-cyan-400">{tagStats.total_readings}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Readings Table */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-300">Histórico de Leituras</h3>
                  {loading && <RefreshCw size={14} className="text-cyan-400 animate-spin" />}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left border-b border-gray-700">Timestamp</th>
                        <th className="px-4 py-3 text-left border-b border-gray-700">Temperatura</th>
                        <th className="px-4 py-3 text-left border-b border-gray-700">RSSI / SNR</th>
                        <th className="px-4 py-3 text-left border-b border-gray-700">Altitude</th>
                        <th className="px-4 py-3 text-left border-b border-gray-700">Frequência</th>
                        <th className="px-4 py-3 text-left border-b border-gray-700">UAV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-gray-500">
                            {loading ? 'Carregando...' : 'Sem dados para esta tag'}
                          </td>
                        </tr>
                      ) : readings.map((r, i) => (
                        <tr key={r.id || i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatTime(r.received_at)}</td>
                          <td className="px-4 py-3">
                            {r.temperature != null
                              ? <TempBar value={r.temperature} />
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.rssi != null
                              ? <SignalBar rssi={r.rssi} snr={r.snr ?? 0} />
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{r.altitude != null ? `${r.altitude} m` : '—'}</td>
                          <td className="px-4 py-3 text-gray-300">{r.frequency != null ? `${r.frequency} GHz` : '—'}</td>
                          <td className="px-4 py-3 text-violet-400 font-semibold">{r.uav_id || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
