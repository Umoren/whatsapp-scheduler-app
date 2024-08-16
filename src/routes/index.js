const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {
    getQRImageData,
    isQRLoading,
    isClientAuthenticated,
    getClientReadyStatus,
    ensureInitialized,
} = require('../services/whatsappClient');
const { sendTestMessage, scheduleMessage, cancelScheduledMessage, getScheduledJobs } = require('../services/messageService');
const messageLimiter = require('../middlewares/rateLimiter');
const { MessageSchema } = require('../utils/schema');
const { BadRequestError, AppError } = require('../utils/errors');
const { createModuleLogger } = require('../middlewares/logger');

const router = express.Router();
const logger = createModuleLogger(path.basename(__filename));

router.get('/qr', async (req, res, next) => {
    logger.info('QR route accessed');
    try {
        logger.debug('Current client state', {
            authenticated: isClientAuthenticated(),
            clientReady: getClientReadyStatus()
        });

        await ensureInitialized();

        if (isClientAuthenticated()) {
            logger.info('Client already authenticated');
            return res.status(200).json({ authenticated: true });
        }

        if (isQRLoading()) {
            logger.info('QR code is loading');
            return res.status(202).json({ message: 'QR code is loading' });
        }

        const qrData = getQRImageData();
        if (qrData) {
            logger.info('QR code data retrieved successfully');
            return res.status(200).json({ qrCode: qrData });
        }

        logger.warn('QR code not available');
        return res.status(404).json({ error: 'QR code not available. Please try again later.' });
    } catch (error) {
        logger.error('Error in QR route', { error });
        next(new AppError('Failed to initialize WhatsApp client or generate QR code', 500));
    }
});


router.get('/auth-status', (req, res) => {
    res.json({
        authenticated: isClientAuthenticated(),
        clientReady: getClientReadyStatus()
    });
});

router.post('/send-message', messageLimiter, async (req, res, next) => {
    const start = Date.now();
    logger.info('Received request to send message', { body: req.body });
    try {
        await ensureInitialized();
        const validatedData = MessageSchema.parse(req.body);
        const { recipientType, recipientName, message, imageUrl } = validatedData;

        const recipients = recipientName.includes(',')
            ? recipientName.split(',').map(r => r.trim())
            : [recipientName.trim()];

        if (recipients.length > 3) {
            logger.warn('Too many recipients', { recipientCount: recipients.length });
            throw new BadRequestError('Maximum of 3 recipients allowed.');
        }

        logger.info('Sending messages', { recipientCount: recipients.length, recipientType });
        const results = await sendTestMessage(recipientType, recipients, message, imageUrl);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        logger.info('Messages sent', { successes, failures });
        res.json({
            message: `Messages sent. Successful: ${successes}, Failed: ${failures}`,
            details: results
        });
    } catch (error) {
        next(error);
    } finally {
        const duration = Date.now() - start;
        logger.info(`Request processing time: ${duration}ms`);
    }
});


router.post('/schedule-message', messageLimiter, async (req, res, next) => {
    logger.info('Schedule message route accessed');
    try {
        await ensureInitialized();
        const validatedData = MessageSchema.parse(req.body);
        const { cronExpression, recipientType, recipientName, message, imageUrl } = validatedData;

        if (!cronExpression) {
            logger.warn('Cron expression missing');
            throw new BadRequestError('Cron expression is required for scheduling');
        }

        const id = uuidv4();
        logger.info('Scheduling message', { id, recipientType, recipientName });
        const result = await scheduleMessage(id, cronExpression, recipientType, recipientName, message, imageUrl);
        logger.info('Message scheduled successfully', { id });
        res.status(200).json({ message: 'Message scheduled successfully', ...result });
    } catch (error) {
        if (error.errors) {
            // Zod validation error
            logger.warn('Validation error', { errors: error.errors });
            res.status(400).json({ error: 'Validation failed', details: error.errors });
        } else {
            logger.error('Failed to schedule message', { error });
            next(new AppError('Failed to schedule message', 500));
        }
    }
});

router.delete('/cancel-schedule/:id', async (req, res, next) => {
    const { id } = req.params;
    logger.info('Cancel scheduled message route accessed', { id });
    try {
        await ensureInitialized();
        const result = cancelScheduledMessage(id);
        if (result) {
            logger.info('Scheduled message cancelled successfully', { id });
            res.status(200).send('Scheduled message cancelled successfully');
        } else {
            logger.warn('Scheduled message not found', { id });
            throw new NotFoundError('Scheduled message not found');
        }
    } catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        } else {
            logger.error('Failed to cancel scheduled message', { error, id });
            next(new AppError('Failed to cancel scheduled message', 500));
        }
    }
});

router.get('/scheduled-jobs', async (req, res, next) => {
    logger.info('Get scheduled jobs route accessed');
    try {
        await ensureInitialized();
        const jobs = getScheduledJobs();
        logger.info('Retrieved scheduled jobs', { jobCount: jobs.length });
        res.status(200).json(jobs);
    } catch (error) {
        logger.error('Failed to get scheduled jobs', { error });
        next(new AppError('Failed to get scheduled jobs', 500));
    }
});


router.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

module.exports = router;