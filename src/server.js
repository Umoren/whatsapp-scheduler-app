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

app.use('/', routes);

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

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received.');
    console.log('Closing http server.');
    server.close(() => {
        console.log('Http server closed.');
        gracefulShutdown().then(() => {
            console.log('WhatsApp client shut down.');
            process.exit(0);
        }).catch(console.error);
    });
});

process.on('SIGINT', () => {
    console.info('SIGINT signal received.');
    console.log('Closing http server.');
    server.close(() => {
        console.log('Http server closed.');
        gracefulShutdown().then(() => {
            console.log('WhatsApp client shut down.');
            process.exit(0);
        }).catch(console.error);
    });
});