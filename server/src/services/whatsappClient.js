const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { createModuleLogger } = require('../middlewares/logger');

const logger = createModuleLogger('whatsappClient');


const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

let client = null;
let qrImageData = '';
let clientState = {
    isLoading: true,
    isAuthenticated: false,
    isInitialized: false,
    isClientReady: false
};

const BASE_AUTH_PATH = process.env.FLY_APP_NAME ? '/app/.wwebjs_auth' : path.join(__dirname, '..', '..', '.wwebjs_auth');


function createClient() {
    return new Client({
        authStrategy: new LocalAuth({
            clientId: 'my-wwebjs-client',
            dataPath: BASE_AUTH_PATH
        }),
        puppeteer: {
            args: [
                "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote",
                "--single-process", "--disable-gpu"
            ],
            headless: true
        },
    });
}

function setupClientListeners(client) {
    client.on('qr', async (qr) => {
        if (clientState.isAuthenticated) {
            logger.warn('QR code generated despite client being authenticated');
            return;
        }
        logger.info('QR RECEIVED');
        try {
            qrImageData = await qrcode.toDataURL(qr);
            clientState.isLoading = false;
            clientState.isAuthenticated = false;
        } catch (error) {
            logger.error('Failed to generate QR code:', error);
        }
    });

    client.on('ready', () => {
        logger.info('Client is ready!');
        clientState = {
            isLoading: false,
            isAuthenticated: true,
            isInitialized: true,
            isClientReady: true
        };
        qrImageData = '';
    });

    client.on('authenticated', () => {
        logger.info('Client is authenticated');
        clientState.isAuthenticated = true;
        qrImageData = '';
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        clientState.isAuthenticated = false;
    });

    client.on('disconnected', (reason) => {
        logger.info('Client was disconnected', reason);
        clientState.isAuthenticated = false;
        clientState.isInitialized = false;
        clientState.isClientReady = false;
    });
}

async function initializeClient() {
    const start = Date.now();
    logger.info('Starting client initialization');

    if (client) {
        logger.info('Client already exists, destroying old client...');
        await client.destroy();
    }

    client = createClient();
    setupClientListeners(client);

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            logger.info(`Attempt ${i + 1} to initialize client...`);
            const initStart = Date.now();
            await client.initialize();
            const initDuration = Date.now() - initStart;
            logger.info(`Client initialized successfully in ${initDuration}ms`);
            clientState.isInitialized = true;
            break;
        } catch (error) {
            logger.error(`Failed to initialize client (attempt ${i + 1}):`, { error, stack: error.stack });
            if (i < MAX_RETRIES - 1) {
                logger.info(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                logger.error('All initialization attempts failed.');
                throw new Error('Failed to initialize WhatsApp client after multiple attempts');
            }
        }
    }

    const totalDuration = Date.now() - start;
    logger.info(`Total client initialization time: ${totalDuration}ms`);
    return client;
}


function getQRImageData() {
    return qrImageData;
}

function getClientState() {
    return { ...clientState };
}

function isClientAuthenticated() {
    return clientState.isAuthenticated;
}

function isQRLoading() {
    return clientState.isLoading;
}

function getClientReadyStatus() {
    return clientState.isClientReady;
}

async function logout() {
    logger.info('Performing fake logout...');
    // Don't actually do anything with the client, just reset the state
    clientState = {
        isLoading: false,
        isAuthenticated: false,
        isInitialized: true,
        isClientReady: false
    };
    logger.info('Fake logout complete. Client state reset.');
    return { success: true, message: 'Logged out successfully' };
}

async function ensureInitialized() {
    if (!client || !clientState.isInitialized) {
        client = await initializeClient();
    }
    return client;
}

async function gracefulShutdown() {
    logger.info('Initiating graceful shutdown of WhatsApp client...');
    if (client) {
        try {
            await client.destroy();
            logger.info('WhatsApp client destroyed successfully.');
        } catch (error) {
            logger.error('Error during WhatsApp client shutdown:', error);
        }
    } else {
        logger.info('No active WhatsApp client to shut down.');
    }
    clientState = {
        isLoading: false,
        isAuthenticated: false,
        isInitialized: false,
        isClientReady: false
    };
    qrImageData = '';
    logger.info('WhatsApp client shutdown complete.');
}

// Handle process termination
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Cleaning up...');
    if (client) {
        await client.destroy();
    }
    process.exit(0);
});

module.exports = {
    initializeClient,
    getQRImageData,
    getClientState,
    isClientAuthenticated,
    isQRLoading,
    getClientReadyStatus,
    logout,
    ensureInitialized,
    gracefulShutdown,
    getClient: () => client
};