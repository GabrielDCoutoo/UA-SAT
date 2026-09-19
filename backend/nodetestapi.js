const axios = require('axios');
require('dotenv').config();

async function testConnection() {
    const now = Date.now().toString();
    const encodedTimestamp = Buffer.from(now).toString('base64');
    
    console.log("🚀 A testar ligação com timestamp:", encodedTimestamp);

    try {
        const res = await axios.get('https://api.tinygs.com/v4/packets?limit=1', {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0',
                'sessionToken': process.env.TINYGS_SESSION_TOKEN,
                'userId': process.env.TINYGS_USER_ID,
                'x-client-timestamp': encodedTimestamp,
                'Origin': 'https://tinygs.com',
                'Referer': 'https://tinygs.com/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site'
            }
        });
        console.log("✅ SUCESSO! A API respondeu. Podes confiar no patch.");
        console.log("Número de pacotes recebidos:", res.data.packets?.length);
    } catch (err) {
        console.error("❌ FALHA NO TESTE.");
        if (err.code === 'ECONNABORTED') {
            console.error("Motivo: Timeout (Bloqueio de IP ou Handshake falhou)");
        } else {
            console.error("Motivo:", err.response?.status || err.message);
        }
    }
}

testConnection();