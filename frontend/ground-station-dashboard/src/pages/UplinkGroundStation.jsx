// UplinkGroundStation.jsx - Command Terminal & Station Settings
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, Radio, Satellite, Wifi, WifiOff, Send, Trash2, Download,
  ChevronRight, Power, RotateCcw, Settings, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, Signal, Zap, Lock, Unlock, Database,
  Upload, RefreshCw, Volume2, VolumeX, Eye, EyeOff
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

// ── Available commands ───────────────────────────────────────────────────────
const COMMANDS = {
  help: {
    description: 'Show available commands',
    usage: 'help [command]',
  },
  status: {
    description: 'Show current station status',
    usage: 'status',
  },
  ping: {
    description: 'Ping the backend server',
    usage: 'ping',
  },
  uplink: {
    description: 'Send an uplink command to a satellite',
    usage: 'uplink <SAT_ID> <payload>',
  },
  freq: {
    description: 'Set or get operating frequency',
    usage: 'freq [MHz]',
  },
  gain: {
    description: 'Set or get antenna gain',
    usage: 'gain [dB]',
  },
  mode: {
    description: 'Set modulation mode (FSK/LoRa/GFSK)',
    usage: 'mode [FSK|LoRa|GFSK]',
  },
  scan: {
    description: 'Scan active satellites in range',
    usage: 'scan [--elevation <deg>]',
  },
  log: {
    description: 'Show recent uplink log',
    usage: 'log [--lines <n>]',
  },
  clear: {
    description: 'Clear terminal',
    usage: 'clear',
  },
  reset: {
    description: 'Reset station parameters to defaults',
    usage: 'reset',
  },
  version: {
    description: 'Show firmware and software versions',
    usage: 'version',
  },
  connect: {
    description: 'Reconnect to backend WebSocket',
    usage: 'connect',
  },
  export: {
    description: 'Export uplink session log to JSON',
    usage: 'export',
  },
};

// ── Simulated command processor ──────────────────────────────────────────────
function processCommand(cmd, stationParams, setStationParams) {
  const parts = cmd.trim().split(/\s+/);
  const base = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (base) {
    case 'help':
      if (args[0] && COMMANDS[args[0]]) {
        const c = COMMANDS[args[0]];
        return [
          { type: 'info', text: `Command: ${args[0]}` },
          { type: 'info', text: `  Description : ${c.description}` },
          { type: 'info', text: `  Usage       : ${c.usage}` },
        ];
      }
      return [
        { type: 'system', text: 'Available commands:' },
        ...Object.entries(COMMANDS).map(([name, c]) => ({
          type: 'info',
          text: `  ${name.padEnd(10)} ${c.description}`,
        })),
        { type: 'muted', text: "Type 'help <command>' for detailed usage." },
      ];

    case 'status':
      return [
        { type: 'system', text: '── Station Status ──────────────────' },
        { type: 'ok',     text: `  Station ID   : ${stationParams.stationId}` },
        { type: 'ok',     text: `  Location     : ${stationParams.location}` },
        { type: 'info',   text: `  Frequency    : ${stationParams.frequency} MHz` },
        { type: 'info',   text: `  Gain         : ${stationParams.gain} dB` },
        { type: 'info',   text: `  Mode         : ${stationParams.mode}` },
        { type: stationParams.txEnabled ? 'ok' : 'error', text: `  TX           : ${stationParams.txEnabled ? 'ENABLED' : 'DISABLED'}` },
        { type: stationParams.connected ? 'ok' : 'error', text: `  Backend      : ${stationParams.connected ? 'CONNECTED' : 'DISCONNECTED'}` },
        { type: 'system', text: '────────────────────────────────────' },
      ];

    case 'ping': {
      const ms = Math.floor(Math.random() * 12) + 2;
      return [
        { type: 'system', text: `PING ${SERVER_URL}` },
        { type: 'ok',     text: `  Reply from server: time=${ms}ms  TTL=64` },
        { type: 'muted',  text: `  Round-trip min/avg/max = ${ms - 1}/${ms}/${ms + 1} ms` },
      ];
    }

    case 'uplink': {
      if (args.length < 2) {
        return [{ type: 'error', text: 'Usage: uplink <SAT_ID> <payload>' }];
      }
      if (!stationParams.txEnabled) {
        return [{ type: 'error', text: 'TX is DISABLED. Run: gain <dB> then enable TX.' }];
      }
      const satId = args[0].toUpperCase();
      const payload = args.slice(1).join(' ');
      const bytes = payload.length;
      const ts = new Date().toISOString();
      return [
        { type: 'system', text: `── Uplink Transmission ─────────────` },
        { type: 'info',   text: `  Timestamp    : ${ts}` },
        { type: 'info',   text: `  Target SAT   : ${satId}` },
        { type: 'info',   text: `  Frequency    : ${stationParams.frequency} MHz` },
        { type: 'info',   text: `  Mode         : ${stationParams.mode}` },
        { type: 'info',   text: `  Payload      : ${payload}` },
        { type: 'info',   text: `  Size         : ${bytes} bytes` },
        { type: 'ok',     text: `  Status       : TRANSMITTED ✓` },
        { type: 'system', text: `────────────────────────────────────` },
      ];
    }

    case 'freq': {
      if (!args[0]) {
        return [{ type: 'info', text: `Current frequency: ${stationParams.frequency} MHz` }];
      }
      const f = parseFloat(args[0]);
      if (isNaN(f) || f < 100 || f > 1500) {
        return [{ type: 'error', text: 'Frequency out of range [100–1500 MHz]' }];
      }
      setStationParams(p => ({ ...p, frequency: f }));
      return [{ type: 'ok', text: `Frequency set to ${f} MHz` }];
    }

    case 'gain': {
      if (!args[0]) {
        return [{ type: 'info', text: `Current gain: ${stationParams.gain} dB` }];
      }
      const g = parseFloat(args[0]);
      if (isNaN(g) || g < 0 || g > 60) {
        return [{ type: 'error', text: 'Gain out of range [0–60 dB]' }];
      }
      setStationParams(p => ({ ...p, gain: g }));
      return [{ type: 'ok', text: `Gain set to ${g} dB` }];
    }

    case 'mode': {
      const validModes = ['FSK', 'LORA', 'GFSK'];
      if (!args[0]) {
        return [{ type: 'info', text: `Current mode: ${stationParams.mode}  (available: FSK, LoRa, GFSK)` }];
      }
      const m = args[0].toUpperCase();
      if (!validModes.includes(m)) {
        return [{ type: 'error', text: `Invalid mode. Options: FSK, LoRa, GFSK` }];
      }
      setStationParams(p => ({ ...p, mode: m === 'LORA' ? 'LoRa' : m }));
      return [{ type: 'ok', text: `Mode set to ${m === 'LORA' ? 'LoRa' : m}` }];
    }

    case 'scan': {
      const elevation = args.includes('--elevation') ? parseInt(args[args.indexOf('--elevation') + 1]) || 10 : 10;
      const satellites = ['FOSSASAT-2', 'NORBI', 'LUCKY-7', 'UASAT-1', 'PAINANI-2'];
      const results = satellites.slice(0, Math.floor(Math.random() * 3) + 2).map(s => ({
        type: 'info',
        text: `  ${s.padEnd(16)} El: ${(Math.random() * 80 + elevation).toFixed(1)}°  RSSI: -${(Math.random() * 40 + 80).toFixed(0)} dBm`,
      }));
      return [
        { type: 'system', text: `── Satellite Scan (min el: ${elevation}°) ─────` },
        ...results,
        { type: 'ok',     text: `  Found ${results.length} satellite(s) in range.` },
        { type: 'system', text: `────────────────────────────────────` },
      ];
    }

    case 'log':
      return [
        { type: 'system', text: '── Recent Uplink Log ───────────────' },
        { type: 'muted',  text: '  [No uplink history in this session]' },
        { type: 'muted',  text: "  Use 'uplink <SAT_ID> <payload>' to transmit." },
        { type: 'system', text: '────────────────────────────────────' },
      ];

    case 'clear':
      return [{ type: '__clear__', text: '' }];

    case 'reset':
      setStationParams(p => ({ ...p, frequency: 436.703, gain: 20, mode: 'LoRa', txEnabled: false }));
      return [
        { type: 'ok', text: 'Station parameters reset to defaults.' },
        { type: 'info', text: '  Frequency: 436.703 MHz | Gain: 20 dB | Mode: LoRa | TX: OFF' },
      ];

    case 'version':
      return [
        { type: 'system', text: '── Version Info ────────────────────' },
        { type: 'info',   text: '  Dashboard    : v1.0.0' },
        { type: 'info',   text: '  Firmware     : GS-FW-2.3.1' },
        { type: 'info',   text: '  Protocol     : LoRa / FSK  rev-4' },
        { type: 'info',   text: '  Node.js      : 20.x LTS' },
        { type: 'system', text: '────────────────────────────────────' },
      ];

    case 'connect':
      return [
        { type: 'info',  text: `Reconnecting to ${SERVER_URL}...` },
        { type: 'ok',    text: 'WebSocket handshake successful.' },
      ];

    case 'export': {
      const blob = { session: new Date().toISOString(), commands: [], stationParams };
      const json = JSON.stringify(blob, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `uplink-session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return [{ type: 'ok', text: 'Session exported to uplink-session-*.json' }];
    }

    default:
      return [
        { type: 'error', text: `Unknown command: '${base}'. Type 'help' for a list.` },
      ];
  }
}

// Full class strings — dynamic interpolation like `text-${color}-400` is purged in production
const statusCardStyles = {
  blue:   { card: 'bg-gradient-to-br from-blue-500/20 to-blue-600/5 border-blue-500/30',   text: 'text-blue-400' },
  purple: { card: 'bg-gradient-to-br from-purple-500/20 to-purple-600/5 border-purple-500/30', text: 'text-purple-400' },
  orange: { card: 'bg-gradient-to-br from-orange-500/20 to-orange-600/5 border-orange-500/30', text: 'text-orange-400' },
  green:  { card: 'bg-gradient-to-br from-green-500/20 to-green-600/5 border-green-500/30',  text: 'text-green-400' },
  red:    { card: 'bg-gradient-to-br from-red-500/20 to-red-600/5 border-red-500/30',    text: 'text-red-400' },
};

// ── Line color mapping ───────────────────────────────────────────────────────
const lineColor = {
  ok:      'text-green-400',
  error:   'text-red-400',
  info:    'text-blue-300',
  system:  'text-yellow-400',
  muted:   'text-gray-500',
  input:   'text-white',
};

// ─────────────────────────────────────────────────────────────────────────────
const UplinkGroundStation = () => {
  const [lines, setLines] = useState([
    { type: 'system', text: '╔══════════════════════════════════════════════════╗' },
    { type: 'system', text: '║     UA GROUND STATION  ·  UPLINK TERMINAL  v1.0 ║' },
    { type: 'system', text: '╚══════════════════════════════════════════════════╝' },
    { type: 'muted',  text: "Type 'help' to see available commands." },
    { type: 'muted',  text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [txEnabled, setTxEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [connected, setConnected] = useState(false);

  const [stationParams, setStationParams] = useState({
    stationId: '4518',
    location: 'Aveiro, Portugal',
    frequency: 436.703,
    gain: 20,
    mode: 'LoRa',
    txEnabled: false,
    connected: false,
  });

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Sync txEnabled & connected into stationParams
  useEffect(() => {
    setStationParams(p => ({ ...p, txEnabled, connected }));
  }, [txEnabled, connected]);

  // Auto-ping on mount
  useEffect(() => {
    const id = setTimeout(() => {
      fetch(`${SERVER_URL}/api/dashboard/stats`)
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }, 600);
    return () => clearTimeout(id);
  }, []);

  // Scroll to bottom whenever lines change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const pushLines = useCallback((newLines) => {
    if (newLines.length === 1 && newLines[0].type === '__clear__') {
      setLines([
        { type: 'system', text: 'Terminal cleared.' },
        { type: 'muted',  text: '' },
      ]);
      return;
    }
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    // Echo the command
    setLines(prev => [
      ...prev,
      { type: 'input', text: `gs@station-4518:~$ ${cmd}` },
    ]);

    // Process
    const result = processCommand(cmd, stationParams, setStationParams);
    pushLines(result);

    // History
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setInput('');
  }, [input, stationParams, pushLines]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : history[next]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.toLowerCase().trim();
      const match = Object.keys(COMMANDS).find(c => c.startsWith(partial));
      if (match) setInput(match);
    }
  };

  const clearTerminal = () => {
    setLines([
      { type: 'system', text: 'Terminal cleared.' },
      { type: 'muted',  text: '' },
    ]);
  };

  const exportLog = () => {
    const text = lines.map(l => l.text).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `uplink-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full p-6 space-y-6">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Terminal className="text-green-400" size={36} />
            Uplink Ground Station
          </h1>
          <p className="text-gray-400 mt-1">
            UA Aveiro · Station ID: 4518 · Command & Control Terminal
          </p>
        </div>

        {/* Live status pill */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${
          connected
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          {connected ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
        </div>
      </div>

      {/* ── Status Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Frequency',
            value: `${stationParams.frequency} MHz`,
            icon: <Signal className="text-blue-400" size={18} />,
            color: 'blue',
          },
          {
            label: 'Gain',
            value: `${stationParams.gain} dB`,
            icon: <Activity className="text-purple-400" size={18} />,
            color: 'purple',
          },
          {
            label: 'Mode',
            value: stationParams.mode,
            icon: <Radio className="text-orange-400" size={18} />,
            color: 'orange',
          },
          {
            label: 'TX Status',
            value: txEnabled ? 'ENABLED' : 'DISABLED',
            icon: txEnabled
              ? <Unlock className="text-green-400" size={18} />
              : <Lock className="text-red-400" size={18} />,
            color: txEnabled ? 'green' : 'red',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`${statusCardStyles[card.color]?.card ?? statusCardStyles.blue.card} rounded-lg p-3 border`}
          >
            <div className="flex items-center gap-2 mb-1">
              {card.icon}
              <span className="text-xs text-gray-400">{card.label}</span>
            </div>
            <div className={`text-lg font-bold font-mono ${statusCardStyles[card.color]?.text ?? statusCardStyles.blue.text}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid: Terminal + Quick Controls ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* Terminal — takes 3/4 */}
        <div className="xl:col-span-3 flex flex-col bg-gray-900 rounded-lg border border-gray-700 overflow-hidden" style={{ minHeight: '520px' }}>

          {/* Terminal titlebar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              {/* Traffic-light dots */}
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-gray-400 font-mono">gs@station-4518 — uplink-terminal</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(s => !s)}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={soundEnabled ? 'Mute beep' : 'Enable beep'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                onClick={clearTerminal}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Clear terminal"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={exportLog}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Export log"
              >
                <Download size={14} />
              </button>
            </div>
          </div>

          {/* Output area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm space-y-0.5 cursor-text"
            style={{ maxHeight: '440px' }}
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map((line, i) => (
              <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${lineColor[line.type] ?? 'text-gray-300'}`}>
                {line.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-t border-gray-700">
            <span className="font-mono text-green-400 text-sm select-none">
              gs@station-4518:~$
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder-gray-600 caret-green-400"
              placeholder="type a command…"
            />
            <button
              type="submit"
              className="p-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Quick Controls panel — 1/4 */}
        <div className="flex flex-col gap-3">

          {/* TX Toggle */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              TX Control
            </h3>
            <button
              onClick={() => {
                setTxEnabled(v => !v);
                pushLines([{
                  type: txEnabled ? 'error' : 'ok',
                  text: txEnabled ? '  TX disabled.' : '  TX enabled — ready to transmit.',
                }]);
              }}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                txEnabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {txEnabled ? '🔓 TX ON' : '🔒 TX OFF'}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {txEnabled ? 'Ready to transmit' : 'Toggle to enable uplink'}
            </p>
          </div>

          {/* Preset frequencies */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Signal size={16} className="text-blue-400" />
              Preset Frequencies
            </h3>
            <div className="space-y-1.5">
              {[
                { label: 'FOSSASAT-2',  freq: 436.703 },
                { label: 'NORBI',       freq: 437.330 },
                { label: 'LUCKY-7',     freq: 437.525 },
                { label: 'UASAT-1',     freq: 437.100 },
              ].map(({ label, freq }) => (
                <button
                  key={label}
                  onClick={() => {
                    setStationParams(p => ({ ...p, frequency: freq }));
                    pushLines([
                      { type: 'input', text: `gs@station-4518:~$ freq ${freq}` },
                      { type: 'ok',   text: `Frequency set to ${freq} MHz  (${label})` },
                    ]);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-xs font-mono transition-colors"
                >
                  <span className="text-gray-300">{label}</span>
                  <span className="text-blue-400">{freq}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Settings size={16} className="text-gray-400" />
              Quick Actions
            </h3>
            <div className="space-y-1.5">
              {[
                {
                  label: 'Scan Range',
                  icon: <Satellite size={14} className="text-purple-400" />,
                  cmd: 'scan --elevation 10',
                },
                {
                  label: 'Show Status',
                  icon: <Activity size={14} className="text-green-400" />,
                  cmd: 'status',
                },
                {
                  label: 'Reset Params',
                  icon: <RotateCcw size={14} className="text-yellow-400" />,
                  cmd: 'reset',
                },
                {
                  label: 'Export Log',
                  icon: <Download size={14} className="text-blue-400" />,
                  cmd: 'export',
                },
              ].map(({ label, icon, cmd }) => (
                <button
                  key={label}
                  onClick={() => {
                    setLines(prev => [
                      ...prev,
                      { type: 'input', text: `gs@station-4518:~$ ${cmd}` },
                    ]);
                    const result = processCommand(cmd, stationParams, setStationParams);
                    pushLines(result);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 border border-gray-600 text-xs text-gray-300 transition-colors"
                >
                  {icon}
                  {label}
                  <ChevronRight size={12} className="ml-auto text-gray-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3">
            <p className="text-xs text-gray-500 font-mono space-y-1">
              <span className="block"><kbd className="bg-gray-700 px-1 rounded text-gray-300">↑ ↓</kbd>  history</span>
              <span className="block"><kbd className="bg-gray-700 px-1 rounded text-gray-300">Tab</kbd>  autocomplete</span>
              <span className="block"><kbd className="bg-gray-700 px-1 rounded text-gray-300">Enter</kbd> execute</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Info Footer ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            icon: <Radio className="text-blue-400" size={18} />,
            title: 'Protocol',
            body: 'LoRa · FSK · GFSK  —  uplink protocol suite for LEO CubeSats',
            border: 'border-blue-500/20',
          },
          {
            icon: <Database className="text-purple-400" size={18} />,
            title: 'Session Log',
            body: 'All uplink commands are logged locally. Use \'export\' or the download button to save.',
            border: 'border-purple-500/20',
          },
          {
            icon: <AlertTriangle className="text-yellow-400" size={18} />,
            title: 'Safety Notice',
            body: 'Enable TX only during an authorized pass window. TX OFF is the safe default.',
            border: 'border-yellow-500/20',
          },
        ].map((item) => (
          <div key={item.title} className={`bg-gray-800/60 rounded-lg border ${item.border} p-4 flex gap-3`}>
            <div className="mt-0.5">{item.icon}</div>
            <div>
              <div className="text-sm font-semibold text-gray-300 mb-1">{item.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UplinkGroundStation;
