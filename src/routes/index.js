const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, getQRImageData, isQRLoading, isClientAuthenticated } = require('../services/whatsappClient');
const { sendTestMessage, scheduleMessage, cancelScheduledMessage, getScheduledJobs } = require('../services/messageService');

const router = express.Router();

router.get('/qr', (req, res) => {
    if (isClientAuthenticated()) {
        res.status(200).json({ authenticated: true });
    } else if (isQRLoading()) {
        res.status(202).json({ message: 'QR code is loading' });
    } else {
        const qrData = getQRImageData();
        if (qrData) {
            // Send the base64 data directly
            res.status(200).json({ qrCode: qrData });
        } else {
            res.status(404).json({ message: 'QR code not available. Please try again later.' });
        }
    }
});

router.get('/auth-status', (req, res) => {
    res.json({ authenticated: !!client.info });
});

router.post('/send-message', async (req, res) => {
    const { recipientType, recipientName, message, imageUrl } = req.body;

    if (!recipientType || !recipientName || !message) {
        res.status(400).send('Recipient type, recipient name/number, and message are required.');
        return;
    }

    try {
        await sendTestMessage(recipientType, recipientName, message, imageUrl);
        res.status(200).json({ message: 'Message sent successfully.' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).send('Failed to send message: ' + error.message);
    }
});

router.post('/schedule-message', async (req, res) => {
    console.log('Received schedule request:', req.body);
    const { cronExpression, recipientType, recipientName, message, imageUrl } = req.body;

    if (!cronExpression || !recipientType || !recipientName || !message) {
        return res.status(400).send('Cron expression, recipient type, recipient name/number, and message are required.');
    }

    try {
        const id = uuidv4();
        const result = await scheduleMessage(id, cronExpression, recipientType, recipientName, message, imageUrl);
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