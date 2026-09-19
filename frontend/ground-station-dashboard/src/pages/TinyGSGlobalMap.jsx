// TinyGSGlobalMap.jsx - Mapa global TinyGS
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Custom icons
const stationOnlineIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const stationOfflineIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const satelliteIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 7L9 3 5 7l4 4"/>
      <path d="m17 11 4 4-4 4-4-4"/>
      <path d="m8 12 4 4 6-6-4-4Z"/>
      <path d="m16 8 3-3"/>
      <path d="M9 21a6 6 0 0 0-6-6"/>
    </svg>
  `),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// Auto-center map component
function MapUpdater({ stations, satellites }) {
  const map = useMap();
  
  useEffect(() => {
    if (stations.length > 0 || satellites.length > 0) {
      const bounds = [];
      
      stations.forEach(s => {
        if (s.location?.lat && s.location?.lng) {
          bounds.push([s.location.lat, s.location.lng]);
        }
      });
      
      satellites.forEach(s => {
        if (s.position?.lat && s.position?.lng) {
          bounds.push([s.position.lat, s.position.lng]);
        }
      });
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 4 });
      }
    }
  }, [stations, satellites, map]);
  
  return null;
}

export default function TinyGSGlobalMap() {
  const [stations, setStations] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const [recentPackets, setRecentPackets] = useState([]);
  const [stats, setStats] = useState({
    totalStations: 0,
    onlineStations: 0,
    totalSatellites: 0,
    totalPackets: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedSatellite, setSelectedSatellite] = useState(null);

  // Fetch map data
  const fetchMapData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tinygs/map`);
      if (!response.ok) throw new Error('Failed to fetch map data');
      
      const data = await response.json();
      setStations(data.stations || []);
      setSatellites(data.satellites || []);
      setRecentPackets(data.recentPackets || []);
      setStats(data.stats || {});
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching map data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 15000); // Update every 15s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading global map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">❌ Error: {error}</p>
          <button 
            onClick={fetchMapData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header Stats */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🌍</span>
            TinyGS Global Network
          </h1>
          
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{stats.onlineStations}</div>
              <div className="text-xs text-gray-400">Online Stations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">{stats.totalStations}</div>
              <div className="text-xs text-gray-400">Total Stations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalSatellites}</div>
              <div className="text-xs text-gray-400">Satellites</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.totalPackets}</div>
              <div className="text-xs text-gray-400">Recent Packets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="h-full w-full"
          style={{ background: '#1a1a1a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <MapUpdater stations={stations} satellites={satellites} />

          {/* Render Stations */}
          {stations.map(station => {
            if (!station.location?.lat || !station.location?.lng) return null;
            
            const isOnline = station.status === 'online';
            const icon = isOnline ? stationOnlineIcon : stationOfflineIcon;
            
            return (
              <Marker
                key={station.id}
                position={[station.location.lat, station.location.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelectedStation(station)
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-lg mb-2">{station.name}</h3>
                    <p><strong>Status:</strong> <span className={isOnline ? 'text-green-600' : 'text-red-600'}>{station.status}</span></p>
                    <p><strong>Packets:</strong> {station.packetCount}</p>
                    {station.lastPacket && (
                      <p><strong>Last Packet:</strong> {new Date(station.lastPacket).toLocaleString()}</p>
                    )}
                    {station.satellite && (
                      <p><strong>Listening:</strong> {station.satellite}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      📍 {station.location.lat.toFixed(4)}, {station.location.lng.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Satellites */}
          {satellites.map(satellite => {
            if (!satellite.position?.lat || !satellite.position?.lng) return null;
            
            return (
              <Marker
                key={satellite.id}
                position={[satellite.position.lat, satellite.position.lng]}
                icon={satelliteIcon}
                eventHandlers={{
                  click: () => setSelectedSatellite(satellite)
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-lg mb-2">🛰️ {satellite.name}</h3>
                    <p><strong>NORAD:</strong> {satellite.norad}</p>
                    {satellite.frequency && (
                      <p><strong>Frequency:</strong> {satellite.frequency} MHz</p>
                    )}
                    {satellite.mode && (
                      <p><strong>Mode:</strong> {satellite.mode}</p>
                    )}
                    {satellite.position?.alt && (
                      <p><strong>Altitude:</strong> {(satellite.position.alt / 1000).toFixed(0)} km</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      📍 {satellite.position.lat.toFixed(4)}, {satellite.position.lng.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render packet connections */}
          {recentPackets.slice(0, 10).map((packet, idx) => {
            if (!packet.satPos || !packet.stationPos) return null;
            
            return (
              <Polyline
                key={`packet-${idx}`}
                positions={[
                  [packet.stationPos.lat, packet.stationPos.lng],
                  [packet.satPos.lat, packet.satPos.lng]
                ]}
                color="#10b981"
                weight={2}
                opacity={0.6}
                dashArray="5, 10"
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm">
        <h3 className="font-bold text-white mb-2">Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-gray-300">Online Station</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-gray-300">Offline Station</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-gray-300">Satellite</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500"></div>
            <span className="text-gray-300">Recent Reception</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="absolute top-20 left-4 bg-gray-800 border border-gray-700 rounded-lg p-4 max-w-sm max-h-96 overflow-y-auto">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📡</span>
          Recent Activity
        </h3>
        <div className="space-y-2">
          {recentPackets.slice(0, 10).map((packet, idx) => (
            <div key={idx} className="text-xs bg-gray-900 p-2 rounded border border-gray-700">
              <div className="font-semibold text-blue-400">{packet.satellite}</div>
              <div className="text-gray-400">
                via Station {packet.station || packet.stationName}
              </div>
              <div className="text-gray-500 text-xs">
                {new Date(packet.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
