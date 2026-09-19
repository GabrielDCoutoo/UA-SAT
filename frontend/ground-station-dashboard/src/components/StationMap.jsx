// Shared Leaflet map component — replaces 3 duplicate GPS map blocks
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon — only needs to run once per module load
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const makeIcon = (fill = '#c2410c', stroke = '#fb923c') =>
  new L.Icon({
    iconUrl:
      'data:image/svg+xml;base64,' +
      btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="${stroke}"/>
      </svg>`),
    iconSize:    [28, 28],
    iconAnchor:  [14, 14],
    popupAnchor: [0, -14],
  });

export const StationMap = ({
  lat,
  lng,
  label,
  sublabel,
  height = 220,
  fillColor = '#c2410c',
  strokeColor = '#fb923c',
}) => {
  const icon = useMemo(() => makeIcon(fillColor, strokeColor), [fillColor, strokeColor]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>
            <strong>{label}</strong>
            {sublabel && <><br />{sublabel}</>}
            <br />{lat}, {lng}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};
