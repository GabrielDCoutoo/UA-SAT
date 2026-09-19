// models/BalloonTelemetry.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BalloonTelemetry = sequelize.define('balloon_telemetry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Balloon identification
    balloon_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      index: true
    },
    mission_name: {
      type: DataTypes.STRING(100),
      defaultValue: 'BALAO-UA-2024'
    },
    
    // GPS data
    latitude: {
      type: DataTypes.DECIMAL(10, 6)
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 6)
    },
    altitude: {
      type: DataTypes.DECIMAL(10, 2) // meters
    },
    
    // Environmental sensors
    temperature: {
      type: DataTypes.DECIMAL(6, 2) // celsius
    },
    pressure: {
      type: DataTypes.DECIMAL(10, 2) // hPa
    },
    humidity: {
      type: DataTypes.DECIMAL(5, 2) // percentage
    },
    
    // System health
    battery_voltage: {
      type: DataTypes.DECIMAL(5, 2) // volts
    },
    solar_voltage: {
      type: DataTypes.DECIMAL(5, 2) // volts
    },
    
    // Motion data
    speed: {
      type: DataTypes.DECIMAL(8, 2) // km/h
    },
    heading: {
      type: DataTypes.DECIMAL(5, 2) // degrees
    },
    vertical_speed: {
      type: DataTypes.DECIMAL(8, 2) // m/s
    },
    
    // Raw packet reference
    tinygs_packet_id: {
      type: DataTypes.UUID,
      references: {
        model: 'tinygs_packets',
        key: 'id'
      },
      index: true
    },
    
    // Timestamps
    telemetry_timestamp: {
      type: DataTypes.DATE,
      index: true
    },
    received_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return BalloonTelemetry;
};
