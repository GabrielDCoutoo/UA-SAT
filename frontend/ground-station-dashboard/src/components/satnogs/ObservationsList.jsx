import React, { useState } from 'react';
import { Radio, ChevronDown, ChevronUp, ExternalLink, ImageOff } from 'lucide-react';

const STATUS_CONFIG = {
  good:    { badge: 'bg-green-500/20 text-green-400 border border-green-500/40',  dot: 'bg-green-400',   label: 'Good' },
  bad:     { badge: 'bg-red-500/20 text-red-400 border border-red-500/40',        dot: 'bg-red-400',     label: 'Bad' },
  failed:  { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/40', dot: 'bg-orange-400', label: 'Failed' },
  unknown: { badge: 'bg-gray-500/20 text-gray-400 border border-gray-500/40',     dot: 'bg-gray-500',    label: 'Unknown' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const WaterfallThumbnail = ({ url, obsId }) => {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!url || errored) {
    return (
      <div className="flex items-center justify-center h-16 w-32 bg-gray-900 rounded text-gray-600 flex-shrink-0">
        <ImageOff size={18} />
      </div>
    );
  }

  return (
    <div className="relative h-16 w-32 bg-gray-900 rounded overflow-hidden flex-shrink-0">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={url}
        alt={`Waterfall #${obsId}`}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
};

const WaterfallFull = ({ url }) => {
  const [errored, setErrored] = useState(false);
  if (!url || errored) return null;
  return (
    <div className="mb-4 rounded-lg overflow-hidden bg-black">
      <img
        src={url}
        alt="Waterfall"
        className="w-full"
        onError={() => setErrored(true)}
      />
    </div>
  );
};

// Elevation thresholds: >45°=green, 20-45°=yellow, <20°=red
const elevClass = (elev) => {
  if (elev == null) return 'text-gray-400';
  if (elev > 45)  return 'text-green-400';
  if (elev >= 20) return 'text-yellow-400';
  return 'text-red-400';
};

const normalize = (obs) => ({
  id: obs.id || obs.observation_id,
  // tle0 is "0 SATELLITE NAME" — strip the leading "0 " prefix
  satellite_name:
    obs.tle0?.replace(/^0\s+/, '') ||
    obs.satellite_name ||
    (obs.norad_cat_id ? `NORAD ${obs.norad_cat_id}` : null) ||
    (obs.satellite_norad_id ? `NORAD ${obs.satellite_norad_id}` : 'Unknown'),
  norad_id: obs.norad_cat_id || obs.satellite_norad_id,
  start: obs.start || obs.start_time,
  end: obs.end || obs.end_time,
  // observation_frequency is in Hz from the SatNOGS API
  frequency: obs.observation_frequency ?? obs.frequency,
  mode: obs.transmitter_mode || obs.mode,
  // prefer the vetted status when available
  status: obs.status || obs.vetted_status || 'unknown',
  station_name: obs.station_name || 'UA-Aveiro (4518)',
  waterfall: obs.waterfall,
  payload: obs.payload,
  demoddata: obs.demoddata,
  rise_azimuth: obs.rise_azimuth,
  set_azimuth: obs.set_azimuth,
  max_altitude: obs.max_altitude,
});

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

export const ObservationsList = ({ observations = [] }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (observations.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
        <Radio className="text-gray-600 mx-auto mb-3" size={48} />
        <p className="text-gray-400 text-lg">No observations</p>
        <p className="text-gray-500 text-sm mt-1">Observations will appear here as they complete</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {observations.map((raw) => {
        const obs = normalize(raw);
        const expanded = expandedId === obs.id;
        const freqMHz = obs.frequency ? (obs.frequency / 1e6).toFixed(3) : null;

        return (
          <div
            key={obs.id}
            className="bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            {/* ── Card row ── */}
            <button
              className="w-full text-left p-4"
              onClick={() => setExpandedId(expanded ? null : obs.id)}
            >
              <div className="flex items-start gap-4">
                <WaterfallThumbnail url={obs.waterfall} obsId={obs.id} />

                <div className="flex-1 min-w-0">
                  {/* Top row: name · NORAD · status */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-bold text-white">{obs.satellite_name}</span>
                    {obs.norad_id && (
                      <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                        #{obs.norad_id}
                      </span>
                    )}
                    <StatusBadge status={obs.status} />
                    <a
                      href={`https://network.satnogs.org/observations/${obs.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto text-xs text-gray-600 hover:text-purple-400 font-mono flex items-center gap-0.5 flex-shrink-0 transition-colors"
                    >
                      #{obs.id}
                      <ExternalLink size={9} />
                    </a>
                  </div>

                  {/* Detail row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                    <div>
                      <div className="text-xs text-gray-500">Station</div>
                      <div className="text-xs text-gray-300 font-medium">{obs.station_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Start → End</div>
                      <div className="text-xs font-mono text-gray-300">
                        {fmtDateTime(obs.start)}
                      </div>
                      <div className="text-xs font-mono text-gray-500">
                        {fmtDateTime(obs.end)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Frequency / Mode</div>
                      <div className="text-xs text-gray-300">
                        {freqMHz ? `${freqMHz} MHz` : '—'}
                        {obs.mode ? ` · ${obs.mode}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Max Elevation</div>
                      <div className={`text-sm font-bold ${elevClass(obs.max_altitude)}`}>
                        {obs.max_altitude != null ? `${obs.max_altitude.toFixed(1)}°` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 text-gray-500 mt-1">
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
            </button>

            {/* ── Detail panel ── */}
            {expanded && (
              <div className="border-t border-gray-700 p-4 bg-gray-900/60">
                <WaterfallFull url={obs.waterfall} />

                {/* Audio */}
                {obs.payload && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1">
                      Audio recording
                    </p>
                    <audio
                      controls
                      className="w-full"
                      style={{ height: 32, filter: 'invert(0.85) hue-rotate(180deg)' }}
                    >
                      <source src={obs.payload} />
                    </audio>
                  </div>
                )}

                {/* Decoded frames */}
                {obs.demoddata && obs.demoddata.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                      Decoded data — {obs.demoddata.length} frame{obs.demoddata.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {obs.demoddata.map((d, i) => (
                        <div
                          key={i}
                          className="text-xs font-mono bg-gray-800 rounded px-2 py-1 text-green-400"
                        >
                          {d.created ? new Date(d.created).toLocaleTimeString() : `Frame ${i + 1}`}
                          {' — '}
                          {d.payload_frame || d.payload_decoded || '(raw data)'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs mb-3">
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-500 mb-0.5">Obs ID</div>
                    <div className="font-mono text-gray-300">{obs.id}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-500 mb-0.5">NORAD</div>
                    <div className="font-mono text-gray-300">{obs.norad_id || '—'}</div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-500 mb-0.5">Max Elev</div>
                    <div className="font-mono text-gray-300">
                      {obs.max_altitude != null ? `${obs.max_altitude.toFixed(1)}°` : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-500 mb-0.5">Rise Az</div>
                    <div className="font-mono text-gray-300">
                      {obs.rise_azimuth != null ? `${obs.rise_azimuth.toFixed(0)}°` : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-500 mb-0.5">Set Az</div>
                    <div className="font-mono text-gray-300">
                      {obs.set_azimuth != null ? `${obs.set_azimuth.toFixed(0)}°` : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a
                    href={`https://network.satnogs.org/observations/${obs.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-xs font-semibold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on SatNOGS Network
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ObservationsList;
