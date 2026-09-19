// backend/data-integration/satnogs-client.js
const axios = require('axios');

class SatNOGSClient {
    constructor() {
    this.baseURL = process.env.SATNOGS_BASE_URL || 'https://network.satnogs.org/api';
    this.stationId = process.env.SATNOGS_STATION_ID || '4518';
    this.apiToken = process.env.SATNOGS_API_TOKEN;
    this.pollInterval = parseInt(process.env.SATNOGS_POLL_INTERVAL) || 60000;
    this.enabled = process.env.ENABLE_SATNOGS === 'true';
    }
  // GET: Station status
 async getStationStatus() {
  try {
    const response = await axios.get(
      `${this.baseURL}/stations/${this.stationId}/`
    );
    
    // ✅ Remover ou comentar o debug log (opcional):
    // console.log('[DEBUG] Station API response:', JSON.stringify(response.data, null, 2));
    
    return {
      id: response.data.id,
      name: response.data.name,
      status: response.data.status, // Online/Offline/Testing
      last_seen: response.data.last_seen,
      
      // Statistics
      observations: response.data.observations || 0,
      future_observations: response.data.future_observations || 0,
      success_rate: response.data.success_rate,
      
      // Location
      latitude: response.data.lat,
      longitude: response.data.lng,
      altitude: response.data.altitude,
      qthlocator: response.data.qthlocator,
      min_horizon: response.data.min_horizon,
      
      // Antennas
      antennas: response.data.antenna || [],
      
      // Metadata
      description: response.data.description,
      client_version: response.data.client_version,
      target_utilization: response.data.target_utilization,
      image: response.data.image,
      owner: response.data.owner,
      created: response.data.created
    };
  } catch (error) {
    console.error('SatNOGS API Error (station status):', error.message);
    return null;
  }
}

  // GET: Recent observations
  async getObservations(limit = 10, status = null) {
    try {
      let url = `${this.baseURL}/observations/?ground_station=${this.stationId}&limit=${limit}`;
      if (status) url += `&status=${status}`; // good, bad, failed, unknown
      
      const response = await axios.get(url);
      return response.data.map(obs => ({
        id: obs.id,
        start: obs.start,
        end: obs.end,
        satellite: {
          norad_id: obs.norad_cat_id,
          name: obs.norad_cat_id // Precisas fazer lookup separado para nome
        },
        transmitter: obs.transmitter,
        frequency: obs.transmitter_downlink_low,
        mode: obs.transmitter_mode,
        status: obs.vetted_status,
        waterfall: obs.waterfall,
        audio: obs.payload ? obs.payload : null,
        client_version: obs.client_version
      }));
    } catch (error) {
      console.error('SatNOGS API Error (observations):', error.message);
      return [];
    }
  }

  // GET: Scheduled jobs (próximas observações)
  async getScheduledJobs() {
    try {
      const response = await axios.get(
        `${this.baseURL}/jobs/?ground_station=${this.stationId}`
      );
      return response.data.map(job => ({
        id: job.id,
        start: job.start,
        end: job.end,
        satellite_id: job.norad_cat_id,
        frequency: job.frequency,
        mode: job.mode,
        transmitter: job.transmitter
      }));
    } catch (error) {
      console.error('SatNOGS API Error (jobs):', error.message);
      return [];
    }
  }

  // GET: Satellite TLE
  async getSatelliteTLE(norad_id) {
    try {
      const response = await axios.get(
        `${this.baseURL}/satellites/?norad_cat_id=${norad_id}`
      );
      if (response.data.length > 0) {
        const sat = response.data[0];
        return {
          norad_id: sat.norad_cat_id,
          name: sat.name,
          tle0: sat.name,
          tle1: sat.tle1,
          tle2: sat.tle2
        };
      }
      return null;
    } catch (error) {
      console.error('SatNOGS API Error (TLE):', error.message);
      return null;
    }
  }

  // Polling automático
  startPolling(callback) {
    this.pollingTimer = setInterval(async () => {
      const status = await this.getStationStatus();
      const observations = await this.getObservations(5, 'good');
      const jobs = await this.getScheduledJobs();
      
      callback({
        status,
        recent_observations: observations,
        scheduled_jobs: jobs,
        timestamp: new Date().toISOString()
      });
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  }
}

module.exports = SatNOGSClient;