const express = require('express');
const { client, getQRImageData, isQRLoading, isClientAuthenticated } = require('../services/whatsappClient');
const { sendMessage } = require('../services/messageService');

const router = express.Router();

router.get('/qr', (req, res) => {
    if (isClientAuthenticated()) {
        res.redirect('/send-test');
    } else if (isQRLoading()) {
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
        res.send(`
            <html>
                <body>
                    <h1>Scan this QR code with WhatsApp</h1>
                    <img src="${getQRImageData()}">
                    <script>
                        setTimeout(() => {
                            window.location.reload();
                        }, 30000); // Refresh every 30 seconds
                    </script>
                </body>
            </html>
        `);
    } else {
        res.status(404).send('QR code not available. Please try again later.');
    }
});

router.get('/', (req, res) => {
    res.redirect('/qr');
});

router.get('/send-test', async (req, res) => {
    if (!client.info) {
        res.status(503).send('Client is not ready. Please <a href="/qr">authenticate</a> and try again later.');
        return;
    }

    try {
        await sendMessage();
        res.send('Test message sent successfully. <a href="/send-test">Send another test message</a>');
    } catch (error) {
        console.error('Manual test failed:', error);
        res.status(500).send('Failed to send test message. Please try again.');
    }
});

router.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;