# Ground Station Dashboard

Plataforma de agregação de estação terrena multi-protocolo, desenvolvida no âmbito de uma dissertação de mestrado no DETI / Universidade de Aveiro.

Reúne num só dashboard, em tempo real, dados de várias fontes de telemetria de satélites e de balões: redes públicas (TinyGS, SatNOGS) e telemetria LoRa própria da estação.

## Arquitetura

```
 Fontes de dados                        Backend (Node.js)                       Frontend
 ───────────────                        ─────────────────                       ────────
 TinyGS  (MQTT / REST / Playwright) ─┐
 SatNOGS (API REST, polling)        ─┤   Express + Socket.io  ── HTTP/WS ──▶   React 19 + Vite
 Telemetria própria UASAT (MQTT)    ─┼─▶ Sequelize ─▶ PostgreSQL               (Tailwind, Leaflet,
 UAV backscatter (MQTT)             ─┤   (sem BD: só TinyGS em memória)           Recharts, hls.js)
 App GNSS Android (HTTP POST)       ─┤
 ThingSpeak (backup), stream HLS    ─┘
                                        Opcional: Node-RED ─▶ InfluxDB ─▶ Grafana
```

- **Backend** (`backend/`): Node.js + Express + Socket.io. Recolhe os dados, guarda-os em PostgreSQL (via Sequelize) e difunde-os por WebSocket. As fontes com ligação própria (TinyGS, SatNOGS, UASAT, UAV) são ativadas por variáveis de ambiente e vêm desligadas por omissão. Se a base de dados não estiver acessível, o servidor arranca na mesma: os pacotes TinyGS ficam só em memória, mas os endpoints de UASAT, UAV e GNSS precisam da base e respondem 500 sem ela.
- **Frontend** (`frontend/ground-station-dashboard/`): React 19 com Vite. Páginas para TinyGS (rede global, a minha estação, mapa de satélites), SatNOGS (observações, passagens, estações, agendamento), telemetria UASAT (balão, missão, gráficos), UAV backscatter, GNSS e backup de dados.
- **Infraestrutura opcional** (`backend/docker-compose.yml`): Node-RED, InfluxDB e Grafana. O fluxo `backend/nodered-flow-optimized.json` recebe pacotes TinyGS por MQTT e escreve em InfluxDB. O backend Node.js **não** escreve em InfluxDB.

## Como correr

O backend e o frontend correm **nativamente com npm, não em contentores**. O Docker Compose serve apenas a infraestrutura opcional (ver mais abaixo).

**Requisitos:** Node.js 18 ou superior (desenvolvido e testado com v22) e npm. Opcionais: PostgreSQL, Docker, Python 3 com `paho-mqtt` (simuladores).

### 1. Backend

```bash
git clone <url-do-repositório> && cd <pasta>
cd backend
cp .env.example .env      # preenche os valores (ver comentários no ficheiro)
npm install
npm start                 # ou: npm run dev (nodemon)
```

O servidor escuta na porta `3000` (`PORT`) e, por omissão, **só em `127.0.0.1`** (`HOST`): para o aceder de outra máquina define `HOST=0.0.0.0`. Confirma com `http://127.0.0.1:3000/api/health`. Para verificar e simular dados, ver [`backend/TESTING_GUIDE.md`](backend/TESTING_GUIDE.md); para problemas comuns, [`backend/TROUBLESHOOTING.md`](backend/TROUBLESHOOTING.md).

No `.env`, o mínimo para arrancar:

| Variável | Notas |
|---|---|
| `JWT_SECRET` | **Obrigatória.** Sem ela o servidor recusa arrancar. Gera uma com `openssl rand -hex 32`. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | **Obrigatórias** (`DB_HOST` e `DB_PORT` têm valor por omissão). Cria uma base PostgreSQL vazia: as tabelas são criadas no arranque. Sem a base, só os pacotes TinyGS funcionam (em memória). |

Tudo o resto é opcional. Para ligar as fontes externas, define a flag e as credenciais respetivas:

| Flag | Liga | Credenciais |
|---|---|---|
| `ENABLE_TINYGS`, `TINYGS_MQTT_ENABLED` | Pacotes TinyGS por MQTT | `TINYGS_USER_*`, `TINYGS_PASS_*` |
| `TINYGS_PLAYWRIGHT_ENABLED` | Recolha TinyGS por browser automatizado (requer `npx playwright install chromium`) | — |
| `ENABLE_SATNOGS` | Polling SatNOGS e agendamento de observações | `SATNOGS_STATION_ID`, `SATNOGS_API_TOKEN` |
| `ENABLE_UASAT` | Telemetria própria (LoRa) por MQTT | `UASAT_MQTT_*` |
| `ENABLE_UAV` | UAV backscatter por MQTT | `UAV_MQTT_*` |

### 2. Frontend

```bash
cd frontend/ground-station-dashboard
cp .env.example .env      # VITE_API_URL e VITE_WS_URL (por omissão http://localhost:3000)
npm install
npm run dev               # http://localhost:5173
```

Para produção: `npm run build` gera `dist/`, que tens de servir com um servidor web (por exemplo nginx). As variáveis `VITE_*` ficam embebidas no build, por isso não metas segredos nelas.

### 3. Infraestrutura opcional (Node-RED, InfluxDB, Grafana)

```bash
cd backend
# no .env, define INFLUXDB_INIT_PASSWORD e GRAFANA_ADMIN_PASSWORD (o Compose recusa arrancar sem elas)
docker compose up -d
```

| Serviço | URL |
|---|---|
| Node-RED | http://localhost:1880 |
| InfluxDB | http://localhost:8086 |
| Grafana | http://localhost:3001 |

O fluxo do Node-RED não é carregado automaticamente: importa `nodered-flow-optimized.json` no editor (menu → Import). Ele lê `TINYGS_USER_SECONDARY` e `TINYGS_PASS_SECONDARY` do ambiente do contentor.

### Em produção

O Node escuta só em `127.0.0.1` por omissão, por isso o acesso externo faz-se por um proxy reverso (por exemplo nginx) que encaminha para a porta 3000. Nesse caso define `TRUST_PROXY=1` no `.env`, senão o limite de tentativas de login não distingue os visitantes. Não definas `TRUST_PROXY` se o Node estiver exposto diretamente (`HOST=0.0.0.0`).

## API e autenticação

A leitura é pública por desenho. Só as ações de escrita exigem credenciais:

| Acesso | Rotas |
|---|---|
| **Público** (GET) | Dados de `/api/tinygs`, `/api/satnogs`, `/api/uasat`, `/api/uav-backscatter`, `/api/gnss`, `/api/dashboard`, `/api/thingspeak`, `/api/stream`; `/api/health`, `/api/config` |
| **JWT** (`Authorization: Bearer …`, obtido em `POST /api/login`) | `POST /api/satnogs/observations`, `GET /api/satnogs/observations/auth`, `POST /api/satnogs/schedule`, `DELETE /api/satnogs/scheduled/:id`, `POST` e `DELETE /api/uasat/telemetry`, `POST /api/uav-backscatter/telemetry`, `DELETE /api/uav-backscatter/cleanup` |
| **Chave de API** (`X-Api-Key`, variável `GNSS_API_KEY`) | `POST /api/gnss/measurement` (app Android) |

- Os utilizadores do login vêm de `DASHBOARD_USER_1/2` e `DASHBOARD_PASS_1/2`. Sem valor, ninguém consegue iniciar sessão.
- `POST /api/login` limita as falhas a 5 por 15 minutos por IP.
- O token da SatNOGS fica só no servidor: o frontend agenda observações através do proxy do backend.
- O WebSocket (Socket.io) difunde dados de leitura e aceita ligações sem token.

## Segredos e configuração

Nenhuma credencial está no código: tudo vem de variáveis de ambiente (`backend/.env`, ignorado pelo git). O `.env.example` deixa em branco os campos que dão acesso (`JWT_SECRET`, passwords do dashboard, `GNSS_API_KEY`, passwords do Docker), de modo que um clone sem os preencher falha em vez de ficar com valores conhecidos.

## Nota sobre o firmware

O firmware do gateway de receção LoRa (Heltec WiFi LoRa 32) não está incluído neste repositório, por conter lógica de descodificação específica da missão CorkSAT. Disponível mediante pedido à equipa da missão.

## Estado do projeto

Este código acompanha uma dissertação de mestrado e reflete o estado do sistema à data da entrega. Algumas limitações arquiteturais conhecidas estão documentadas na dissertação (Secção 6.5) e não foram necessariamente resolvidas aqui. Do lado do código:

- Não há testes automáticos; existem apenas scripts de simulação e de teste manual (`backend/scripts/`, `backend/mqtt_simulator.py`, `backend/testmqtt.js`).
- O esquema da base de dados é sincronizado no arranque (`sequelize.sync({ alter: true })`) em vez de migrações.
- O login é simples (utilizadores em variáveis de ambiente) e o próprio código o marca como temporário.
- Os identificadores da estação SatNOGS (`4518`) e TinyGS estão fixos em páginas do frontend.
- O limite de tentativas de login vive em memória e reinicia com o servidor.
- `GET /api/stream/status` não verifica o stream real: só devolve `live` com `STREAM_MOCK=true`. A variável `MOCK_DATA` apenas é refletida em `GET /api/config`.

## Licença

[MIT](LICENSE) © 2026 Gabriel Couto.

## Citação

Se usares este trabalho, por favor cita: [referência da dissertação]
