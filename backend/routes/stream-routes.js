const express = require('express');
const router = express.Router();

const HLS_URL = process.env.STREAM_HLS_URL || 'http://localhost:8080/live/balloon/index.m3u8';

router.get('/status', (req, res) => {
  const mock = process.env.STREAM_MOCK === 'true';
  if (mock) {
    return res.json({ live: true, url: HLS_URL, message: 'Stream ativo' });
  }
  res.json({ live: false, url: null, message: 'Stream offline' });
});

module.exports = router;