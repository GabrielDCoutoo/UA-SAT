// routes/satnogs-proxy-routes.js
// Proxies public SatNOGS Network API calls to avoid browser CORS restrictions.
// These routes shadow the equivalents in satnogsroutes.js and work regardless
// of whether SATNOGS_ENABLED is set or satnogsClient is running.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const satellite = require('satellite.js');
const { authenticateToken } = require('../auth');

const SATNOGS_BASE    = 'https://network.satnogs.org/api';
const SATNOGS_DB_BASE = 'https://db.satnogs.org/api';
const SATNOGS_TOKEN   = process.env.SATNOGS_API_TOKEN || '';

const axiosClient = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': 'UA-Aveiro-GroundStation/1.0' },
});

// Station 4518 (UA Aveiro) — same defaults as modules/satnogs-passes.js
const STATION = {
  latitude:  parseFloat(process.env.STATION_LAT) || 40.644,
  longitude: parseFloat(process.env.STATION_LON) || -8.645,
  altitude:  parseFloat(process.env.STATION_ALT) || 50, // meters
};

// Helper — normalise SatNOGS paginated or flat response into { stations, total }
function parseStationsResponse(data) {
  if (Array.isArray(data)) {
    return { stations: data, total: data.length };
  }
  const stations = data.results || [];
  const total = data.count ?? stations.length;
  return { stations, total };
}

// ── GET /api/satnogs/stations ─────────────────────────────────────────────────
// Fetches a single page of active/testing SatNOGS stations (limit=500).
// Returns { stations, total, returned, partial } so the frontend can show
// "Showing X of Y stations" without a slow multi-page crawl.
//
// Falls back to a smaller limit=100 request (no status filter) if the primary
// request times out or errors, so the map always shows something.
router.get('/stations', async (req, res) => {
  const PRIMARY  = `${SATNOGS_BASE}/stations/?format=json&limit=500&status=1`;
  const FALLBACK = `${SATNOGS_BASE}/stations/?format=json&limit=100`;

  // ── Primary request (30 s timeout) ────────────────────────────────────────
  try {
    const { data } = await axiosClient.get(PRIMARY, { timeout: 30000 });
    const { stations, total } = parseStationsResponse(data);

    return res.json({
      stations,
      total,
      returned: stations.length,
      partial: stations.length < total,
    });
  } catch (primaryErr) {
    console.warn('[SatNOGS Proxy] /stations primary failed, trying fallback:', primaryErr.message);
  }

  // ── Fallback request (15 s timeout) ───────────────────────────────────────
  try {
    const { data } = await axiosClient.get(FALLBACK, { timeout: 15000 });
    const { stations, total } = parseStationsResponse(data);

    return res.json({
      stations,
      total,
      returned: stations.length,
      partial: true,
    });
  } catch (fallbackErr) {
    console.error('[SatNOGS Proxy] /stations fallback also failed:', fallbackErr.message);
    return res.status(502).json({
      error: 'Failed to fetch stations from SatNOGS',
      detail: fallbackErr.message,
    });
  }
});

// ── GET /api/satnogs/observations ─────────────────────────────────────────────
// Proxies a single page of observations from network.satnogs.org.
// Accepts all query params (ground_station, limit, page, status, etc.) and
// forwards them to the SatNOGS API. Returns the SatNOGS response intact but
// rewrites the `next` pagination URL so it routes through this proxy.
router.get('/observations', async (req, res) => {
  try {
    // Forward all query params the frontend sends, always request JSON
    const params = new URLSearchParams({ format: 'json', ...req.query });

    const { data } = await axiosClient.get(
      `${SATNOGS_BASE}/observations/?${params.toString()}`
    );

    // Rewrite the `next` URL so pagination still goes through the proxy
    // instead of hitting network.satnogs.org directly (CORS).
    if (data && data.next) {
      try {
        const nextUrl = new URL(data.next);
        // Keep all the original query params, just change the host
        data.next = `/api/satnogs/observations?${nextUrl.searchParams.toString()}`;
      } catch {
        data.next = null;
      }
    }

    res.json(data);
  } catch (err) {
    console.error('[SatNOGS Proxy] /observations error:', err.message);
    res.status(502).json({ error: 'Failed to fetch observations from SatNOGS', detail: err.message });
  }
});

// ── GET /api/satnogs/jobs ─────────────────────────────────────────────────────
// Returns upcoming jobs calculated by SatNOGS for station 4518.
// These use server-side TLEs so times are guaranteed accurate.
router.get('/jobs', async (req, res) => {
  try {
    const params = new URLSearchParams({ format: 'json', ground_station: 4518, ...req.query });
    const { data } = await axiosClient.get(
      `${SATNOGS_BASE}/jobs/?${params.toString()}`
    );
    const jobs = Array.isArray(data) ? data : (data.results ?? []);
    res.json({ success: true, jobs, count: jobs.length });
  } catch (err) {
    console.error('[SatNOGS Proxy] /jobs error:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

// Samples a job's TLE between `start` and `end` to recover azimuth at AOS,
// LOS and culmination. network.satnogs.org's /jobs/ endpoint (the only real
// "upcoming passes" source it exposes — there is no public /passes endpoint)
// gives start/end/max_altitude but no azimuth, so it's derived locally here
// from the same TLE the job already carries.
function computePassGeometry(tle1, tle2, start, end) {
  const satrec = satellite.twoline2satrec(tle1, tle2);
  const observerGd = {
    longitude: STATION.longitude * (Math.PI / 180),
    latitude: STATION.latitude * (Math.PI / 180),
    height: STATION.altitude / 1000, // km
  };

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const stepMs = 2000;

  let aosAz = null, losAz = null, maxAz = null, maxEl = -Infinity;

  for (let t = startMs; t <= endMs; t += stepMs) {
    const time = new Date(t);
    const pv = satellite.propagate(satrec, time);
    if (!pv.position || typeof pv.position === 'boolean') continue;

    const gmst = satellite.gstime(time);
    const positionEcf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, positionEcf);
    const elevation = look.elevation * (180 / Math.PI);
    const azimuth   = look.azimuth   * (180 / Math.PI);

    if (aosAz === null) aosAz = azimuth;
    losAz = azimuth;
    if (elevation > maxEl) { maxEl = elevation; maxAz = azimuth; }
  }

  return { aos_az: aosAz, los_az: losAz, max_az: maxAz };
}

// ── GET /api/satnogs/network-passes ───────────────────────────────────────────
// Future passes for station 4518. Sourced from SatNOGS's own scheduled jobs
// (server-side TLEs, so times/elevation are accurate) filtered to the
// requested window, enriched with azimuth computed locally per job.
router.get('/network-passes', async (req, res) => {
  try {
    const hours = parseFloat(req.query.hours) || 24;
    const params = new URLSearchParams({ format: 'json', ground_station: 4518 });
    const { data } = await axiosClient.get(`${SATNOGS_BASE}/jobs/?${params.toString()}`);

    const now = Date.now();
    const horizon = now + hours * 60 * 60 * 1000;

    const passes = (Array.isArray(data) ? data : [])
      .filter(job => {
        const start = new Date(job.start).getTime();
        return start >= now && start <= horizon;
      })
      .map(job => ({
        satellite: (job.tle0 || '').replace(/^0\s+/, ''),
        norad_cat_id: job.norad_cat_id,
        aos: job.start,
        los: job.end,
        max_alt: job.max_altitude,
        transmitter_uuid: job.transmitter,
        ...computePassGeometry(job.tle1, job.tle2, job.start, job.end),
      }))
      .sort((a, b) => new Date(a.aos) - new Date(b.aos));

    res.json(passes);
  } catch (err) {
    console.error('[SatNOGS Proxy] /network-passes error:', err.message);
    res.status(502).json({ error: 'Failed to fetch passes from SatNOGS', detail: err.message });
  }
});

// ── GET /api/satnogs/all-passes ───────────────────────────────────────────────
// Calculates every pass over station 4518 from CelesTrak TLEs (the amateur
// group, ~800 sats) rather than relying on SatNOGS's own scheduled jobs —
// mirrors what the SatNOGS website itself does client-side. Two caches keep
// this affordable: the TLE set (1h) and the computed pass list per
// hours/min_el combination (5min), since a full run over ~800 sats can take
// a few seconds.
const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle';
const TLE_TTL = 3600000; // 1 hour
const PASSES_TTL = 300000; // 5 minutes

// Precise station 4518 coordinates (as given by SatNOGS's own station page) —
// deliberately separate from STATION above so this doesn't change the
// already-shipped /network-passes azimuths.
const ALL_PASSES_STATION = { latitude: 40.6331, longitude: -8.6595, altitude: 30 };

let tleCache = { data: null, timestamp: 0 };
const passesCache = new Map();

async function fetchTLEs() {
  if (tleCache.data && Date.now() - tleCache.timestamp < TLE_TTL) {
    return tleCache.data;
  }
  const resp = await axiosClient.get(CELESTRAK_URL, { timeout: 15000 });
  const lines = resp.data.trim().split('\n').map(l => l.trim());
  const sats = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    sats.push({ name: lines[i], tle1: lines[i + 1], tle2: lines[i + 2] });
  }
  tleCache = { data: sats, timestamp: Date.now() };
  return sats;
}

function calcAllPasses(tles, lat, lon, alt, hoursAhead, minEl) {
  const observer = {
    latitude: lat * Math.PI / 180,
    longitude: lon * Math.PI / 180,
    height: alt / 1000,
  };
  const now = Date.now();
  const end = now + hoursAhead * 3600000;
  const step = 30000; // 30 seconds
  const passes = [];

  for (const { name, tle1, tle2 } of tles) {
    let satrec;
    try { satrec = satellite.twoline2satrec(tle1, tle2); }
    catch { continue; }

    let inPass = false;
    let passData = null;

    for (let t = now; t <= end; t += step) {
      const date = new Date(t);
      const posVel = satellite.propagate(satrec, date);
      if (!posVel.position || typeof posVel.position === 'boolean') continue;

      const gmst = satellite.gstime(date);
      const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(posVel.position, gmst));
      const el = look.elevation * 180 / Math.PI;
      const az = look.azimuth * 180 / Math.PI;

      if (el >= minEl) {
        if (!inPass) {
          inPass = true;
          passData = {
            satellite: name, aos: date.toISOString(),
            aos_az: az, max_el: el, max_az: az,
            los: null, los_az: az,
          };
        } else {
          if (el > passData.max_el) {
            passData.max_el = el;
            passData.max_az = az;
          }
          passData.los = date.toISOString();
          passData.los_az = az;
        }
      } else if (inPass) {
        inPass = false;
        if (passData.los) passes.push(passData);
        passData = null;
      }
    }
    // Close out a pass still active at the end of the window
    if (inPass && passData?.los) passes.push(passData);
  }

  return passes.sort((a, b) => new Date(a.aos) - new Date(b.aos));
}

router.get('/all-passes', async (req, res) => {
  try {
    const hours = Math.min(Number(req.query.hours) || 24, 48);
    const minEl = Math.min(Number(req.query.min_el) || 10, 45);

    const cacheKey = `${hours}_${minEl}`;
    const cached = passesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PASSES_TTL) {
      return res.json({ count: cached.data.length, passes: cached.data });
    }

    const tles = await fetchTLEs();
    const passes = calcAllPasses(
      tles,
      ALL_PASSES_STATION.latitude, ALL_PASSES_STATION.longitude, ALL_PASSES_STATION.altitude,
      hours, minEl
    );
    passesCache.set(cacheKey, { data: passes, timestamp: Date.now() });

    res.json({ count: passes.length, passes });
  } catch (err) {
    console.error('[SatNOGS Proxy] /all-passes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/satnogs/transmitters ─────────────────────────────────────────────
// Proxies transmitter lookups from db.satnogs.org (has status/alive/mode fields).
// network.satnogs.org/transmitters only returns uuid+stats — wrong source.
router.get('/transmitters', async (req, res) => {
  try {
    const params = new URLSearchParams({ format: 'json', ...req.query });
    const { data } = await axiosClient.get(
      `${SATNOGS_DB_BASE}/transmitters/?${params.toString()}`
    );
    res.json(data);
  } catch (err) {
    console.error('[SatNOGS Proxy] /transmitters error:', err.message);
    res.status(502).json({ error: 'Failed to fetch transmitters from SatNOGS DB', detail: err.message });
  }
});

// Convert ISO 8601 ("2026-05-29T10:30:00Z") → "2026-05-29 10:30:00"
function toSatnogsDate(iso) {
  return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
}

// ── POST /api/satnogs/observations ────────────────────────────────────────────
// Creates a new observation on network.satnogs.org using the server-side token.
// Requires a valid dashboard JWT (Authorization: Bearer …): it spends the server's SatNOGS token.
router.post('/observations', authenticateToken, async (req, res) => {
  if (!SATNOGS_TOKEN) {
    return res.status(503).json({ error: 'SATNOGS_API_TOKEN not configured on server' });
  }
  try {
    const raw = Array.isArray(req.body) ? req.body[0] : req.body;

    const durationSecs = (new Date(raw.end) - new Date(raw.start)) / 1000;
    if (durationSecs < 200) {
      return res.status(400).json({ error: 'Pass too short to schedule (minimum 3 minutes)' });
    }

    const payload = [{
      ground_station:   raw.ground_station,
      transmitter_uuid: raw.transmitter_uuid ?? raw.transmitter,
      start:            toSatnogsDate(raw.start),
      end:              toSatnogsDate(raw.end),
    }];
    const { data, status } = await axiosClient.post(
      `${SATNOGS_BASE}/observations/`,
      payload,
      { headers: { Authorization: `Token ${SATNOGS_TOKEN}` } }
    );
    res.status(status).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const body   = err.response?.data  || { error: err.message };
    console.error('[SatNOGS Proxy] POST /observations error:', err.message);
    res.status(status).json(body);
  }
});

// ── GET /api/satnogs/observations (authenticated) ─────────────────────────────
// Re-export with auth so callers can filter by ground_station without CORS.
// Overrides the unauthenticated version above — place this AFTER it.
// Requires a valid dashboard JWT (Authorization: Bearer …): it uses the server's SatNOGS token.
router.get('/observations/auth', authenticateToken, async (req, res) => {
  if (!SATNOGS_TOKEN) {
    return res.status(503).json({ error: 'SATNOGS_API_TOKEN not configured on server' });
  }
  try {
    const params = new URLSearchParams({ format: 'json', ...req.query });
    const { data } = await axiosClient.get(
      `${SATNOGS_BASE}/observations/?${params.toString()}`,
      { headers: { Authorization: `Token ${SATNOGS_TOKEN}` } }
    );
    res.json(data);
  } catch (err) {
    console.error('[SatNOGS Proxy] /observations/auth error:', err.message);
    res.status(502).json({ error: 'Failed to fetch observations from SatNOGS', detail: err.message });
  }
});

module.exports = router;
