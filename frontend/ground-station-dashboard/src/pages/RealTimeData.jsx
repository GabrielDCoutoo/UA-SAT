// frontend/src/pages/RealTimeData.jsx
import React from 'react';
import { Activity, Wifi, WifiOff, Radio, Satellite, TrendingUp, Globe } from 'lucide-react';
import LiveDataPanel from '../components/live/LiveDataPanel';
import { useSatelliteData } from '../hooks/useSatelliteData';


import SatNOGSStatus from '../components/satnogs/SatNOGSStatus';
import ObservationsList from '../components/satnogs/ObservationsList';
import ScheduledPasses from '../components/satnogs/ScheduledPasses';

const RealTimeDataPage = ({ theme = 'dark' }) => {
  // Use the updated hook with both TinyGS and SatNOGS support
  const { 
    connected, 
    error,
    tinygsData, 
    satnogsData,
    dataSources,
    totalPackets 
  } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  return (
    <div className="w-full space-y-6">
      {/* ===================================== */}
      {/* PAGE HEADER */}
      {/* ===================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            Real-Time Satellite Data
          </h1>
          <p className="text-gray-400 mt-2">
            Live telemetry from TinyGS ground stations and SatNOGS network
          </p>
        </div>
      </div>

      {/* ===================================== */}
      {/* CONNECTION STATUS BANNER */}
      {/* ===================================== */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {connected ? (
              <Wifi className="text-green-500" size={24} />
            ) : (
              <WifiOff className="text-red-500" size={24} />
            )}
            <div>
              <h3 className="font-semibold">
                {connected ? '✅ Connected to Backend' : '❌ Disconnected'}
              </h3>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <p className="text-sm text-gray-400">
                WebSocket: {connected ? 'Active' : 'Inactive'} | Total packets: {totalPackets}
              </p>
            </div>
          </div>

          {/* Data Sources Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dataSources.tinygs ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-sm">TinyGS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dataSources.satnogs ? 'bg-purple-500 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-sm">SatNOGS</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* STATISTICS CARDS */}
      {/* ===================================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* TinyGS Packets */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="text-blue-500" size={20} />
            <h3 className="font-semibold">TinyGS Network</h3>
          </div>
          <p className="text-3xl font-bold">{tinygsData.count}</p>
          <p className="text-sm text-gray-400 mt-1">LoRa packets received</p>
          {tinygsData.latest && (
            <p className="text-xs text-gray-500 mt-2">
              Latest: {tinygsData.latest.satellite || 'Unknown'}
            </p>
          )}
        </div>

        {/* SatNOGS Observations */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Satellite className="text-purple-500" size={20} />
            <h3 className="font-semibold">SatNOGS</h3>
          </div>
          <p className="text-3xl font-bold">
            {satnogsData.status?.statistics?.total_observations || 0}
          </p>
          <p className="text-sm text-gray-400 mt-1">Total observations</p>
          <p className="text-xs text-gray-500 mt-2">
            {satnogsData.observations.length} recent
          </p>
        </div>

        {/* Station Status */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="text-green-500" size={20} />
            <h3 className="font-semibold">Station</h3>
          </div>
          <p className={`text-3xl font-bold ${
            satnogsData.status?.online ? 'text-green-500' : 'text-red-500'
          }`}>
            {satnogsData.status?.online ? 'ONLINE' : 'OFFLINE'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Ground station status</p>
          {satnogsData.status?.station_name && (
            <p className="text-xs text-gray-500 mt-2 truncate">
              {satnogsData.status.station_name}
            </p>
          )}
        </div>

        {/* Scheduled Passes */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-yellow-500" size={20} />
            <h3 className="font-semibold">Scheduled</h3>
          </div>
          <p className="text-3xl font-bold">{satnogsData.scheduled.length}</p>
          <p className="text-sm text-gray-400 mt-1">Upcoming passes</p>
          {satnogsData.scheduled[0] && (
            <p className="text-xs text-gray-500 mt-2">
              Next: {new Date(satnogsData.scheduled[0].start_time).toLocaleTimeString('pt-PT', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </div>

      {/* ===================================== */}
      {/* TINYGS SECTION */}
      {/* ===================================== */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Radio className="text-blue-500" size={28} />
          <div>
            <h2 className="text-2xl font-bold">TinyGS Live Data</h2>
            <p className="text-sm text-gray-400">
              Real-time LoRa satellite packets from ground stations worldwide
            </p>
          </div>
        </div>
        <LiveDataPanel theme={theme} />
      </div>

      {/* ===================================== */}
      {/* SATNOGS SECTION */}
      {/* ===================================== */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Satellite className="text-purple-500" size={28} />
          <div>
            <h2 className="text-2xl font-bold">SatNOGS Ground Station</h2>
            <p className="text-sm text-gray-400">
              Observations and scheduled passes from UA Aveiro ground station
            </p>
          </div>
        </div>

        {/* Station Status Card */}
        <SatNOGSStatus status={satnogsData.status} theme={theme} />

        {/* Two Column Layout: Observations + Scheduled Passes */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Recent Observations */}
          <ObservationsList 
            observations={satnogsData.observations} 
            theme={theme} 
          />

          {/* Scheduled Passes */}
          <ScheduledPasses 
            passes={satnogsData.scheduled} 
            theme={theme} 
          />
        </div>
      </div>

      {/* ===================================== */}
      {/* FOOTER INFO */}
      {/* ===================================== */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Globe size={16} />
            <span>
              Last update: {satnogsData.lastUpdate ? 
                satnogsData.lastUpdate.toLocaleTimeString('pt-PT') : 
                'Waiting...'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Station ID: 4518</span>
            <span>|</span>
            <span>Polling: Every 60s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeDataPage;