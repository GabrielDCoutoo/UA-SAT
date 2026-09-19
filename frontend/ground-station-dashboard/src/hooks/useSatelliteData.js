// frontend/src/hooks/useSatelliteData.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSatelliteData = (options = {}) => {
  // Store options in ref to avoid dependency issues
  const optionsRef = useRef({
    serverUrl: options.serverUrl || 'http://localhost:3000',
    autoConnect: options.autoConnect !== false,
    reconnectAttempts: options.reconnectAttempts || 5,
    reconnectDelay: options.reconnectDelay || 3000,
    handshake: options.handshake || {}
  });

  // Connection state
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // TinyGS data
  const [tinygsData, setTinygsData] = useState({
    latest: null,
    history: [],
    count: 0
  });

  // SatNOGS data
  const [satnogsData, setSatnogsData] = useState({
    status: null,
    observations: [],
    scheduled: [],
    lastUpdate: null,
    count: 0
  });

  // Unified data array (compatibility)
  const [data, setData] = useState([]);

  // Data sources status
  const [dataSources, setDataSources] = useState({
    tinygs: false,
    satnogs: false
  });

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔡 Já conectado');
      return;
    }

    const opts = optionsRef.current;
    console.log('🔌 Conectando ao backend WebSocket:', opts.serverUrl);

    const socket = io(opts.serverUrl, {
      reconnection: true,
      reconnectionAttempts: opts.reconnectAttempts,
      reconnectionDelay: opts.reconnectDelay,
      timeout: 10000,
      auth: opts.handshake
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Conectado ao backend WebSocket');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado:', reason);
      setConnected(false);
      setDataSources({ tinygs: false, satnogs: false });
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão:', err.message);
      setError(err.message);
      setConnected(false);
    });

    // ============================================
    // TinyGS Events
    // ============================================
    socket.on('satellite-data', (message) => {
      console.log('🛰️ TinyGS packet:', message.satellite || 'UNKNOWN');
      
      const enriched = {
        ...message,
        receivedAt: new Date().toISOString(),
        source: 'tinygs'
      };

      setTinygsData(prev => ({
        latest: enriched,
        history: [enriched, ...prev.history].slice(0, 100),
        count: prev.count + 1
      }));

      setData(prev => [enriched, ...prev].slice(0, 100));
      setDataSources(prev => ({ ...prev, tinygs: true }));
    });

    socket.on('balloon-data', (message) => {
      console.log('🎈 Balloon packet!');
      
      const enriched = {
        ...message,
        receivedAt: new Date().toISOString(),
        isBalloon: true,
        source: 'tinygs'
      };

      setTinygsData(prev => ({
        latest: enriched,
        history: [enriched, ...prev.history].slice(0, 100),
        count: prev.count + 1
      }));

      setData(prev => [enriched, ...prev].slice(0, 100));
      setDataSources(prev => ({ ...prev, tinygs: true }));
    });

    // ============================================
    // SatNOGS Events
    // ============================================
    socket.on('satnogs:data', (message) => {
      console.log('📡 SatNOGS data:', message.type);

      if (message.type === 'station_status') {
        setSatnogsData(prev => ({
          ...prev,
          status: message,
          lastUpdate: new Date()
        }));
      } 
      else if (message.type === 'observations') {
        setSatnogsData(prev => ({
          ...prev,
          observations: message.data || [],
          count: prev.count + (message.data?.length || 0),
          lastUpdate: new Date()
        }));

        if (message.data && message.data.length > 0) {
          const unified = message.data.map(obs => ({
            ...obs,
            source: 'satnogs',
            receivedAt: new Date().toISOString()
          }));
          setData(prev => [...unified, ...prev].slice(0, 100));
        }
      } 
      else if (message.type === 'scheduled_passes') {
        setSatnogsData(prev => ({
          ...prev,
          scheduled: message.passes || [],
          lastUpdate: new Date()
        }));
      }

      setDataSources(prev => ({ ...prev, satnogs: true }));
    });

    socket.on('satnogs:history', (history) => {
      console.log('📚 SatNOGS history:', history.length, 'items');
      
      if (Array.isArray(history)) {
        const unified = history.map(item => ({
          ...item,
          receivedAt: new Date().toISOString()
        }));
        setData(prev => [...unified, ...prev].slice(0, 100));
      }
    });

    return socket;
  }, []); // Empty dependencies - using ref instead

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Desconectando...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setDataSources({ tinygs: false, satnogs: false });
    }
  }, []);

  // Request update from server
  const requestUpdate = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔄 Requesting update...');
      socketRef.current.emit('request-update');
    }
  }, []);

  // Clear all data
  const clearData = useCallback(() => {
    setData([]);
    setTinygsData({ latest: null, history: [], count: 0 });
    setSatnogsData({ 
      status: null, 
      observations: [], 
      scheduled: [], 
      lastUpdate: null,
      count: 0 
    });
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (optionsRef.current.autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    // Connection
    connected,
    error,
    connect,
    disconnect,
    requestUpdate,
    
    // Data
    data,
    tinygsData,
    satnogsData,
    
    // Sources status
    dataSources,
    
    // Actions
    clearData,
    
    // Statistics
    totalPackets: data.length,
    tinygsPackets: tinygsData.count,
    satnogsPackets: satnogsData.count,
    
    // Socket reference
    socket: socketRef.current
  };
};

/**
 * Hook for satellite data statistics
 */
export const useSatelliteStats = (data = []) => {
  const totalObservations = data.length;
  const uniqueSatellites = new Set(data.map(d => d.satellite).filter(Boolean)).size;
  
  const rssiData = data.filter(d => d.rssi);
  const avgRSSI = rssiData.length > 0 
    ? (rssiData.reduce((acc, d) => acc + d.rssi, 0) / rssiData.length).toFixed(1)
    : 0;
  
  const snrData = data.filter(d => d.snr);
  const avgSNR = snrData.length > 0
    ? (snrData.reduce((acc, d) => acc + d.snr, 0) / snrData.length).toFixed(1)
    : 0;

  return {
    totalObservations,
    uniqueSatellites,
    avgRSSI,
    avgSNR
  };
};

export default useSatelliteData;