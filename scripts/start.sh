#!/bin/bash
# J.O.C.A.S.T.A. Quick Start Script
# Starts both server and client

set -e

echo "🚀 Starting J.O.C.A.S.T.A."
echo "=========================="

# Check if PostgreSQL is running
if ! docker ps | grep -q jocasta-postgres; then
    echo "📦 Starting PostgreSQL..."
    docker compose up -d postgres
    sleep 3
fi

echo "✓ PostgreSQL running"

# Start server in background
echo "🖥️  Starting server..."
cd apps/server
npm run dev &
SERVER_PID=$!
cd ../..

# Wait for server to be ready
echo "⏳ Waiting for server..."
sleep 5

# Start client
echo "📱 Starting client..."
cd apps/client
npm run web &
CLIENT_PID=$!
cd ../..

echo ""
echo "✅ J.O.C.A.S.T.A. is running!"
echo ""
echo "   Server: http://localhost:3001"
echo "   API Docs: http://localhost:3001/api/docs"
echo "   Client: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
