import React from 'react';
import { Wifi, WifiOff, Radio, Satellite, RefreshCw, Trash2, Signal, Activity } from 'lucide-react';
import { useSatelliteData, useSatelliteStats } from '../../hooks/useSatelliteData';

/**
 * Componente que mostra dados TinyGS em tempo real
 * NOTA: Estrutura de dados normalizada pelo backend DataNormalizer
 */
const LiveDataPanel = ({ theme = 'dark' }) => {
  const {
    data,
    tinygsData,
    connected,
    error,
    dataSources,
    requestUpdate,
    clearData,
    totalPackets,
    tinygsPackets,
  } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  // Filter only TinyGS data
  const tinygsOnly = data.filter(d => d.source === 'tinygs');

  // Calculate statistics
  const uniqueSatellites = new Set(
    tinygsOnly.map(d => d.satellite?.name).filter(Boolean)
  ).size;

  const rssiData = tinygsOnly.filter(d => d.rf?.rssi !== null);
  const avgRSSI = rssiData.length > 0
    ? (rssiData.reduce((acc, d) => acc + d.rf.rssi, 0) / rssiData.length).toFixed(1)
    : 0;

  const snrData = tinygsOnly.filter(d => d.rf?.snr !== null);
  const avgSNR = snrData.length > 0
    ? (snrData.reduce((acc, d) => acc + d.rf.snr, 0) / snrData.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      {/* Connection Status Banner */}
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
                {connected ? 'Connected Backend' : 'Disconected from Backend'}
              </h3>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={requestUpdate}
              disabled={!connected}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              title="Solicitar atualização"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={clearData}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              title="Limpar dados"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Radio size={16} />
            <span className="text-xs uppercase font-semibold">Total Packets</span>
          </div>
          <p className="text-2xl font-bold">{tinygsOnly.length}</p>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Satellite size={16} />
            <span className="text-xs uppercase font-semibold">Satellites</span>
          </div>
          <p className="text-2xl font-bold">{uniqueSatellites}</p>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Signal size={16} />
            <span className="text-xs uppercase font-semibold">RSSI </span>
          </div>
          <p className="text-2xl font-bold">{avgRSSI} dBm</p>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Activity size={16} />
            <span className="text-xs uppercase font-semibold">SNR </span>
          </div>
          <p className="text-2xl font-bold">{avgSNR} dB</p>
        </div>
      </div>

      {/* Recent Data */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Activity size={20} className="text-blue-500" />
            Recent Data ({tinygsOnly.length})
          </h4>
          {tinygsData.latest && (
            <div className="text-xs text-gray-400">
              Last: {new Date(tinygsData.latest.timestamp || tinygsData.latest.receivedAt).toLocaleTimeString('pt-PT')}
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tinygsOnly.length === 0 ? (
            <div className="text-center py-8">
              <Radio className="text-gray-600 mx-auto mb-3" size={48} />
              <p className="text-gray-400">Waiting for satellite data</p>
              <p className="text-sm text-gray-500 mt-2">
                Lora Packets
              </p>
            </div>
          ) : (
            tinygsOnly.slice(0, 20).map((item, idx) => {
              // Extract fields from normalized structure
              const satelliteName = item.satellite?.name || 'Unknown Satellite';
              const rssi = item.rf?.rssi;
              const snr = item.rf?.snr;
              const frequency = item.rf?.frequency;
              const stationId = item.station?.id || item.station?.name;
              const isMyStation = item.station?.isMyStation;
              const isMyBalloon = item.metadata?.isMyBalloon;
              const packetData = item.packet?.data;
              const parsedData = item.packet?.parsed;
              const timestamp = item.timestamp || item.receivedAt;

              return (
                <div
                  key={idx}
                  className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-4 transition-all hover:ring-2 hover:ring-blue-500`}
                >
                  {/* Header: Satellite Info */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        isMyBalloon ? 'bg-purple-500 animate-pulse' : 
                        isMyStation ? 'bg-green-500 animate-pulse' : 
                        'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-bold text-lg">
                          {satelliteName}
                          {isMyBalloon && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold uppercase">
                              🎈 Balloon
                            </span>
                          )}
                          {isMyStation && (
                            <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase">
                              📡 My Station
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(timestamp).toLocaleString('pt-PT')}
                        </p>
                      </div>
                    </div>
                    
                    {/* Signal Quality Badge */}
                    {rssi !== null && rssi !== undefined && (
                      <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                        rssi > -100 ? 'bg-green-500/20 text-green-400' :
                        rssi > -120 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {rssi > -100 ? 'Excelente' : 
                         rssi > -120 ? 'Bom' : 'Fraco'}
                      </div>
                    )}
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {rssi !== null && rssi !== undefined && (
                      <div>
                        <span className="text-xs text-gray-400">RSSI:</span>
                        <p className="font-mono font-semibold">{rssi} dBm</p>
                      </div>
                    )}
                    {snr !== null && snr !== undefined && (
                      <div>
                        <span className="text-xs text-gray-400">SNR:</span>
                        <p className="font-mono font-semibold">{snr} dB</p>
                      </div>
                    )}
                    {frequency && (
                      <div>
                        <span className="text-xs text-gray-400">Freq:</span>
                        <p className="font-mono font-semibold">{(frequency / 1e6).toFixed(3)} MHz</p>
                      </div>
                    )}
                    {stationId && (
                      <div>
                        <span className="text-xs text-gray-400">Station:</span>
                        <p className="font-mono text-xs truncate">{stationId}</p>
                      </div>
                    )}
                  </div>

                  {/* Packet Data */}
                  {packetData && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Data</p>
                      <div className="bg-gray-900 rounded p-2 font-mono text-xs overflow-x-auto">
                        {typeof packetData === 'string' ? (
                          <pre className="text-green-400">{packetData}</pre>
                        ) : (
                          <pre className="text-green-400">
                            {JSON.stringify(packetData, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Parsed Telemetry (if available) */}
                  {parsedData && Object.keys(parsedData).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400 mb-2">Telemetry:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {Object.entries(parsedData).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-gray-400">{key}:</span>
                            <span className="ml-2 font-semibold">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDataPanel;