const UserSessionManager = require('./UserSessionManager');
const { createModuleLogger } = require('../middlewares/logger');

const logger = createModuleLogger('whatsappClient');

async function ensureInitialized(userId) {
    if (!userId || userId === 'default') {
        logger.warn('Attempted to initialize client for invalid user', { userId });
        throw new Error('Invalid user ID');
    }

    logger.info(`Ensuring WhatsApp client is initialized for user ${userId}`);
    try {
        const { client } = await UserSessionManager.getOrCreateSession(userId);
        logger.info(`WhatsApp client ensured for user ${userId}`);
        return client;
    } catch (error) {
        logger.error(`Failed to initialize WhatsApp client for user ${userId}:`, error);
        throw error;
    }
}

async function getClientState(userId) {
    logger.debug(`Getting client state for user ${userId}`);
    const state = await UserSessionManager.getSessionState(userId);
    logger.debug(`Retrieved client state for user ${userId}:`, state);
    return state || {
        isInitialized: false,
        isAuthenticated: false,
        qrCode: null,
        lastHeartbeat: null
    };
}
async function updateClientHeartbeat(userId) {
    await UserSessionManager.updateSessionHeartbeat(userId);
}

async function removeClient(userId) {
    await UserSessionManager.removeSession(userId);
}

async function gracefulShutdown() {
    logger.info('Initiating graceful shutdown of WhatsApp clients...');
    for (const [userId, session] of UserSessionManager.sessions) {
        try {
            await UserSessionManager.removeSession(userId);
            logger.info(`WhatsApp client destroyed for user ${userId}`);
        } catch (error) {
            logger.error(`Error shutting down client for user ${userId}:`, error);
        }
    }
    logger.info('All WhatsApp clients shut down.');
}

module.exports = {
    ensureInitialized,
    getClientState,
    updateClientHeartbeat,
    removeClient,
    gracefulShutdown
};