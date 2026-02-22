#!/bin/bash
# J.O.C.A.S.T.A. Setup Script
# Run this to set up the entire stack

set -e

echo "🚀 J.O.C.A.S.T.A. Setup"
echo "======================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is required but not installed.${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✓ Docker found${NC}"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed.${NC}"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ is required. Found: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Start PostgreSQL
echo ""
echo "📦 Starting PostgreSQL..."
docker compose up -d postgres

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if server .env exists
if [ ! -f "apps/server/.env" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Creating server .env from example...${NC}"
    cp apps/server/.env.example apps/server/.env

    # Generate secrets
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)

    # Update .env with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|your-jwt-secret-here-replace-in-production|$JWT_SECRET|g" apps/server/.env
        sed -i '' "s|your-refresh-secret-here-replace-in-production|$JWT_REFRESH_SECRET|g" apps/server/.env
        sed -i '' "s|your-32-byte-encryption-key-here|$ENCRYPTION_KEY|g" apps/server/.env
    else
        sed -i "s|your-jwt-secret-here-replace-in-production|$JWT_SECRET|g" apps/server/.env
        sed -i "s|your-refresh-secret-here-replace-in-production|$JWT_REFRESH_SECRET|g" apps/server/.env
        sed -i "s|your-32-byte-encryption-key-here|$ENCRYPTION_KEY|g" apps/server/.env
    fi

    echo -e "${GREEN}✓ Server .env created with generated secrets${NC}"
    echo ""
    echo -e "${YELLOW}📝 IMPORTANT: Edit apps/server/.env to add:${NC}"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo "   - GOOGLE_MAPS_API_KEY (optional - enables real directions)"
    echo "   - OPENAI_API_KEY (optional - enables AI scheduling)"
    echo "   - TELEGRAM_BOT_TOKEN (optional - enables Telegram notifications)"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
cd apps/server
npx prisma generate

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Seed database
echo ""
echo "🌱 Seeding database..."
npx prisma db seed || echo "Seed may have already run"

cd ../..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start the app:"
echo ""
echo "  1. Start the server:"
echo "     cd apps/server && npm run dev"
echo ""
echo "  2. Start the client (in another terminal):"
echo "     cd apps/client && npm run web"
echo ""
echo "  Or use the quick start script:"
echo "     ./scripts/start.sh"
echo ""
echo "API will be at: http://localhost:3001"
echo "Web app will be at: http://localhost:8081"
echo "API docs: http://localhost:3001/api/docs"
