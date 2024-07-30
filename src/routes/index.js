const express = require('express');
const { client, getQRImageData, initializeWithRetry, isQRLoading } = require('../services/whatsappClient');
const { sendMessage } = require('../services/messageService');

const router = express.Router();

router.get('/qr', (req, res) => {
    if (isQRLoading()) {
        res.send(`
            <html>
                <body>
                    <h1>Loading QR Code...</h1>
                    <script>
                        setTimeout(() => {
                            window.location.reload();
                        }, 5000);
                    </script>
                </body>
            </html>
        `);
    } else if (getQRImageData()) {
        res.send(`<img src="${getQRImageData()}">`);
    } else {
        res.status(404).send('QR code not available. Please try again later.');
    }
});

router.get('/', (req, res) => {
    res.redirect('/qr');
});

router.get('/send-test', async (req, res) => {
    if (!client.info) {
        res.status(503).send('Client is not ready. Please try again later.');
        return;
    }

    try {
        await sendMessage();
        res.send('Test message sent');
    } catch (error) {
        console.error('Manual test failed:', error);
        res.status(500).send('Failed to send test message');
    }
});

router.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;