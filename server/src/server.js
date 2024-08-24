require('dotenv').config({ path: "../.env" });
require("./instrument");
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');
const { initializeClient, gracefulShutdown } = require('./services/whatsappClient');
const { loadJobs } = require('./services/messageService');
const errorHandler = require('./middlewares/errorHandler');
const { loggingMiddleware } = require('./middlewares/logger');

const app = express();

// Middleware
app.use(cors({
    origin: 'https://whatsapp-scheduler-client.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(loggingMiddleware);

// Rate limiters
const staticFileLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

const catchAllLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50
});

// API routes
app.use('/api', routes);

// Serve static files and handle client-side routing
if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
    app.use(staticFileLimiter, express.static(clientDistPath));
    app.get('*/', catchAllLimiter, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// Error handling
app.use(errorHandler);
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

// App initialization
async function initializeApp() {
    try {
        await initializeClient();
        console.log('WhatsApp client initialized successfully');
        await loadJobs();
        console.log('Scheduled jobs loaded successfully');
    } catch (err) {
        console.error('Error during app initialization:', err);
        console.log('Starting server without fully initialized WhatsApp client...');
    }
}

// Server startup
const startServer = async () => {
    await initializeApp();
    const server = app.listen(config.PORT, config.HOST, () => {
        console.log(`Server is running on ${config.HOST}:${config.PORT}`);
    });

    const shutdownServer = async () => {
        console.log('Shutting down server...');
        server.close(async () => {
            console.log('Http server closed.');
            try {
                await gracefulShutdown();
                console.log('WhatsApp client shut down successfully.');
            } catch (error) {
                console.error('Error during WhatsApp client shutdown:', error);
            }
            process.exit(0);
        });

        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', shutdownServer);
    process.on('SIGINT', shutdownServer);
};

startServer();