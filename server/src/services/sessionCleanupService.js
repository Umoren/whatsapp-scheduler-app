const UserSessionManager = require('./UserSessionManager');
const { createModuleLogger } = require('../middlewares/logger');
const logger = createModuleLogger('sessionCleanupService');

const INACTIVE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSIONS = 10; // Maximum number of concurrent sessions

function startSessionCleanup() {
    setInterval(async () => {
        logger.info('Starting session cleanup');
        const sessions = UserSessionManager.sessions;
        const now = Date.now();

        // Sort sessions by last activity, oldest first
        const sortedSessions = [...sessions.entries()].sort((a, b) => a[1].state.lastHeartbeat - b[1].state.lastHeartbeat);

        for (const [userId, session] of sortedSessions) {
            const lastActivity = session.state.lastHeartbeat;
            const isInactive = now - lastActivity > INACTIVE_TIMEOUT;
            const shouldRemoveForCapacity = sessions.size > MAX_SESSIONS;

            if (isInactive || shouldRemoveForCapacity) {
                logger.info(`Cleaning up session for user ${userId}. Reason: ${isInactive ? 'Inactive' : 'Capacity limit reached'}`);
                try {
                    await UserSessionManager.removeSession(userId);
                    logger.info(`Session for user ${userId} cleaned up successfully`);
                } catch (error) {
                    logger.error(`Error cleaning up session for user ${userId}`, error);
                }
            }

            if (sessions.size <= MAX_SESSIONS && !isInactive) {
                // Stop cleaning up if we're within capacity and remaining sessions are active
                break;
            }
        }

        logger.info(`Session cleanup completed. Current session count: ${sessions.size}`);
    }, CLEANUP_INTERVAL);
}

module.exports = { startSessionCleanup };