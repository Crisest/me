#!/usr/bin/env bash
# Compares read-endpoint responses between the Mongo stack and the Postgres
# stack for the same user and month. Requires both servers running and a
# valid jwt cookie for each.
#
#   MONGO_URL=http://localhost:3001 PG_URL=http://localhost:3000 \
#   MONGO_JWT=... PG_JWT=... ./parity.sh 1 2026
set -euo pipefail
MONTH="${1:?month required}"
YEAR="${2:?year required}"

for path in \
  "/transactions?month=${MONTH}&year=${YEAR}" \
  "/transactions/insights?month=${MONTH}&year=${YEAR}" \
  "/budget/summary?month=${MONTH}&year=${YEAR}" \
  "/groups"
do
  echo "=== ${path} ==="
  curl -s -b "jwt=${MONGO_JWT}" "${MONGO_URL}${path}" | jq -S . > /tmp/mongo.json
  curl -s -b "jwt=${PG_JWT}"    "${PG_URL}${path}"    | jq -S . > /tmp/pg.json
  # ids legitimately differ; strip them before diffing.
  jq -S 'walk(if type == "object" then del(.id, .createdBy, .cardId, .accountId, .categoryId, .groupId) else . end)' \
     /tmp/mongo.json > /tmp/mongo.stripped.json
  jq -S 'walk(if type == "object" then del(.id, .createdBy, .cardId, .accountId, .categoryId, .groupId) else . end)' \
     /tmp/pg.json > /tmp/pg.stripped.json
  if diff -u /tmp/mongo.stripped.json /tmp/pg.stripped.json; then
    echo "PARITY OK"
  else
    echo "PARITY MISMATCH on ${path}"
    exit 1
  fi
done
echo "ALL ENDPOINTS MATCH"
