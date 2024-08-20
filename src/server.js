require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const config = require('./config');
const routes = require('./routes');
const { initializeClient, gracefulShutdown } = require('./services/whatsappClient');
const { loadJobs } = require('./services/messageService');
const errorHandler = require('./middlewares/errorHandler');
const { loggingMiddleware } = require('./middlewares/logger');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.use(loggingMiddleware);

app.use('/api', routes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist', 'index.html'));
    });
}

app.use(errorHandler);

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

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

initializeApp();

const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${config.PORT}`);
});

async function shutdownServer() {
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

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', shutdownServer);
process.on('SIGINT', shutdownServer);