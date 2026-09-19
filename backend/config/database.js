// config/database.js
const { Sequelize } = require('sequelize');

// Sem valores por omissão: sem a variável, o servidor recusa arrancar
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não definido — define-o no .env antes de arrancar o servidor`);
  }
  return value;
}

const sequelize = new Sequelize(
  requireEnv('DB_NAME'),
  requireEnv('DB_USER'),
  requireEnv('DB_PASSWORD'),
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    
    define: {
      timestamps: true,
      underscored: true
    },
    
    timezone: '+00:00' // UTC
  }
);

// Test connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('[Database] ✅ Connection established successfully');
    return true;
  } catch (error) {
    console.error('[Database] ❌ Unable to connect:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection
};
