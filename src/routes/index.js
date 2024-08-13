const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, getQRImageData, isQRLoading, isClientAuthenticated } = require('../services/whatsappClient');
const { sendMessage, sendTestMessage, scheduleMessage, cancelScheduledMessage, getScheduledJobs } = require('../services/messageService');

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

router.get('/auth-status', (req, res) => {
    res.json({ authenticated: !!client.info });
});

router.post('/send-message', async (req, res) => {
    if (!client.info) {
        res.status(503).send('Client is not ready. Please authenticate and try again later.');
        return;
    }

    const { groupName, message, imageUrl } = req.body;

    if (!groupName || !message) {
        res.status(400).send('Group name and message are required.');
        return;
    }

    try {
        await sendTestMessage(groupName, message, imageUrl);
        res.send('Message sent successfully.');
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).send('Failed to send message. Please try again.');
    }
});

router.post('/schedule-message', async (req, res) => {
    console.log('Body:', req.body);
    const { cronExpression, groupName, message, imageUrl } = req.body;

    if (!cronExpression || !groupName || !message) {
        return res.status(400).send('Cron expression, group name, and message are required.');
    }

    try {
        const id = uuidv4();
        const result = await scheduleMessage(id, cronExpression, groupName, message, imageUrl);
        console.log('Message scheduled:', result);
        res.status(200).json({ message: 'Message scheduled successfully', ...result });
    } catch (error) {
        console.error('Failed to schedule message:', error);
        res.status(500).send('Failed to schedule message: ' + error.message);
    }
});

router.delete('/cancel-schedule/:id', (req, res) => {
    const { id } = req.params;
    const result = cancelScheduledMessage(id);
    if (result) {
        res.status(200).send('Scheduled message cancelled successfully');
    } else {
        res.status(404).send('Scheduled message not found');
    }
});

router.get('/scheduled-jobs', (req, res) => {
    const jobs = getScheduledJobs();
    res.status(200).json(jobs);
});



router.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;