#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Testing API at: $BASE_URL"

echo "\n1) GET /api/health"
curl -sS "$BASE_URL/api/health" | cat

echo "\n\n2) POST /api/signup"
TEST_EMAIL="smoke-$(date +%s)@example.com"
curl -sS -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}" | cat

echo "\n\n3) GET /api/signups"
curl -sS "$BASE_URL/api/signups" | cat

echo "\n\nSmoke test complete."
