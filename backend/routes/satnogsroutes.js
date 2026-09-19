// backend/routes/satnogs.routes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET: Station status
router.get('/status', async (req, res) => {
  const { satnogsClient } = req.app.locals;
  
  if (!satnogsClient) {
    return res.status(503).json({ error: 'SatNOGS not enabled' });
  }
  
  try {
    const status = await satnogsClient.getStationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Observations
router.get('/observations', async (req, res) => {
  const { satnogsClient } = req.app.locals;
  
  if (!satnogsClient) {
    return res.status(503).json({ error: 'SatNOGS not enabled' });
  }
  
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status || null;
    const observations = await satnogsClient.getObservations(limit, status);
    res.json(observations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Single observation
router.get('/observations/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `https://network.satnogs.org/api/observations/${req.params.id}/`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Scheduled passes
router.get('/passes', async (req, res) => {
  const { satnogsClient } = req.app.locals;
  
  if (!satnogsClient) {
    return res.status(503).json({ error: 'SatNOGS not enabled' });
  }
  
  try {
    const passes = await satnogsClient.getScheduledJobs();
    res.json(passes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Statistics
router.get('/stats', async (req, res) => {
  const { satnogsClient } = req.app.locals;
  
  if (!satnogsClient) {
    return res.status(503).json({ error: 'SatNOGS not enabled' });
  }
  
  try {
    const [status, observations] = await Promise.all([
      satnogsClient.getStationStatus(),
      satnogsClient.getObservations(200)
    ]);
    
    const stats = {
      total: observations.length,
      successful: observations.filter(o => o.status === 'good').length,
      failed: observations.filter(o => o.status === 'bad' || o.status === 'failed').length,
      unknown: observations.filter(o => o.status === 'unknown').length,
      station: {
        online: status?.status === 2,
        observations: status?.observations || 0,
        success_rate: status?.success_rate || 0,
        last_seen: status?.last_seen
      },
      recent: observations.slice(0, 10)
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;