// frontend/src/components/satnogs/SatNOGSStatus.jsx
import React from 'react';
import { Radio, MapPin, Activity, Clock, Antenna } from 'lucide-react';

export const SatNOGSStatus = ({ status, theme = 'dark' }) => {
  if (!status) {
    return (
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <p className="text-gray-400">Connecting to SatNOGS Network...</p>
        </div>
      </div>
    );
  }

  const lastSeenDate = new Date(status.last_seen);
  const timeSinceLastSeen = Math.floor((new Date() - lastSeenDate) / 1000);
  
  const formatTimeSince = (seconds) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radio className="text-purple-500" size={28} />
          <div>
            <h3 className="text-xl font-bold">Ground Station</h3>
            <p className="text-sm text-gray-400">SatNOGS Network</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          status.online 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status.online ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`} />
          <span className="font-semibold text-sm uppercase">
            {status.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Station Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Station Name */}
        <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Activity size={16} />
            <span className="text-xs uppercase font-semibold">Station</span>
          </div>
          <div className="text-lg font-bold truncate">{status.station_name}</div>
          <div className="text-xs text-gray-400 mt-1">ID: {status.station_id}</div>
        </div>

        {/* Last Seen */}
        <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Clock size={16} />
            <span className="text-xs uppercase font-semibold">Last Seen</span>
          </div>
          <div className="text-lg font-bold">{formatTimeSince(timeSinceLastSeen)}</div>
          <div className="text-xs text-gray-400 mt-1">
            {lastSeenDate.toLocaleString('pt-PT', { 
              day: '2-digit', 
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Location */}
        <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <MapPin size={16} />
            <span className="text-xs uppercase font-semibold">Location</span>
          </div>
          <div className="text-sm font-mono">
            {status.location.latitude.toFixed(4)}°N
          </div>
          <div className="text-sm font-mono">
            {Math.abs(status.location.longitude).toFixed(4)}°W
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {status.location.altitude}m | {status.location.qth_locator}
          </div>
        </div>

        {/* Observations */}
        <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Activity size={16} />
            <span className="text-xs uppercase font-semibold">Observations</span>
          </div>
          <div className="text-2xl font-bold">{status.statistics.total_observations}</div>
          <div className="text-xs text-gray-400 mt-1">
            {status.statistics.future_observations} scheduled
          </div>
        </div>
      </div>

      {/* Antennas */}
      {status.antennas && status.antennas.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <Antenna size={16} />
            <span className="text-xs uppercase font-semibold">Antennas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {status.antennas.map((antenna, idx) => (
              <div
                key={idx}
                className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2 text-sm`}
              >
                <span className="font-semibold">{antenna.band}</span>
                <span className="text-gray-400 mx-2">|</span>
                <span>{antenna.type}</span>
                <span className="text-gray-400 mx-2">|</span>
                <span className="font-mono text-xs">
                  {antenna.frequency_min}-{antenna.frequency_max} MHz
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {status.config?.description && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400">{status.config.description}</p>
        </div>
      )}
    </div>
  );
};

export default SatNOGSStatus;
