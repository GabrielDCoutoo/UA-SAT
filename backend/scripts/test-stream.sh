#!/usr/bin/env bash

VIDEO=/tmp/test-video.mp4
RTMP_URL="rtmp://localhost/live/balloon"

# --- Verificar ffmpeg ---
if ! command -v ffmpeg &>/dev/null; then
  echo "❌ ffmpeg não encontrado. Instala com:"
  echo "   sudo apt install ffmpeg"
  exit 1
fi

# --- Download do vídeo de teste se não existir ---
if [ ! -f "$VIDEO" ]; then
  echo "📥 A descarregar Big Buck Bunny para $VIDEO ..."
  if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$VIDEO" \
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  elif command -v curl &>/dev/null; then
    curl -L --progress-bar -o "$VIDEO" \
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  else
    echo "❌ wget ou curl necessários para fazer o download."
    exit 1
  fi
  echo "✅ Vídeo descarregado."
fi

echo ""
echo "🎬 A publicar stream em loop para $RTMP_URL"
echo "   HLS disponível em: http://localhost:5173/uasat/balloon-live.m3u8"
echo "   Abre a aba 'Balloon Live Stream' no dashboard."
echo ""
echo "   Prima Ctrl+C para parar."
echo ""

while true; do
  ffmpeg -re -i "$VIDEO" \
    -c copy \
    -f flv "$RTMP_URL" \
    -loglevel warning
done
