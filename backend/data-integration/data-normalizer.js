
class DataNormalizer {
  /**
   * Normaliza dados do TinyGS MQTT
   * @param {Object} raw - Dados brutos do TinyGS
   * @param {Object} metadata - Metadata adicional (isMyStation, isMyBalloon)
   * @returns {Object} Dados normalizados
   */
  normalizeTinyGS(raw, metadata = {}) {
    try {
      return {
        source: 'tinygs',
        type: 'telemetry',
        timestamp: raw.timestamp || new Date().toISOString(),
        
        // Satellite info
        satellite: {
          name: raw.satellite || raw.sat || raw.norad_id || 'UNKNOWN',
          norad_id: raw.norad_id || null
        },
        
        // Station info
        station: {
          id: raw.station || raw.groundstation || raw.client || 'UNKNOWN',
          name: raw.station_name || null,
          isMyStation: metadata.isMyStation || false
        },
        
        // RF metrics
        rf: {
          rssi: raw.rssi !== undefined ? parseFloat(raw.rssi) : null,
          snr: raw.snr !== undefined ? parseFloat(raw.snr) : null,
          frequency: raw.frequency || raw.freq || null
        },
        
        // Packet data
        packet: {
          data: raw.data || raw.payload || null,
          parsed: raw.parsed || null,
          crc_ok: raw.crc_ok !== undefined ? raw.crc_ok : null
        },
        
        // Metadata
        metadata: {
          isMyBalloon: metadata.isMyBalloon || false,
          raw: raw // Guardar dados originais
        }
      };
    } catch (error) {
      console.error('[Normalizer] Error normalizing TinyGS data:', error.message);
      return null;
    }
  }

  /**
   * Normaliza dados do SatNOGS Network API
   * @param {Object} satnogs_data - Dados do SatNOGS
   * @returns {Object|null} Dados normalizados ou null se inválido
   */
  normalizeSatNOGS(satnogs_data) {
    if (!satnogs_data) return null;

    try {
      // 1. STATION STATUS
      if (satnogs_data.status) {
        return this._normalizeSatNOGSStatus(satnogs_data);
      }

      // 2. OBSERVATIONS (recent)
      if (satnogs_data.recent_observations) {
        return this._normalizeSatNOGSObservations(satnogs_data);
      }

      // 3. SCHEDULED JOBS (future passes)
      if (satnogs_data.scheduled_jobs) {
        return this._normalizeSatNOGSJobs(satnogs_data);
      }

      console.warn('[Normalizer] Unknown SatNOGS data type');
      return null;

    } catch (error) {
      console.error('[Normalizer] Error normalizing SatNOGS data:', error.message);
      return null;
    }
  }

  /**
   * Normaliza Station Status do SatNOGS
   * @private
   */
  _normalizeSatNOGSStatus(satnogs_data) {
  const status = satnogs_data.status;
  
  return {
    source: 'satnogs',
    type: 'station_status',
    timestamp: satnogs_data.timestamp || new Date().toISOString(),
    
    // Station identification
    station_id: status.id,
    station_name: status.name,
    owner: status.owner,
    
    // Status
    online: status.status === 'Online',
    status_text: status.status,
    last_seen: status.last_seen,
    
    // Location
    location: {
      latitude: status.latitude,
      longitude: status.longitude,
      altitude: status.altitude,
      qth_locator: status.qthlocator // ✅ Já vem da API!
    },
    
    // Configuration
    config: {
      min_horizon: status.min_horizon,
      target_utilization: status.target_utilization,
      description: status.description
    },
    
    // Antennas
    antennas: status.antennas.map(ant => ({
      band: ant.band,
      type: ant.antenna_type_name,
      frequency_min: ant.frequency / 1e6, // Convert to MHz
      frequency_max: ant.frequency_max / 1e6
    })),
    
    // Statistics
    statistics: {
      total_observations: status.observations,
      future_observations: status.future_observations,
      success_rate: status.success_rate
    },
    
    // Metadata
    metadata: {
      client_version: status.client_version,
      image: status.image,
      created: status.created,
      last_updated: satnogs_data.timestamp
    }
  };
}

  /**
   * Normaliza Observations do SatNOGS
   * @private
   */
  _normalizeSatNOGSObservations(satnogs_data) {
    return {
      source: 'satnogs',
      type: 'observations',
      timestamp: satnogs_data.timestamp || new Date().toISOString(),
      count: satnogs_data.recent_observations.length,
      
      data: satnogs_data.recent_observations.map(obs => ({
        // Observation ID
        id: obs.id,
        
        // Timing
        start_time: obs.start,
        end_time: obs.end,
        duration: this._calculateDuration(obs.start, obs.end),
        
        // Satellite
        satellite: {
          name: obs.satellite.name || `NORAD ${obs.satellite.norad_id}`,
          norad_id: obs.satellite.norad_id
        },
        
        // RF Configuration
        rf: {
          frequency: obs.frequency,
          mode: obs.mode,
          transmitter: obs.transmitter
        },
        
        // Quality metrics
        quality: {
          status: obs.status, // good, bad, failed, unknown
          vetted: obs.vetted || false
        },
        
        // Data products
        products: {
          waterfall: obs.waterfall || null,
          audio: obs.audio || null,
          data: obs.data || null
        },
        
        // Metadata
        metadata: {
          client_version: obs.client_version || null,
          ground_station: obs.ground_station || null
        }
      }))
    };
  }

  /**
   * Normaliza Scheduled Jobs do SatNOGS
   * @private
   */
  _normalizeSatNOGSJobs(satnogs_data) {
    return {
      source: 'satnogs',
      type: 'scheduled_passes',
      timestamp: satnogs_data.timestamp || new Date().toISOString(),
      count: satnogs_data.scheduled_jobs.length,
      
      passes: satnogs_data.scheduled_jobs.map(job => ({
        // Job identification
        id: job.id,
        
        // Timing
        start: job.start,
        end: job.end,
        duration: this._calculateDuration(job.start, job.end),
        countdown: this._calculateCountdown(job.start),
        
        // Satellite
        satellite: {
          norad_id: job.satellite_id,
          name: null // Precisa lookup separado
        },
        
        // RF Configuration
        rf: {
          frequency: job.frequency,
          mode: job.mode,
          transmitter: job.transmitter
        },
        
        // Pass prediction (se disponível)
        pass: {
          max_elevation: job.max_elevation || null,
          aos_azimuth: job.aos_azimuth || null,
          los_azimuth: job.los_azimuth || null
        }
      }))
    };
  }

  /**
   * Calcula QTH Locator (Maidenhead)
   * @private
   */
  _calculateQTHLocator(lat, lon) {
    if (lat === null || lon === null) return null;
    
    // Simplified Maidenhead calculation (4 characters)
    const A = 'ABCDEFGHIJKLMNOPQR'.charCodeAt(0);
    
    const adjLon = lon + 180;
    const adjLat = lat + 90;
    
    const lonField = String.fromCharCode(A + Math.floor(adjLon / 20));
    const latField = String.fromCharCode(A + Math.floor(adjLat / 10));
    
    const lonSquare = Math.floor((adjLon % 20) / 2);
    const latSquare = Math.floor(adjLat % 10);
    
    return `${lonField}${latField}${lonSquare}${latSquare}`;
  }

  /**
   * Calcula duração entre duas timestamps
   * @private
   */
  _calculateDuration(start, end) {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const durationMs = endDate - startDate;
      
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      
      return {
        milliseconds: durationMs,
        seconds: Math.floor(durationMs / 1000),
        formatted: `${minutes}m ${seconds}s`
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calcula countdown até evento futuro
   * @private
   */
  _calculateCountdown(targetTime) {
    try {
      const now = new Date();
      const target = new Date(targetTime);
      const diffMs = target - now;
      
      if (diffMs <= 0) {
        return {
          milliseconds: 0,
          expired: true,
          formatted: 'Started'
        };
      }
      
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      
      return {
        milliseconds: diffMs,
        expired: false,
        formatted: hours > 0 
          ? `${hours}h ${minutes}m ${seconds}s`
          : `${minutes}m ${seconds}s`
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Valida dados normalizados
   * @param {Object} normalized - Dados normalizados
   * @returns {boolean} true se válido
   */
  validate(normalized) {
    if (!normalized) return false;
    if (!normalized.source) return false;
    if (!normalized.type) return false;
    if (!normalized.timestamp) return false;
    
    return true;
  }

  /**
   * Combina múltiplas fontes de dados
   * @param {Array} dataArray - Array de dados normalizados de várias fontes
   * @returns {Object} Dados combinados
   */
  combineMultipleSources(dataArray) {
    return {
      timestamp: new Date().toISOString(),
      sources: dataArray.map(d => d.source),
      combined_data: dataArray,
      count: dataArray.length
    };
  }
}

module.exports = DataNormalizer;