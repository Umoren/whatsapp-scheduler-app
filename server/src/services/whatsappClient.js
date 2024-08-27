const UserSessionManager = require('./UserSessionManager');
const { createModuleLogger } = require('../middlewares/logger');

const logger = createModuleLogger('whatsappClient');

async function ensureInitialized(userId) {
    try {
        const { client } = await UserSessionManager.getOrCreateSession(userId);
        return client;
    } catch (error) {
        logger.error(`Failed to initialize WhatsApp client for user ${userId}:`, error);
        throw error;
    }
}

async function getClientState(userId) {
    return await UserSessionManager.getSessionState(userId);
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