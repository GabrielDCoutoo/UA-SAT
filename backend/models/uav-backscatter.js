// models/uav-backscatter.js - Database model for UAV Backscatter telemetry
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UAVBackscatter = sequelize.define('UAVBackscatter', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Tag identification
    tag_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Tag identifier (Tag-1, Tag-2, etc)'
    },
    
    // UAV identification
    uav_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'UAV/Drone identifier that read the tag'
    },
    
    // Sensor data
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Temperature in Celsius'
    },
    
    // GPS Location (IT Aveiro - fixed)
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'GPS latitude'
    },
    
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'GPS longitude'
    },
    
    altitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Altitude in meters'
    },
    
    // Signal quality
    rssi: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Received Signal Strength Indicator (dBm)'
    },
    
    snr: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Signal-to-Noise Ratio (dB)'
    },
    
    // Frequency
    frequency: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Communication frequency in GHz'
    },
    
    // Status
    status: {
      type: DataTypes.ENUM('ok', 'warning', 'error'),
      defaultValue: 'ok',
      comment: 'Tag status'
    },
    
    // Timestamps
    received_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp when data was received'
    }
  }, {
    tableName: 'uav_backscatter',
    timestamps: true,
    indexes: [
      {
        fields: ['tag_id']
      },
      {
        fields: ['uav_id']
      },
      {
        fields: ['received_at']
      },
      {
        fields: ['tag_id', 'received_at']
      }
    ]
  });

  // Static methods
  UAVBackscatter.getLatestByTag = async function() {
    const tags = await this.findAll({
      attributes: [
        'tag_id',
        [sequelize.fn('MAX', sequelize.col('received_at')), 'latest_time']
      ],
      group: ['tag_id']
    });

    const latest = await Promise.all(
      tags.map(tag => 
        this.findOne({
          where: {
            tag_id: tag.tag_id,
            received_at: tag.dataValues.latest_time
          }
        })
      )
    );

    return latest.filter(Boolean);
  };

  UAVBackscatter.getStats = async function(hours = 24) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const total = await this.count({
      where: {
        received_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        }
      }
    });

    const activeTags = await this.count({
      distinct: true,
      col: 'tag_id',
      where: {
        received_at: {
          [sequelize.Sequelize.Op.gte]: cutoffDate
        }
      }
    });

    const messagesPerHour = total / hours;

    return {
      total_messages: total,
      active_tags: activeTags,
      messages_per_hour: parseFloat(messagesPerHour.toFixed(1))
    };
  };

  return UAVBackscatter;
};
