const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GnssMeasurement = sequelize.define('GnssMeasurement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Measurement timestamp (from device or server)'
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
      comment: 'Latitude in decimal degrees'
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
      comment: 'Longitude in decimal degrees'
    },

    altitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Altitude in meters above WGS-84 ellipsoid'
    },

    accuracy: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Horizontal accuracy radius in meters'
    },

    speed: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Ground speed in m/s'
    },

    bearing: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Bearing in degrees (0-360)'
    },

    satellites_visible: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of satellites in view'
    },

    satellites_used: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of satellites used in fix'
    },

    satellites: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of satellite detail objects'
    },

    device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Identifier of the Android device'
    }

  }, {
    tableName: 'gnss_measurements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['timestamp'] },
      { fields: ['device_id'] },
      { fields: ['device_id', 'timestamp'] },
      { fields: ['created_at'] }
    ]
  });

  GnssMeasurement.getLatest = async function(deviceId) {
    const where = deviceId ? { device_id: deviceId } : {};
    return this.findOne({
      where,
      order: [['timestamp', 'DESC']]
    });
  };

  GnssMeasurement.getHistory = async function(limit = 100, deviceId) {
    const where = deviceId ? { device_id: deviceId } : {};
    return this.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: Math.min(limit, 1000)
    });
  };

  return GnssMeasurement;
};
