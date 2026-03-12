#!/usr/bin/env bash
set -euo pipefail

cp -n backend/.env.example backend/.env || true
cp -n .env.example .env || true

docker compose up --build
