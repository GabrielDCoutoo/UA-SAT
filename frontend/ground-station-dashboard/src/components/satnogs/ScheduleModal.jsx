import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../auth';
import {
  X, Search, Satellite, ChevronRight,
  CheckCircle, AlertTriangle, Clock, Radio,
} from 'lucide-react';

const SATNOGS_NET = 'https://network.satnogs.org/api';
const STATION_ID = 4518;

const elevClass = (elev) => {
  if (elev > 45)  return 'text-green-400';
  if (elev >= 20) return 'text-yellow-400';
  return 'text-red-400';
};

const fmtDT = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// ── Step indicator ────────────────────────────────────────────────────────────
const Steps = ({ current }) => {
  const steps = [
    { id: 'search',      label: '1. Satellite' },
    { id: 'transmitter', label: '2. Transmitter' },
    { id: 'pass',        label: '3. Pass' },
  ];
  const done = ['transmitter', 'pass', 'submitting', 'done', 'error'];
  const doneCurrent = [...done, 'search'];

  return (
    <div className="flex items-center gap-1 text-xs px-4 py-3 border-b border-gray-700/50">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <ChevronRight size={11} className="text-gray-600 flex-shrink-0" />}
          <span
            className={
              current === s.id
                ? 'text-blue-400 font-semibold'
                : done.includes(current) && i < done.indexOf(current)
                ? 'text-green-400'
                : 'text-gray-500'
            }
          >
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ text = 'Loading…' }) => (
  <div className="text-center py-10">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
    <p className="text-gray-400 text-sm">{text}</p>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
const ScheduleModal = ({ onClose, onScheduled }) => {
  // step: search | transmitter | pass | submitting | done | error
  const [step, setStep] = useState('search');

  // Step 1 — satellite search
  const [query, setQuery]         = useState('');
  const [satellites, setSatellites] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [selectedSat, setSelectedSat] = useState(null);

  // Step 2 — transmitter
  const [transmitters, setTransmitters] = useState([]);
  const [loadingTx, setLoadingTx]       = useState(false);
  const [selectedTx, setSelectedTx]     = useState(null);

  // Step 3 — pass
  const [passes, setPasses]           = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [selectedPass, setSelectedPass]   = useState(null);

  // Result
  const [errorMsg, setErrorMsg]     = useState('');
  const [createdObs, setCreatedObs] = useState(null);

  const debounceRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // ── Step 1: debounced search ────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSatellites([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 450);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const doSearch = async (q) => {
    setSearching(true);
    setSatellites([]);
    try {
      // Numeric → NORAD ID lookup; text → name search (best-effort)
      const param = /^\d+$/.test(q) ? `norad_cat_id=${q}` : `q=${encodeURIComponent(q)}`;
      const res  = await fetch(`${SATNOGS_NET}/satellites/?format=json&${param}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setSatellites(list.slice(0, 20));
    } catch {
      setSatellites([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Step 1 → 2: select satellite, fetch transmitters ───────────────────────
  const selectSatellite = async (sat) => {
    setSelectedSat(sat);
    setStep('transmitter');
    setLoadingTx(true);
    setTransmitters([]);
    try {
      const res  = await fetch(
        `${apiUrl}/api/satnogs/transmitters?status=active&norad_cat_id=${sat.norad_cat_id}`
      );
      const data = await res.json();
      const list = (Array.isArray(data) ? data : (data.results ?? []))
        .filter((t) => t.status === 'active' && t.alive !== false);
      setTransmitters(list);
    } catch {
      setTransmitters([]);
    } finally {
      setLoadingTx(false);
    }
  };

  // ── Step 2 → 3: select transmitter, fetch passes from backend ──────────────
  const selectTransmitter = async (tx) => {
    setSelectedTx(tx);
    setStep('pass');
    setLoadingPasses(true);
    setPasses([]);
    setSelectedPass(null);
    try {
      const res  = await fetch(`${apiUrl}/api/satnogs/passes?hours=72&min_elevation=0`);
      const data = await res.json();
      if (data.success && Array.isArray(data.passes)) {
        const norad = String(selectedSat?.norad_cat_id ?? '');
        const matching = data.passes.filter((p) => String(p.norad) === norad);
        setPasses(matching);
      }
    } catch {
      setPasses([]);
    } finally {
      setLoadingPasses(false);
    }
  };

  // ── Step 3 → submit: POST to SatNOGS Network API ───────────────────────────
  const scheduleObservation = async () => {
    if (!selectedPass || !selectedTx) return;
    setStep('submitting');
    try {
      const res = await authFetch(`${apiUrl}/api/satnogs/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ground_station: STATION_ID,
          transmitter: selectedTx.uuid,
          start: selectedPass.aos,
          end: selectedPass.los,
        }),
      });

      if (res.ok || res.status === 201) {
        const obs = await res.json().catch(() => ({}));
        setCreatedObs(obs);
        setStep('done');
        onScheduled?.();
      } else {
        let errText = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          errText = JSON.stringify(body, null, 2);
        } catch { /* ignore */ }
        setErrorMsg(errText);
        setStep('error');
      }
    } catch (e) {
      setErrorMsg(e.message);
      setStep('error');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Satellite className="text-blue-400" size={18} />
            Schedule Observation — Station #{STATION_ID}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        {['search', 'transmitter', 'pass'].includes(step) && <Steps current={step} />}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* STEP 1: SATELLITE SEARCH */}
          {step === 'search' && (
            <div>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Satellite name or NORAD ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                e.g. "NOAA 15" or NORAD ID "25338"
              </p>

              {searching && <Spinner text="Searching satellites…" />}

              {!searching && satellites.length === 0 && query.trim().length > 1 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No results. Try entering a NORAD ID (number).
                </div>
              )}

              <div className="space-y-1.5">
                {satellites.map((sat) => (
                  <button
                    key={sat.norad_cat_id}
                    onClick={() => selectSatellite(sat)}
                    className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
                  >
                    <div className="font-semibold text-sm">{sat.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      <span>NORAD {sat.norad_cat_id}</span>
                      {sat.names && <span className="truncate text-gray-600">{sat.names}</span>}
                      <span
                        className={`ml-auto font-medium ${
                          sat.status === 'alive' ? 'text-green-400' : 'text-gray-500'
                        }`}
                      >
                        {sat.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: TRANSMITTER */}
          {step === 'transmitter' && (
            <div>
              {/* Selected satellite banner */}
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4 text-sm">
                <Satellite className="text-blue-400 flex-shrink-0" size={15} />
                <span className="font-semibold">{selectedSat?.name}</span>
                <span className="text-gray-500 text-xs">NORAD {selectedSat?.norad_cat_id}</span>
              </div>

              {loadingTx ? (
                <Spinner text="Loading transmitters…" />
              ) : transmitters.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  <Radio className="mx-auto mb-2 text-gray-600" size={32} />
                  No active transmitters found for this satellite.
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">Select a transmitter:</p>
                  <div className="space-y-1.5">
                    {transmitters.map((tx) => (
                      <button
                        key={tx.uuid}
                        onClick={() => selectTransmitter(tx)}
                        className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
                      >
                        <div className="font-medium text-sm leading-snug">{tx.description}</div>
                        <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-3">
                          <span>Mode: <span className="text-white">{tx.mode || '—'}</span></span>
                          {tx.downlink_low && (
                            <span>
                              ↓ <span className="text-white">{(tx.downlink_low / 1e6).toFixed(3)} MHz</span>
                            </span>
                          )}
                          {tx.baud && <span>{tx.baud} baud</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => setStep('search')}
                className="mt-4 text-xs text-gray-500 hover:text-white transition-colors"
              >
                ← Change satellite
              </button>
            </div>
          )}

          {/* STEP 3: PASS */}
          {step === 'pass' && (
            <div>
              {/* Summary banner */}
              <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4 text-xs space-y-0.5">
                <div className="font-semibold text-sm">{selectedSat?.name}</div>
                <div className="text-gray-400">
                  {selectedTx?.description} · {selectedTx?.mode}
                  {selectedTx?.downlink_low
                    ? ` · ${(selectedTx.downlink_low / 1e6).toFixed(3)} MHz`
                    : ''}
                </div>
              </div>

              {loadingPasses ? (
                <Spinner text="Fetching upcoming passes…" />
              ) : passes.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  <Clock className="mx-auto mb-2 text-gray-600" size={32} />
                  No passes found in the next 72 hours.
                  <br />
                  <span className="text-xs text-gray-600 mt-1 block">
                    The backend may not have TLE data for NORAD {selectedSat?.norad_cat_id}.
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Select a pass — {passes.length} available:
                  </p>
                  <div className="space-y-1.5">
                    {passes.map((pass, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPass(pass)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedPass === pass
                            ? 'bg-blue-900/40 border-blue-500'
                            : 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-mono">
                            {fmtDT(pass.aos)} → {fmtTime(pass.los)}
                          </span>
                          <span className={`font-bold ${elevClass(pass.max_elevation)}`}>
                            {pass.max_elevation.toFixed(0)}°
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {Math.round((new Date(pass.los) - new Date(pass.aos)) / 60000)} min
                          {pass.aos_azimuth != null && (
                            <span className="ml-2 text-gray-600">
                              {pass.aos_azimuth.toFixed(0)}° → {pass.los_azimuth?.toFixed(0)}°
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => setStep('transmitter')}
                className="mt-4 text-xs text-gray-500 hover:text-white transition-colors"
              >
                ← Change transmitter
              </button>
            </div>
          )}

          {/* SUBMITTING */}
          {step === 'submitting' && <Spinner text="Scheduling observation…" />}

          {/* DONE */}
          {step === 'done' && (
            <div className="text-center py-10">
              <CheckCircle className="text-green-500 mx-auto mb-3" size={48} />
              <h3 className="text-lg font-bold text-green-400 mb-1">Observation Scheduled!</h3>
              {createdObs?.id && (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    Observation <span className="font-mono">#{createdObs.id}</span> created
                  </p>
                  <a
                    href={`https://network.satnogs.org/observations/${createdObs.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                  >
                    View on SatNOGS Network →
                  </a>
                </>
              )}
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="text-center py-8">
              <AlertTriangle className="text-red-500 mx-auto mb-3" size={40} />
              <h3 className="text-base font-bold text-red-400 mb-3">Scheduling Failed</h3>
              <pre className="text-xs text-gray-400 font-mono bg-gray-800 rounded-lg p-3 text-left overflow-x-auto max-h-40 mb-4">
                {errorMsg}
              </pre>
              <button
                onClick={() => setStep('pass')}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                ← Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Footer — only shown when a pass is selected ── */}
        {step === 'pass' && selectedPass && (
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <div className="bg-gray-800 rounded-lg p-3 mb-3 text-xs space-y-0.5">
              <div className="font-semibold text-sm">{selectedSat?.name}</div>
              <div className="text-gray-400">
                {selectedTx?.description} · {selectedTx?.mode}
              </div>
              <div className="text-gray-400 font-mono">
                {fmtDT(selectedPass.aos)} → {fmtTime(selectedPass.los)}
              </div>
              <div className={`font-semibold ${elevClass(selectedPass.max_elevation)}`}>
                Max elevation {selectedPass.max_elevation.toFixed(1)}°
              </div>
            </div>
            <button
              onClick={scheduleObservation}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-semibold text-sm transition-colors"
            >
              Schedule Observation
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="p-4 border-t border-gray-700 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleModal;
