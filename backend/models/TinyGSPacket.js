// models/TinyGSPacket.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TinyGSPacket = sequelize.define('tinygs_packets', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Satellite info
    satellite_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      index: true
    },
    norad_id: {
      type: DataTypes.INTEGER
    },
    
    // Station info
    station_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      index: true
    },
    station_name: {
      type: DataTypes.STRING(255)
    },
    station_lat: {
      type: DataTypes.DECIMAL(10, 6)
    },
    station_lon: {
      type: DataTypes.DECIMAL(10, 6)
    },
    
    // RF data
    rssi: {
      type: DataTypes.DECIMAL(6, 2)
    },
    snr: {
      type: DataTypes.DECIMAL(6, 2)
    },
    frequency: {
      type: DataTypes.DOUBLE,  // ✅ CORRETO!
      allowNull: true,
      comment: 'Frequency in MHz (e.g., 437.16)'
    },
    
    // Packet data
    packet_data: {
      type: DataTypes.TEXT
    },
    parsed_data: {
      type: DataTypes.JSONB
    },
    crc_ok: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    // Flags
    is_my_station: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true
    },
    is_balloon: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true
    },
    
    // Timestamps
    packet_timestamp: {
      type: DataTypes.DATE
    },
    received_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      index: true
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['satellite_name'] },
      { fields: ['station_id'] },
      { fields: ['received_at'] },
      { fields: ['is_my_station'] },
      { fields: ['is_balloon'] }
    ]
  });

  return TinyGSPacket;
};
