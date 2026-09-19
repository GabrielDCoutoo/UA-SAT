// test-all-topics.js - Testa subscrever a TUDO
require('dotenv').config();
const mqtt = require('mqtt');

console.log('🔍 Testing ALL TinyGS Topics\n');

const client = mqtt.connect('mqtts://mqtt.tinygs.com:8883', {
  username: process.env.TINYGS_USER_PRIMARY,
  password: process.env.TINYGS_PASS_PRIMARY,
  clean: true,
  keepalive: 60,
  reconnectPeriod: 5000,
  rejectUnauthorized: false
});

client.on('connect', () => {
  console.log('✅ Connected!\n');
  
  // Subscribe a LITERALMENTE TUDO
  client.subscribe('tinygs/#', { qos: 0 }, (err) => {
    if (err) {
      console.log('❌ Subscribe failed:', err.message);
    } else {
      console.log('✅ Subscribed to: tinygs/#');
      console.log('📡 Listening for ANY message on TinyGS...\n');
    }
  });
});

let messageCount = 0;
let topicsSeen = new Set();

client.on('message', (topic, message) => {
  messageCount++;
  topicsSeen.add(topic);
  
  console.log(`📦 Message #${messageCount}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Size: ${message.length} bytes`);
  
  try {
    const data = JSON.parse(message.toString());
    console.log(`   Data: ${JSON.stringify(data).substring(0, 100)}...`);
  } catch (e) {
    console.log(`   Data: [Non-JSON]`);
  }
  
  console.log('');
});

client.on('error', (err) => {
  console.error('❌ Error:', err.message);
});

// Stats a cada 30s
setInterval(() => {
  console.log('\n📊 ========== STATS ==========');
  console.log(`   Messages: ${messageCount}`);
  console.log(`   Unique topics: ${topicsSeen.size}`);
  
  if (topicsSeen.size > 0) {
    console.log('\n   Topics seen:');
    Array.from(topicsSeen).slice(0, 10).forEach(topic => {
      console.log(`      ${topic}`);
    });
  }
  
  console.log('==============================\n');
}, 30000);

// Shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  console.log(`\nFINAL: ${messageCount} messages, ${topicsSeen.size} unique topics`);
  client.end();
  process.exit(0);
});

console.log('💡 Waiting 60 seconds...');
console.log('💡 If you see NOTHING → Credentials have no read permissions!\n');