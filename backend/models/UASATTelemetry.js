// models/UASATTelemetry.js - VERSÃO ATUALIZADA com campos específicos
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UASATTelemetry = sequelize.define('uasat_telemetry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // ============================================
    // SATELLITE IDENTIFICATION
    // ============================================
    sat_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      index: true,
      comment: 'Satellite ID (e.g., UASAT-1)'
    },

    sat_status: {
      type: DataTypes.ENUM('ok', 'not_ok'),
      allowNull: false,
      defaultValue: 'ok',
      comment: 'Satellite health status'
    },

    // ============================================
    // FRAME / GATEWAY
    // ============================================
    frame_type: {
      type: DataTypes.ENUM('frame0', 'frame1', 'retrans'),
      allowNull: true,
      comment: 'Telemetry frame type'
    },

    gateway_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Gateway node ID'
    },

    gateway_status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Gateway health status string'
    },

    sat_battery_pct: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Satellite battery percentage (retrans frame)'
    },

    gw_battery_raw: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Gateway raw battery ADC reading (gw_battery_raw field in retrans)'
    },

    gw_battery_pct: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Gateway battery percentage, float (e.g. 33.3)'
    },

    gw_nodes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Gateway sensor nodes [{id, status, value}] (retrans frame)'
    },

    // ============================================
    // BATTERY
    // ============================================
    battery_status: {
      type: DataTypes.ENUM('full', 'half_full', 'half_empty', 'empty'),
      comment: 'Battery level'
    },

    battery_voltage: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Battery voltage in V'
    },

    // ============================================
    // TELEMETRY
    // ============================================
    temperature: {
      type: DataTypes.INTEGER,
      comment: 'Temperature in °C (integer)'
    },

    humidity: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Humidity in %'
    },

    gas: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Gas sensor reading'
    },

    pressure: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Atmospheric pressure in hPa'
    },

    // GPS
    gps_latitude: {
      type: DataTypes.DECIMAL(10, 6),
      comment: 'GPS Latitude'
    },

    gps_longitude: {
      type: DataTypes.DECIMAL(10, 6),
      comment: 'GPS Longitude'
    },

    gps_altitude: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'GPS Altitude in meters'
    },

    // ============================================
    // IMU (3 EIXOS)
    // ============================================
    imu_accel_x: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Acceleration X axis (m/s²)'
    },

    imu_accel_y: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Acceleration Y axis (m/s²)'
    },

    imu_accel_z: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Acceleration Z axis (m/s²)'
    },

    imu_gyro_x: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Gyroscope X axis (deg/s)'
    },

    imu_gyro_y: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Gyroscope Y axis (deg/s)'
    },

    imu_gyro_z: {
      type: DataTypes.DECIMAL(9, 4),
      comment: 'IMU Gyroscope Z axis (deg/s)'
    },

    // ============================================
    // SENSORS
    // ============================================
    digital_nose: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Digital nose sensor reading'
    },

    spectrum_probe: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Spectrum probe reading (Bm/Hz)'
    },

    // ============================================
    // SIGNAL QUALITY
    // ============================================
    rssi: {
      type: DataTypes.DECIMAL(6, 2),
      comment: 'RSSI in dBm'
    },

    snr: {
      type: DataTypes.DECIMAL(6, 2),
      comment: 'SNR in dB'
    },

    // ============================================
    // METADATA
    // ============================================
    topic: {
      type: DataTypes.STRING(255),
      index: true,
      comment: 'MQTT topic'
    },

    payload: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Full JSONB payload (backup)'
    },

    raw_message: {
      type: DataTypes.TEXT,
      comment: 'Raw MQTT message'
    },

    telemetry_timestamp: {
      type: DataTypes.DATE,
      index: true,
      comment: 'Timestamp from satellite'
    },

    received_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      index: true,
      comment: 'Timestamp when received by ground station'
    }

  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['sat_id'] },
      { fields: ['sat_status'] },
      { fields: ['received_at'] },
      { fields: ['telemetry_timestamp'] },
      { 
        fields: ['payload'],
        
      }
    ]
  });

  // ============================================
  // CLASS METHODS
  // ============================================
  
  /**
   * Get latest telemetry for each satellite
   */
  UASATTelemetry.getLatestBySatellite = async function() {
    const results = await this.findAll({
      attributes: [
        'sat_id',
        [sequelize.fn('MAX', sequelize.col('received_at')), 'latest_time']
      ],
      group: ['sat_id']
    });
    
    const latest = [];
    for (const result of results) {
      const record = await this.findOne({
        where: {
          sat_id: result.sat_id,
          received_at: result.get('latest_time')
        }
      });
      if (record) latest.push(record);
    }
    
    return latest;
  };

  /**
   * Get statistics
   */
  UASATTelemetry.getStats = async function(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const total = await this.count({
      where: {
        received_at: { [sequelize.Sequelize.Op.gte]: since }
      }
    });

    const satellites = await this.count({
      distinct: true,
      col: 'sat_id',
      where: {
        received_at: { [sequelize.Sequelize.Op.gte]: since }
      }
    });

    const healthy = await this.count({
      where: {
        sat_status: 'ok',
        received_at: { [sequelize.Sequelize.Op.gte]: since }
      }
    });

    return {
      total_messages: total,
      active_satellites: satellites,
      healthy_satellites: healthy,
      messages_per_hour: parseFloat((total / hours).toFixed(1)),
      time_range_hours: hours
    };
  };

  return UASATTelemetry;
};
