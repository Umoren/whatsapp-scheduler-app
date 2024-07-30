const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const config = require('./config');
const routes = require('./routes');
const { client, initializeWithRetry } = require('./services/whatsappClient');
const { sendMessage } = require('./services/messageService');

const app = express();

app.use('/', routes);

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

async function initializeApp() {
    try {
        await initializeWithRetry();
        console.log('WhatsApp client initialized successfully');

        cron.schedule('15 7 * * *', async () => {
            console.log('Performing daily connection check...');
            try {
                if (!client.info) {
                    console.log('Client not connected, reconnecting...');
                    await client.initialize();
                }
                await axios.get('https://hc-ping.com/f51fcce0-5129-4c2d-bbce-ae2fe970cbe6');
            } catch (error) {
                console.error('Connection check failed:', error);
                await axios.get('https://hc-ping.com/f51fcce0-5129-4c2d-bbce-ae2fe970cbe6/fail');
            }
        }, { timezone: config.TIMEZONE });

        cron.schedule('20 7 * * *', async () => {
            console.log('Cron job triggered at:', new Date().toISOString());
            if (client.info) {
                console.log('Client is ready. Attempting to send scheduled message...');
                try {
                    await sendMessage();
                    console.log('Scheduled message sent successfully');
                } catch (error) {
                    console.error('Scheduled message failed:', error);
                }
            } else {
                console.log('Client not ready. Skipping scheduled message.');
            }
        }, {
            timezone: config.TIMEZONE
        });

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