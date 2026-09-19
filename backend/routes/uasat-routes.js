// routes/uasat-routes.js - API routes com Sequelize
const express = require('express');
const router = express.Router();
const { UASATTelemetry } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../auth');

/**
 * GET /api/uasat/telemetry
 * Get telemetry data with optional filters
 */
router.get('/telemetry', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const hours = req.query.hours ? parseInt(req.query.hours) : null;
    const topic = req.query.topic;
    const frameType = req.query.frame_type;

    const where = {};
    if (hours) {
      where.received_at = {
        [Op.gte]: new Date(Date.now() - hours * 60 * 60 * 1000)
      };
    }

    if (topic && topic !== 'all') {
      where.topic = {
        [Op.like]: `${topic}%`
      };
    }

    if (frameType && ['frame0', 'frame1', 'retrans'].includes(frameType)) {
      where.frame_type = frameType;
    }

    const telemetry = await UASATTelemetry.findAll({
      where,
      order: [['received_at', 'DESC']],
      limit
    });

    res.json({
      success: true,
      data: telemetry,
      count: telemetry.length,
      filters: { limit, hours, topic }
    });

  } catch (error) {
    console.error('[UASAT API] Error fetching telemetry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uasat/latest
 * Get latest telemetry per topic
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = await UASATTelemetry.getLatestBySatellite();

    res.json({
      success: true,
      data: latest,
      count: latest.length
    });

  } catch (error) {
    console.error('[UASAT API] Error fetching latest:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uasat/stats
 * Get telemetry statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;

    const stats = await UASATTelemetry.getStats(hours);

    res.json({
      success: true,
      stats: stats,
      time_range_hours: hours
    });

  } catch (error) {
    console.error('[UASAT API] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uasat/topics
 * Get list of all topics
 */
router.get('/topics', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;

    const results = await UASATTelemetry.findAll({
      attributes: [
        'topic',
        [UASATTelemetry.sequelize.fn('COUNT', '*'), 'message_count']
      ],
      where: {
        received_at: {
          [Op.gte]: new Date(Date.now() - hours * 60 * 60 * 1000)
        }
      },
      group: ['topic'],
      order: [[UASATTelemetry.sequelize.literal('message_count'), 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      topics: results,
      count: results.length
    });

  } catch (error) {
    console.error('[UASAT API] Error fetching topics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uasat/telemetry
 * Manually insert telemetry (for testing or HTTP clients). Requires a valid dashboard JWT.
 */
router.post('/telemetry', authenticateToken, async (req, res) => {
  try {
    const { topic, payload, raw_message } = req.body;

    if (!topic || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: topic, payload'
      });
    }

    const telemetry = await UASATTelemetry.create({
      topic,
      payload,
      raw_message: raw_message || JSON.stringify(payload),
      received_at: new Date()
    });

    res.json({
      success: true,
      data: {
        id: telemetry.id,
        timestamp: telemetry.received_at
      }
    });

  } catch (error) {
    console.error('[UASAT API] Error inserting telemetry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uasat/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await UASATTelemetry.count();

    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * DELETE /api/uasat/telemetry
 * Delete old telemetry (cleanup). Requires a valid dashboard JWT.
 */
router.delete('/telemetry', authenticateToken, async (req, res) => {
  try {
    // Só inteiros >= 1 (antes, days=-1 punha o corte no futuro e apagava tudo)
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1) {
      return res.status(400).json({ success: false, error: 'days must be a positive integer' });
    }

    const deleted = await UASATTelemetry.destroy({
      where: {
        received_at: {
          [Op.lt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      success: true,
      deleted: deleted,
      older_than_days: days
    });

  } catch (error) {
    console.error('[UASAT API] Error deleting telemetry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
