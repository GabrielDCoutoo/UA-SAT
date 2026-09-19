// models/SatNOGSObservation.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SatNOGSObservation = sequelize.define('satnogs_observations', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // SatNOGS IDs
    observation_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: false,
      index: true
    },
    
    // Satellite info
    satellite_name: {
      type: DataTypes.STRING(100),
      index: true
    },
    norad_id: {
      type: DataTypes.INTEGER
    },
    
    // Ground station info
    ground_station_id: {
      type: DataTypes.INTEGER,
      index: true
    },
    ground_station_name: {
      type: DataTypes.STRING(255)
    },
    
    // Observation timing
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      index: true
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    // RF configuration
    transmitter_uuid: {
      type: DataTypes.UUID
    },
    transmitter_description: {
      type: DataTypes.TEXT
    },
    transmitter_mode: {
      type: DataTypes.STRING(50)
    },
    transmitter_downlink_low: {
      type: DataTypes.BIGINT
    },
    transmitter_downlink_high: {
      type: DataTypes.BIGINT
    },
    
    // Quality
    vetted_status: {
      type: DataTypes.STRING(50)
    },
    vetted_user: {
      type: DataTypes.STRING(100)
    },
    
    // Data products
    waterfall_url: {
      type: DataTypes.TEXT
    },
    audio_url: {
      type: DataTypes.TEXT
    },
    
    // Raw data
    raw_data: {
      type: DataTypes.JSONB
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return SatNOGSObservation;
};
