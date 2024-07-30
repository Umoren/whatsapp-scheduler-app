const fs = require('fs').promises;
const path = require('path');

async function checkSession() {
    const AUTH_DIR = '/app/.wwebjs_auth';
    const SESSION_DIR = path.join(AUTH_DIR, 'session', 'session-my-wwebjs-client');

    try {
        const files = await fs.readdir(SESSION_DIR);
        console.log('Session files:', files);

        for (const file of files) {
            if (file !== 'Default' && file !== 'DevToolsActivePort') {
                const stats = await fs.stat(path.join(SESSION_DIR, file));
                console.log(`${file}: Size ${stats.size} bytes, Last modified: ${stats.mtime}`);
            }
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

checkSession();