const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { createModuleLogger } = require('../middlewares/logger');
const Redis = require('ioredis');
const { promisify } = require('util');
const logger = createModuleLogger('whatsappClient');

let redis;

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => {
        logger.info('Successfully connected to Redis');
        setupRedisMonitoring(redis);
    });
    redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
    });
} else {
    logger.warn('REDIS_URL not set. Using in-memory store for locking mechanism. This is not suitable for production.');
    // Implement a simple in-memory store for local development
    redis = {
        set: (key, value, mode, duration) => Promise.resolve('OK'),
        eval: () => Promise.resolve(1)
    };
}

// We only need redisSet for now
const redisSet = promisify(redis.set).bind(redis);

const LOCK_KEY = 'whatsapp_client_lock';
const LOCK_TTL = 30000; // 30 seconds
const RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 30;

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
                "--no-sandbox", "--disable-setuid-sandbox", "--headless=new", "--single-process"
            ],
            headless: false
        },
    });
}

function setupClientListeners(client) {
    client.on('qr', async (qr) => {
        console.log('QR RECEIVED');
        try {
            qrImageData = await qrcode.toDataURL(qr);
            clientState.isLoading = false;
            clientState.isAuthenticated = false;
        } catch (error) {
            console.error('Failed to generate QR code:', error);
        }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        clientState = {
            isLoading: false,
            isAuthenticated: true,
            isInitialized: true,
            isClientReady: true
        };
        qrImageData = '';
    });

    client.on('authenticated', () => {
        console.log('Client is authenticated');
        clientState.isAuthenticated = true;
        qrImageData = '';
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        clientState.isAuthenticated = false;
    });

    client.on('disconnected', async (reason) => {
        logger.warn('Client was disconnected', reason);
        clientState.isAuthenticated = false;
        clientState.isInitialized = false;
        clientState.isClientReady = false;

        // Attempt to reinitialize after a short delay
        setTimeout(async () => {
            try {
                await initializeClient();
            } catch (error) {
                logger.error('Failed to reinitialize client after disconnection:', error);
            }
        }, 5000);
    });
}

async function acquireLock() {
    const lockValue = Date.now().toString();
    const result = await redisSet(LOCK_KEY, lockValue, 'NX', 'PX', LOCK_TTL);
    logger.info(`Lock acquisition attempt: ${result === 'OK' ? 'successful' : 'failed'}`);
    return result === 'OK' ? lockValue : null;
}

async function releaseLock(lockValue) {
    const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `;
    const result = await redis.eval(script, 1, LOCK_KEY, lockValue);
    logger.info(`Lock release attempt: ${result === 1 ? 'successful' : 'failed'}`);
    return result === 1;
}

async function initializeClient() {
    let lockValue = null;
    let retries = 0;

    while (!lockValue && retries < MAX_RETRIES) {
        lockValue = await acquireLock();
        if (!lockValue) {
            logger.info(`Failed to acquire lock. Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            retries++;
        }
    }

    if (!lockValue) {
        throw new Error('Failed to acquire lock after maximum retries');
    }

    try {
        logger.info('Lock acquired. Initializing WhatsApp client...');

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

        logger.info('WhatsApp client initialized successfully');
    } finally {
        const released = await releaseLock(lockValue);
        if (released) {
            logger.info('Lock released successfully');
        } else {
            logger.warn('Failed to release lock. It may have expired.');
        }
    }

    return client;
}

async function updateClientHeartbeat() {
    if (client && clientState.isAuthenticated) {
        await redis.set('whatsapp_client_heartbeat', Date.now(), 'EX', 60);
    }
}

setInterval(updateClientHeartbeat, 30000);


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

function getDetailedClientState() {
    return {
        isLoading: clientState.isLoading,
        isAuthenticated: clientState.isAuthenticated,
        isInitialized: clientState.isInitialized,
        isClientReady: clientState.isClientReady,
        hasQR: !!qrImageData
    };
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
    console.log('SIGTERM received. Cleaning up...');
    if (client) {
        await client.destroy();
    }
    process.exit(0);
});

// Monitor Redis commands
function setupRedisMonitoring(redisClient) {
    redisClient.monitor((err, monitor) => {
        if (err) {
            logger.error('Error setting up Redis monitoring:', err);
            return;
        }
        monitor.on('monitor', (time, args) => {
            logger.debug('Redis command:', args);
        });
    });
}

module.exports = {
    initializeClient,
    getQRImageData,
    getClientState,
    updateClientHeartbeat,
    isClientAuthenticated,
    isQRLoading,
    getClientReadyStatus,
    ensureInitialized,
    gracefulShutdown,
    getDetailedClientState,
    getClient: () => client,
    LOCK_KEY,
};