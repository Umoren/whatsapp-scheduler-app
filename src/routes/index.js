const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, getQRImageData, isQRLoading, isClientAuthenticated } = require('../services/whatsappClient');
const { sendTestMessage, scheduleMessage, cancelScheduledMessage, getScheduledJobs } = require('../services/messageService');
const messageLimiter = require('../middlewares/rateLimiter');
const { MessageSchema } = require('../utils/schema');

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

router.post('/send-message', messageLimiter, async (req, res) => {
    try {
        const validatedData = MessageSchema.parse(req.body);
        const { recipientType, recipientName, message, imageUrl } = validatedData;

        const recipients = recipientName.includes(',')
            ? recipientName.split(',').map(r => r.trim())
            : [recipientName.trim()];

        if (recipients.length > 3) {
            return res.status(400).json({ error: 'Validation failed', details: 'Maximum of 3 recipients allowed.' });
        }

        const results = await Promise.allSettled(
            recipients.map(recipient => sendTestMessage(recipientType, recipient, message, imageUrl))
        );

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        res.json({
            message: `Messages sent. Successful: ${successes}, Failed: ${failures}`,
            details: results.map((r, i) => ({
                recipient: recipients[i],
                status: r.status,
                error: r.reason?.message
            }))
        });
    } catch (error) {
        if (error.errors) {
            // Zod validation error
            res.status(400).json({ error: 'Validation failed', details: error.errors });
        } else {
            console.error('Failed to send message:', error);
            res.status(500).json({ error: 'Failed to send message', details: error.message });
        }
    }
});

router.post('/schedule-message', messageLimiter, async (req, res) => {
    try {
        const validatedData = MessageSchema.parse(req.body);
        const { cronExpression, recipientType, recipientName, message, imageUrl } = validatedData;

        if (!cronExpression) {
            throw new Error('Cron expression is required for scheduling');
        }

        const id = uuidv4();
        const result = await scheduleMessage(id, cronExpression, recipientType, recipientName, message, imageUrl);
        res.status(200).json({ message: 'Message scheduled successfully', ...result });
    } catch (error) {
        if (error.errors) {
            // Zod validation error
            res.status(400).json({ error: 'Validation failed', details: error.errors });
        } else {
            console.error('Failed to schedule message:', error);
            res.status(500).json({ error: 'Failed to schedule message', details: error.message });
        }
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