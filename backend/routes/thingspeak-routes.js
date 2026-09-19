// routes/thingspeak-routes.js - API routes para ThingSpeak backup
const express = require('express');
const router = express.Router();
const axios = require('axios');

// ============================================
// CONFIGURAÇÃO THINGSPEAK
// ============================================

const THINGSPEAK_CONFIG = {
  CHANNEL_ID: process.env.THINGSPEAK_CHANNEL_ID || '3236598',
  READ_API_KEY: process.env.THINGSPEAK_READ_API_KEY,
  BASE_URL: 'https://api.thingspeak.com'
};

if (!THINGSPEAK_CONFIG.READ_API_KEY) {
  console.warn('[ThingSpeak] THINGSPEAK_READ_API_KEY não definido — as rotas de backup ThingSpeak vão falhar');
}

/**
 * GET /api/thingspeak/feeds
 * Get latest feeds from ThingSpeak
 */
router.get('/feeds', async (req, res) => {
  try {
    const results = parseInt(req.query.results) || 20;
    
    const url = `${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`;
    
    console.log('[ThingSpeak] Fetching feeds...');
    
    const response = await axios.get(url, {
      params: {
        api_key: THINGSPEAK_CONFIG.READ_API_KEY,
        results: results
      },
      timeout: 10000
    });
    
    if (!response.data || !response.data.feeds) {
      return res.json({
        success: false,
        error: 'No data from ThingSpeak'
      });
    }
    
    // Transformar dados para formato consistente
    const feeds = response.data.feeds.map(feed => ({
      id: feed.entry_id,
      created_at: feed.created_at,
      
      // Campos do ThingSpeak
      sat_id: feed.field1 || 'UNKNOWN',
      battery_percent: parseInt(feed.field2) || null,
      temperature: parseInt(feed.field3) || null,
      humidity: parseFloat(feed.field4) || null,
      pressure: parseFloat(feed.field5) || null,
      longitude: parseFloat(feed.field6) || null,
      latitude: parseFloat(feed.field7) || null,
      
      // Calcular battery_voltage a partir de %
      battery_voltage: feed.field2 ? (3.0 + (parseFloat(feed.field2) / 100) * 1.2) : null,
      
      // Status baseado em bateria
      sat_status: (feed.field2 && parseInt(feed.field2) > 20) ? 'ok' : 'not_ok'
    }));
    
    console.log(`[ThingSpeak] ✅ Fetched ${feeds.length} feeds`);
    
    res.json({
      success: true,
      data: feeds,
      count: feeds.length,
      channel: {
        id: response.data.channel.id,
        name: response.data.channel.name,
        last_entry_id: response.data.channel.last_entry_id
      }
    });
    
  } catch (error) {
    console.error('[ThingSpeak] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/thingspeak/latest
 * Get latest feed
 */
router.get('/latest', async (req, res) => {
  try {
    const url = `${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`;
    
    const response = await axios.get(url, {
      params: {
        api_key: THINGSPEAK_CONFIG.READ_API_KEY,
        results: 1
      },
      timeout: 10000
    });
    
    if (!response.data || !response.data.feeds || response.data.feeds.length === 0) {
      return res.json({
        success: false,
        error: 'No data available'
      });
    }
    
    const feed = response.data.feeds[0];
    
    const latest = {
      id: feed.entry_id,
      created_at: feed.created_at,
      sat_id: feed.field1 || 'UNKNOWN',
      battery_percent: parseInt(feed.field2) || null,
      temperature: parseInt(feed.field3) || null,
      humidity: parseFloat(feed.field4) || null,
      pressure: parseFloat(feed.field5) || null,
      longitude: parseFloat(feed.field6) || null,
      latitude: parseFloat(feed.field7) || null,
      battery_voltage: feed.field2 ? (3.0 + (parseFloat(feed.field2) / 100) * 1.2) : null,
      sat_status: (feed.field2 && parseInt(feed.field2) > 20) ? 'ok' : 'not_ok'
    };
    
    res.json({
      success: true,
      data: latest
    });
    
  } catch (error) {
    console.error('[ThingSpeak] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/thingspeak/stats
 * Get statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    const url = `${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`;
    
    const response = await axios.get(url, {
      params: {
        api_key: THINGSPEAK_CONFIG.READ_API_KEY,
        results: 8000 // Max do ThingSpeak
      },
      timeout: 10000
    });
    
    if (!response.data || !response.data.feeds) {
      return res.json({
        success: false,
        error: 'No data available'
      });
    }
    
    // Filtrar últimas X horas
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentFeeds = response.data.feeds.filter(feed => 
      new Date(feed.created_at) >= cutoff
    );
    
    // Calcular stats
    const satellites = new Set(recentFeeds.map(f => f.field1).filter(Boolean));
    const healthy = recentFeeds.filter(f => 
      f.field2 && parseInt(f.field2) > 20
    ).length;
    
    const stats = {
      total_messages: recentFeeds.length,
      active_satellites: satellites.size,
      healthy_messages: healthy,
      messages_per_hour: parseFloat((recentFeeds.length / hours).toFixed(1)),
      time_range_hours: hours,
      last_update: response.data.channel.updated_at
    };
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('[ThingSpeak] ❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/thingspeak/health
 * Health check
 */
router.get('/health', async (req, res) => {
  try {
    const url = `${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`;
    
    const response = await axios.get(url, {
      params: {
        api_key: THINGSPEAK_CONFIG.READ_API_KEY,
        results: 1
      },
      timeout: 5000
    });
    
    res.json({
      success: true,
      status: 'healthy',
      channel_id: THINGSPEAK_CONFIG.CHANNEL_ID,
      last_entry: response.data.channel.last_entry_id,
      last_update: response.data.channel.updated_at
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
