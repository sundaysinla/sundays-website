#!/usr/bin/env bash
# Recreates the throwaway demo Postgres and loads the current Prisma schema.
# Safe to re-run: it only ever touches the sundays-live-demo-pg container.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=sundays-live-demo-pg

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=demo -e POSTGRES_USER=demo -e POSTGRES_DB=sundays_demo \
  -p 55433:5432 postgres:16-alpine >/dev/null

# The image runs a temporary server during init, then restarts; wait for the real one.
until docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete"; do sleep 0.5; done
until docker exec "$NAME" pg_isready -q -U demo -d sundays_demo; do sleep 0.5; done

npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  | grep -v '^◇' | docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U demo -d sundays_demo 2>&1 | grep -v 'already exists, skipping' || true
echo "demo database ready on 127.0.0.1:55433"
