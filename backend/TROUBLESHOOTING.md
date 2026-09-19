# Resolução de problemas

## O servidor não arranca

| Mensagem | Causa e solução |
|---|---|
| `JWT_SECRET não definido` | Falta a variável no `.env`. Gera uma com `openssl rand -hex 32`. |
| `DB_NAME não definido` (ou `DB_USER`, `DB_PASSWORD`) | São obrigatórias, mesmo que a base não esteja acessível. Preenche-as no `.env`. |
| `EADDRINUSE` | A porta 3000 já está ocupada. Muda `PORT` no `.env` ou vê quem a usa: `ss -ltnp \| grep 3000`. |
| `TRUST_PROXY=true confia em qualquer X-Forwarded-For…` | Usa o número de proxies (`TRUST_PROXY=1`), não `true`. |

## Não consigo aceder ao backend a partir de outra máquina

Por omissão o Node só escuta em `127.0.0.1` (variável `HOST`). Em produção, o acesso externo faz-se por um proxy reverso (nginx). Se precisares de aceder diretamente de outra máquina, define `HOST=0.0.0.0` (e protege a porta com uma firewall).

## Base de dados

`[Database] ❌ Connection failed - running without database`: o servidor arrancou sem PostgreSQL. Confirma que o serviço está a correr, que a base existe e que `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` estão certos.

Sem base de dados, os pacotes TinyGS ficam só em memória, mas os endpoints de UASAT, UAV e GNSS respondem **500**. As tabelas são criadas ou alteradas no arranque; não é preciso criá-las à mão.

## Login e autenticação

| Sintoma | Causa |
|---|---|
| `401` no login com credenciais certas | Os utilizadores vêm de `DASHBOARD_USER_1/2` e `DASHBOARD_PASS_1/2`. Entradas sem valor são ignoradas; se estão vazias, ninguém consegue entrar. |
| `429 Demasiadas tentativas` | Cinco falhas por IP em 15 minutos. Espera, ou reinicia o servidor (o contador está em memória). |
| `429` para todos os visitantes atrás do nginx | Falta `TRUST_PROXY=1`: o servidor vê sempre o IP do proxy. |
| `401` `AUTH_REQUIRED` / `403` `AUTH_INVALID` | A ação exige sessão (agendar, apagar) e o token falta, é inválido ou expirou. O frontend abre o login sozinho. |

## SatNOGS

- `503 SATNOGS_API_TOKEN not configured on server`: define `SATNOGS_API_TOKEN` no `.env`. O token fica só no servidor.
- O polling só corre com `ENABLE_SATNOGS=true` e `SATNOGS_STATION_ID` definido.

## App GNSS

- `503`: falta `GNSS_API_KEY` no servidor.
- `401`: a app não envia o cabeçalho `X-Api-Key`, ou a chave é diferente.
- `400`: latitude ou longitude em falta, não numéricas ou fora do intervalo.

## TinyGS não liga (`connack timeout` ou sem dados)

1. Confirma as flags: `ENABLE_TINYGS=true` e `TINYGS_MQTT_ENABLED=true`.
2. O broker por omissão é `mqtts://mqtt.tinygs.com` na porta **8883**. Testa a ligação: `nc -zv mqtt.tinygs.com 8883`.
3. Confirma as credenciais com `node testmqtt.js` (usa `TINYGS_USER_PRIMARY` e `TINYGS_PASS_PRIMARY`).
4. A ligação MQTT usa `TINYGS_USER_SECONDARY`/`TINYGS_PASS_SECONDARY` se estiverem definidas, senão as principais.
5. Se usas o mesmo `.env` com o Docker Compose, uma password com o carácter `$` tem de ir entre aspas simples: o Compose interpreta o `$`.
6. Sem dados com a ligação estabelecida é normal: os satélites só transmitem quando passam. Consulta as passagens em https://tinygs.com/.
7. A recolha por browser (`TINYGS_PLAYWRIGHT_ENABLED=true`) precisa de `npx playwright install chromium`.

## O frontend não liga ao backend

- Confirma `VITE_API_URL` e `VITE_WS_URL` no `.env` do frontend (por omissão `http://localhost:3000`). Depois de os mudar, reinicia o `npm run dev`.
- Em produção, as variáveis `VITE_*` ficam embebidas no build: alterá-las obriga a fazer `npm run build` outra vez.
- O WebSocket só aceita a origem definida em `FRONTEND_URL` (por omissão `http://localhost:5173`). Se serves o dashboard de outro endereço, define-a no `.env` do backend.

## Docker Compose (Node-RED, InfluxDB, Grafana)

- `required variable … is missing a value`: define `INFLUXDB_INIT_PASSWORD` e `GRAFANA_ADMIN_PASSWORD` no `.env`, que fica na mesma pasta do `docker-compose.yml`.
- Avisos `The "…" variable is not set`: alguma password do `.env` tem o carácter `$`, que o Compose interpreta. Põe o valor entre aspas simples.
- O Grafana usa a porta 3001, para não colidir com o backend.
- O fluxo do Node-RED não é carregado sozinho: importa `nodered-flow-optimized.json` no editor (http://localhost:1880).
