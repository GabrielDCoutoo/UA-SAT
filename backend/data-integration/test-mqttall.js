// test-mqtt-all.js - Testa TODAS as combinações
require('dotenv').config();

// tinygs-mqtt.js - Cliente MQTT estável e definitivo
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mqtt = require('mqtt');
const EventEmitter = require('events');
console.log('🔍 Testando credenciais MQTT TinyGS...\n');

// Mostrar o que está no .env
console.log('📋 Variáveis .env:');
console.log('  TINYGS_USER_PRIMARY:', process.env.TINYGS_USER_PRIMARY || 'NOT SET');
console.log('  TINYGS_PASS_PRIMARY:', process.env.TINYGS_PASS_PRIMARY ? '***' + process.env.TINYGS_PASS_PRIMARY.slice(-4) : 'NOT SET');
console.log('  TINYGS_USER_SECONDARY:', process.env.TINYGS_USER_SECONDARY || 'NOT SET');
console.log('  TINYGS_PASS_SECONDARY:', process.env.TINYGS_PASS_SECONDARY ? '***' + process.env.TINYGS_PASS_SECONDARY.slice(-4) : 'NOT SET');
console.log('');

const configs = [
  {
    name: 'SECONDARY (mqtts:8883)',
    broker: 'mqtts://mqtt.tinygs.com:8883',
    username: process.env.TINYGS_USER_SECONDARY,
    password: process.env.TINYGS_PASS_SECONDARY
  },
  {
    name: 'PRIMARY (mqtts:8883)',
    broker: 'mqtts://mqtt.tinygs.com:8883',
    username: process.env.TINYGS_USER_PRIMARY,
    password: process.env.TINYGS_PASS_PRIMARY
  },
  {
    name: 'SECONDARY (mqtt:1883)',
    broker: 'mqtt://mqtt.tinygs.com:1883',
    username: process.env.TINYGS_USER_SECONDARY,
    password: process.env.TINYGS_PASS_SECONDARY
  },
  {
    name: 'PRIMARY (mqtt:1883)',
    broker: 'mqtt://mqtt.tinygs.com:1883',
    username: process.env.TINYGS_USER_PRIMARY,
    password: process.env.TINYGS_PASS_PRIMARY
  }
];

let currentTest = 0;

function testNext() {
  if (currentTest >= configs.length) {
    console.log('\n❌ TODAS as combinações falharam!\n');
    console.log('💡 Possíveis soluções:');
    console.log('1. Verifica se tens conta ativa no https://tinygs.com');
    console.log('2. Gera credenciais MQTT específicas no painel web');
    console.log('3. Usa REST API com sessionToken (temporário mas funciona)');
    console.log('4. Desabilita TinyGS e foca no SatNOGS (que funciona 100%)');
    process.exit(1);
  }

  const config = configs[currentTest];
  
  if (!config.username || !config.password) {
    console.log(`⏭️  Teste ${currentTest + 1}: ${config.name} - SKIP (credenciais vazias)`);
    currentTest++;
    testNext();
    return;
  }

  console.log(`\n🧪 Teste ${currentTest + 1}/${configs.length}: ${config.name}`);
  console.log(`   📍 Broker: ${config.broker}`);
  console.log(`   👤 User: ${config.username}`);
  console.log(`   🔐 Pass: ***${config.password.slice(-4)}`);

  const client = mqtt.connect(config.broker, {
    username: config.username,
    password: config.password,
    clientId: `test-${Date.now()}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 0,
    rejectUnauthorized: false
  });

  let timeout = setTimeout(() => {
    console.log('   ⏱️  Timeout (10s)');
    client.end();
    currentTest++;
    testNext();
  }, 10000);

  client.on('connect', () => {
    clearTimeout(timeout);
    console.log('   ✅ CONECTADO COM SUCESSO!');
    console.log('\n🎉 Configuração funcional encontrada!');
    console.log('\n📋 Use no código:');
    console.log(`   broker: '${config.broker}'`);
    console.log(`   username: '${config.username}'`);
    console.log(`   password: '${config.password}'`);
    
    // Testar subscribe
    client.subscribe('tinygs/#', (err) => {
      if (!err) {
        console.log('\n✅ Subscribe bem-sucedido! Aguardando mensagens...');
        setTimeout(() => {
          console.log('\n✅ Tudo OK! Usa estas credenciais!');
          client.end();
          process.exit(0);
        }, 3000);
      } else {
        console.log('\n⚠️  Conectado mas subscribe falhou:', err.message);
        client.end();
        process.exit(0);
      }
    });
  });

  client.on('error', (err) => {
    clearTimeout(timeout);
    console.log(`   ❌ Erro: ${err.message}`);
    client.end();
    currentTest++;
    setTimeout(testNext, 1000);
  });
}

testNext();