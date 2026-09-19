// frontend/src/pages/SatNOGSScheduled.jsx
import React from 'react';
import { Calendar, TrendingUp, Clock, Info } from 'lucide-react';
import { useSatelliteData } from '../hooks/useSatelliteData';
import ScheduledPasses from '../components/satnogs/ScheduledPasses';

const SatNOGSScheduled = ({ theme = 'dark' }) => {
  const {
    satnogsData,
    connected
  } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  // Calculate stats
  const now = new Date();
  const passes = satnogsData.scheduled;
  const next24h = passes.filter(p => {
    const start = new Date(p.start);
    return start - now < 86400000; // 24 hours
  }).length;

  const nextPass = passes.length > 0 ? passes[0] : null;

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Calendar className="text-yellow-500" size={36} />
          Scheduled Passes
        </h1>
        <p className="text-gray-400">
          Upcoming satellite passes for UA Aveiro ground station (ID: 4518)
        </p>
      </div>

      {/* Next Pass Highlight */}
      {nextPass && (
        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-lg p-6 mb-6 border border-yellow-500/30">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-3 text-yellow-400">Next Pass</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-400">Satellite:</span>
                  <p className="font-semibold text-lg">{nextPass.satellite?.name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Start Time:</span>
                  <p className="font-semibold text-lg">
                    {new Date(nextPass.start).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Max Elevation:</span>
                  <p className="font-semibold text-lg">
                    {nextPass.pass?.max_elevation ? `${nextPass.pass.max_elevation}°` : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Duration:</span>
                  <p className="font-semibold text-lg">
                    {nextPass.duration?.formatted || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-yellow-500" size={20} />
            <span className="text-sm text-gray-400">Total Scheduled</span>
          </div>
          <p className="text-3xl font-bold">{passes.length}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="text-blue-500" size={20} />
            <span className="text-sm text-gray-400">Next 24 Hours</span>
          </div>
          <p className="text-3xl font-bold">{next24h}</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Info className="text-purple-500" size={20} />
            <span className="text-sm text-gray-400">Station Status</span>
          </div>
          <p className={`text-2xl font-bold ${
            satnogsData.status?.online ? 'text-green-400' : 'text-red-400'
          }`}>
            {satnogsData.status?.online ? 'ONLINE' : 'OFFLINE'}
          </p>
        </div>
      </div>

      {/* Passes List */}
      <ScheduledPasses 
        passes={passes}
        theme={theme}
      />

      {/* Info Box */}
      {passes.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <Calendar className="mx-auto mb-4 text-gray-600" size={64} />
          <h3 className="text-xl font-semibold mb-2">No Passes Scheduled</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            {connected 
              ? "No satellite passes are currently scheduled. Check back later or schedule observations manually on SatNOGS Network."
              : "Not connected to backend. Check your connection."}
          </p>
        </div>
      )}
    </div>
  );
};

export default SatNOGSScheduled;
