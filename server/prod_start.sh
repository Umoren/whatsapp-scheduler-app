#!/bin/bash

AUTH_DIR="/app/.wwebjs_auth"
PERSISTENT_DIR="${AUTH_DIR}/persistent_session"
SESSION_DIR="${AUTH_DIR}/session"

# Ensure persistent directory exists
mkdir -p "${PERSISTENT_DIR}"

# Remove existing symlink if it's broken
if [ -L "${SESSION_DIR}" ] && [ ! -e "${SESSION_DIR}" ]; then
    rm "${SESSION_DIR}"
fi

# Create symlink if it doesn't exist
if [ ! -e "${SESSION_DIR}" ]; then
    ln -sfn "${PERSISTENT_DIR}" "${SESSION_DIR}"
fi

# Log the current state
echo "Auth directory contents:"
ls -la "${AUTH_DIR}"
echo "Persistent directory contents:"
ls -la "${PERSISTENT_DIR}"
echo "Session symlink target:"
readlink -f "${SESSION_DIR}"

# Set environment variables
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0

# Log the environment variables
echo "Environment variables set:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOST: $HOST"

# Start the server and check if it's listening
node src/server.js &
SERVER_PID=$!

# Wait for a moment to allow the server to start
sleep 10

# Check if the server is listening on the correct port
if netstat -tuln | grep :3000 > /dev/null; then
    echo "Server is listening on port 3000"
else
    echo "Server failed to bind to port 3000"
    kill $SERVER_PID
    exit 1
fi

# Keep the script running
wait $SERVER_PID