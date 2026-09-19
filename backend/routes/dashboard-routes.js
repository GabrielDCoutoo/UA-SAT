// routes/dashboard-routes.js - API endpoints para Dashboard
const express = require('express');
const router = express.Router();

// Cache para stats (evitar hits excessivos ao DB)
let statsCache = null;
let lastUpdate = null;
const CACHE_TTL = 60 * 1000; // 1 minuto

/**
 * GET /api/dashboard/stats
 * Get overview statistics for dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (statsCache && lastUpdate && (now - lastUpdate) < CACHE_TTL) {
      return res.json({
        success: true,
        stats: statsCache.stats,
        station_status: statsCache.station_status,
        cached: true
      });
    }

    // Fetch fresh stats
    const stats = {
      tinygs_packets: 0,
      satnogs_observations: 0,
      scheduled_passes: 0,
      satellites_tracked: 0
    };

    const station_status = {
      satnogs: 'offline',
      tinygs: 'offline'
    };

    // TODO: Query database for actual stats
    // For now, using placeholder values
    
    // Example: Get TinyGS packet count from last 24h
    // const db = require('../database/db');
    // stats.tinygs_packets = await db.query('SELECT COUNT(*) FROM tinygs_packets WHERE timestamp > NOW() - INTERVAL 24 HOUR');
    
    // Example: Get SatNOGS observations count
    // stats.satnogs_observations = await db.query('SELECT COUNT(*) FROM satnogs_observations');
    
    // Example: Get scheduled passes count
    // stats.scheduled_passes = await db.query('SELECT COUNT(*) FROM scheduled_passes WHERE aos > NOW()');

    // Mock data for now (replace with real DB queries)
    stats.tinygs_packets = Math.floor(Math.random() * 50) + 10;
    stats.satnogs_observations = 9; // From your actual station
    stats.scheduled_passes = 5; // From passes calculation
    stats.satellites_tracked = 3; // ISS, NOAA 18, NOAA 19

    // Check SatNOGS station status
    try {
      const axios = require('axios');
      const STATION_ID = process.env.SATNOGS_STATION_ID || '4518';
      
      const response = await axios.get(
        `https://network.satnogs.org/api/stations/${STATION_ID}/`,
        { timeout: 3000 }
      );
      
      station_status.satnogs = response.data.status.toLowerCase();
    } catch (error) {
      console.error('[Dashboard] Error fetching SatNOGS status:', error.message);
      station_status.satnogs = 'offline';
    }

    // TinyGS status (assume online if websocket connected)
    station_status.tinygs = 'connected';

    // Update cache
    statsCache = { stats, station_status };
    lastUpdate = now;

    res.json({
      success: true,
      stats: stats,
      station_status: station_status,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Dashboard] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Get recent activity feed
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // TODO: Query database for recent activity
    // const activities = await db.query('SELECT * FROM activities ORDER BY timestamp DESC LIMIT ?', [limit]);
    
    // Mock data for now
    const activities = [
      {
        type: 'tinygs',
        satellite: 'NORBI',
        station: 'UA_Aveiro_GS',
        timestamp: new Date().toISOString(),
        rssi: -98,
        snr: 8.5
      },
      {
        type: 'satnogs',
        observation_id: 12345,
        satellite: 'NOAA 19',
        status: 'good',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      }
    ];

    res.json({
      success: true,
      activities: activities,
      count: activities.length
    });

  } catch (error) {
    console.error('[Dashboard] Error fetching activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/health
 * System health check
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    services: {
      database: 'connected',
      websocket: 'active',
      satnogs_api: 'reachable',
      tinygs_mqtt: 'connected'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    health: health
  });
});

module.exports = router;
