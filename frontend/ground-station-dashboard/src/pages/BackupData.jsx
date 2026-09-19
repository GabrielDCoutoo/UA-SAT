// BackupData.jsx - Página de backup ThingSpeak (igual UASAT Mission)
import React, { useState, useEffect } from 'react';
import {
  Database, Activity, Radio, Battery, Thermometer, Droplets, Wind,
  Gauge, Navigation, Signal, Clock, AlertCircle, CheckCircle, 
  RefreshCw, Cloud, ChevronDown, ChevronUp
} from 'lucide-react';

const BackupData = () => {
  const [packets, setPackets] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [stats, setStats] = useState({
    total_messages: 0,
    active_satellites: 0,
    healthy_messages: 0,
    messages_per_hour: 0
  });
  const [loading, setLoading] = useState(true);
  const [expandedPacket, setExpandedPacket] = useState(null);
  
  const serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  // Fetch packets
  const fetchPackets = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/thingspeak/feeds?results=20`);
      const data = await response.json();
      
      if (data.success) {
        setPackets(data.data);
      }
    } catch (error) {
      console.error('[ThingSpeak] Error fetching packets:', error);
    }
  };

  // Fetch latest data
  const fetchLatest = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/thingspeak/latest`);
      const data = await response.json();
      
      if (data.success) {
        setLatestData(data.data);
      }
    } catch (error) {
      console.error('[ThingSpeak] Error fetching latest:', error);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/thingspeak/stats?hours=24`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('[ThingSpeak] Error fetching stats:', error);
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchPackets(), fetchLatest(), fetchStats()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 60 seconds (ThingSpeak rate limit)
    const interval = setInterval(() => {
      fetchPackets();
      fetchLatest();
      fetchStats();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Battery color based on percentage
  const getBatteryColor = (percent) => {
    if (!percent) return 'text-gray-400';
    if (percent >= 70) return 'text-green-400';
    if (percent >= 40) return 'text-yellow-400';
    if (percent >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get value or N/A
  const getValue = (value, suffix = '') => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}${suffix}`;
  };

  return (
    <div className="w-full h-screen flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="text-purple-500" size={36} />
              Backup Data (ThingSpeak)
            </h1>
            <p className="text-gray-400 mt-2">
              Backup telemetry via ThingSpeak API
            </p>
          </div>
          
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-400">{stats.total_messages}</div>
            <div className="text-sm text-gray-400">Total Messages</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-400">{stats.active_satellites}</div>
            <div className="text-sm text-gray-400">Active Satellites</div>
          </div>
          <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">{stats.healthy_messages}</div>
            <div className="text-sm text-gray-400">Healthy</div>
          </div>
          <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-3">
            <div className="text-2xl font-bold text-cyan-400">
              {(Number(stats.messages_per_hour) || 0).toFixed(0)}
            </div>
            <div className="text-sm text-gray-400">Messages/Hour</div>
          </div>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        
        {/* LEFT SIDE - PACKETS */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Cloud className="text-purple-400" size={24} />
            Packets ({packets.length})
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {packets.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                <Database className="mx-auto mb-4 text-gray-600" size={48} />
                <p className="text-gray-400">No packets received</p>
                <p className="text-sm text-gray-500 mt-2">Waiting for ThingSpeak data...</p>
              </div>
            ) : (
              packets.map((packet) => (
                <div 
                  key={packet.id}
                  className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-purple-500/50 transition-colors"
                >
                  {/* Packet Header */}
                  <div 
                    className="p-4 cursor-pointer flex items-center justify-between"
                    onClick={() => setExpandedPacket(expandedPacket === packet.id ? null : packet.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        packet.sat_status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                      } animate-pulse`} />
                      <div>
                        <div className="font-semibold text-lg">{packet.sat_id || 'Unknown'}</div>
                        <div className="text-sm text-gray-400">
                          {formatTime(packet.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div className="text-gray-400">Entry: <span className="text-white">#{packet.id}</span></div>
                        <div className={`${getBatteryColor(packet.battery_percent)}`}>
                          Bat: {getValue(packet.battery_percent, '%')}
                        </div>
                      </div>
                      {expandedPacket === packet.id ? (
                        <ChevronUp className="text-gray-400" size={20} />
                      ) : (
                        <ChevronDown className="text-gray-400" size={20} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedPacket === packet.id && (
                    <div className="px-4 pb-4 border-t border-gray-700 pt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Temp: <span className="text-white">{getValue(packet.temperature, '°C')}</span></div>
                      <div className="text-gray-400">Humidity: <span className="text-white">{getValue(packet.humidity, '%')}</span></div>
                      <div className="text-gray-400">Pressure: <span className="text-white">{getValue(packet.pressure, ' hPa')}</span></div>
                      <div className="text-gray-400">Battery: <span className={getBatteryColor(packet.battery_percent)}>{getValue(packet.battery_percent, '%')}</span></div>
                      {packet.latitude && (
                        <div className="col-span-2 text-gray-400">
                          GPS: <span className="text-white">{packet.latitude}, {packet.longitude}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT SIDE - LIVE DATA (SEMPRE VISÍVEL) */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="text-green-400" size={24} />
            Live Dashboard
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            
            {/* Satellite ID & Status */}
            <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold text-purple-400">
                  {latestData?.sat_id || 'WAITING...'}
                </h3>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  latestData?.sat_status === 'ok' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : latestData?.sat_status === 'not_ok'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  {latestData?.sat_status === 'ok' ? '✅ OK' : latestData?.sat_status === 'not_ok' ? '⚠️ LOW BAT' : '⏳ N/A'}
                </div>
              </div>
              <div className="text-sm text-gray-400">
                Last update: {formatTime(latestData?.created_at)}
              </div>
            </div>

            {/* Battery */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Battery className="text-yellow-400" size={24} />
                  <h3 className="text-lg font-semibold">Battery Status</h3>
                </div>
                <span className="text-3xl">🔋</span>
              </div>
              <div className={`text-3xl font-bold mb-2 ${getBatteryColor(latestData?.battery_percent)}`}>
                {getValue(latestData?.battery_percent, '%')}
              </div>
              <div className="text-sm text-gray-400">
                Voltage: {getValue(latestData?.battery_voltage, ' V')}
              </div>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="text-red-400" size={20} />
                  <span className="text-sm text-gray-400">Temperature</span>
                </div>
                <div className="text-3xl font-bold text-red-400">
                  {getValue(latestData?.temperature, '°C')}
                </div>
              </div>

              {/* Humidity */}
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="text-blue-400" size={20} />
                  <span className="text-sm text-gray-400">Humidity</span>
                </div>
                <div className="text-3xl font-bold text-blue-400">
                  {getValue(latestData?.humidity, '%')}
                </div>
              </div>

              {/* Pressure */}
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="text-purple-400" size={20} />
                  <span className="text-sm text-gray-400">Pressure</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {getValue(latestData?.pressure, ' hPa')}
                </div>
              </div>

              {/* Entry ID */}
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="text-cyan-400" size={20} />
                  <span className="text-sm text-gray-400">Entry ID</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  #{getValue(latestData?.id)}
                </div>
              </div>
            </div>

            {/* GPS */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="text-blue-400" size={24} />
                <h3 className="text-lg font-semibold">GPS Location</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Latitude</div>
                  <div className="text-xl font-semibold">{getValue(latestData?.latitude)}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Longitude</div>
                  <div className="text-xl font-semibold">{getValue(latestData?.longitude)}</div>
                </div>
              </div>
            </div>

            {/* ThingSpeak Info */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="text-purple-400" size={24} />
                <h3 className="text-lg font-semibold">ThingSpeak API</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Channel:</span>
                  <span className="font-semibold">3236598</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Auto-refresh:</span>
                  <span className="font-semibold">60 seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-semibold">● Connected</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupData;
