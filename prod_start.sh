#!/bin/bash
if [ ! -L /app/.wwebjs_auth/session ] && [ -d /app/.wwebjs_auth/session ]; then
  mv /app/.wwebjs_auth/session /app/.wwebjs_auth/old_session
fi
ln -sfn /app/.wwebjs_auth/persistent_session /app/.wwebjs_auth/session
node src/server.js