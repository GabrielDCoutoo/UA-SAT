const express = require('express');
const crypto = require('crypto');
const { GnssMeasurement } = require('../models');

// A app Android envia a chave no cabeçalho X-Api-Key (GNSS_API_KEY no .env).
// Sem GNSS_API_KEY configurada a rota recusa tudo (fail closed).
function requireApiKey(req, res, next) {
  const expected = process.env.GNSS_API_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, error: 'GNSS_API_KEY not configured on server' });
  }
  // Comparação em tempo constante (hash para igualar comprimentos)
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!crypto.timingSafeEqual(digest(req.get('x-api-key') || ''), digest(expected))) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
}

const toNumber = (v) =>
  (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null;

module.exports = (io) => {
  const router = express.Router();

  /**
   * POST /api/gnss/measurement
   * Receive and persist a GNSS measurement from the Android app.
   * Requires the X-Api-Key header.
   */
  router.post('/measurement', requireApiKey, async (req, res) => {
    try {
      const {
        timestamp,
        latitude,
        longitude,
        altitude,
        accuracy,
        speed,
        bearing,
        satellites_visible,
        satellites_used,
        satellites,
        device_id
      } = req.body;

      const lat = toNumber(latitude);
      const lon = toNumber(longitude);
      if (lat === null || lon === null) {
        return res.status(400).json({
          success: false,
          error: 'latitude and longitude are required numbers'
        });
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({
          success: false,
          error: 'latitude must be within [-90, 90] and longitude within [-180, 180]'
        });
      }

      const measurement = await GnssMeasurement.create({
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        latitude: lat,
        longitude: lon,
        altitude: altitude ?? null,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        bearing: bearing ?? null,
        satellites_visible: satellites_visible ?? null,
        satellites_used: satellites_used ?? null,
        satellites: satellites ?? [],
        device_id: device_id ?? null
      });

      if (io) {
        io.emit('gnss:measurement', measurement);
      }

      return res.status(201).json({
        success: true,
        data: measurement
      });

    } catch (error) {
      console.error('[GNSS] Error saving measurement:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/gnss/latest
   * Return the most recent measurement, optionally filtered by device_id.
   */
  router.get('/latest', async (req, res) => {
    try {
      const { device_id } = req.query;
      const measurement = await GnssMeasurement.getLatest(device_id);

      if (!measurement) {
        return res.status(404).json({
          success: false,
          error: 'No measurements found'
        });
      }

      return res.json({
        success: true,
        data: measurement
      });

    } catch (error) {
      console.error('[GNSS] Error fetching latest:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/gnss/history?limit=100&device_id=<id>
   * Return measurement history in reverse-chronological order.
   */
  router.get('/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const { device_id } = req.query;

      const measurements = await GnssMeasurement.getHistory(limit, device_id);

      return res.json({
        success: true,
        data: measurements,
        count: measurements.length
      });

    } catch (error) {
      console.error('[GNSS] Error fetching history:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
