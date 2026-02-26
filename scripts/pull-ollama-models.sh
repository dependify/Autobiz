#!/usr/bin/env bash
set -e

echo "Pulling Ollama models for Dependify..."

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

# Pull Llama 3.1 8B (primary local model)
echo "Pulling llama3.1:8b ..."
curl -s "${OLLAMA_URL}/api/pull" -d '{"name":"llama3.1:8b"}' | grep -o '"status":"[^"]*"' | tail -1

echo ""
echo "Models ready:"
curl -s "${OLLAMA_URL}/api/tags" | python3 -c "import sys,json; [print('  -', m['name']) for m in json.load(sys.stdin).get('models',[])]"
