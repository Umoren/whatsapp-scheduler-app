const express = require('express');
const path = require('path');
const {
    ensureInitialized,
    getClientState,
    updateClientHeartbeat
} = require('../services/whatsappClient');
const { sendTestMessage, scheduleMessage, cancelScheduledMessage, getScheduledJobs } = require('../services/messageService');
const messageLimiter = require('../middlewares/rateLimiter');
const { MessageSchema } = require('../utils/schema');
const { BadRequestError, AppError, NotFoundError } = require('../utils/errors');
const { createModuleLogger } = require('../middlewares/logger');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();
const logger = createModuleLogger(path.basename(__filename));

router.get('/', (req, res) => {
    res.status(200).send('WhatsApp Scheduler is running');
});

router.get('/qr', authMiddleware, async (req, res, next) => {
    logger.info('QR route accessed', { userId: req.user.id });
    try {
        await updateClientHeartbeat(req.user.id);
        logger.debug('Ensuring client is initialized', { userId: req.user.id });
        await ensureInitialized(req.user.id);

        logger.debug('Getting client state', { userId: req.user.id });
        const clientState = await getClientState(req.user.id);

        logger.debug('Client state retrieved', { userId: req.user.id, clientState });

        if (!clientState) {
            logger.warn('Client state is null', { userId: req.user.id });
            return res.status(500).json({ error: 'Failed to retrieve client state' });
        }

        if (clientState.isAuthenticated) {
            logger.info('Client already authenticated', { userId: req.user.id });
            return res.status(200).json({ authenticated: true });
        }

        if (clientState.qrCode) {
            logger.info('QR code retrieved for user', { userId: req.user.id });
            return res.status(200).json({ qrCode: clientState.qrCode });
        }

        logger.info('QR code not available, client initializing', { userId: req.user.id });
        return res.status(202).json({ message: 'WhatsApp client initializing. Please try again shortly.' });
    } catch (error) {
        logger.error('Error in QR route', { error: error.message, stack: error.stack, userId: req.user.id });
        return res.status(500).json({ error: 'An unexpected error occurred', details: error.message });
    }
});


router.get('/auth-status', authMiddleware, async (req, res, next) => {
    logger.info('Auth status route accessed', { userId: req.user.id });
    try {
        await updateClientHeartbeat(req.user.id);
        logger.debug('Client heartbeat updated', { userId: req.user.id });

        const clientState = await getClientState(req.user.id);
        logger.debug('Client state retrieved', { userId: req.user.id, clientState });

        res.json({
            isAuthenticated: clientState.isAuthenticated,
            isClientReady: clientState.isClientReady,
            lastHeartbeat: clientState.lastHeartbeat ? new Date(clientState.lastHeartbeat) : null
        });
        logger.info('Auth status response sent', { userId: req.user.id });
    } catch (error) {
        logger.error('Error in auth-status route', {
            error: error.message,
            stack: error.stack,
            userId: req.user.id
        });
        next(error);
    }
});

router.post('/send-message', authMiddleware, messageLimiter, async (req, res, next) => {
    const start = Date.now();
    logger.info('Received request to send message', { body: req.body, userId: req.user.id });
    try {
        await updateClientHeartbeat(req.user.id);
        const client = await ensureInitialized(req.user.id);
        const validatedData = MessageSchema.parse(req.body);
        const { recipientType, recipientName, message, imageUrl } = validatedData;

        const recipients = recipientName.includes(',')
            ? recipientName.split(',').map(r => r.trim())
            : [recipientName.trim()];

        if (recipients.length > 3) {
            logger.warn('Too many recipients', { recipientCount: recipients.length, userId: req.user.id });
            throw new BadRequestError('Maximum of 3 recipients allowed.');
        }

        logger.info('Sending messages', { recipientCount: recipients.length, recipientType, userId: req.user.id });
        const results = await sendTestMessage(client, recipientType, recipients, message, imageUrl);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        logger.info('Messages sent', { successes, failures, userId: req.user.id });
        res.json({
            message: `Messages sent. Successful: ${successes}, Failed: ${failures}`,
            details: results
        });
    } catch (error) {
        next(error);
    } finally {
        const duration = Date.now() - start;
        logger.info(`Request processing time: ${duration}ms`, { userId: req.user.id });
    }
});

router.post('/schedule-message', authMiddleware, messageLimiter, async (req, res, next) => {
    logger.info('Schedule message route accessed', { userId: req.user.id });
    try {
        await updateClientHeartbeat(req.user.id);
        await ensureInitialized(req.user.id);
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
        await ensureInitialized(req.user.id);
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
        await updateClientHeartbeat(req.user.id);
        await ensureInitialized(req.user.id);
        const jobs = await getScheduledJobs(req.user.id);
        logger.info(`Returning ${jobs.length} jobs`, { userId: req.user.id });
        res.status(200).json(jobs);
    } catch (error) {
        logger.error('Failed to get scheduled jobs', { error, userId: req.user.id });
        next(new AppError('Failed to get scheduled jobs', 500));
    }
});

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

module.exports = router;