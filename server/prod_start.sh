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

# Start the server
node src/server.js