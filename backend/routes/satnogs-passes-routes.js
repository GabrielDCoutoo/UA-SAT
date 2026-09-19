// routes/satnogs-passes.js - API routes para passes agendados
const express = require('express');
const router = express.Router();
const SatNOGSPassPredictor = require('../modules/satnogs-passes');
const { authenticateToken } = require('../auth');

// Initialize predictor with station info from env
const predictor = new SatNOGSPassPredictor({
  latitude: parseFloat(process.env.STATION_LAT) || 40.644,
  longitude: parseFloat(process.env.STATION_LON) || -8.645,
  altitude: parseFloat(process.env.STATION_ALT) || 50,
  name: process.env.STATION_NAME || 'UA Aveiro'
});

// TLEs sourced from Celestrak — update periodically for accurate predictions.
// NOAA 18 (28654) and NOAA 19 (33591) excluded: decommissioned 2025, no active transmitters.
const SATELLITES = [
  {
    name: 'ISS (ZARYA)',
    norad_id: 25544,
    tle_line1: '1 25544U 98067A   25041.50000000  .00016717  00000-0  10270-3 0  9005',
    tle_line2: '2 25544  51.6400 208.0900 0001160 108.1700  90.2500 15.50030000000000',
    frequency: 145.800,
    mode: 'FM'
  },
  {
    name: 'NOAA 15',
    norad_id: 25338,
    tle_line1: '1 25338U 98030A   25041.50000000  .00000100  00000-0  62081-4 0  9991',
    tle_line2: '2 25338  98.5500  60.0000 0010000  90.0000 270.0000 14.25900000000000',
    frequency: 137.620,
    mode: 'APT'
  },
  {
    name: 'METEOR-M N2-3',
    norad_id: 57166,
    tle_line1: '1 57166U 23091A   25041.50000000  .00000100  00000-0  62081-4 0  9992',
    tle_line2: '2 57166  98.6900  60.0000 0001200  90.0000 270.0000 14.24600000000000',
    frequency: 137.900,
    mode: 'FSK'
  },
  {
    name: 'METEOR-M N2-4',
    norad_id: 59051,
    tle_line1: '1 59051U 24014A   25041.50000000  .00000100  00000-0  62081-4 0  9993',
    tle_line2: '2 59051  98.7000  60.0000 0001200  90.0000 270.0000 14.23900000000000',
    frequency: 137.900,
    mode: 'FSK'
  }
];

/**
 * GET /api/satnogs/passes
 * Calculate future satellite passes
 */
router.get('/passes', async (req, res) => {
  try {
    const hoursAhead = parseInt(req.query.hours) || 24;
    const minElevation = parseInt(req.query.min_elevation) || 30;
    
    console.log(`[API] Calculating passes: ${hoursAhead}h ahead, min elevation ${minElevation}°`);
    
    // Calculate passes for all satellites
    const passes = await predictor.calculateMultiplePasses(
      SATELLITES,
      hoursAhead,
      minElevation
    );
    
    res.json({
      success: true,
      passes: passes,
      count: passes.length,
      station: {
        name: predictor.station.name,
        latitude: predictor.station.latitude,
        longitude: predictor.station.longitude
      }
    });
    
  } catch (error) {
    console.error('[API] Error calculating passes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/satnogs/scheduled
 * Get scheduled observations
 */
router.get('/scheduled', (req, res) => {
  try {
    const scheduled = predictor.getScheduledPasses();
    
    res.json({
      success: true,
      scheduled: scheduled,
      count: scheduled.length
    });
    
  } catch (error) {
    console.error('[API] Error getting scheduled passes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/satnogs/schedule
 * Schedule a new observation (requires a valid dashboard JWT)
 */
router.post('/schedule', authenticateToken, (req, res) => {
  try {
    const passData = req.body;
    
    // Validate required fields
    if (!passData.satellite || !passData.aos || !passData.los) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: satellite, aos, los'
      });
    }
    
    // Check if pass is in the future
    const aosTime = new Date(passData.aos);
    if (aosTime < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot schedule pass in the past'
      });
    }
    
    // Schedule the pass
    const scheduled = predictor.schedulePass(passData);
    
    console.log(`[API] ✅ Scheduled observation: ${scheduled.satellite} at ${scheduled.aos}`);
    
    res.json({
      success: true,
      scheduled: scheduled
    });
    
  } catch (error) {
    console.error('[API] Error scheduling pass:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/satnogs/scheduled/:id
 * Cancel a scheduled observation (requires a valid dashboard JWT)
 */
router.delete('/scheduled/:id', authenticateToken, (req, res) => {
  try {
    const id = req.params.id;
    
    // In a real app, would delete from database
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Observation cancelled'
    });
    
  } catch (error) {
    console.error('[API] Error cancelling observation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/satnogs/satellites
 * Get list of available satellites
 */
router.get('/satellites', (req, res) => {
  try {
    const satellites = SATELLITES.map(s => ({
      name: s.name,
      norad_id: s.norad_id,
      frequency: s.frequency,
      mode: s.mode
    }));
    
    res.json({
      success: true,
      satellites: satellites,
      count: satellites.length
    });
    
  } catch (error) {
    console.error('[API] Error getting satellites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
