#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  POSTGRES_DB="${POSTGRES_DB:-byos_db}"
  export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
fi

if [ -z "${DATABASE_URL:-}" ] && [ "${AUTH_ENABLED:-true}" != "false" ]; then
  echo "DATABASE_URL is required when AUTH_ENABLED is not false" >&2
  exit 1
fi

exec "$@"
