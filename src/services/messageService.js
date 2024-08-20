require('dotenv').config()
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const schedule = require('node-schedule');
const { ensureInitialized } = require('./whatsappClient');
const { createModuleLogger } = require('../middlewares/logger');
const { WhatsAppClientError, BadRequestError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { encrypt, decrypt } = require('../utils/encryption');
const { supabase } = require('../utils/supabaseClient');


const logger = createModuleLogger(path.basename(__filename));


const scheduledJobs = new Map();

async function loadJobs() {
    logger.info('Loading scheduled jobs from Supabase...');
    try {
        const { data, error } = await supabase
            .from('scheduled_jobs')
            .select('*')
            .not('status', 'eq', 'cancelled');

        if (error) throw error;

        scheduledJobs.clear();
        for (const jobData of data) {
            logger.info(`Scheduling saved job: ${jobData.id}`);
            const job = schedule.scheduleJob(jobData.id, jobData.cron_expression, async () => {
                logger.info(`Executing scheduled job ${jobData.id} at ${new Date()}`);
                try {
                    await sendTestMessage(
                        jobData.recipient_type,
                        decrypt(jobData.recipient_name),
                        decrypt(jobData.message),
                        jobData.image_url ? decrypt(jobData.image_url) : null
                    );
                    await supabase
                        .from('scheduled_jobs')
                        .update({
                            status: 'sent',
                            next_run_at: calculateNextRunTime(jobData.cron_expression)
                        })
                        .match({ id: jobData.id });
                } catch (error) {
                    logger.error(`Failed to execute job ${jobData.id}:`, error);
                    await supabase
                        .from('scheduled_jobs')
                        .update({ status: 'failed' })
                        .match({ id: jobData.id });
                }
            });
            scheduledJobs.set(jobData.id, { ...jobData, job });
        }
        logger.info(`Loaded ${data.length} scheduled jobs`);
    } catch (error) {
        logger.error('Error loading jobs from Supabase:', error);
    }
}

function validateAndNormalizeCronExpression(expression) {
    console.log('Validating cron expression:', expression);
    const parts = expression.split(' ').filter(part => part !== '');

    // Handle Quartz format
    if (parts.length === 6 || parts.length === 7) {
        // Remove seconds and year (if present)
        parts.splice(0, 1);
        if (parts.length > 5) parts.pop();
    }

    if (parts.length !== 5) {
        console.error('Invalid cron expression:', expression);
        throw new Error('Invalid cron expression');
    }

    // Replace '?' with '*' for day-of-week and day-of-month
    parts[2] = parts[2] === '?' ? '*' : parts[2];
    parts[4] = parts[4] === '?' ? '*' : parts[4];

    const normalizedExpression = parts.join(' ');
    console.log('Normalized cron expression:', normalizedExpression);
    return normalizedExpression;
}

const imageCache = new Map();
let groupId = null;

async function getImageMedia(imageUrl) {
    console.log('Getting image media...');

    if (imageCache.has(imageUrl)) {
        console.log('Using cached image data');
        return imageCache.get(imageUrl);
    }

    try {
        console.log('Downloading image...');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const base64Image = imageBuffer.toString('base64');

        const fileExtension = imageUrl.split('.').pop().split(/\#|\?/)[0] || 'jpg';
        const mimeType = `image/${fileExtension}`;

        const media = new MessageMedia(mimeType, base64Image, 'image.' + fileExtension);
        console.log('Image downloaded and processed successfully');

        imageCache.set(imageUrl, media);
        return media;
    } catch (error) {
        console.error('Failed to download image:', error);
        throw error;
    }

}

async function sendTestMessage(recipientType, recipients, message, imageUrl = null) {
    logger.info('Starting sendTestMessage function', { recipientType, recipients, message, imageUrl });

    try {
        const client = await ensureInitialized();
        if (!client) {
            throw new WhatsAppClientError('WhatsApp client is not initialized');
        }

        const recipientList = Array.isArray(recipients) ? recipients : recipients.split(',').map(r => r.trim());

        const results = await Promise.all(recipientList.map(async (recipient) => {
            try {
                let chat;
                if (recipientType === 'group') {
                    logger.debug('Finding group...', { recipient });
                    const chats = await client.getChats();
                    chat = chats.find(chat => chat.name === recipient);
                    if (!chat) {
                        throw new NotFoundError(`Group not found: ${recipient}`);
                    }
                } else {
                    logger.debug('Getting chat for individual...', { recipient });
                    const cleanedNumber = recipient.replace(/\D/g, '');
                    chat = await client.getChatById(cleanedNumber + '@c.us');
                }

                if (imageUrl) {
                    logger.debug('Getting image media...', { imageUrl });
                    const media = await getImageMedia(imageUrl);
                    logger.debug('Sending message with media...');
                    await chat.sendMessage(media, { caption: message });
                } else {
                    logger.debug('Sending message without media...');
                    await chat.sendMessage(message);
                }

                logger.info(`Message sent successfully to ${recipient}`);
                return { status: 'fulfilled', recipient };
            } catch (error) {
                logger.error(`Failed to send message to ${recipient}`, { error });
                return { status: 'rejected', recipient, error: error.message };
            }
        }));

        return results;
    } catch (error) {
        logger.error('Failed to send message', { error });
        throw error;
    }
}

async function scheduleMessage(cronExpression, recipientType, recipientName, message, imageUrl = null, userId = null) {
    const id = uuidv4();
    logger.info(`Scheduling message with ID: ${id}`);

    try {
        const normalizedCronExpression = validateAndNormalizeCronExpression(cronExpression);

        const jobData = {
            id,
            user_id: userId,
            cron_expression: normalizedCronExpression,
            recipient_type: recipientType,
            recipient_name: encrypt(recipientName),
            message: encrypt(message),
            image_url: imageUrl ? encrypt(imageUrl) : null,
            next_run_at: calculateNextRunTime(normalizedCronExpression),
            status: 'pending'
        };

        const { data, error } = await supabase.from('scheduled_jobs').insert(jobData);

        if (error) {
            logger.error('Error inserting job into Supabase:', error);
            throw new Error('Failed to insert job into database');
        }

        const job = schedule.scheduleJob(id, normalizedCronExpression, async () => {
            logger.info(`Executing scheduled job ${id} at ${new Date()}`);
            try {
                await sendTestMessage(recipientType, recipientName, message, imageUrl);
                logger.info(`Scheduled message sent at ${new Date()}`);
                await supabase.from('scheduled_jobs').update({
                    next_run_at: calculateNextRunTime(normalizedCronExpression),
                    status: 'sent'
                }).match({ id });
            } catch (error) {
                logger.error('Failed to send scheduled message:', error);
                await supabase.from('scheduled_jobs').update({ status: 'failed' }).match({ id });
            }
        });

        scheduledJobs.set(id, { ...jobData, job });

        logger.info(`Job scheduled successfully with ID: ${id}`);
        return { id, cronExpression: normalizedCronExpression };
    } catch (error) {
        logger.error('Error scheduling message:', error);
        throw error;
    }
}

async function cancelScheduledMessage(id) {
    try {
        const { data, error } = await supabase
            .from('scheduled_jobs')
            .delete()
            .match({ id });

        if (error) throw error;

        if (scheduledJobs.has(id)) {
            const job = scheduledJobs.get(id);
            if (job && job.job && typeof job.job.cancel === 'function') {
                job.job.cancel();
            }
            scheduledJobs.delete(id);
        }

        logger.info(`Job deleted successfully: ${id}`);
        return true;
    } catch (error) {
        logger.error(`Error deleting job: ${id}`, error);
        return false;
    }
}


async function getScheduledJobs(userId) {
    try {
        const { data, error } = await supabase
            .from('scheduled_jobs')
            .select('*')
            .eq('user_id', userId)
            .not('status', 'eq', 'cancelled');

        if (error) {
            logger.error('Supabase error:', error);
            throw error;
        }

        logger.info('Raw data from Supabase:', { data });
        logger.info(`Retrieved ${data.length} jobs for user ${userId}`);

        if (!data || data.length === 0) {
            logger.info('No scheduled jobs found');
            return [];
        }

        // Decrypt sensitive data
        const decryptedJobs = data.map(job => ({
            ...job,
            recipient_name: decrypt(job.recipient_name),
            message: decrypt(job.message),
            image_url: job.image_url ? decrypt(job.image_url) : null
        }));

        logger.info('Processed jobs:', { count: decryptedJobs.length });
        return decryptedJobs;
    } catch (error) {
        logger.error('Error fetching scheduled jobs:', error);
        throw error;
    }
}

function calculateNextRunTime(cronExpression) {
    return schedule.scheduleJob(cronExpression, () => { }).nextInvocation();
}



module.exports = {
    sendTestMessage,
    scheduleMessage,
    getScheduledJobs,
    cancelScheduledMessage,
    loadJobs,
};