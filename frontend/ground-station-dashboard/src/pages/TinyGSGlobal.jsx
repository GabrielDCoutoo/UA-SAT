// frontend/src/pages/TinyGSGlobal.jsx
// CORRIGIDO: USA SÓ WEBSOCKET, NÃO USA API REST (bloqueada por Cloudflare)
import React, { useState, useEffect } from 'react';
import { Globe, Radio, Satellite, Filter, RefreshCw, Download } from 'lucide-react';
import TinyGSPacketCard from '../components/tinygs/TinyGSPacketCard';
import { useSatelliteData } from '../hooks/useSatelliteData';

import { ErrorBoundary } from '../components/ErrorBoundary';

const TinyGSGlobal = ({ theme = 'dark' }) => {
  const { 
    connected,
    error,
    tinygsData,
    requestUpdate
  } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  // ✅ APENAS WebSocket - SEM API REST!
  const [packets, setPackets] = useState([]);
  const [filterSatellite, setFilterSatellite] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // ✅ Receber packets via WebSocket
  useEffect(() => {
    if (tinygsData.latest) {
      setPackets(prev => {
        const currentPackets = prev && Array.isArray(prev) ? prev : [];
        
        // Gerar ID único se não existir
        const packetWithId = {
          ...tinygsData.latest,
          id: tinygsData.latest.id || `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        // Verificar se packet já existe
        const exists = currentPackets.some(p => p && p.id === packetWithId.id);
        if (exists) return currentPackets;
        
        // Adicionar novo packet no início
        return [packetWithId, ...currentPackets].slice(0, 100);
      });
    }
  }, [tinygsData.latest]);

  // ✅ Carregar histórico inicial do WebSocket (se disponível)
  useEffect(() => {
    if (tinygsData.history && tinygsData.history.length > 0 && packets.length === 0) {
      const historyWithIds = tinygsData.history.map(p => ({
        ...p,
        id: p.id || `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      setPackets(historyWithIds);
    }
  }, [tinygsData.history]);

  // ✅ Calcular stats dos packets recebidos (não usa API)
  const satellites = [...new Set((packets || []).map(p => p.satellite_name || p.satellite))].filter(Boolean);
  
  const stats = {
    total: packets.length,
    satellites: satellites.length,
    avgRSSI: packets.length > 0 
      ? (packets.reduce((acc, p) => acc + (parseFloat(p.rssi) || 0), 0) / packets.length).toFixed(1)
      : 0
  };

  // ✅ Filtrar e ordenar packets
  let filteredPackets = [...(packets || [])];
  if (filterSatellite !== 'all') {
    filteredPackets = filteredPackets.filter(p => (p.satellite_name || p.satellite) === filterSatellite);
  }

  const getTs = p => new Date(p.received_at || p.receivedAt || p.timestamp || 0);
  if (sortBy === 'newest') {
    filteredPackets.sort((a, b) => getTs(b) - getTs(a));
  } else {
    filteredPackets.sort((a, b) => getTs(a) - getTs(b));
  }

  // ✅ Refresh via WebSocket (não usa API)
  const handleRefresh = () => {
    requestUpdate();
  };

  const exportData = () => {
    const dataStr = JSON.stringify(filteredPackets, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tinygs-packets-${new Date().toISOString()}.json`;
    link.click();
  };

  return (
    <ErrorBoundary>
      <div className="w-full p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Globe className="text-blue-500" size={36} />
                TinyGS Global Network
              </h1>
              <p className="text-gray-400 mt-2">
                Real-time LoRa satellite packets from ground stations worldwide
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={!connected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                onClick={exportData}
                disabled={packets.length === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          <div className={`p-3 rounded-lg flex items-center justify-between ${
            connected ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold">
                {connected ? '✅ Connected to TinyGS Network' : '❌ Disconnected'}
              </span>
              {error && <span className="text-sm text-red-400">({error})</span>}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-gray-500'}`}>
                <Radio size={14} />
                <span>Socket.io</span>
              </div>
              <div className="text-gray-400">
                {tinygsData.count} live packets
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Radio className="text-blue-500" size={20} />
              <span className="text-sm text-gray-400">Total Packets (Session)</span>
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Satellite className="text-purple-500" size={20} />
              <span className="text-sm text-gray-400">Unique Satellites</span>
            </div>
            <p className="text-3xl font-bold">{stats.satellites}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Filter className="text-yellow-500" size={20} />
              <span className="text-sm text-gray-400">Avg RSSI</span>
            </div>
            <p className="text-3xl font-bold">{stats.avgRSSI} dBm</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">Filter:</span>
            </div>

            <select
              value={filterSatellite}
              onChange={(e) => setFilterSatellite(e.target.value)}
              className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600"
            >
              <option value="all">All Satellites ({satellites.length})</option>
              {satellites.map(sat => (
                <option key={sat} value={sat}>{sat}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Packets ({filteredPackets.length})
            </h2>
          </div>

          {!connected ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <Radio className="mx-auto mb-4 text-red-500" size={64} />
              <h3 className="text-xl font-semibold mb-2">Disconnected</h3>
              <p className="text-gray-400">WebSocket connection lost. Reconnecting...</p>
            </div>
          ) : filteredPackets.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <Radio className="mx-auto mb-4 text-gray-600 animate-pulse" size={64} />
              <h3 className="text-xl font-semibold mb-2">Waiting for Packets...</h3>
              <p className="text-gray-400">Connected to TinyGS network via WebSocket</p>
              <p className="text-gray-500 text-sm mt-2">Packets arrive when satellites pass over ground stations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPackets.map((packet, index) => (
                <TinyGSPacketCard key={packet.id || index} packet={packet} theme={theme} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default TinyGSGlobal;