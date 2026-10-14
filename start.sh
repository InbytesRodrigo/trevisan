#!/bin/bash
cd /workspace/backend && node server.js &
BACKEND_PID=$!
cd /workspace/frontend && npm run dev
trap "kill $BACKEND_PID" EXIT
