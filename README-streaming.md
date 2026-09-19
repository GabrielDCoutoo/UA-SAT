# Live Streaming HLS — Balão Estratosférico

## 1. Instalar Nginx com módulo RTMP (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install nginx libnginx-mod-rtmp
sudo mkdir -p /tmp/hls
```

## 2. Iniciar o Nginx com esta configuração

```bash
sudo nginx -c /caminho/para/nginx-rtmp.conf
# ou, se substituíres o nginx.conf do sistema:
sudo systemctl restart nginx
```

## 3. Publicar o stream do SDR via ffmpeg

```bash
ffmpeg -i [input_dvb] -c:v copy -c:a aac -f flv rtmp://localhost/live/balloon
```

Substitui `[input_dvb]` pelo device V4L2/DVB do teu SDR, por exemplo:
`-i /dev/video0` ou o output do pipeline GStreamer/SDRplay.

## 4. Testar localmente com ficheiro de vídeo

```bash
ffmpeg -re -i ficheiro_teste.mp4 -c copy -f flv rtmp://localhost/live/balloon
```

O flag `-re` lê o ficheiro à velocidade real (simula stream ao vivo).

## 5. Verificar

- RTMP recebe: `rtmp://localhost/live/balloon`
- HLS disponível em: `http://localhost:8080/live/balloon/index.m3u8`
- API backend: `GET http://localhost:3000/api/stream/status`
