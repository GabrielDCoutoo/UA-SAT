// models/index.js
const { sequelize } = require('../config/database');

// Import model definitions
const TinyGSPacketModel = require('./TinyGSPacket');
const SatNOGSObservationModel = require('./SatNOGSObservation');
const BalloonTelemetryModel = require('./BalloonTelemetry');
const UASATTelemetryModel = require('./UASATTelemetry');
const UAVBackscatterModel = require('./uav-backscatter');
const GnssMeasurementModel = require('./GnssMeasurement');
// Initialize models
const TinyGSPacket = TinyGSPacketModel(sequelize);
const SatNOGSObservation = SatNOGSObservationModel(sequelize);
const BalloonTelemetry = BalloonTelemetryModel(sequelize);
const UASATTelemetry = UASATTelemetryModel(sequelize);
const UAVBackscatter = UAVBackscatterModel(sequelize);
const GnssMeasurement = GnssMeasurementModel(sequelize);
// Define relationships
BalloonTelemetry.belongsTo(TinyGSPacket, {
  foreignKey: 'tinygs_packet_id',
  as: 'packet'
});

TinyGSPacket.hasMany(BalloonTelemetry, {
  foreignKey: 'tinygs_packet_id',
  as: 'balloon_data'
});

// Sync function
async function syncDatabase(options = {}) {
  try {
    await sequelize.sync(options);
    console.log('[Database] ✅ Models synced successfully');
    return true;
  } catch (error) {
    console.error('[Database] ❌ Model sync failed:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  TinyGSPacket,
  SatNOGSObservation,
  BalloonTelemetry,
  UASATTelemetry,
  UAVBackscatter,
  GnssMeasurement,
  syncDatabase
};
