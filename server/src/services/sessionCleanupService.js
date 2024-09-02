const UserSessionManager = require('./UserSessionManager');
const { createModuleLogger } = require('../middlewares/logger');
const logger = createModuleLogger('sessionCleanupService');

const AUTHENTICATED_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours
const UNAUTHENTICATED_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSIONS = 10; // Maximum number of concurrent sessions
const SESSION_REPORT_INTERVAL = 60 * 60 * 1000; // 1 hour

function startSessionCleanup() {
    setInterval(async () => {
        logger.info('Starting session cleanup');
        const sessions = UserSessionManager.sessions;
        const now = Date.now();

        // Sort sessions by last activity, oldest first
        const sortedSessions = [...sessions.entries()].sort((a, b) => a[1].state.lastHeartbeat - b[1].state.lastHeartbeat);

        for (const [userId, session] of sortedSessions) {
            const lastActivity = session.state.lastHeartbeat;
            const isAuthenticated = session.state.isAuthenticated;
            const timeoutDuration = isAuthenticated ? AUTHENTICATED_TIMEOUT : UNAUTHENTICATED_TIMEOUT;
            const isInactive = now - lastActivity > timeoutDuration;
            const shouldRemoveForCapacity = sessions.size > MAX_SESSIONS;

            if (isInactive || shouldRemoveForCapacity) {
                logger.info(`Cleaning up session for user ${userId}. Reason: ${isInactive ? 'Inactive' : 'Capacity limit reached'}. Authenticated: ${isAuthenticated}`);
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

    // Start periodic session reporting
    startPeriodicSessionReport();
}

function startPeriodicSessionReport() {
    setInterval(() => {
        const sessions = UserSessionManager.sessions;
        const now = Date.now();
        const activeSessions = [...sessions.entries()].filter(([_, session]) => {
            const timeoutDuration = session.state.isAuthenticated ? AUTHENTICATED_TIMEOUT : UNAUTHENTICATED_TIMEOUT;
            return now - session.state.lastHeartbeat <= timeoutDuration;
        });

        logger.info('Periodic Session Report', {
            totalSessions: sessions.size,
            activeSessions: activeSessions.length,
            inactiveSessions: sessions.size - activeSessions.length
        });

        // Log details of each session if needed
        activeSessions.forEach(([userId, session]) => {
            logger.debug('Active session details', {
                userId,
                lastHeartbeat: new Date(session.state.lastHeartbeat).toISOString(),
                isAuthenticated: session.state.isAuthenticated
            });
        });
    }, SESSION_REPORT_INTERVAL);
}

module.exports = { startSessionCleanup };