import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Initialize Cesium access token (replace with your token)
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0OWM4NGU2NC1iYTVjLTQ0ZDctOGUxNS1lNzJmNzdlOTRkYWIiLCJpZCI6MTgwNDI0LCJpYXQiOjE3MDAzMjk4MjR9.V1qPw1NtpB1wUHISx29jG8ILR51iQOfKGglmCDIGc-k';

const CesiumGlobe = ({ satellitePosition, groundStation }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  // Initialize viewer once with terrain
  useEffect(() => {
    let mounted = true;
    
    const initCesium = async () => {
      if (!containerRef.current || viewerRef.current) return;

      try {
        // Create terrain provider
        const terrainProvider = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        });

        // Initialize viewer with terrain
        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider,
          baseLayerPicker: false,
          navigationHelpButton: false,
          homeButton: false,
          sceneModePicker: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          geocoder: false,
          creditContainer: document.createElement('div'), // Hide credits
        });

        // Apply dark theme
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.skyBox.show = false;
        viewer.scene.skyAtmosphere.show = false;

        if (!mounted) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;

        // Add ground station if provided
        if (groundStation) {
          viewer.entities.add({
            id: 'groundStation',
            position: Cesium.Cartesian3.fromDegrees(
              groundStation.longitude,
              groundStation.latitude,
              (groundStation.altitude || 0) * 1000
            ),
            point: {
              pixelSize: 10,
              color: Cesium.Color.CYAN,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            },
            label: {
              text: 'Ground Station',
              font: '14px sans-serif',
              fillColor: Cesium.Color.WHITE,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12)
            }
          });
        }
      } catch (error) {
        console.error('Failed to initialize Cesium:', error);
      }
    };

    initCesium();

    return () => {
      mounted = false;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Update satellite position
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !satellitePosition) return;

    // Create or update satellite entity
    const position = Cesium.Cartesian3.fromDegrees(
      satellitePosition.longitude,
      satellitePosition.latitude,
      (satellitePosition.altitude || 0) * 1000
    );

    let satellite = viewer.entities.getById('satellite');
    if (!satellite) {
      satellite = viewer.entities.add({
        id: 'satellite',
        position,
        point: {
          pixelSize: 12,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: 'Satellite',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14)
        }
      });
    } else {
      satellite.position = position;
    }

    // Smoothly fly to satellite
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        satellitePosition.longitude,
        satellitePosition.latitude,
        (satellitePosition.altitude || 0) * 1000 + 800000
      ),
      duration: 1.0,
    });
  }, [satellitePosition]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{
        minHeight: 400,
        background: '#000'
      }}
    />
  );
};

export default CesiumGlobe;
