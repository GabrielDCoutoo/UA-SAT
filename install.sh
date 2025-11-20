#!/bin/bash

# ==========================================
# Ground Station Dashboard - Setup Automático
# ==========================================

set -e  # Exit on error

echo "🛰️ Ground Station Dashboard - Instalação Automática"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para imprimir com cor
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js não está instalado!"
    print_info "Instala Node.js: https://nodejs.org/"
    exit 1
fi

print_success "Node.js $(node --version) encontrado"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    print_error "npm não está instalado!"
    exit 1
fi

print_success "npm $(npm --version) encontrado"

# ==========================================
# 1. SETUP DO BACKEND
# ==========================================

echo ""
echo "📡 1. Configurando Backend..."
echo "----------------------------"



if [ ! -f "package.json" ]; then
    print_error "package.json não encontrado no diretório backend!"
    exit 1
fi

print_info "Instalando dependências do backend..."
npm install

# Criar .env se não existir
if [ ! -f ".env" ]; then
    print_warning ".env não encontrado. A criar a partir do exemplo..."
    cp .env.example .env
    print_info "Edita o ficheiro backend/.env com as tuas credenciais:"
    print_info "  - TINYGS_USER"
    print_info "  - TINYGS_PASS"
    print_info "  - SATNOGS_STATION_ID"
fi

print_success "Backend configurado!"



# ==========================================
# 2. SETUP DO FRONTEND
# ==========================================

echo ""
echo "⚛️  2. Configurando Frontend..."
echo "----------------------------"

if [ ! -f "package.json" ]; then
    print_error "package.json não encontrado na raiz do projeto!"
    exit 1
fi

print_info "Instalando dependências do frontend..."
npm install

# Instalar socket.io-client se ainda não estiver
print_info "Instalando socket.io-client..."
npm install socket.io-client

print_success "Frontend configurado!"

# ==========================================
# 3. VERIFICAR NODE-RED (OPCIONAL)
# ==========================================

echo ""
echo "🔴 3. Verificando Node-RED (opcional)..."
echo "----------------------------------------"

if command -v node-red &> /dev/null; then
    print_success "Node-RED $(node-red --version) já instalado"
    print_info "Flow disponível em: nodered/ground-station-flow.json"
else
    print_warning "Node-RED não encontrado"
    read -p "Queres instalar Node-RED? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Instalando Node-RED globalmente..."
        npm install -g --unsafe-perm node-red
        print_success "Node-RED instalado!"
    else
        print_info "A saltar instalação do Node-RED"
    fi
fi

# ==========================================
# 4. RESUMO E PRÓXIMOS PASSOS
# ==========================================

echo ""
echo "=================================================="
echo "🎉 Instalação Concluída!"
echo "=================================================="
echo ""
print_success "Tudo pronto para começar!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1️⃣  Configurar credenciais:"
echo "   cd backend && nano .env"
echo ""
echo "2️⃣  Iniciar o backend:"
echo "   cd backend && npm start"
echo "   (ou 'npm run dev' para modo desenvolvimento)"
echo ""
echo "3️⃣  Em outro terminal, iniciar o frontend:"
echo "   npm run dev"
echo ""
echo "4️⃣  (Opcional) Iniciar Node-RED:"
echo "   node-red"
echo "   Depois importa o flow de: nodered/ground-station-flow.json"
echo ""
echo "=================================================="
echo "🌐 URLs importantes:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   Node-RED:  http://localhost:1880"
echo "=================================================="
echo ""
print_info "📖 Consulta o SETUP_GUIDE.md para mais detalhes"
echo ""
print_success "Boa sorte com a dissertação! 🚀🛰️"