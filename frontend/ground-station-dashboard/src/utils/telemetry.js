// Shared telemetry display utilities — imported by UASATMission, TinyGSMyStation, UAVBackscatter

export const batteryPct = s =>
  ({ full: 100, half_full: 75, half_empty: 25, empty: 0 }[s] ?? null);

export const batteryColor = s =>
  ({ full: 'text-green-400', half_full: 'text-yellow-400', half_empty: 'text-orange-400', empty: 'text-red-400' }[s] ?? 'text-gray-400');

export const batteryBarColor = s =>
  ({ full: 'bg-green-400', half_full: 'bg-yellow-400', half_empty: 'bg-orange-400', empty: 'bg-red-400' }[s] ?? 'bg-gray-400');

export const rssiColor = v =>
  +v > -90 ? 'text-green-400' : +v > -105 ? 'text-yellow-400' : 'text-red-400';

export const snrColor = v =>
  +v > 10 ? 'text-green-400' : +v > 5 ? 'text-yellow-400' : 'text-red-400';

export const fmtVal = (v, u = '') => (v == null) ? 'N/A' : `${v}${u}`;

export const fmtTemp = v => (v == null) ? 'N/A' : `${Number(v).toFixed(1)}°C`;

export const fmtHum = v => (v == null) ? 'N/A' : `${Math.round(Number(v))}%`;

export const fmtGas = v => (v == null) ? '—' : `${(Number(v) / 1000).toFixed(2)} kΩ`;

export const fmtTime = ts => {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

export const fmtRelative = ts => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts);
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};
