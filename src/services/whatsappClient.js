const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const config = require('../config');
const qrcode = require('qrcode')
const fs = require('fs').promises;

const MAX_RETRIES = 5;
const RETRY_DELAY = 10000;


let qrImageData = '';
let isLoading = true;

async function ensureDirectoryExists(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

async function logAuthDir() {
    const AUTH_DIR = '/app/.wwebjs_auth';
    try {
        await ensureDirectoryExists(AUTH_DIR);
        const files = await fs.readdir(AUTH_DIR);
        console.log('Contents of .wwebjs_auth:', files);
        for (const file of files) {
            const filePath = path.join(AUTH_DIR, file);
            const stat = await fs.lstat(filePath);
            console.log(`${file} is ${stat.isSymbolicLink() ? 'symlink' : 'directory'}`);
            if (file === 'session' || file === 'persistent_session') {
                try {
                    const subfiles = await fs.readdir(filePath);
                    console.log(`Contents of ${file}:`, subfiles);
                } catch (error) {
                    console.error(`Error reading ${file}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('Error reading auth directories:', error);
    }
}



const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'my-wwebjs-client',
        dataPath: '/app/.wwebjs_auth/session',
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
            '--single-process', '--disable-gpu']
    }
});

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    try {
        qrImageData = await qrcode.toDataURL(qr);
        isLoading = false;
    } catch (error) {
        console.error('Failed to generate QR code:', error);
    }
});
client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected', reason);
});

async function initializeWithRetry() {
    await logAuthDir();
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Attempt ${i + 1} to initialize client...`);
            await ensureDirectoryExists('/app/.wwebjs_auth/session');
            await client.initialize();
            console.log('Client initialized successfully');
            return;
        } catch (error) {
            console.error(`Failed to initialize client (attempt ${i + 1}):`, error);
            if (i < MAX_RETRIES - 1) {
                console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    throw new Error('Failed to initialize client after multiple attempts');
}

module.exports = {
    client,
    initializeWithRetry,
    getQRImageData: () => qrImageData,
    isQRLoading: () => isLoading
};

