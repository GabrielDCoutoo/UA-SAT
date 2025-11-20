require('dotenv').config();
const mqtt = require('mqtt');

console.log('🧪 Teste de Conexão TinyGS MQTT (SSL/TLS)\n');

const username = process.env.TINYGS_USER;
const password = process.env.TINYGS_PASS.replace(/^['"]|['"]$/g, '');

console.log('📋 Configurações:');
console.log('   Broker: mqtts://mqtt.tinygs.com:8883 (SSL/TLS)');
console.log('   Username:', username);
console.log('   Password length:', password.length);
console.log('');

const client = mqtt.connect('mqtts://mqtt.tinygs.com:8883', {
  username,
  password,
  reconnectPeriod: 0, // Desativar reconexão automática para teste
  connectTimeout: 30000,
  keepalive: 60,
  clean: true,
  clientId: `test_${username}_${Date.now()}`,
  rejectUnauthorized: false  // Aceitar certificado self-signed
});

let connected = false;

client.on('connect', () => {
  console.log('✅ SUCESSO! Conectado ao TinyGS MQTT via SSL/TLS');
  connected = true;
  
  const testTopics = [
    `tinygs/${username}/packets`,
    'tinygs/packets/#'
  ];
  
  console.log('\n📬 Testando subscrições:');
  testTopics.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.log(`   ❌ ${topic}: ERRO`);
      } else {
        console.log(`   ✅ ${topic}: OK`);
      }
    });
  });
  
  setTimeout(() => {
    console.log('\n✨ Teste concluído com sucesso!');
    console.log('🔐 Conexão SSL/TLS estabelecida com sucesso');
    client.end();
    process.exit(0);
  }, 2000);
});

client.on('error', (error) => {
  console.error('❌ ERRO:', error.message);
  if (error.code) {
    console.error('   Código:', error.code);
  }
});

client.on('close', () => {
  if (!connected) {
    console.log('\n❌ Falha na conexão');
  }
});

client.on('offline', () => {
  console.log('📴 Cliente offline');
});

// Timeout de segurança
setTimeout(() => {
  if (!connected) {
    console.log('\n⏱️  Timeout atingido - Conexão falhou');
    console.log('\n🔍 Possíveis problemas:');
    console.log('   1. Credenciais incorretas');
    console.log('   2. Firewall bloqueando porta 8883');
    console.log('   3. Broker TinyGS temporariamente indisponível');
    console.log('   4. Problema com certificado SSL');
    client.end(true);
    process.exit(1);
  }
}, 35000);