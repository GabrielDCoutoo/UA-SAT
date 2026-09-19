require('dotenv').config();

// --- CONFIGURAÇÃO ---
const CONFIG = {
    CHANNEL_ID: '3236598',
    READ_API_KEY: process.env.THINGSPEAK_READ_API_KEY,
    INTERVALO_MS: 60000 // 60 segundos (1000ms * 60)
};

if (!CONFIG.READ_API_KEY) {
  console.error('THINGSPEAK_READ_API_KEY não definido — configura-o no .env');
  process.exit(1);
}

// URL de consulta
const url = `https://api.thingspeak.com/channels/${CONFIG.CHANNEL_ID}/feeds.json?api_key=${CONFIG.READ_API_KEY}&results=2`;

/**
 * Função principal que procura e processa os dados
 */
async function atualizarDados() {
    const agora = new Date().toLocaleTimeString();
    console.log(`[${agora}] A verificar novos dados...`);

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            const ultimo = data.feeds[0];

            // Mapeamento e conversão de dados
            const leitura = {
                data_hora: ultimo.created_at,
                temperatura: parseInt(ultimo.field3) || 0,
                sat_id: ultimo.field1 || "N/A",
                humidade: parseFloat(ultimo.field4) || 0,
                bateria: parseInt(ultimo.field2) || 0,
                pressao: parseFloat(ultimo.field5) || 0,
                latitude: parseFloat(ultimo.field7) || 0,
                longitude: parseFloat(ultimo.field6) || 0,
                imu: ultimo.field7 || "N/A"
            };

            exibirNoConsola(leitura);
            
            
        } else {
            console.warn("Atenção: Nenhum dado encontrado no canal.");
        }

    } catch (error) {
        console.error("Erro na ligação:", error.message);
    }
}

/**
 * Apenas para organizar o que aparece no terminal
 */
function exibirNoConsola(dados) {
    console.log("-----------------------------------------");
    console.log(`| Satélite ID: ${dados.sat_id}`);
    console.log(`| Temperatura: ${dados.temperatura}°C`);
    console.log(`| Humidade:    ${dados.humidade}%`);
    console.log(`| Bateria:     ${dados.bateria}%`);
    console.log(`| Timestamp:   ${dados.data_hora}`);
    console.log(`| IMU:         ${dados.imu} `);
    console.log(`| longitude: ${dados.longitude} `);
    console.log(`| pressão: ${dados.pressao} hPa `);
    console.log(`| latitude: ${dados.latitude} `);
    console.log("-----------------------------------------\n");
}


atualizarDados();

setInterval(atualizarDados, CONFIG.INTERVALO_MS);

console.log(`Monitorização iniciada. Intervalo: ${CONFIG.INTERVALO_MS / 1000}s`);