import React, { useState, useEffect, useCallback } from 'react';
import { Satellite, RefreshCw, Plus } from 'lucide-react';
import { useToast, ToastContainer } from '../components/ui/Toast';
import { authFetch } from '../auth';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STATION_ID = 4518;

const QUALITY_COLOR = {
  Excellent: '#22c55e',
  Good:      '#84cc16',
  Fair:      '#eab308',
  Poor:      '#ef4444',
};

function qualityLabel(maxEl) {
  if (maxEl >= 60) return 'Excellent';
  if (maxEl >= 40) return 'Good';
  if (maxEl >= 20) return 'Fair';
  return 'Poor';
}

function formatUTC(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toUTCString().replace('GMT', 'UTC').slice(0, -4);
}

function formatLocal(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

// ── Polar sky-track plot ───────────────────────────────────────────────────────
// Azimuths come from the backend's local TLE propagation (network.satnogs.org's
// /jobs/ endpoint gives start/end/max_altitude but no azimuth), so they can be
// null if the source job carried no usable TLE — callers should skip rendering
// this component in that case.
function PolarPlot({ aos_az, max_az, los_az, max_el }) {
  const size = 80;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  const toXY = (az, el) => {
    const rad = (az - 90) * Math.PI / 180;
    const dist = r * (1 - el / 90);
    return [cx + dist * Math.cos(rad), cy + dist * Math.sin(rad)];
  };

  const [x1, y1] = toXY(aos_az, 0);
  const [xm, ym] = toXY(max_az, max_el);
  const [x2, y2] = toXY(los_az, 0);

  return (
    <svg width={size} height={size} style={{ opacity: 0.9 }}>
      {[0, 30, 60, 90].map(el => (
        <circle key={el} cx={cx} cy={cy} r={r * (1 - el / 90)} fill="none" stroke="#334155" strokeWidth={0.5} />
      ))}
      {['N', 'S', 'E', 'O'].map((d, i) => {
        const a = i * 90 * Math.PI / 180;
        return (
          <line key={d}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(a - Math.PI / 2)}
            y2={cy + r * Math.sin(a - Math.PI / 2)}
            stroke="#334155" strokeWidth={0.5} />
        );
      })}
      <polyline points={`${x1},${y1} ${xm},${ym} ${x2},${y2}`}
        fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={x1} cy={y1} r={3} fill="#22c55e" />
      <circle cx={xm} cy={ym} r={3} fill="white" />
      <circle cx={x2} cy={y2} r={3} fill="#ef4444" />
    </svg>
  );
}

export default function FuturePasses() {
  const { toasts, show: showToast, dismiss } = useToast();
  const [passes, setPasses]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [hours, setHours]     = useState(24);
  const [mode, setMode]       = useState('scheduled'); // 'scheduled' | 'all'
  const [scheduling, setScheduling] = useState(null); // satellite name currently being scheduled

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === 'all'
        ? `${BACKEND}/api/satnogs/all-passes?hours=${hours}&min_el=10`
        : `${BACKEND}/api/satnogs/network-passes?hours=${hours}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // network-passes returns a flat array; all-passes returns { count, passes }
      setPasses(Array.isArray(data) ? data : (data.passes ?? []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [hours, mode]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  // Only meaningful for 'scheduled' mode — those passes come from SatNOGS's
  // own jobs, which already carry a transmitter it picked. 'all' mode passes
  // are computed from bare CelesTrak TLEs and have no transmitter to offer.
  const schedulePass = async (pass) => {
    if (!pass.transmitter_uuid) {
      showToast(`Sem transmissor disponível para ${pass.satellite}`, 'error');
      return;
    }
    setScheduling(pass.satellite);
    try {
      const res = await authFetch(`${BACKEND}/api/satnogs/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ground_station:   STATION_ID,
          transmitter_uuid: pass.transmitter_uuid,
          start:            pass.aos,
          end:              pass.los,
        }),
      });

      if (res.ok || res.status === 201) {
        const obs = await res.json().catch(() => ({}));
        showToast(
          obs.id
            ? `Observação #${obs.id} agendada para ${pass.satellite}!`
            : `Observação agendada para ${pass.satellite}!`,
          'success'
        );
      } else {
        let errText = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          errText = body.detail ?? JSON.stringify(body);
        } catch { /* ignore */ }
        showToast(`Falhou: ${errText}`, 'error');
      }
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error');
    } finally {
      setScheduling(null);
    }
  };

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Satellite className="text-blue-500" size={30} />
          Future Passes — UA_Aveiro_GS_Pluto (4518)
        </h1>

        <select
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          {[6, 12, 24, 48].map(h => (
            <option key={h} value={h}>Próximas {h}h</option>
          ))}
        </select>

        <button
          onClick={fetchPasses}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 transition-colors text-sm font-semibold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>

        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => setMode('scheduled')}
            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === 'scheduled' ? 'bg-sky-600' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Agendados
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === 'all' ? 'bg-sky-600' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todos os passes
          </button>
        </div>
      </div>

      {mode === 'all' && (
        <div className="mb-4 bg-sky-500/10 border border-sky-500/25 rounded-lg p-3 text-sky-300 text-sm">
          A calcular passes para ~800 satélites amadores — pode demorar alguns segundos na primeira
          vez (TLEs em cache por 1 hora).
        </div>
      )}

      {loading && (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <p className="text-gray-400">A carregar passagens...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-4 text-red-400 text-sm">
          Erro: {error}
        </div>
      )}

      {!loading && !error && passes.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <Satellite className="mx-auto mb-4 text-gray-600" size={48} />
          <p className="text-gray-400">Nenhuma passagem encontrada nas próximas {hours}h.</p>
        </div>
      )}

      {!loading && !error && passes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-800 text-gray-400 text-left">
                {['Satélite', 'AOS (UTC)', 'LOS (UTC)', 'Hora local', 'El. máx.', 'Qualidade', 'Polar', 'Ação'].map(h => (
                  <th key={h} className="px-3 py-2 border-b border-gray-700 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {passes.map((p, i) => {
                // network-passes uses `max_alt`, all-passes uses `max_el`
                const maxEl = p.max_el ?? p.max_alt ?? 0;
                const q = qualityLabel(maxEl);
                const color = QUALITY_COLOR[q];
                const hasPolarData = p.aos_az != null && p.max_az != null && p.los_az != null;

                return (
                  <tr key={i} className={`${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'} border-b border-gray-800`}>
                    <td className="px-3 py-2 text-sky-400 font-semibold">
                      {p.satellite || '—'}
                    </td>
                    <td className="px-3 py-2">{formatUTC(p.aos)}</td>
                    <td className="px-3 py-2">{formatUTC(p.los)}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {formatLocal(p.aos)} → {formatLocal(p.los)}
                    </td>
                    <td className="px-3 py-2 font-bold" style={{ color }}>
                      {maxEl.toFixed(1)}°
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${color}22`, color }}
                      >
                        {q}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      {hasPolarData
                        ? <PolarPlot aos_az={p.aos_az} max_az={p.max_az} los_az={p.los_az} max_el={maxEl} />
                        : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {mode === 'scheduled' ? (
                        <button
                          onClick={() => schedulePass(p)}
                          disabled={!p.transmitter_uuid || scheduling === p.satellite}
                          title={!p.transmitter_uuid ? 'Sem transmissor disponível' : undefined}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg flex items-center gap-1 transition-colors text-xs font-semibold"
                        >
                          <Plus size={12} />
                          {scheduling === p.satellite ? '...' : 'Schedule'}
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs" title="Passes de 'Todos os passes' não têm transmissor associado (TLE puro, sem dados do SatNOGS)">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
