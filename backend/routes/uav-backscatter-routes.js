// routes/uav-backscatter-routes.js - API routes for UAV Backscatter
const express = require('express');
const router = express.Router();
const { UAVBackscatter } = require('../models');
const { authenticateToken } = require('../auth');

// Campos que um cliente pode definir (id e received_at são sempre gerados pelo servidor)
const WRITABLE_FIELDS = ['tag_id', 'uav_id', 'temperature', 'latitude', 'longitude', 'altitude', 'rssi', 'snr', 'frequency', 'status'];

/**
 * GET /api/uav-backscatter/telemetry
 * Get telemetry readings with pagination
 */
router.get('/telemetry', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const tag_id = req.query.tag_id;

    const where = {};
    if (tag_id) {
      where.tag_id = tag_id;
    }

    const readings = await UAVBackscatter.findAll({
      where,
      order: [['received_at', 'DESC']],
      limit,
      offset
    });

    const total = await UAVBackscatter.count({ where });

    res.json({
      success: true,
      data: readings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error fetching telemetry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uav-backscatter/latest
 * Get latest reading from each tag
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = await UAVBackscatter.getLatestByTag();

    res.json({
      success: true,
      data: latest
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error fetching latest:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uav-backscatter/tags
 * Get list of all tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await UAVBackscatter.findAll({
      attributes: [
        'tag_id',
        [UAVBackscatter.sequelize.fn('MAX', UAVBackscatter.sequelize.col('received_at')), 'last_seen'],
        [UAVBackscatter.sequelize.fn('COUNT', UAVBackscatter.sequelize.col('id')), 'total_readings']
      ],
      group: ['tag_id'],
      order: [[UAVBackscatter.sequelize.literal('last_seen'), 'DESC']]
    });

    res.json({
      success: true,
      data: tags
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error fetching tags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uav-backscatter/tag/:tagId
 * Get specific tag details
 */
router.get('/tag/:tagId', async (req, res) => {
  try {
    const { tagId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const readings = await UAVBackscatter.findAll({
      where: { tag_id: tagId },
      order: [['received_at', 'DESC']],
      limit
    });

    if (readings.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      });
    }

    const stats = {
      total_readings: readings.length,
      latest_reading: readings[0],
      avg_temperature: readings.reduce((sum, r) => sum + (r.temperature || 0), 0) / readings.length,
      avg_rssi: readings.reduce((sum, r) => sum + (r.rssi || 0), 0) / readings.length
    };

    res.json({
      success: true,
      tag_id: tagId,
      stats,
      readings
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error fetching tag:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uav-backscatter/stats
 * Get statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await UAVBackscatter.getStats(hours);

    res.json({
      success: true,
      stats,
      time_range_hours: hours
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/uav-backscatter/telemetry
 * Create new telemetry reading (for testing). Requires a valid dashboard JWT.
 */
router.post('/telemetry', authenticateToken, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = Object.fromEntries(WRITABLE_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
    const reading = await UAVBackscatter.create(data);

    res.json({
      success: true,
      data: reading
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error creating reading:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/uav-backscatter/cleanup
 * Delete old readings (optional cleanup endpoint). Requires a valid dashboard JWT.
 */
router.delete('/cleanup', authenticateToken, async (req, res) => {
  try {
    // Só inteiros >= 1 (antes, days=-1 punha o corte no futuro e apagava tudo)
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1) {
      return res.status(400).json({ success: false, error: 'days must be a positive integer' });
    }
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleted = await UAVBackscatter.destroy({
      where: {
        received_at: {
          [UAVBackscatter.sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });

    res.json({
      success: true,
      deleted_count: deleted,
      cutoff_date: cutoffDate
    });

  } catch (error) {
    console.error('[UAV Backscatter] Error cleaning up:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
