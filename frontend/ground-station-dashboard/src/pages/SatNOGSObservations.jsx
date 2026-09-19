import React, { useState, useEffect, useCallback } from 'react';
import { Telescope, RefreshCw, Filter, CalendarPlus } from 'lucide-react';
import { useSatelliteData } from '../hooks/useSatelliteData';
import ObservationsList from '../components/satnogs/ObservationsList';
import SatNOGSStatus from '../components/satnogs/SatNOGSStatus';
import ScheduleModal from '../components/satnogs/ScheduleModal';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STATION_ID = 4518;

const SatNOGSObservations = ({ theme = 'dark' }) => {
  const { satnogsData, connected } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true,
  });

  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSchedule, setShowSchedule] = useState(false);

  const mergeObservations = (prev, incoming) => {
    const combined = [...incoming, ...prev];
    return Array.from(new Map(combined.map((o) => [o.id || o.observation_id, o])).values());
  };

  const fetchObservations = useCallback(async (url = null, append = false) => {
    try {
      // First call uses the backend proxy; subsequent pages come from the
      // rewritten `next` path returned by the proxy (e.g. /api/satnogs/observations?page=2…)
      const endpoint = url
        ? (url.startsWith('http') ? url : `${BACKEND}${url}`)
        : `${BACKEND}/api/satnogs/observations?ground_station=${STATION_ID}&limit=25`;

      const res = await fetch(endpoint);
      const data = await res.json();

      const results = Array.isArray(data) ? data : data.results ?? [];
      const next = Array.isArray(data) ? null : data.next ?? null;

      setObservations((prev) => (append ? mergeObservations(prev, results) : results));
      setNextPage(next);
    } catch (err) {
      console.error('[SatNOGS] Failed to fetch observations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const refresh = () => {
    setRefreshing(true);
    fetchObservations();
  };

  const loadMore = () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    fetchObservations(nextPage, true);
  };

  useEffect(() => {
    fetchObservations();
    const interval = setInterval(() => fetchObservations(), 120_000);
    return () => clearInterval(interval);
  }, [fetchObservations]);

  // Merge any live WebSocket observations
  useEffect(() => {
    if (satnogsData.observations?.length > 0) {
      setObservations((prev) => mergeObservations(prev, satnogsData.observations).slice(0, 200));
    }
  }, [satnogsData.observations]);

  const getStatus = (o) => o.vetted_status || o.status || 'unknown';

  const counts = {
    total:   observations.length,
    good:    observations.filter((o) => getStatus(o) === 'good').length,
    bad:     observations.filter((o) => getStatus(o) === 'bad').length,
    failed:  observations.filter((o) => getStatus(o) === 'failed').length,
    unknown: observations.filter((o) => !['good', 'bad', 'failed'].includes(getStatus(o))).length,
  };

  const filtered =
    statusFilter === 'all'
      ? observations
      : observations.filter((o) => getStatus(o) === statusFilter);

  const filterBtns = [
    { key: 'all',     label: 'All',     count: counts.total,   activeClass: 'bg-purple-600 text-white' },
    { key: 'good',    label: 'Good',    count: counts.good,    activeClass: 'bg-green-600 text-white' },
    { key: 'bad',     label: 'Bad',     count: counts.bad,     activeClass: 'bg-red-600 text-white' },
    { key: 'unknown', label: 'Unknown', count: counts.unknown, activeClass: 'bg-gray-600 text-white' },
    { key: 'failed',  label: 'Failed',  count: counts.failed,  activeClass: 'bg-orange-600 text-white' },
  ];

  return (
    <div className="w-full p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
              <Telescope className="text-purple-500" size={34} />
              Observations
            </h1>
            <p className="text-gray-400 text-sm">
              VHF/UHF satellite observations · UA Aveiro ground station #{STATION_ID}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-semibold"
            >
              <CalendarPlus size={15} />
              Schedule
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={refreshing ? 'animate-spin' : ''} size={15} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live feed connected' : 'Disconnected — showing cached data'}
          </span>
        </div>
      </div>

      {/* Station status */}
      <div className="mb-6">
        <SatNOGSStatus status={satnogsData.status} theme={theme} />
      </div>

      {/* Stat cards — clicking filters the list */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { key: 'good',    value: counts.good,    label: 'Good',    valueClass: 'text-green-400',  borderActive: 'border-green-500' },
          { key: 'bad',     value: counts.bad,     label: 'Bad',     valueClass: 'text-red-400',    borderActive: 'border-red-500' },
          { key: 'failed',  value: counts.failed,  label: 'Failed',  valueClass: 'text-orange-400', borderActive: 'border-orange-500' },
          { key: 'unknown', value: counts.unknown, label: 'Unknown', valueClass: 'text-gray-400',   borderActive: 'border-gray-400' },
        ].map(({ key, value, label, valueClass, borderActive }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`bg-gray-800 rounded-lg p-4 border text-left transition-colors ${
              statusFilter === key ? borderActive : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
            <div className="text-xs text-gray-400 uppercase mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700 flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-gray-400 flex-shrink-0" />
        {filterBtns.map(({ key, label, count, activeClass }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-colors ${
              statusFilter === key ? activeClass : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {label} ({count})
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} observation{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      ) : (
        <>
          <ObservationsList observations={filtered} />

          {nextPage && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </>
              ) : (
                'Load more observations'
              )}
            </button>
          )}
        </>
      )}

      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            setShowSchedule(false);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default SatNOGSObservations;
