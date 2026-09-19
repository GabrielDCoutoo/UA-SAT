// frontend/src/pages/UABalloonTracker.jsx
import { useState, useRef, useEffect } from 'react';
import {
  Rocket, Activity, MapPin, TrendingUp,
  ExternalLink, Settings, Video, Signal, Clock
} from 'lucide-react';
import { useSatelliteData } from '../hooks/useSatelliteData';

// Converte URL público para URL de embed
const getEmbedUrl = (url) => {
  if (!url) return null;

  const ytMatch =
    url.match(/youtube\.com\/watch\?v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?]+)/) ||
    url.match(/youtube\.com\/live\/([^?]+)/) ||
    url.match(/youtube\.com\/shorts\/([^?]+)/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  }

  const twitchMatch = url.match(/twitch\.tv\/([^/?]+)/);
  if (twitchMatch) {
    return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${window.location.hostname}&autoplay=true`;
  }

  return null; // vídeo direto (MP4, WebM, HLS)
};

const UABalloonTracker = () => {
  const savedUrl = typeof localStorage !== 'undefined'
    ? localStorage.getItem('balloon-stream-url') || ''
    : '';

  const [streamUrl, setStreamUrl] = useState(savedUrl);
  const [inputUrl, setInputUrl] = useState(savedUrl);
  const [showConfig, setShowConfig] = useState(!savedUrl);
  const [isLive, setIsLive] = useState(!!savedUrl);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  const { data, connected } = useSatelliteData({
    serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000',
    autoConnect: true
  });

  const BALLOON_NAME = 'BALAO-UA-2024';
  const balloonPackets = data.filter(d =>
    d.source === 'tinygs' &&
    (d.metadata?.isMyBalloon ||
      d.isBalloon ||
      (d.satellite?.name || d.satellite) === BALLOON_NAME)
  );
  const latest = balloonPackets[0];
  const telemetry = latest?.packet?.parsed || latest?.parsed || null;

  // Timer de missão
  useEffect(() => {
    if (!isLive) { setElapsed(0); return; }
    if (!startRef.current) startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isLive]);

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const handleSetStream = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    setStreamUrl(trimmed);
    localStorage.setItem('balloon-stream-url', trimmed);
    setShowConfig(false);
    setIsLive(true);
    startRef.current = Date.now();
    setElapsed(0);
  };

  const handleRemoveStream = () => {
    setStreamUrl('');
    setInputUrl('');
    localStorage.removeItem('balloon-stream-url');
    setIsLive(false);
    startRef.current = null;
    setShowConfig(true);
  };

  const embedUrl = getEmbedUrl(streamUrl);
  const altitudeM = telemetry?.altitude ? Number(telemetry.altitude) : null;
  const altitudePct = altitudeM ? Math.min((altitudeM / 30000) * 100, 100) : 0;

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <Rocket className="text-orange-500" size={36} />
            UASAT Balloon Mission
            {isLive && (
              <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse flex items-center gap-1">
                ● LIVE
              </span>
            )}
          </h1>
          <p className="text-gray-400">
            Live transmission from high-altitude balloon — {BALLOON_NAME}
          </p>
        </div>
        <button
          onClick={() => setShowConfig(v => !v)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 text-sm transition-colors flex-shrink-0"
        >
          <Settings size={16} />
          {showConfig ? 'Close' : 'Configure stream'}
        </button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="bg-gray-800 border border-orange-500/30 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Video size={20} className="text-orange-400" />
            Configure Video Stream
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Paste the YouTube Live, Twitch, or direct stream URL (HLS/MP4) here.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="https://youtube.com/live/xxxx  ou  https://www.youtube.com/watch?v=xxxx"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetStream()}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={handleSetStream}
              disabled={!inputUrl.trim()}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 rounded-lg font-semibold transition-colors"
            >
              Activate
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>✓ YouTube Live</span>
            <span>✓ YouTube (URL normal)</span>
            <span>✓ Twitch</span>
            <span>✓ HLS (.m3u8)</span>
            <span>✓ Direct video (MP4/WebM)</span>
          </div>
        </div>
      )}

      {/* Main Layout: Video + Side Panel */}
      <div className="grid grid-cols-3 gap-6">

        {/* ── Video Player (2/3) ── */}
        <div className="col-span-2 flex flex-col gap-3">
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {streamUrl ? (
              embedUrl ? (
                <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Balloon Livestream"
                  />
                </div>
              ) : (
                <video
                  key={streamUrl}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: '100%', display: 'block', backgroundColor: '#000', maxHeight: '65vh' }}
                >
                  <source src={streamUrl} />
                  Your browser does not support this video format.
                </video>
              )
            ) : (
              <div
                className="flex flex-col items-center justify-center text-center p-16"
                style={{ minHeight: '420px', background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }}
              >
                <Video size={72} className="text-gray-600 mb-6" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">Stream not configured</h3>
                <p className="text-gray-500 text-sm max-w-sm mb-6">
                  Configure the stream URL before launch so the feed appears here automatically.
                </p>
                <button
                  onClick={() => setShowConfig(true)}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold transition-colors"
                >
                  Configure now
                </button>
              </div>
            )}
          </div>

          {/* URL bar */}
          {streamUrl && (
            <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-400">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="truncate flex-1">{streamUrl}</span>
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 flex-shrink-0"
              >
                <ExternalLink size={13} />
                Open
              </a>
              <button
                onClick={handleRemoveStream}
                className="text-red-400 hover:text-red-300 flex-shrink-0"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* ── Side Panel (1/3) ── */}
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
                title={connected ? 'Online' : 'Offline'}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Mission status</span>
                <span className={`font-semibold ${balloonPackets.length > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  {balloonPackets.length > 0 ? 'ACTIVE' : 'Pre-launch'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Packets received</span>
                <span className="font-semibold">{balloonPackets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Telemetry</span>
                <span className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
                  <Signal size={12} />
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>
              {isLive && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Stream active for</span>
                  <span className="font-mono font-semibold text-red-400 flex items-center gap-1">
                    <Clock size={12} />
                    {formatElapsed(elapsed)}
                  </span>
                </div>
              )}
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
            <div className="text-xs text-gray-500 mb-3">Target: ~30 000 m</div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${altitudePct}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">{altitudePct.toFixed(1)}%</div>
          </div>

          {/* Telemetry */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-gray-300 flex items-center gap-2">
              <Activity size={16} className="text-green-400" />
              Telemetry
            </h3>
            {telemetry ? (
              <div className="space-y-2 text-sm">
                {telemetry.temperature !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Temperature</span>
                    <span className="font-semibold">{telemetry.temperature} °C</span>
                  </div>
                )}
                {telemetry.battery && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Battery</span>
                    <span className="font-semibold">{telemetry.battery} V</span>
                  </div>
                )}
                {telemetry.latitude && telemetry.longitude && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position</span>
                    <span className="font-semibold text-xs font-mono">
                      {parseFloat(telemetry.latitude).toFixed(4)}°,{' '}
                      {parseFloat(telemetry.longitude).toFixed(4)}°
                    </span>
                  </div>
                )}
                {latest && (
                  <div className="flex justify-between pt-1 border-t border-gray-700">
                    <span className="text-gray-400">Last update</span>
                    <span className="text-xs text-gray-300">
                      {new Date(latest.timestamp || latest.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Waiting for balloon packets...</p>
            )}
          </div>

          {/* Info da Missão */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-gray-300">Mission Info</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
                <span>IT Aveiro, Portugal</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Target altitude: ~30 km</span>
              </div>
              <div className="flex items-start gap-2">
                <Signal size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>LoRa 433 MHz · TinyGS</span>
              </div>
              <div className="flex items-start gap-2">
                <Activity size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                <span>GPS · Câmara · Sensores ambientais</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UABalloonTracker;
