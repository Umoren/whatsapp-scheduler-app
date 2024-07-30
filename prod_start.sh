#!/bin/bash
ln -s /app/.wwebjs_auth/persistent_session /app/.wwebjs_auth/session
node src/server.js