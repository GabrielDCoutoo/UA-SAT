// satnogs-passes.js - Backend para cálculo de passes de satélites
const satellite = require('satellite.js');

class SatNOGSPassPredictor {
  constructor(stationInfo) {
    this.station = {
      latitude: stationInfo.latitude || 40.644, // UA Aveiro
      longitude: stationInfo.longitude || -8.645,
      altitude: stationInfo.altitude || 50, // meters
      name: stationInfo.name || 'UA Aveiro'
    };
    
    this.scheduledPasses = [];
  }

  /**
   * Calculate satellite passes over station
   */
  async calculatePasses(tle1, tle2, satelliteName, hoursAhead = 24, minElevation = 0) {
    try {
      const satrec = satellite.twoline2satrec(tle1, tle2);
      const passes = [];
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + hoursAhead * 60 * 60 * 1000);
      
      // Observer position in radians
      const observerGd = {
        longitude: this.station.longitude * (Math.PI / 180),
        latitude: this.station.latitude * (Math.PI / 180),
        height: this.station.altitude / 1000 // km
      };
      
      // Sample every 60 seconds
      const stepMinutes = 1;
      let currentTime = new Date(startTime);
      
      let inPass = false;
      let passData = null;
      
      while (currentTime <= endTime) {
        const positionAndVelocity = satellite.propagate(satrec, currentTime);
        
        if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
          const positionEci = positionAndVelocity.position;
          const gmst = satellite.gstime(currentTime);
          
          const positionEcf = satellite.eciToEcf(positionEci, gmst);
          const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
          
          const elevation = lookAngles.elevation * (180 / Math.PI);
          const azimuth = lookAngles.azimuth * (180 / Math.PI);
          
          // Check if satellite is above horizon
          if (elevation > 0) {
            if (!inPass) {
              // Start of pass (AOS - Acquisition of Signal)
              inPass = true;
              passData = {
                satellite: satelliteName,
                aos: new Date(currentTime),
                aos_azimuth: azimuth,
                max_elevation: elevation,
                max_elevation_time: new Date(currentTime),
                elevations: [{ time: new Date(currentTime), elevation, azimuth }]
              };
            } else {
              // Continue tracking pass
              passData.elevations.push({ time: new Date(currentTime), elevation, azimuth });
              
              if (elevation > passData.max_elevation) {
                passData.max_elevation = elevation;
                passData.max_elevation_time = new Date(currentTime);
              }
            }
          } else if (inPass) {
            // End of pass (LOS - Loss of Signal)
            passData.los = new Date(currentTime);
            passData.los_azimuth = azimuth;
            passData.duration = (passData.los - passData.aos) / 1000; // seconds
            
            // Only include passes above minimum elevation
            if (passData.max_elevation >= minElevation) {
              passes.push({
                satellite: passData.satellite,
                aos: passData.aos.toISOString(),
                los: passData.los.toISOString(),
                duration: Math.round(passData.duration),
                max_elevation: passData.max_elevation,
                max_elevation_time: passData.max_elevation_time.toISOString(),
                aos_azimuth: passData.aos_azimuth,
                los_azimuth: passData.los_azimuth,
                // Additional computed data
                quality: this.getPassQuality(passData.max_elevation),
                station: this.station.name
              });
            }
            
            inPass = false;
            passData = null;
          }
        }
        
        // Advance time
        currentTime = new Date(currentTime.getTime() + stepMinutes * 60 * 1000);
      }
      
      return passes;
      
    } catch (error) {
      console.error('[SatNOGS] Error calculating passes:', error);
      return [];
    }
  }

  /**
   * Get pass quality based on max elevation
   */
  getPassQuality(elevation) {
    if (elevation >= 70) return 'excellent';
    if (elevation >= 50) return 'very_good';
    if (elevation >= 30) return 'good';
    return 'fair';
  }

  /**
   * Calculate passes for multiple satellites
   */
  async calculateMultiplePasses(satellites, hoursAhead = 24, minElevation = 30) {
    const allPasses = [];
    
    for (const sat of satellites) {
      if (sat.tle_line1 && sat.tle_line2) {
        const passes = await this.calculatePasses(
          sat.tle_line1,
          sat.tle_line2,
          sat.name,
          hoursAhead,
          minElevation
        );
        
        // Add satellite metadata
        passes.forEach(pass => {
          pass.norad = sat.norad_id;
          pass.frequency = sat.frequency;
          pass.mode = sat.mode;
        });
        
        allPasses.push(...passes);
      }
    }
    
    // Sort by AOS time
    allPasses.sort((a, b) => new Date(a.aos) - new Date(b.aos));
    
    return allPasses;
  }

  /**
   * Schedule a pass for observation
   */
  schedulePass(passData) {
    const scheduled = {
      ...passData,
      scheduled_at: new Date().toISOString(),
      status: 'scheduled'
    };
    
    this.scheduledPasses.push(scheduled);
    
    return scheduled;
  }

  /**
   * Get scheduled passes
   */
  getScheduledPasses() {
    // Filter out past passes
    const now = new Date();
    this.scheduledPasses = this.scheduledPasses.filter(p => 
      new Date(p.los) > now
    );
    
    return this.scheduledPasses;
  }
}

// ============================================
// TESTE
// ============================================
if (require.main === module) {
  console.log('🛰️ Testing SatNOGS Pass Predictor\n');

  const predictor = new SatNOGSPassPredictor({
    latitude: 40.644,
    longitude: -8.645,
    altitude: 50,
    name: 'UA Aveiro'
  });

  // Example TLE for ISS
  const tle1 = '1 25544U 98067A   25041.50000000  .00016717  00000-0  10270-3 0  9005';
  const tle2 = '2 25544  51.6400 208.0900 0001160 108.1700  90.2500 15.50030000000000';

  (async () => {
    console.log('📡 Calculating ISS passes for next 48 hours...\n');
    
    const passes = await predictor.calculatePasses(
      tle1,
      tle2,
      'ISS (ZARYA)',
      48,
      30 // min elevation 30°
    );

    console.log(`✅ Found ${passes.length} passes above 30° elevation:\n`);

    passes.slice(0, 5).forEach((pass, i) => {
      console.log(`Pass ${i + 1}:`);
      console.log(`  AOS: ${new Date(pass.aos).toLocaleString()}`);
      console.log(`  LOS: ${new Date(pass.los).toLocaleString()}`);
      console.log(`  Duration: ${Math.round(pass.duration / 60)} minutes`);
      console.log(`  Max Elevation: ${pass.max_elevation.toFixed(1)}° (${pass.quality})`);
      console.log(`  Azimuth: ${pass.aos_azimuth.toFixed(0)}° → ${pass.los_azimuth.toFixed(0)}°`);
      console.log('');
    });
  })();
}

module.exports = SatNOGSPassPredictor;
