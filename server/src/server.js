require('dotenv').config({ path: "../.env" });
require("./instrument");
const express = require('express');
const config = require('./config');
const { setupMiddleware } = require('./middlewares');
const routes = require('./routes');
const { gracefulShutdown, ensureInitialized } = require('./services/whatsappClient');
const { loadJobs } = require('./services/messageService');
const errorHandler = require('./middlewares/errorHandler');
const MemoryLeakMonitor = require('./utils/memoryLeakMonitor');
const { logger } = require('./middlewares/logger');
const { startSessionCleanup } = require('./services/sessionCleanupService');

const app = express();

// Setup middleware
setupMiddleware(app);

// API routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Memory leak monitoring
const memoryMonitor = new MemoryLeakMonitor(config.memoryMonitor);
memoryMonitor.start();

// Start session cleanup
startSessionCleanup();

async function initializeApp() {
    try {
        await ensureInitialized('default');
        await loadJobs();
        logger.info('Scheduled jobs loaded successfully');
    } catch (err) {
        logger.error('Error during app initialization:', err);
        logger.warn('Starting server without fully initialized WhatsApp client...');
    }
}

async function startServer() {
    await initializeApp();
    const server = app.listen(config.PORT, config.HOST, () => {
        logger.info(`Server is running on ${config.HOST}:${config.PORT}`);
    });

    const shutdownServer = async () => {
        logger.info('Initiating graceful shutdown...');
        server.close(async () => {
            logger.info('HTTP server closed.');
            try {
                await gracefulShutdown();
                logger.info('WhatsApp clients shut down successfully.');
            } catch (error) {
                logger.error('Error during WhatsApp clients shutdown:', error);
            }
            memoryMonitor.stop();
            process.exit(0);
        });

        setTimeout(() => {
            logger.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', shutdownServer);
    process.on('SIGINT', shutdownServer);
}

startServer().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});