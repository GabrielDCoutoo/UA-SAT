# Guia de testes e verificação

O projeto **não tem testes automáticos**. Este guia mostra como verificar à mão que o backend e o frontend estão a funcionar, e como simular dados sem hardware. Os comandos do backend correm a partir de `backend/`.

## 1. O backend está de pé?

```bash
npm start
curl http://127.0.0.1:3000/api/health
```

Resposta (resumida):

```json
{
  "status": "ok",
  "timestamp": "…",
  "database":  { "connected": true, "type": "PostgreSQL" },
  "tinygs":    { "enabled": false, "mqtt": { "enabled": false, "connected": false, "packetsReceived": 0 },
                 "rest": { … }, "playwright": { … } },
  "satnogs":   { "enabled": false, "stationId": "…", "polling": false }
}
```

No arranque, o log mostra `🚀 Ground Station Backend started!` e, a seguir, `[Database] ✅ Ready` ou `[Database] ❌ Connection failed - running without database`.

Por omissão o servidor só escuta em `127.0.0.1` (variável `HOST`), por isso o `curl` tem de correr na mesma máquina.

## 2. Leitura pública

```bash
curl http://127.0.0.1:3000/api/config          # estação, balão e estado das fontes
curl http://127.0.0.1:3000/api/stream/status
curl http://127.0.0.1:3000/api/tinygs/map
```

Sem PostgreSQL ligado, estas respondem 200. Os endpoints que leem ou gravam na base de dados (`/api/uasat/*`, `/api/gnss/*`, `/api/uav-backscatter/*`) respondem **500**: para os testar precisas da base configurada (`DB_*`).

## 3. Autenticação (JWT)

Só é preciso para as ações de escrita. Requer `DASHBOARD_USER_1` e `DASHBOARD_PASS_1` (ou `_2`) no `.env`.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<o teu utilizador>","password":"<a tua password>"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3000/api/protected   # 200
curl http://127.0.0.1:3000/api/protected                                     # 401 {"code":"AUTH_REQUIRED"}
```

Cinco falhas de login por IP em 15 minutos dão `429`.

## 4. App GNSS

```bash
curl -X POST http://127.0.0.1:3000/api/gnss/measurement \
  -H 'Content-Type: application/json' -H "X-Api-Key: $GNSS_API_KEY" \
  -d '{"latitude": 40.64, "longitude": -8.65}'
```

Grava uma medição **real** na base de dados. Sem chave, ou com chave errada, responde 401. Sem `GNSS_API_KEY` configurada no servidor, 503. Latitude fora de [-90, 90] ou longitude fora de [-180, 180] dão 400.

## 5. WebSocket

O Socket.io está na mesma porta. Para ver o que o backend difunde:

```bash
node -e "const io=require('socket.io-client')('http://127.0.0.1:3000');
io.on('connect',()=>console.log('ligado'));
io.onAny((e,d)=>console.log(e,JSON.stringify(d).slice(0,120)))"
```

Eventos emitidos: `satellite-data`, `satnogs:data`, `satnogs:history`, `balloon-data`, `uasat:telemetry`, `uav:telemetry`, `gnss:measurement` e `heartbeat` (de 30 em 30 segundos). O frontend liga-se ao endereço definido em `VITE_WS_URL`.

## 6. Simular dados sem hardware

| Para testar | Como |
|---|---|
| Telemetria UASAT | Precisa de um broker MQTT local (mosquitto) em `mqtt://localhost:1883`. No `.env`: `ENABLE_UASAT=true` e `UASAT_MQTT_BROKER=mqtt://localhost:1883`. Depois `node scripts/simulate-uasat-local.js` (frame0, frame1 e retrans falsos). |
| UAV backscatter | Com `ENABLE_UAV=true` e `UAV_MQTT_BROKER`/`UAV_MQTT_TOPIC` definidos, `node scripts/simulate-backscatter.js` publica leituras falsas em `uav/backscatter/<tag>` de 2 em 2 segundos. |
| Vários satélites | `python3 mqtt_simulator.py` simula 12 satélites. Precisa de `paho-mqtt` e das variáveis `MQTT_BROKER_HOST`, `MQTT_BROKER_USER` e `MQTT_BROKER_PASS`. |
| Stream do balão | `bash scripts/test-stream.sh` descarrega um vídeo de exemplo (Big Buck Bunny) para `/tmp` e envia-o para `rtmp://localhost/live/balloon`. Precisa de `ffmpeg`, de acesso à internet e do nginx com módulo RTMP (`nginx-rtmp.conf`, na raiz do repositório). |
| Pacotes TinyGS reais | `node testmqtt.js` subscreve `tinygs/#` com `TINYGS_USER_PRIMARY`/`TINYGS_PASS_PRIMARY` e imprime o que chega. Usa-o para confirmar que as credenciais e a ligação ao broker funcionam. |

## 7. Frontend

```bash
cd ../frontend/ground-station-dashboard
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run lint
```

O `npm run lint` tem erros e avisos conhecidos (variáveis sem uso, sobretudo) que não impedem o build.
