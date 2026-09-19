// Dashboard.jsx - Página inicial melhorada
import React, { useState, useEffect } from 'react';
import { 
  Radio, Satellite, Calendar, Clock, TrendingUp, Activity,
  MapPin, Globe, Telescope, Signal, ArrowRight, AlertCircle,
  CheckCircle, XCircle, Zap
} from 'lucide-react';
import { useSatelliteData } from '../hooks/useSatelliteData';

const Dashboard = () => {
  const {
    connected,
    tinygsData,
    satnogsData
  } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  const [nextPass, setNextPass] = useState(null);
  const [stationStatus, setStationStatus] = useState({
    satnogs: 'offline',
    tinygs: 'offline'
  });
  const [stats, setStats] = useState({
    tinygs_packets: 0,
    satnogs_observations: 0,
    scheduled_passes: 0,
    satellites_tracked: 0
  });

  const serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  // Fetch overview stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/dashboard/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setStationStatus(data.station_status || stationStatus);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching stats:', error);
    }
  };

  // Fetch next pass
  const fetchNextPass = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/satnogs/passes?hours=24&min_elevation=30`);
      const data = await response.json();
      
      if (data.success && data.passes && data.passes.length > 0) {
        const upcoming = data.passes[0];
        setNextPass(upcoming);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching next pass:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchNextPass();
    
    const interval = setInterval(() => {
      fetchStats();
      fetchNextPass();
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getTimeUntilPass = () => {
    if (!nextPass) return null;
    
    const now = new Date();
    const passTime = new Date(nextPass.aos);
    const diff = passTime - now;
    
    if (diff < 0) return 'Starting now!';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Telescope className="text-blue-500" size={36} />
          Ground Station Dashboard
        </h1>
        <p className="text-gray-400 mt-2">
          UA Aveiro · Station ID: 4518 · Aveiro, Portugal
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className={`rounded-lg p-4 border ${
          connected ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <div>
              <div className="font-semibold">
                {connected ? '✅ WebSocket Connected' : '❌ WebSocket Disconnected'}
              </div>
              <div className="text-sm text-gray-400">
                Real-time data streaming
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-4 border ${
          stationStatus.satnogs === 'online' 
            ? 'bg-green-500/20 border-green-500/30' 
            : 'bg-gray-700/50 border-gray-600'
        }`}>
          <div className="flex items-center gap-3">
            <Satellite className="text-purple-400" size={20} />
            <div>
              <div className="font-semibold">
                SatNOGS Station: {stationStatus.satnogs === 'online' ? 'Online' : 'Offline'}
              </div>
              <div className="text-sm text-gray-400">
                {stats.satnogs_observations} observations total
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <Radio className="text-blue-400" size={24} />
            <span className="text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded">24h</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{stats.tinygs_packets}</div>
          <div className="text-sm text-gray-400 mt-1">TinyGS Packets</div>
          <div className="text-xs text-gray-500 mt-2">
            {tinygsData.count} live · {stats.satellites_tracked} satellites
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <Satellite className="text-purple-400" size={24} />
            <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded">Total</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">{stats.satnogs_observations}</div>
          <div className="text-sm text-gray-400 mt-1">Observations</div>
          <div className="text-xs text-gray-500 mt-2">
            {satnogsData.count} since startup
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-lg p-4 border border-orange-500/30">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="text-orange-400" size={24} />
            <span className="text-xs text-orange-300 bg-orange-500/20 px-2 py-1 rounded">Next 24h</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">{stats.scheduled_passes}</div>
          <div className="text-sm text-gray-400 mt-1">Scheduled Passes</div>
          <div className="text-xs text-gray-500 mt-2">
            Ready to observe
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-green-400" size={24} />
            <span className="text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded">Live</span>
          </div>
          {(() => {
            const online = [connected, stationStatus.satnogs === 'online', stationStatus.tinygs === 'online'].filter(Boolean).length;
            const color  = online === 3 ? 'text-green-400' : online >= 2 ? 'text-yellow-400' : 'text-red-400';
            return (
              <>
                <div className={`text-3xl font-bold ${color}`}>{online}/3</div>
                <div className="text-sm text-gray-400 mt-1">Systems Online</div>
                <div className="text-xs text-gray-500 mt-2">
                  {online === 3 ? 'All systems operational' : `${3 - online} system(s) offline`}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="text-blue-500" size={24} />
              Next Satellite Pass
            </h2>
            {nextPass && (
              <span className="text-sm text-gray-400">
                in {getTimeUntilPass()}
              </span>
            )}
          </div>

          {nextPass ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-blue-400">{nextPass.satellite}</h3>
                  <p className="text-gray-400 text-sm">NORAD: {nextPass.norad}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  nextPass.max_elevation >= 70 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  nextPass.max_elevation >= 50 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {nextPass.max_elevation.toFixed(0)}° elevation
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">AOS (Rise)</div>
                  <div className="font-semibold text-green-400">{formatTime(nextPass.aos)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">LOS (Set)</div>
                  <div className="font-semibold text-red-400">{formatTime(nextPass.los)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Duration</div>
                  <div className="font-semibold">
                    {Math.round((new Date(nextPass.los) - new Date(nextPass.aos)) / 60000)} min
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Signal className="text-gray-400" size={16} />
                <span className="text-sm text-gray-400">
                  {nextPass.frequency ? `${nextPass.frequency} MHz` : 'N/A'} · {nextPass.mode || 'Unknown'}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <a
                  href="/satnogs/scheduled"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  View All Passes
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock className="mx-auto mb-4" size={48} />
              <p>No upcoming passes</p>
              <p className="text-sm">Calculating satellite trajectories...</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="text-yellow-500" size={24} />
            Quick Actions
          </h2>

          <div className="space-y-3">
            <a
              href="/tinygs/global"
              className="block p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="text-blue-400" size={20} />
                  <span className="font-medium">TinyGS Global</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-8">
                View worldwide packets
              </p>
            </a>

            <a
              href="/satnogs/observations"
              className="block p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Satellite className="text-purple-400" size={20} />
                  <span className="font-medium">Observations</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-8">
                Review station data
              </p>
            </a>

            <a
              href="/satnogs/scheduled"
              className="block p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="text-orange-400" size={20} />
                  <span className="font-medium">Schedule Pass</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-8">
                Plan observations
              </p>
            </a>

            <a
              href="/satnogs/observations"
              className="block p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="text-gray-400" size={20} />
                  <span className="font-medium">Satellite DB</span>
                </div>
                <ArrowRight className="text-gray-400" size={16} />
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-8">
                Browse satellites
              </p>
            </a>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="text-green-500" size={24} />
          Recent Activity
        </h2>

        <div className="space-y-3">
          {tinygsData.latest && (
            <div className="flex items-start gap-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <Radio className="text-blue-400 mt-1" size={20} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-400">TinyGS Packet Received</span>
                  <span className="text-xs text-gray-500">
                    {new Date(tinygsData.latest.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {tinygsData.latest.satellite} · {tinygsData.latest.station_name || 'Unknown Station'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>RSSI: {tinygsData.latest.rssi} dBm</span>
                  <span>SNR: {tinygsData.latest.snr} dB</span>
                </div>
              </div>
            </div>
          )}

          {satnogsData.latest && (
            <div className="flex items-start gap-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
              <Satellite className="text-purple-400 mt-1" size={20} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-400">SatNOGS Observation</span>
                  <span className="text-xs text-gray-500">
                    {new Date(satnogsData.latest.start).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {satnogsData.latest.norad_cat_id} · {satnogsData.latest.transmitter_description || 'N/A'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>Mode: {satnogsData.latest.transmitter_mode || 'Unknown'}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    satnogsData.latest.vetted_status === 'good' ? 'bg-green-500/20 text-green-400' :
                    satnogsData.latest.vetted_status === 'bad' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {satnogsData.latest.vetted_status || 'unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!tinygsData.latest && !satnogsData.latest && (
            <div className="text-center py-8 text-gray-500">
              <Activity className="mx-auto mb-2" size={32} />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs">Waiting for satellite data...</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 text-center">
          <a
            href="/tinygs/global"
            className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            View All Activity
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
