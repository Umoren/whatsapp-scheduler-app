const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const MAX_RETRIES = 5;
const RETRY_DELAY = 10000; // 10 seconds

let qrImageData = '';
let isLoading = true;
let isAuthenticated = false;

const BASE_AUTH_PATH = process.env.FLY_APP_NAME ? '/app/.wwebjs_auth' : path.join(__dirname, '..', '..', '.wwebjs_auth');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'my-wwebjs-client',
        dataPath: BASE_AUTH_PATH
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
        isAuthenticated = false;
    } catch (error) {
        console.error('Failed to generate QR code:', error);
    }
});

client.on('ready', () => {
    console.log('Client is ready!');
    isLoading = false;
    isAuthenticated = true;
    qrImageData = ''; // Clear QR code once authenticated
});

client.on('authenticated', () => {
    console.log('Client is authenticated');
    isAuthenticated = true;
    qrImageData = ''; // Clear QR code once authenticated
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
    isAuthenticated = false;
});

async function initializeWithRetry() {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Attempt ${i + 1} to initialize client...`);
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

function getQRImageData() {
    return qrImageData;
}

function isQRLoading() {
    return isLoading;
}

function isClientAuthenticated() {
    return isAuthenticated;
}

module.exports = {
    client,
    initializeWithRetry,
    getQRImageData,
    isQRLoading,
    isClientAuthenticated
};