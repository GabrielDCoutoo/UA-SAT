import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook personalizado para conectar ao backend via WebSocket
 * e receber dados em tempo real do TinyGS e SatNOGS
 */
export const useSatelliteData = (options = {}) => {
  const {
    serverUrl = 'http://localhost:3000',
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 3000
  } = options;

  const [data, setData] = useState([]);
  const [tinygsData, setTinygsData] = useState([]);
  const [satnogsData, setSatnogsData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [dataSources, setDataSources] = useState({
    tinygs: false,
    satnogs: false
  });

  const socketRef = useRef(null);
  const reconnectCountRef = useRef(0);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('📡 Já conectado ao WebSocket');
      return;
    }

    console.log('🔌 Conectando ao backend...', serverUrl);

    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: reconnectAttempts,
      reconnectionDelay: reconnectDelay,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Conectado ao backend!');
      setConnected(true);
      setError(null);
      reconnectCountRef.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado:', reason);
      setConnected(false);
      reconnectCountRef.current++;

      if (reconnectCountRef.current >= reconnectAttempts) {
        setError('Falha ao conectar após múltiplas tentativas');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
      setError(`Erro de conexão: ${err.message}`);
      setConnected(false);
    });

    // Receber dados dos satélites
    socket.on('satellite-data', (message) => {
      console.log('📦 Dados recebidos:', message.source, message.satellite);

      // Adicionar timestamp de recepção
      const enrichedData = {
        ...message,
        receivedAt: new Date().toISOString()
      };

      // Adicionar à lista geral (últimos 100)
      setData(prev => [enrichedData, ...prev].slice(0, 100));

      // Separar por fonte
      if (message.source === 'tinygs') {
        setTinygsData(prev => [enrichedData, ...prev].slice(0, 50));
      } else if (message.source === 'satnogs') {
        setSatnogsData(prev => [enrichedData, ...prev].slice(0, 50));
      }
    });

    // Receber status das fontes de dados
    socket.on('data-sources-status', (status) => {
      console.log('📊 Status das fontes:', status);
      setDataSources(status);
    });

    return socket;
  }, [serverUrl, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Desconectando...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const requestUpdate = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔄 Solicitando atualização...');
      socketRef.current.emit('request-update');
    }
  }, []);

  const clearData = useCallback(() => {
    setData([]);
    setTinygsData([]);
    setSatnogsData([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // Estado
    data,
    tinygsData,
    satnogsData,
    connected,
    error,
    dataSources,

    // Ações
    connect,
    disconnect,
    requestUpdate,
    clearData,

    // Stats
    totalPackets: data.length,
    tinygsPackets: tinygsData.length,
    satnogsPackets: satnogsData.length,
  };
};

/**
 * Hook para estatísticas agregadas dos dados
 */
export const useSatelliteStats = (data) => {
  const [stats, setStats] = useState({
    totalObservations: 0,
    uniqueSatellites: 0,
    avgRSSI: 0,
    avgSNR: 0,
    lastUpdate: null,
    sourceBreakdown: {}
  });

  useEffect(() => {
    if (!data || data.length === 0) {
      return;
    }

    // Calcular estatísticas
    const satellites = new Set(data.map(d => d.satellite));
    const rssiValues = data.filter(d => d.rssi).map(d => parseFloat(d.rssi));
    const snrValues = data.filter(d => d.snr).map(d => parseFloat(d.snr));

    const sourceBreakdown = data.reduce((acc, d) => {
      acc[d.source] = (acc[d.source] || 0) + 1;
      return acc;
    }, {});

    setStats({
      totalObservations: data.length,
      uniqueSatellites: satellites.size,
      avgRSSI: rssiValues.length > 0 
        ? (rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length).toFixed(1)
        : 0,
      avgSNR: snrValues.length > 0
        ? (snrValues.reduce((a, b) => a + b, 0) / snrValues.length).toFixed(1)
        : 0,
      lastUpdate: data[0]?.timestamp,
      sourceBreakdown
    });
  }, [data]);

  return stats;
};

export default useSatelliteData;