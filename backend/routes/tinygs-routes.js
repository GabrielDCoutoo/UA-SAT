// routes/tinygs.js - Add this route to your backend
const express = require('express');
const router = express.Router();

// Import the TinyGS Global Map module
const TinyGSGlobalMap = require('../data-integration/tinygs-global-map');

// Initialize map instance (should be done once in server.js ideally)
let globalMap = null;

function initializeGlobalMap() {
  if (!globalMap) {
    globalMap = new TinyGSGlobalMap();
    globalMap.startPolling();
    console.log('[API] TinyGS Global Map initialized');
  }
  return globalMap;
}

/**
 * GET /api/tinygs/map
 * Returns current state of global map
 */
router.get('/map', (req, res) => {
  try {
    const map = initializeGlobalMap();
    const state = map.getMapState();
    
    res.json({
      success: true,
      ...state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Error fetching map state:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tinygs/stations
 * Returns list of all stations
 */
router.get('/stations', (req, res) => {
  try {
    const map = initializeGlobalMap();
    const state = map.getMapState();
    
    res.json({
      success: true,
      stations: state.stations,
      count: state.stations.length
    });
  } catch (error) {
    console.error('[API] Error fetching stations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tinygs/satellites
 * Returns list of all satellites
 */
router.get('/satellites', (req, res) => {
  try {
    const map = initializeGlobalMap();
    const state = map.getMapState();
    
    res.json({
      success: true,
      satellites: state.satellites,
      count: state.satellites.length
    });
  } catch (error) {
    console.error('[API] Error fetching satellites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tinygs/packets
 * Returns recent packets
 */
router.get('/packets', (req, res) => {
  try {
    const map = initializeGlobalMap();
    const state = map.getMapState();
    
    const limit = parseInt(req.query.limit) || 20;
    
    res.json({
      success: true,
      packets: state.recentPackets.slice(0, limit),
      count: state.recentPackets.length
    });
  } catch (error) {
    console.error('[API] Error fetching packets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
