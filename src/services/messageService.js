require('dotenv').config()
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const schedule = require('node-schedule');
const { ensureInitialized } = require('./whatsappClient');
const { createModuleLogger } = require('../middlewares/logger');
const { WhatsAppClientError, BadRequestError, NotFoundError } = require('../utils/errors');
const fs = require('fs').promises;
const path = require('path');

const JOBS_FILE = path.join(__dirname, 'scheduledJobs.json');
const logger = createModuleLogger(path.basename(__filename));

const scheduledJobs = new Map();


async function saveJobs() {
    console.log('Saving jobs to file...');
    const jobsData = Array.from(scheduledJobs.values()).map(({ job, ...rest }) => rest);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
    console.log(`Saved ${jobsData.length} jobs to file`);
}

async function loadJobs() {
    console.log('Loading scheduled jobs...');
    try {
        const data = await fs.readFile(JOBS_FILE, 'utf8');
        const jobsData = JSON.parse(data);
        scheduledJobs.clear();
        for (const jobData of jobsData) {
            console.log(`Scheduling saved job: ${jobData.id}`);
            const job = schedule.scheduleJob(jobData.expression, async () => {
                console.log(`Executing scheduled job ${jobData.id} at ${new Date()}`);
                await sendTestMessage(jobData.groupName, jobData.message, jobData.imageUrl);
            });
            scheduledJobs.set(jobData.id, { ...jobData, job });
        }
        console.log(`Loaded ${jobsData.length} scheduled jobs`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading jobs:', error);
        } else {
            console.log('No saved jobs found. Starting with empty schedule.');
        }
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


async function scheduleMessage(id, cronExpression, recipientType, recipientName, message, imageUrl = null) {
    console.log(`Scheduling message with ID: ${id}`);

    try {
        const normalizedCronExpression = validateAndNormalizeCronExpression(cronExpression);

        const job = schedule.scheduleJob(normalizedCronExpression, async () => {
            console.log(`Executing scheduled job ${id} at ${new Date()}`);
            try {
                await sendTestMessage(recipientType, recipientName, message, imageUrl);
                console.log(`Scheduled message sent at ${new Date()}`);
            } catch (error) {
                console.error('Failed to send scheduled message:', error);
            }
        });

        if (!job) {
            throw new Error('Failed to schedule job');
        }

        scheduledJobs.set(id, { id, expression: normalizedCronExpression, recipientType, recipientName, message, imageUrl, job });
        await saveJobs();
        console.log(`Job scheduled successfully with ID: ${id}`);
        return { id, cronExpression: normalizedCronExpression };
    } catch (error) {
        console.error('Error scheduling message:', error);
        throw error;
    }
}

async function cancelScheduledMessage(id) {
    console.log(`Attempting to cancel job with ID: ${id}`);
    const jobInfo = scheduledJobs.get(id);
    if (jobInfo) {
        jobInfo.job.cancel();
        scheduledJobs.delete(id);
        await saveJobs();
        console.log(`Job cancelled successfully: ${id}`);
        return true;
    }
    console.log(`Job not found: ${id}`);
    return false;
}

function getScheduledJobs() {
    const jobs = Array.from(scheduledJobs.values()).map(({ job, ...rest }) => ({
        ...rest,
        next: job.nextInvocation()
    }));
    return jobs;
}


module.exports = {
    sendTestMessage,
    scheduleMessage,
    getScheduledJobs,
    cancelScheduledMessage,
    loadJobs,
};