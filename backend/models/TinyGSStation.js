// backend/models/TinyGSStation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database').sequelize;

const TinyGSStation = sequelize.define('TinyGSStation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  station_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  station_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'unknown' // online, offline, unknown
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  packet_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'tinygs_stations',
  timestamps: true,
  underscored: true
});

module.exports = TinyGSStation;
