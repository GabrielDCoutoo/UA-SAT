import React, { useState, useEffect } from 'react';
import './App.css';
import { Satellite, Radio, Activity, Command, Database, Settings, Menu, X, Signal, Wifi, Battery, Thermometer, Gauge, MapPin, Clock, TrendingUp, AlertCircle, CheckCircle, Send } from 'lucide-react';
import CesiumGlobe from './components/CesiumGlobe';

// Mock data generator
const generateMockTelemetry = () => ({
  battery: (3.7 + Math.random() * 0.5).toFixed(2),
  temperature: (20 + Math.random() * 10).toFixed(1),
  signalStrength: (-85 + Math.random() * 20).toFixed(0),
  altitude: (400 + Math.random() * 50).toFixed(1),
  velocity: (7.5 + Math.random() * 0.3).toFixed(2),
  latitude: (40.2 + Math.random() * 0.1).toFixed(4),
  longitude: (-8.4 + Math.random() * 0.1).toFixed(4),
  rssi: (-110 + Math.random() * 30).toFixed(0),
  snr: (5 + Math.random() * 10).toFixed(1),
  packetCount: Math.floor(1200 + Math.random() * 100),
  lastContact: new Date().toISOString(),
  status: Math.random() > 0.2 ? 'online' : 'offline'
});

const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState(generateMockTelemetry());
  const [theme, setTheme] = useState('dark');

  // Simulate real-time telemetry updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(generateMockTelemetry());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'telemetry', name: 'Telemetry', icon: Gauge },
    { id: 'tracking', name: 'Tracking', icon: Satellite },
    { id: 'mission', name: 'Mission Control', icon: Command },
    { id: 'data', name: 'Data & Logs', icon: Database },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div className={`min-h-screen w-full ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-screen overflow-y-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} border-r ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} z-50`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'hidden'}`}>
            <Radio className="text-blue-500" size={32} />
            <span className="font-bold text-lg">Ground Station</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-700 rounded-lg">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 p-3 mb-2 rounded-lg transition-all ${
                  currentPage === item.id 
                    ? 'bg-blue-600 text-white' 
                    : `${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.name}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`w-full min-h-screen transition-all duration-300 ${sidebarOpen ? 'pl-64' : 'pl-20'}`}>
        <div className="p-4 md:p-6 w-full">
          {currentPage === 'dashboard' && <DashboardPage telemetry={telemetry} theme={theme} />}
          {currentPage === 'telemetry' && <TelemetryPage telemetry={telemetry} theme={theme} />}
          {currentPage === 'tracking' && <TrackingPage telemetry={telemetry} theme={theme} />}
          {currentPage === 'mission' && <MissionControlPage theme={theme} />}
          {currentPage === 'data' && <DataPage theme={theme} />}
          {currentPage === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} />}
        </div>
      </main>
    </div>
  );
};

// Dashboard Page
const DashboardPage = ({ telemetry, theme }) => {
  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold mb-6">Mission Dashboard</h1>
      
      {/* Status Banner */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 mb-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${telemetry.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <div>
              <h2 className="text-xl font-semibold">UASat Ground Station</h2>
              <p className="text-gray-400 text-sm">Aveiro, Portugal</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Last Contact</p>
            <p className="font-mono">{new Date(telemetry.lastContact).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Battery} label="Battery" value={`${telemetry.battery}V`} status="good" theme={theme} />
        <StatCard icon={Thermometer} label="Temperature" value={`${telemetry.temperature}°C`} status="good" theme={theme} />
        <StatCard icon={Signal} label="Signal" value={`${telemetry.signalStrength} dBm`} status="good" theme={theme} />
        <StatCard icon={TrendingUp} label="Packets" value={telemetry.packetCount} status="good" theme={theme} />
      </div>

      {/* Live Position */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-blue-500" />
            Current Position
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Latitude</p>
              <p className="text-2xl font-mono">{telemetry.latitude}°</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Longitude</p>
              <p className="text-2xl font-mono">{telemetry.longitude}°</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Altitude</p>
              <p className="text-2xl font-mono">{telemetry.altitude} km</p>
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-cyan-500" />
            Next Pass
          </h3>
          <div className="text-2xl font-bold mb-2">14:23:45</div>
          <div className="text-sm text-gray-400">In 15 minutes</div>
        </div>
      </div>
    </div>
  );
};

// Telemetry Page
const TelemetryPage = ({ telemetry, theme }) => {
  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold mb-6">Telemetry Data</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        <TelemetryCard 
          icon={Battery} 
          title="Battery Voltage" 
          value={`${telemetry.battery} V`}
          subtitle="Nominal: 3.7-4.2V"
          color="green"
          theme={theme}
        />
        <TelemetryCard 
          icon={Thermometer} 
          title="Temperature" 
          value={`${telemetry.temperature} °C`}
          subtitle="Operating range"
          color="orange"
          theme={theme}
        />
        <TelemetryCard 
          icon={Signal} 
          title="Signal Strength" 
          value={`${telemetry.signalStrength} dBm`}
          subtitle="RSSI"
          color="blue"
          theme={theme}
        />
        <TelemetryCard 
          icon={Satellite} 
          title="Altitude" 
          value={`${telemetry.altitude} km`}
          subtitle="Above sea level"
          color="purple"
          theme={theme}
        />
        <TelemetryCard 
          icon={TrendingUp} 
          title="Velocity" 
          value={`${telemetry.velocity} km/s`}
          subtitle="Orbital speed"
          color="cyan"
          theme={theme}
        />
        <TelemetryCard 
          icon={Wifi} 
          title="SNR" 
          value={`${telemetry.snr} dB`}
          subtitle="Signal to Noise"
          color="green"
          theme={theme}
        />
        <TelemetryCard 
          icon={Activity} 
          title="Packet Count" 
          value={telemetry.packetCount}
          subtitle="Total received"
          color="blue"
          theme={theme}
        />
        <TelemetryCard 
          icon={MapPin} 
          title="Latitude" 
          value={`${telemetry.latitude}°`}
          subtitle="Current position"
          color="purple"
          theme={theme}
        />
        <TelemetryCard 
          icon={MapPin} 
          title="Longitude" 
          value={`${telemetry.longitude}°`}
          subtitle="Current position"
          color="purple"
          theme={theme}
        />
      </div>
    </div>
  );
};

// Tracking Page
const TrackingPage = ({ telemetry, theme }) => {
  const groundStation = {
    latitude: 40.2033,
    longitude: -8.4103,
    altitude: 0.14 // km
  };

  // Add this missing array so the component doesn't throw a ReferenceError
  const upcomingPasses = [
    { time: '14:23:45', duration: '8m 34s', maxElevation: '45°', aos: '14:23:45', los: '14:32:19' },
    { time: '16:15:22', duration: '10m 12s', maxElevation: '67°', aos: '16:15:22', los: '16:25:34' },
    { time: '18:45:10', duration: '6m 45s', maxElevation: '32°', aos: '18:45:10', los: '18:51:55' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Satellite Tracking</h1>
      
      {/* 3D Globe View */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 mb-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="text-lg font-semibold mb-4">3D Globe View</h3>
        <div className="w-full h-[600px]">
          <CesiumGlobe
            satellitePosition={{
              latitude: parseFloat(telemetry.latitude),
              longitude: parseFloat(telemetry.longitude),
              altitude: parseFloat(telemetry.altitude)
            }}
            groundStation={groundStation}
          />
        </div>
      </div>

      {/* Ground Station Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Radio size={20} className="text-blue-500" />
            Ground Station
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Location</span>
              <span className="font-mono">Coimbra, Portugal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Coordinates</span>
              <span className="font-mono">40.2033° N, 8.4103° W</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Elevation</span>
              <span className="font-mono">140m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Active
              </span>
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Satellite size={20} className="text-purple-500" />
            Current Pass
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Elevation</span>
              <span className="font-mono text-2xl">45°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Azimuth</span>
              <span className="font-mono text-2xl">180°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Range</span>
              <span className="font-mono">{telemetry.altitude} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Doppler Shift</span>
              <span className="font-mono">+2.3 kHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pass Predictions */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock size={20} className="text-cyan-500" />
          Upcoming Passes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4">AOS Time</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="text-left py-3 px-4">Max Elevation</th>
                <th className="text-left py-3 px-4">LOS Time</th>
              </tr>
            </thead>
            <tbody>
              {upcomingPasses.map((pass, idx) => (
                <tr key={idx} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} hover:bg-gray-700`}>
                  <td className="py-3 px-4 font-mono">{pass.aos}</td>
                  <td className="py-3 px-4 font-mono">{pass.duration}</td>
                  <td className="py-3 px-4 font-mono">{pass.maxElevation}</td>
                  <td className="py-3 px-4 font-mono">{pass.los}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Mission Control Page
const MissionControlPage = ({ theme }) => {
  const [selectedCommand, setSelectedCommand] = useState('');
  const [commandLog, setCommandLog] = useState([
    { time: '14:23:45', command: 'PING', status: 'success', response: 'PONG' },
    { time: '14:20:12', command: 'GET_TELEMETRY', status: 'success', response: 'Data received' },
    { time: '14:15:30', command: 'SET_MODE_SAFE', status: 'success', response: 'Mode changed' },
  ]);

  const commonCommands = [
    { id: 'ping', name: 'PING', description: 'Check satellite connectivity', category: 'general' },
    { id: 'telemetry', name: 'GET_TELEMETRY', description: 'Request full telemetry', category: 'general' },
    { id: 'beacon', name: 'ENABLE_BEACON', description: 'Enable beacon transmission', category: 'comm' },
    { id: 'safe_mode', name: 'SET_MODE_SAFE', description: 'Enter safe mode', category: 'system' },
    { id: 'camera', name: 'CAPTURE_IMAGE', description: 'Take photograph', category: 'payload' },
  ];

  const sendCommand = () => {
    if (selectedCommand) {
      const newLog = {
        time: new Date().toLocaleTimeString(),
        command: selectedCommand,
        status: 'pending',
        response: 'Awaiting response...'
      };
      setCommandLog([newLog, ...commandLog]);
      setSelectedCommand('');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mission Control</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Command Interface */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Send size={20} className="text-blue-500" />
            Send Command
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Command</label>
              <select 
                value={selectedCommand}
                onChange={(e) => setSelectedCommand(e.target.value)}
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              >
                <option value="">Choose a command...</option>
                {commonCommands.map(cmd => (
                  <option key={cmd.id} value={cmd.name}>{cmd.name} - {cmd.description}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={sendCommand}
              disabled={!selectedCommand}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Send Command
            </button>
          </div>
        </div>

        {/* Quick Commands */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              <div className="text-sm font-semibold">PING</div>
              <div className="text-xs opacity-75 mt-1">Test Connection</div>
            </button>
            <button className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <div className="text-sm font-semibold">TELEMETRY</div>
              <div className="text-xs opacity-75 mt-1">Get Data</div>
            </button>
            <button className="p-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors">
              <div className="text-sm font-semibold">SAFE MODE</div>
              <div className="text-xs opacity-75 mt-1">Emergency</div>
            </button>
            <button className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              <div className="text-sm font-semibold">BEACON</div>
              <div className="text-xs opacity-75 mt-1">Enable</div>
            </button>
          </div>
        </div>
      </div>

      {/* Command Log */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity size={20} className="text-green-500" />
          Command Log
        </h3>
        <div className="space-y-2">
          {commandLog.map((log, idx) => (
            <div key={idx} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-gray-400">{log.time}</span>
                <span className="font-semibold">{log.command}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{log.response}</span>
                {log.status === 'success' ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <AlertCircle size={18} className="text-yellow-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Data Page
const DataPage = ({ theme }) => {
  const observations = [
    { id: 1, time: '2025-11-05 14:23:45', satellite: 'UASat-1', duration: '8m 34s', packets: 124, quality: 'Excellent' },
    { id: 2, time: '2025-11-05 12:15:22', satellite: 'UASat-1', duration: '10m 12s', packets: 156, quality: 'Good' },
    { id: 3, time: '2025-11-05 10:45:10', satellite: 'UASat-1', duration: '6m 45s', packets: 89, quality: 'Fair' },
    { id: 4, time: '2025-11-04 18:32:15', satellite: 'UASat-1', duration: '9m 21s', packets: 132, quality: 'Excellent' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Data & Observations</h1>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-gray-400 text-sm mb-2">Total Observations</div>
          <div className="text-3xl font-bold">248</div>
        </div>
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-gray-400 text-sm mb-2">Packets Received</div>
          <div className="text-3xl font-bold">31,245</div>
        </div>
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-gray-400 text-sm mb-2">Success Rate</div>
          <div className="text-3xl font-bold">94.2%</div>
        </div>
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="text-gray-400 text-sm mb-2">Uptime</div>
          <div className="text-3xl font-bold">99.8%</div>
        </div>
      </div>

      {/* Observations Table */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className="text-lg font-semibold mb-4">Recent Observations</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4">ID</th>
                <th className="text-left py-3 px-4">Timestamp</th>
                <th className="text-left py-3 px-4">Satellite</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="text-left py-3 px-4">Packets</th>
                <th className="text-left py-3 px-4">Quality</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((obs) => (
                <tr key={obs.id} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} hover:bg-gray-700`}>
                  <td className="py-3 px-4 font-mono">#{obs.id}</td>
                  <td className="py-3 px-4 font-mono">{obs.time}</td>
                  <td className="py-3 px-4">{obs.satellite}</td>
                  <td className="py-3 px-4 font-mono">{obs.duration}</td>
                  <td className="py-3 px-4 font-mono">{obs.packets}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      obs.quality === 'Excellent' ? 'bg-green-900 text-green-300' :
                      obs.quality === 'Good' ? 'bg-blue-900 text-blue-300' :
                      'bg-yellow-900 text-yellow-300'
                    }`}>
                      {obs.quality}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Settings Page
const SettingsPage = ({ theme, setTheme }) => {
  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Theme</label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4">Ground Station</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Station Name</label>
              <input 
                type="text"
                value="UASat Ground Station"
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Location</label>
              <input 
                type="text"
                value="Coimbra, Portugal"
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              />
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4">Connection Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">MQTT Broker</label>
              <input 
                type="text"
                placeholder="mqtt://localhost:1883"
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">API Endpoint</label>
              <input 
                type="text"
                placeholder="http://localhost:8000/api"
                className={`w-full p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'} border`}
              />
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold mb-4">Data Sources</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>SatNOGS Integration</span>
              <label className="relative inline-block w-12 h-6">
                <input type="checkbox" className="opacity-0 w-0 h-0" defaultChecked />
                <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-600 rounded-full transition-all before:absolute before:content-[''] before:h-5 before:w-5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all"></span>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span>TinyGS Integration</span>
              <label className="relative inline-block w-12 h-6">
                <input type="checkbox" className="opacity-0 w-0 h-0" defaultChecked />
                <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-600 rounded-full transition-all before:absolute before:content-[''] before:h-5 before:w-5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable Components
const StatCard = ({ icon: Icon, label, value, status, theme }) => (
  <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
    <div className="flex items-center justify-between mb-2">
      <Icon size={24} className="text-blue-500" />
      <div className={`w-2 h-2 rounded-full ${status === 'good' ? 'bg-green-500' : 'bg-red-500'}`}></div>
    </div>
    <div className="text-gray-400 text-sm mb-1">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);

const TelemetryCard = ({ icon: Icon, title, value, subtitle, color, theme }) => {
  const colorClasses = {
    green: 'border-green-500 bg-green-500/10',
    orange: 'border-orange-500 bg-orange-500/10',
    blue: 'border-blue-500 bg-blue-500/10',
    purple: 'border-purple-500 bg-purple-500/10',
    cyan: 'border-cyan-500 bg-cyan-500/10'
  };

  return (
    <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 border-l-4 ${colorClasses[color]} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={24} className={`text-${color}-500`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-400">{subtitle}</div>
    </div>
  );
};

export default App;