#!/usr/bin/env bash
set -e

echo "======================================================"
echo "  Dependify Business OS — Initial Setup"
echo "======================================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm required. Run: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker required. Install from https://docker.com"; exit 1; }

echo ""
echo "✓ Prerequisites checked"

# Copy env if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example — PLEASE EDIT WITH YOUR VALUES"
else
  echo "✓ .env already exists"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install

echo "✓ Dependencies installed"

# Start infrastructure
echo ""
echo "Starting infrastructure services (PostgreSQL, Redis, MinIO, Weaviate)..."
cd docker && docker-compose up -d postgres redis minio weaviate
cd ..

echo "Waiting for services to be ready..."
sleep 10

# Run database migrations
echo ""
echo "Running database migrations..."
pnpm db:push

echo "✓ Database schema pushed"

echo ""
echo "======================================================"
echo "  Setup Complete!"
echo "======================================================"
echo ""
echo "  Start development:"
echo "    pnpm dev"
echo ""
echo "  API:        http://localhost:4000"
echo "  Dashboard:  http://localhost:3000"
echo "  MinIO:      http://localhost:9001"
echo "  Weaviate:   http://localhost:8080"
echo ""
echo "  Don't forget to add your ANTHROPIC_API_KEY to .env!"
echo ""
