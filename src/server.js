require('dotenv').config();
const express = require('express');
const path = require('path')
const bodyParser = require('body-parser')
const config = require('./config');
const routes = require('./routes');
const { client, initializeWithRetry } = require('./services/whatsappClient');
const { loadJobs } = require('./services/messageService');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use('/', routes);
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

async function initializeApp() {
    try {
        await initializeWithRetry();
        console.log('WhatsApp client initialized successfully');

        await loadJobs();
        console.log('Scheduled jobs loaded successfully');

    } catch (err) {
        console.error('Error during app initialization:', err);
        process.exit(1);
    }
}

initializeApp();

app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${config.PORT}`);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing WhatsApp client...');
    await client.destroy();
    process.exit(0);
});
