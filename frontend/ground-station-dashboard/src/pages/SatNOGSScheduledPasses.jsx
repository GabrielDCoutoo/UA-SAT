import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Satellite, TrendingUp, Radio, MapPin, Filter, Plus } from 'lucide-react';
import { useToast, ToastContainer } from '../components/ui/Toast';
import { authFetch } from '../auth';

const STATION_ID = 4518;

// ── Elevation thresholds ──────────────────────────────────────────────────────
// >45° = excellent (green), 20-45° = good (yellow), <20° = poor (red)
const getElevConfig = (elev) => {
  if (elev > 45)  return { color: '#22c55e', text: 'text-green-400',  badge: 'bg-green-500/20 text-green-400 border-green-500/30',  bar: 'bg-green-500',  label: 'Excellent' };
  if (elev >= 20) return { color: '#eab308', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', bar: 'bg-yellow-500', label: 'Good' };
  return           { color: '#ef4444', text: 'text-red-400',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',     bar: 'bg-red-500',    label: 'Poor' };
};

// ── Polar plot (SVG sky chart) ────────────────────────────────────────────────
const PolarPlot = ({ pass }) => {
  const SIZE = 150;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = CX - 14; // leave room for labels

  // Elevation → distance from centre (90°=centre, 0°=edge)
  // Azimuth → angle (N=top, E=right)
  const toXY = (elev, az) => {
    const dist = R * (1 - Math.max(0, Math.min(90, elev)) / 90);
    const rad = ((az - 90) * Math.PI) / 180; // rotate so N points up
    return { x: CX + dist * Math.cos(rad), y: CY + dist * Math.sin(rad) };
  };

  const aosAz = pass.aos_azimuth ?? 0;
  const losAz = pass.los_azimuth ?? 180;
  const maxEl = pass.max_elevation ?? 0;

  // Mid-azimuth for the peak point (simple average, handling wrap-around)
  let diff = ((losAz - aosAz) + 360) % 360;
  const midAz = (aosAz + (diff > 180 ? diff - 360 : diff) / 2 + 360) % 360;

  const aosP = toXY(0, aosAz);
  const midP = toXY(maxEl, midAz);
  const losP = toXY(0, losAz);

  const { color } = getElevConfig(maxEl);
  const compassPts = [
    { label: 'N', az: 0 },
    { label: 'E', az: 90 },
    { label: 'S', az: 180 },
    { label: 'W', az: 270 },
  ];

  return (
    <svg
      width={SIZE}
      height={SIZE}
      className="flex-shrink-0"
      aria-label={`Sky chart for pass with ${maxEl.toFixed(0)}° max elevation`}
    >
      {/* Elevation rings at 0°, 30°, 60°, 90° */}
      {[0, 30, 60].map((el) => (
        <circle
          key={el}
          cx={CX} cy={CY}
          r={R * (1 - el / 90)}
          fill="none"
          stroke="#374151"
          strokeWidth="0.8"
        />
      ))}
      {/* Centre dot (zenith) */}
      <circle cx={CX} cy={CY} r={2} fill="#374151" />

      {/* Crosshairs */}
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#374151" strokeWidth="0.6" />
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#374151" strokeWidth="0.6" />

      {/* Elevation ring labels */}
      <text x={CX + 3} y={CY - R * (30 / 90) + 3} fill="#4b5563" fontSize="7.5">60°</text>
      <text x={CX + 3} y={CY - R * (60 / 90) + 3} fill="#4b5563" fontSize="7.5">30°</text>

      {/* Compass labels */}
      {compassPts.map(({ label, az }) => {
        const p = toXY(-8, az);
        return (
          <text key={label} x={p.x} y={p.y + 3} fill="#6b7280" fontSize="9" textAnchor="middle">
            {label}
          </text>
        );
      })}

      {/* Satellite track (quadratic bezier AOS→peak→LOS) */}
      <path
        d={`M ${aosP.x.toFixed(1)} ${aosP.y.toFixed(1)} Q ${midP.x.toFixed(1)} ${midP.y.toFixed(1)} ${losP.x.toFixed(1)} ${losP.y.toFixed(1)}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* AOS marker */}
      <circle cx={aosP.x} cy={aosP.y} r={3.5} fill="#22c55e" />
      <text x={aosP.x + 5} y={aosP.y + 3} fill="#22c55e" fontSize="7.5">AOS</text>

      {/* LOS marker */}
      <circle cx={losP.x} cy={losP.y} r={3.5} fill="#ef4444" />
      <text x={losP.x + 5} y={losP.y + 3} fill="#ef4444" fontSize="7.5">LOS</text>

      {/* Peak marker */}
      <circle cx={midP.x} cy={midP.y} r={4} fill={color} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const SatNOGSScheduledPasses = () => {
  const { toasts, show: showToast, dismiss } = useToast();
  const [passes, setPasses] = useState([]);
  const [scheduledPasses, setScheduledPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ next24h: 0, scheduled: 0, bestElevation: 0 });

  const [minElevation, setMinElevation] = useState(20);
  const [selectedSatellite, setSelectedSatellite] = useState('all');
  const [timeRange, setTimeRange] = useState(24);

  const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchPasses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${serverUrl}/api/satnogs/jobs`);
      const data = await res.json();

      if (data.success && Array.isArray(data.jobs)) {
        // Map SatNOGS job fields to the shape the component expects.
        // tle0 = "0 SATELLITE NAME" — strip leading number+space to get the name.
        // frequency comes in Hz → convert to MHz.
        // transmitter_uuid is already present — no separate lookup needed.
        const mapped = data.jobs.map((job) => ({
          satellite:        job.tle0.replace(/^\d+\s+/, ''),
          norad:            job.norad_cat_id,
          aos:              job.start,
          los:              job.end,
          max_elevation:    job.max_altitude ?? 0,
          frequency:        job.frequency / 1e6,
          mode:             job.mode,
          transmitter_uuid: job.transmitter,
          aos_azimuth:      null,
          los_azimuth:      null,
        }));
        setPasses(mapped);
        const now = Date.now();
        const in24h = now + 24 * 3600 * 1000;
        setStats({
          next24h: mapped.filter((p) => {
            const t = new Date(p.aos).getTime();
            return t >= now && t <= in24h;
          }).length,
          scheduled:     scheduledPasses.length,
          bestElevation: mapped.reduce((m, p) => Math.max(m, p.max_elevation ?? 0), 0),
        });
      }
    } catch (err) {
      console.error('[SatNOGS] Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduled = async () => {
    try {
      // Leitura pública (proxy sem auth): só o agendar exige sessão
      const res = await fetch(
        `${serverUrl}/api/satnogs/observations?ground_station=${STATION_ID}&limit=20`
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      const now = Date.now();
      setScheduledPasses(list.filter((o) => new Date(o.start).getTime() > now));
    } catch (err) {
      console.error('[SatNOGS] Error fetching scheduled:', err);
    }
  };

  useEffect(() => {
    fetchPasses();
    fetchScheduled();
    const interval = setInterval(() => { fetchPasses(); fetchScheduled(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeRange, minElevation]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedulePass = async (pass) => {
    try {
      if (!pass.transmitter_uuid) {
        showToast(`No transmitter available for ${pass.satellite}`, 'error');
        return;
      }

      const obsRes = await authFetch(`${serverUrl}/api/satnogs/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ground_station:   STATION_ID,
          transmitter_uuid: pass.transmitter_uuid,
          start:            pass.aos,
          end:              pass.los,
        }),
      });

      if (obsRes.ok || obsRes.status === 201) {
        const obs = await obsRes.json().catch(() => ({}));
        showToast(
          obs.id
            ? `Observation #${obs.id} scheduled for ${pass.satellite}!`
            : `Observation scheduled for ${pass.satellite}!`,
          'success'
        );
        fetchScheduled();
      } else {
        let errText = `HTTP ${obsRes.status}`;
        try {
          const body = await obsRes.json();
          errText = body.detail ?? JSON.stringify(body);
        } catch { /* ignore */ }
        showToast(`Failed: ${errText}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const satellites = [...new Set(passes.map((p) => p.satellite).filter(Boolean))];

  const filteredPasses = passes.filter((p) => {
    if (selectedSatellite !== 'all' && p.satellite !== selectedSatellite) return false;
    if ((p.max_elevation ?? 0) < minElevation) return false;
    return true;
  });

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const passDuration = (aos, los) =>
    Math.round((new Date(los) - new Date(aos)) / 60000);

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
          <Calendar className="text-blue-500" size={34} />
          Scheduled Passes
        </h1>
        <p className="text-gray-400 text-sm">
          Upcoming satellite passes · UA Aveiro ground station (ID: 4518)
        </p>

        <div className="mt-3 bg-green-500/10 border border-green-500/25 rounded-lg p-3 flex items-center gap-3 text-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="font-semibold text-green-400">Station Online</span>
          <span className="text-gray-400 ml-auto text-xs hidden sm:block">
            Aveiro, Portugal — 40.644°N, 8.645°W
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="text-blue-500" size={18} />
            <span className="text-xs text-gray-400 uppercase">Next 24 Hours</span>
          </div>
          <p className="text-3xl font-bold">{stats.next24h}</p>
          <p className="text-xs text-gray-500 mt-1">passes available</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="text-green-500" size={18} />
            <span className="text-xs text-gray-400 uppercase">Scheduled</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{scheduledPasses.length}</p>
          <p className="text-xs text-gray-500 mt-1">observations queued</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-yellow-500" size={18} />
            <span className="text-xs text-gray-400 uppercase">Best Elevation</span>
          </div>
          <p className={`text-3xl font-bold ${getElevConfig(stats.bestElevation).text}`}>
            {stats.bestElevation.toFixed(0)}°
          </p>
          <p className="text-xs text-gray-500 mt-1">maximum this window</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 mb-5 border border-gray-700">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Filter size={14} className="text-gray-400" />
          <span className="text-gray-400 text-xs">Filters:</span>

          <select
            value={selectedSatellite}
            onChange={(e) => setSelectedSatellite(e.target.value)}
            className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All satellites ({satellites.length})</option>
            {satellites.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Min elev:</span>
            <select
              value={minElevation}
              onChange={(e) => setMinElevation(Number(e.target.value))}
              className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="0">0° — All</option>
              <option value="20">20° — Good+</option>
              <option value="45">45° — Excellent</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Window:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="24">Next 24 hours</option>
              <option value="48">Next 48 hours</option>
              <option value="72">Next 3 days</option>
              <option value="168">Next week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Passes list */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Available Passes <span className="text-gray-500 font-normal text-sm">({filteredPasses.length})</span>
        </h2>
      </div>

      {loading ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <Calendar className="mx-auto mb-4 text-blue-500 animate-pulse" size={40} />
          <p className="text-gray-400">Loading passes…</p>
        </div>
      ) : filteredPasses.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <Satellite className="mx-auto mb-4 text-gray-600" size={56} />
          <h3 className="text-lg font-semibold mb-1">No Passes Found</h3>
          <p className="text-gray-400 text-sm">Try lowering the minimum elevation or extending the time window</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPasses.map((pass, idx) => {
            const cfg = getElevConfig(pass.max_elevation ?? 0);
            const hasPolarData = pass.aos_azimuth != null && pass.los_azimuth != null;

            return (
              <div
                key={idx}
                className="bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500/40 transition-all"
              >
                <div className="p-4 flex flex-col md:flex-row gap-4">
                  {/* Polar plot */}
                  {hasPolarData && (
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <PolarPlot pass={pass} />
                      <span className="text-xs text-gray-500">Sky track</span>
                    </div>
                  )}

                  {/* Pass info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Satellite className="text-blue-400 flex-shrink-0" size={18} />
                        <span className="font-bold text-lg leading-tight">{pass.satellite}</span>
                        {pass.norad && (
                          <span className="text-xs text-gray-500 font-mono">NORAD {pass.norad}</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <button
                          onClick={() => schedulePass(pass)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors text-xs font-semibold"
                        >
                          <Plus size={13} />
                          Schedule
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-xs text-gray-500">AOS (Rise)</div>
                        <div className="font-semibold text-green-400">{fmtTime(pass.aos)}</div>
                        <div className="text-xs text-gray-500">{fmtDate(pass.aos)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">LOS (Set)</div>
                        <div className="font-semibold text-red-400">{fmtTime(pass.los)}</div>
                        <div className="text-xs text-gray-500">
                          {passDuration(pass.aos, pass.los)} min
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Max Elevation</div>
                        <div className={`font-bold text-xl ${cfg.text}`}>
                          {(pass.max_elevation ?? 0).toFixed(1)}°
                        </div>
                        {hasPolarData && (
                          <div className="text-xs text-gray-500">
                            {pass.aos_azimuth.toFixed(0)}° → {pass.los_azimuth.toFixed(0)}°
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Frequency / Mode</div>
                        <div className="font-semibold text-sm">
                          {pass.frequency ? `${pass.frequency} MHz` : '—'}
                        </div>
                        <div className="text-xs text-gray-500">{pass.mode || 'Unknown'}</div>
                      </div>
                    </div>

                    {/* Elevation bar */}
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cfg.bar}`}
                        style={{ width: `${Math.min(((pass.max_elevation ?? 0) / 90) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quality guide */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/25 rounded-lg text-sm">
        <div className="flex items-start gap-3">
          <MapPin className="text-blue-400 mt-0.5 flex-shrink-0" size={18} />
          <div>
            <p className="font-semibold mb-1">Pass Quality Guide</p>
            <ul className="space-y-0.5 text-gray-400 text-xs">
              <li>
                <span className="text-green-400 font-semibold">Excellent (&gt;45°)</span> — Best signal, satellite passes nearly overhead
              </li>
              <li>
                <span className="text-yellow-400 font-semibold">Good (20–45°)</span> — Decent signal, some path loss expected
              </li>
              <li>
                <span className="text-red-400 font-semibold">Poor (&lt;20°)</span> — Weak signal, likely obstructed by horizon
              </li>
            </ul>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default SatNOGSScheduledPasses;
