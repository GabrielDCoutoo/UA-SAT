import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Globe, Search, RefreshCw, ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const OUR_STATION_ID = 4518;

const STATUS = {
  2: { label: 'Online',  color: '#22c55e', dot: 'bg-green-500',  text: 'text-green-400',  border: 'border-green-500' },
  1: { label: 'Testing', color: '#eab308', dot: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500' },
  0: { label: 'Offline', color: '#6b7280', dot: 'bg-gray-500',   text: 'text-gray-400',   border: 'border-gray-500' },
};

const markerColor = (station) => {
  if (station.id === OUR_STATION_ID) return '#a855f7';
  return STATUS[Number(station.status)]?.color ?? '#6b7280';
};


const SatNOGSStationsMap = () => {
  const [stations, setStations]     = useState([]);
  const [totalCount, setTotalCount] = useState(null); // total on SatNOGS network
  const [isPartial, setIsPartial]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/satnogs/stations`);
      const data = await res.json();

      // Backend returns { stations, total, returned, partial }
      // Fall back gracefully if it somehow returns a plain array
      const list    = Array.isArray(data) ? data : (data.stations ?? []);
      const total   = Array.isArray(data) ? list.length : (data.total ?? list.length);
      const partial = Array.isArray(data) ? false : (data.partial ?? false);

      setStations(list);
      setTotalCount(total);
      setIsPartial(partial);
    } catch (err) {
      console.error('[SatNOGS] Failed to fetch stations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const counts = {
    online:  stations.filter((s) => Number(s.status) === 2).length,
    testing: stations.filter((s) => Number(s.status) === 1).length,
    offline: stations.filter((s) => Number(s.status) === 0).length,
  };

  const filtered = stations.filter((s) => {
    if (statusFilter !== 'all' && Number(s.status) !== Number(statusFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name?.toLowerCase().includes(q) && !s.location?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Sort: our station first, then online, then testing, then offline
  const sorted = [...filtered].sort((a, b) => {
    if (a.id === OUR_STATION_ID) return -1;
    if (b.id === OUR_STATION_ID) return 1;
    return (Number(b.status) ?? -1) - (Number(a.status) ?? -1);
  });

  return (
    <div className="w-full p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
            <Globe className="text-green-500" size={34} />
            Stations Worldwide
          </h1>
          <p className="text-gray-400 text-sm">
            {loading
              ? 'Loading…'
              : isPartial
                ? `Showing ${stations.length} of ${totalCount ?? '?'} SatNOGS stations`
                : `${stations.length} SatNOGS ground stations globally`}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} size={15} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-3xl font-bold">{loading ? '…' : stations.length}</div>
          <div className="text-xs text-gray-400 uppercase mt-1">
            {isPartial && totalCount
              ? `Showing / ${totalCount} total`
              : 'Loaded Stations'}
          </div>
        </div>
        {[
          { label: 'Online',  value: counts.online,  cls: 'text-green-400',  key: '2' },
          { label: 'Testing', value: counts.testing, cls: 'text-yellow-400', key: '1' },
          { label: 'Offline', value: counts.offline, cls: 'text-gray-400',   key: '0' },
        ].map(({ label, value, cls, key }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`bg-gray-800 rounded-lg p-4 border text-left transition-colors ${
              statusFilter === key ? (STATUS[Number(key)]?.border ?? 'border-gray-500') : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className={`text-3xl font-bold ${cls}`}>{loading ? '…' : value}</div>
            <div className="text-xs text-gray-400 uppercase mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Map */}
      <div
        className="rounded-lg border border-gray-700 overflow-hidden mb-5"
        style={{ height: 460 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full bg-gray-800">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
          </div>
        ) : (
          <MapContainer
            center={[20, 10]}
            zoom={2}
            style={{ height: '100%', width: '100%' }}
            attributionControl={false}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="© CartoDB © OpenStreetMap contributors"
            />

            {filtered.map((station) => {
              if (station.lat == null || station.lng == null) return null;
              const isOurs = station.id === OUR_STATION_ID;
              const color = markerColor(station);
              const cfg = STATUS[Number(station.status)];

              return (
                <CircleMarker
                  key={station.id}
                  center={[station.lat, station.lng]}
                  radius={isOurs ? 11 : 5}
                  fillColor={color}
                  color={isOurs ? '#ffffff' : color}
                  fillOpacity={isOurs ? 1 : 0.75}
                  weight={isOurs ? 2.5 : 1}
                >
                  <Popup>
                    <div
                      style={{
                        background: '#1f2937',
                        color: '#f3f4f6',
                        borderRadius: 6,
                        padding: '10px 12px',
                        minWidth: 200,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {isOurs && <span style={{ color: '#a855f7' }}>★</span>}
                        <span>{station.name}</span>
                        {isOurs && (
                          <span style={{ color: '#a855f7', fontSize: 10 }}>(Our Station)</span>
                        )}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>
                        <div>ID: {station.id}</div>
                        <div style={{ color: cfg?.color ?? '#6b7280' }}>
                          {cfg?.label ?? 'Unknown'}
                        </div>
                        {station.location && <div>{station.location}</div>}
                        <div>
                          {station.lat?.toFixed(3)}°, {station.lng?.toFixed(3)}°
                          {station.altitude != null ? `, ${station.altitude}m` : ''}
                        </div>
                        {station.observations_count != null && (
                          <div>{station.observations_count.toLocaleString()} observations</div>
                        )}
                        {station.last_seen && (
                          <div>Last seen {new Date(station.last_seen).toLocaleDateString()}</div>
                        )}
                      </div>
                      <a
                        href={`https://network.satnogs.org/stations/${station.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#a855f7', fontSize: 12, display: 'block', marginTop: 6 }}
                      >
                        View on SatNOGS →
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-5 flex flex-wrap items-center gap-5 text-sm">
        <span className="text-gray-400 font-semibold text-xs uppercase">Legend</span>
        {[
          { dot: 'bg-green-500',  label: `Online (${counts.online})` },
          { dot: 'bg-yellow-500', label: `Testing (${counts.testing})` },
          { dot: 'bg-gray-500',   label: `Offline (${counts.offline})` },
          { dot: 'bg-purple-500 ring-2 ring-white', label: 'Our Station (UA Aveiro #4518)' },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full inline-block ${dot}`} />
            <span className="text-gray-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        >
          <option value="all">All statuses</option>
          <option value="2">Online only</option>
          <option value="1">Testing only</option>
          <option value="0">Offline only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Station</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Observations</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sorted.slice(0, 150).map((station) => {
                const isOurs = station.id === OUR_STATION_ID;
                const cfg = STATUS[Number(station.status)];
                return (
                  <tr
                    key={station.id}
                    className={`transition-colors ${
                      isOurs
                        ? 'bg-purple-500/10 hover:bg-purple-500/20'
                        : 'hover:bg-gray-700/40'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOurs && <span className="text-purple-400 font-bold">★</span>}
                        <a
                          href={`https://network.satnogs.org/stations/${station.id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-green-400 transition-colors flex items-center gap-1"
                        >
                          {station.name}
                          <ExternalLink size={10} className="opacity-40" />
                        </a>
                        <span className="text-xs text-gray-600">#{station.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">
                      {station.location ||
                        (station.lat != null
                          ? `${station.lat.toFixed(2)}°, ${station.lng?.toFixed(2)}°`
                          : '—')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          cfg?.text ?? 'text-gray-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? 'bg-gray-500'}`} />
                        {cfg?.label ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 hidden md:table-cell">
                      {station.observations_count != null
                        ? station.observations_count.toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 hidden lg:table-cell">
                      {station.last_seen
                        ? new Date(station.last_seen).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sorted.length > 150 && (
            <div className="px-4 py-3 text-center text-xs text-gray-500 bg-gray-900 border-t border-gray-700">
              Showing 150 of {sorted.length} stations
            </div>
          )}

          {sorted.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-gray-500">
              No stations match your filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SatNOGSStationsMap;
