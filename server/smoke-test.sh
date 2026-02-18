#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Testing API at: $BASE_URL"

echo "\n1) POST /api/signup"
curl -sS -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@example.com"}' | cat

echo "\n\n2) POST /track"
curl -sS -X POST "$BASE_URL/track" \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","agent":"support","endpoint":"chat.completions","provider":"openai","cost":0.023}' | cat

echo "\n\n3) GET /health"
curl -sS "$BASE_URL/health" | cat

echo "\n\nSmoke test complete."
