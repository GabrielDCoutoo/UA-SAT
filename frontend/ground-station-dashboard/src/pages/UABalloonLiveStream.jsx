import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Rocket, Activity, MapPin, TrendingUp, Signal, Thermometer, Video } from 'lucide-react';
import { useSatelliteData } from '../hooks/useSatelliteData';

const BALLOON_NAME = 'BALAO-UA-2024';

const UABalloonLiveStream = () => {
  const serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  const [streamStatus, setStreamStatus] = useState({
    live: false,
    url: null,
    message: 'A verificar...'
  });
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const { data, connected } = useSatelliteData({ serverUrl, autoConnect: true });

  const balloonPackets = data.filter(d =>
    d.source === 'tinygs' &&
    (d.metadata?.isMyBalloon || d.isBalloon || (d.satellite?.name || d.satellite) === BALLOON_NAME)
  );
  const latest = balloonPackets[0];
  const telemetry = latest?.packet?.parsed || latest?.parsed || null;
  const altitudeM = telemetry?.altitude ? Number(telemetry.altitude) : null;

  // Poll /api/stream/status every 10 s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/stream/status`);
        const json = await res.json();
        setStreamStatus(json);
      } catch {
        setStreamStatus({ live: false, url: null, message: 'Sem ligação ao servidor' });
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [serverUrl]);

  // Initialize / destroy HLS player
  useEffect(() => {
    if (!streamStatus.live || !streamStatus.url || !videoRef.current) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamStatus.url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play());
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      videoRef.current.src = streamStatus.url;
      videoRef.current.play();
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamStatus.live, streamStatus.url]);

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Rocket className="text-orange-500" size={36} />
          UA Balloon Live Stream
          {streamStatus.live && (
            <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse flex items-center gap-1">
              ● LIVE
            </span>
          )}
        </h1>
        <p className="text-gray-400">Transmissão HLS em direto do balão estratosférico</p>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-3 gap-6">

        {/* Video Player (2/3) */}
        <div className="col-span-2">
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden relative">

            {/* RF status indicator — top-right */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-medium">
              <div className={`w-2 h-2 rounded-full ${streamStatus.live ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {streamStatus.live ? 'Stream ativo' : 'Aguardar sinal'}
            </div>

            {streamStatus.live ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  muted
                  className="w-full block bg-black max-h-[65vh]"
                />

                {/* Telemetry overlay — bottom-left, only when data available */}
                {telemetry && (
                  <div className="absolute bottom-10 left-3 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-xs font-mono space-y-1">
                    {altitudeM !== null && (
                      <div className="flex items-center gap-2 text-blue-300">
                        <TrendingUp size={11} />
                        <span>{altitudeM.toLocaleString()} m</span>
                      </div>
                    )}
                    {telemetry.latitude && telemetry.longitude && (
                      <div className="flex items-center gap-2 text-green-300">
                        <MapPin size={11} />
                        <span>
                          {parseFloat(telemetry.latitude).toFixed(4)}°,{' '}
                          {parseFloat(telemetry.longitude).toFixed(4)}°
                        </span>
                      </div>
                    )}
                    {telemetry.temperature !== undefined && (
                      <div className="flex items-center gap-2 text-red-300">
                        <Thermometer size={11} />
                        <span>{telemetry.temperature} °C</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-16 min-h-[420px] bg-gradient-to-br from-gray-900 to-gray-800">
                <Video size={72} className="text-gray-600 mb-6" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">{streamStatus.message}</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  O stream inicia automaticamente quando o Nginx‑RTMP estiver a receber sinal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel (1/3) */}
        <div className="flex flex-col gap-4">

          {/* Mission Status */}
          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-orange-400 flex items-center gap-2">
                <Rocket size={18} />
                {BALLOON_NAME}
              </h3>
              <div
                className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
                title={connected ? 'Telemetria online' : 'Telemetria offline'}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Estado missão</span>
                <span className={`font-semibold ${balloonPackets.length > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  {balloonPackets.length > 0 ? 'ATIVO' : 'Pré-lançamento'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Telemetria RF</span>
                <span className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
                  <Signal size={12} />
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Stream HLS</span>
                <span className={`font-semibold ${streamStatus.live ? 'text-green-400' : 'text-gray-400'}`}>
                  {streamStatus.live ? 'Ativo' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Altitude */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-blue-400" size={20} />
              <h3 className="font-semibold">Altitude</h3>
            </div>
            <div className="text-4xl font-bold text-blue-400 mb-1">
              {altitudeM !== null ? `${altitudeM.toLocaleString()} m` : '-- m'}
            </div>
            <div className="text-xs text-gray-500 mb-3">Objetivo: ~30 000 m</div>
            {altitudeM !== null && (
              <>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${Math.min((altitudeM / 30000) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {Math.min((altitudeM / 30000) * 100, 100).toFixed(1)}%
                </div>
              </>
            )}
          </div>

          {/* Telemetria — só aparece quando há dados */}
          {telemetry && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="font-semibold mb-3 text-gray-300 flex items-center gap-2">
                <Activity size={16} className="text-green-400" />
                Telemetria
              </h3>
              <div className="space-y-2 text-sm">
                {telemetry.temperature !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Temperatura</span>
                    <span className="font-semibold">{telemetry.temperature} °C</span>
                  </div>
                )}
                {telemetry.latitude && telemetry.longitude && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Posição</span>
                    <span className="font-semibold text-xs font-mono">
                      {parseFloat(telemetry.latitude).toFixed(4)}°,{' '}
                      {parseFloat(telemetry.longitude).toFixed(4)}°
                    </span>
                  </div>
                )}
                {latest && (
                  <div className="flex justify-between pt-1 border-t border-gray-700">
                    <span className="text-gray-400">Último update</span>
                    <span className="text-xs text-gray-300">
                      {new Date(latest.timestamp || latest.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info da Missão */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-gray-300">Info da Missão</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                <span>IT Aveiro, Portugal</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Altitude alvo: ~30 km</span>
              </div>
              <div className="flex items-start gap-2">
                <Signal size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>HLS via Nginx‑RTMP</span>
              </div>
              <div className="flex items-start gap-2">
                <Activity size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                <span>SDR · Câmara · Sensores ambientais</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UABalloonLiveStream;
