// frontend/src/components/tinygs/TinyGSPacketCard.jsx - CORRIGIDO
import React from 'react';
import { Radio, MapPin, Activity, Clock } from 'lucide-react';

const TinyGSPacketCard = ({ packet, theme = 'dark' }) => {
  // Adapt database fields
  const satellite = packet.satellite_name || 'Unknown';
  const station = packet.station_name || packet.station_id || 'Unknown Station';
  const rssi = parseFloat(packet.rssi) || 0;
  const snr = parseFloat(packet.snr) || 0;
  const timestamp = packet.received_at || packet.packet_timestamp || new Date().toISOString();
  const mode = packet.transmitter_mode || 'FSK@433.1750';
  const isMyStation = packet.is_my_station || false;
  const isBalloon = packet.is_balloon || false;

  // Format timestamp
  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get RSSI color
  const getRSSIColor = (value) => {
    if (value > -90) return 'text-green-400';
    if (value > -105) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get SNR color  
  const getSNRColor = (value) => {
    if (value > 10) return 'text-green-400';
    if (value > 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`rounded-lg border transition-all hover:border-blue-500/50 ${
      theme === 'dark' 
        ? 'bg-gray-800 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isBalloon ? 'bg-orange-500/20' : 'bg-blue-500/20'
            }`}>
              <Radio className={isBalloon ? 'text-orange-500' : 'text-blue-500'} size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                {satellite}
                {isBalloon && (
                  <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                    🎈 BALLOON
                  </span>
                )}
                {isMyStation && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                    ⭐ MY STATION
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <Clock size={14} />
                <span>{formatTimestamp(timestamp)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-400">Mode</div>
            <div className="font-mono text-sm">{mode}</div>
            <div className="text-xs text-gray-500 mt-1">
              Received by
            </div>
            <div className="text-xs font-semibold">
              {packet.is_my_station ? '⭐ ' : ''}{station}
            </div>
          </div>
        </div>

        {/* Data Section */}
        {packet.parsed_data && Object.keys(packet.parsed_data).length > 0 && (
          <div className="mb-3 p-3 bg-gray-900/50 rounded-lg">
            <div className="text-xs text-gray-400 mb-2">Telemetry Data</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(packet.parsed_data).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400 capitalize">{key}:</span>
                  <span className="font-mono">
                    {/* ✅ FIX: Converte objetos para string */}
                    {typeof value === 'object' && value !== null 
                      ? JSON.stringify(value).substring(0, 30) + '...'
                      : String(value)
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RF Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-400" />
            <div>
              <div className="text-xs text-gray-400">RSSI</div>
              <div className={`font-bold ${getRSSIColor(rssi)}`}>
                {rssi.toFixed(2)} dBm
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity size={16} className="text-gray-400" />
            <div>
              <div className="text-xs text-gray-400">SNR</div>
              <div className={`font-bold ${getSNRColor(snr)}`}>
                {snr.toFixed(2)} dB
              </div>
            </div>
          </div>
        </div>

        {/* Station Location */}
        {(packet.station_lat || packet.station_lon) && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin size={14} />
              <span>Station: {station}</span>
            </div>
            {packet.station_lat && packet.station_lon && (
              <div className="text-xs text-gray-500 mt-1 font-mono">
                Lat: {parseFloat(packet.station_lat).toFixed(4)}° 
                {' | '}
                Lon: {parseFloat(packet.station_lon).toFixed(4)}°
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TinyGSPacketCard;