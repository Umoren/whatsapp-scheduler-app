const express = require('express');
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
const authMiddleware = require('../middlewares/authMiddleware');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

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

router.post('/schedule-message', authMiddleware, messageLimiter, async (req, res, next) => {
    logger.info('Schedule message route accessed', { userId: req.user.id });
    try {
        await ensureInitialized();
        const validatedData = MessageSchema.parse(req.body);
        const { cronExpression, recipientType, recipientName, message, imageUrl } = validatedData;

        if (!cronExpression) {
            logger.warn('Cron expression missing', { userId: req.user.id });
            throw new BadRequestError('Cron expression is required for scheduling');
        }

        logger.info('Scheduling message', { recipientType, recipientName, userId: req.user.id });
        const result = await scheduleMessage(cronExpression, recipientType, recipientName, message, imageUrl, req.user.id);
        logger.info('Message scheduled successfully', { id: result.id, userId: req.user.id });
        res.status(200).json({ message: 'Message scheduled successfully', ...result });
    } catch (error) {
        if (error.errors) {
            // Zod validation error
            logger.warn('Validation error', { errors: error.errors, userId: req.user.id });
            res.status(400).json({ error: 'Validation failed', details: error.errors });
        } else {
            logger.error('Failed to schedule message', { error: error.message, stack: error.stack, userId: req.user.id });
            next(new AppError('Failed to schedule message: ' + error.message, 500));
        }
    }
});

router.delete('/cancel-schedule/:id', authMiddleware, async (req, res, next) => {
    const { id } = req.params;
    logger.info('Delete scheduled message route accessed', { id, userId: req.user.id });
    try {
        await ensureInitialized();
        const result = await cancelScheduledMessage(id, req.user.id);
        if (result) {
            logger.info('Scheduled message deleted successfully', { id, userId: req.user.id });
            res.status(200).send('Scheduled message deleted successfully');
        } else {
            logger.warn('Scheduled message not found or unauthorized', { id, userId: req.user.id });
            throw new NotFoundError('Scheduled message not found or unauthorized');
        }
    } catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        } else {
            logger.error('Failed to delete scheduled message', { error, id, userId: req.user.id });
            next(new AppError('Failed to delete scheduled message', 500));
        }
    }
});

router.get('/scheduled-jobs', authMiddleware, async (req, res, next) => {
    logger.info('Get scheduled jobs route accessed', { userId: req.user.id });
    try {
        await ensureInitialized();
        const jobs = await getScheduledJobs(req.user.id);
        logger.info(`Returning ${jobs.length} jobs`, { userId: req.user.id });
        res.status(200).json(jobs);
    } catch (error) {
        logger.error('Failed to get scheduled jobs', { error, userId: req.user.id });
        next(new AppError('Failed to get scheduled jobs', 500));
    }
});


router.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

router.get('/whatsapp-status', (req, res) => {
    res.json({
        isAuthenticated: isClientAuthenticated(),
        isReady: getClientReadyStatus(),
        lockStatus: redis.get(LOCK_KEY).then(value => !!value)
    });
});

module.exports = router;