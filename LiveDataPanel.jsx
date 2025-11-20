import React from 'react';
import { Wifi, WifiOff, Radio, Satellite, RefreshCw, Trash2 } from 'lucide-react';
import { useSatelliteData, useSatelliteStats } from '../hooks/useSatelliteData';

/**
 * Componente que mostra o status da conexão e dados em tempo real
 */
const LiveDataPanel = ({ theme = 'dark' }) => {
  const {
    data,
    tinygsData,
    satnogsData,
    connected,
    error,
    dataSources,
    connect,
    disconnect,
    requestUpdate,
    clearData,
    totalPackets,
    tinygsPackets,
    satnogsPackets,
  } = useSatelliteData({
    serverUrl: 'http://localhost:3000',
    autoConnect: true
  });

  const stats = useSatelliteStats(data);

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
                {connected ? 'Conectado ao Backend' : 'Desconectado'}
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
            <button
              onClick={connected ? disconnect : connect}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                connected
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {connected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Sources Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={20} className="text-blue-500" />
              <h4 className="font-semibold">TinyGS</h4>
            </div>
            <div className={`w-3 h-3 rounded-full ${dataSources.tinygs ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span>{dataSources.tinygs ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pacotes</span>
              <span className="font-mono">{tinygsPackets}</span>
            </div>
          </div>
        </div>

        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Satellite size={20} className="text-purple-500" />
              <h4 className="font-semibold">SatNOGS</h4>
            </div>
            <div className={`w-3 h-3 rounded-full ${dataSources.satnogs ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span>{dataSources.satnogs ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Observações</span>
              <span className="font-mono">{satnogsPackets}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h4 className="font-semibold mb-4">Estatísticas Agregadas</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Total Observações</p>
            <p className="text-2xl font-bold">{stats.totalObservations}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Satélites Únicos</p>
            <p className="text-2xl font-bold">{stats.uniqueSatellites}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">RSSI Médio</p>
            <p className="text-2xl font-bold">{stats.avgRSSI} dBm</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">SNR Médio</p>
            <p className="text-2xl font-bold">{stats.avgSNR} dB</p>
          </div>
        </div>
      </div>

      {/* Recent Data */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg p-4 border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h4 className="font-semibold mb-4">Dados Recentes ({totalPackets})</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aguardando dados...</p>
          ) : (
            data.slice(0, 20).map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.source === 'tinygs' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <div>
                    <p className="font-semibold">{item.satellite}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {item.rssi && (
                    <div>
                      <span className="text-gray-400">RSSI:</span>{' '}
                      <span className="font-mono">{item.rssi} dBm</span>
                    </div>
                  )}
                  {item.snr && (
                    <div>
                      <span className="text-gray-400">SNR:</span>{' '}
                      <span className="font-mono">{item.snr} dB</span>
                    </div>
                  )}
                  <span className="px-2 py-1 rounded text-xs font-semibold uppercase bg-gray-600">
                    {item.source}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDataPanel;