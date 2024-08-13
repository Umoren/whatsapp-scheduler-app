require('dotenv').config()
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const schedule = require('node-schedule');
const config = require('../config');
const { client } = require('./whatsappClient');
const fs = require('fs').promises;
const path = require('path');

const JOBS_FILE = path.join(__dirname, 'scheduledJobs.json');

const scheduledJobs = new Map();

async function saveJobs() {
    const jobsData = Array.from(scheduledJobs.entries()).map(([id, jobInfo]) => ({
        id,
        expression: jobInfo.expression,
        groupName: jobInfo.groupName,
        message: jobInfo.message,
        imageUrl: jobInfo.imageUrl
    }));
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
}

async function loadJobs() {
    try {
        const data = await fs.readFile(JOBS_FILE, 'utf8');
        const jobsData = JSON.parse(data);
        jobsData.forEach(jobData => {
            scheduleMessage(jobData.id, jobData.expression, jobData.groupName, jobData.message, jobData.imageUrl);
        });
        console.log('Loaded scheduled jobs:', jobsData.length);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading jobs:', error);
        }
    }
}

function validateAndNormalizeCronExpression(expression) {
    const parts = expression.split(' ');
    if (parts.length >= 6) {
        // Remove seconds and year (if present)
        parts.splice(0, 1);
        if (parts.length > 5) parts.pop();
    }
    if (parts.length !== 5) {
        throw new Error('Invalid cron expression');
    }
    return parts.join(' ');
}

function sanitizeInput(input) {
    // TODO: write a sanitizer util
    return input.replace(/[;&|`'"\*?~<>^(){}$\[\]]/g, '');
}

let cachedImageMedia = null;
let groupId = null;

async function getImageMedia() {
    console.log('Getting image media...');
    if (cachedImageMedia) {
        console.log('Using cached image data');
        return cachedImageMedia;
    }

    console.log('Downloading image...');
    try {
        const response = await axios.get(config.WELCOME_IMAGE_URL, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const base64Image = imageBuffer.toString('base64');

        cachedImageMedia = new MessageMedia('image/jpeg', base64Image, '5UFYCmC.jpeg');
        console.log('Image downloaded and cached successfully');
        return cachedImageMedia;
    } catch (error) {
        console.error('Failed to download image:', error);
        throw error;
    }
}

async function findGroupId() {
    console.log('Finding group ID...');
    if (groupId) {
        console.log('Using cached group ID:', groupId);
        return groupId;
    }

    console.log('Fetching chats...');
    const chats = await client.getChats();
    console.log(`Found ${chats.length} chats`);

    const group = chats.find(chat => chat.name === process.env.WHATSAPP_GROUP_NAME);

    if (group) {
        groupId = group.id._serialized;
        console.log('Group found. ID:', groupId);
        return groupId;
    } else {
        console.log('Group not found');
        throw new Error('Group not found');
    }
}

async function sendMessage() {
    console.log('Starting sendMessage function...');

    if (!client.info) {
        console.log('Client not ready, attempting to reconnect...');
        await client.initialize();
        console.log('Client reinitialized');
    }

    const message = `Hi Islanders!

Join the Desert Island meeting:

Zoom Code:  ${config.ZOOM_CODE}
Password: ${config.ZOOM_PASSWORD}

Or use the link:
${config.ZOOM_LINK}`;

    try {
        console.log('Finding group ID...');
        const id = await findGroupId();
        console.log('Getting chat by ID...');
        const chat = await client.getChatById(id);

        console.log('Getting image media...');
        const media = await getImageMedia();

        console.log('Sending message with media...');
        await chat.sendMessage(media, { caption: message });
        console.log('Message and image sent successfully');
    } catch (error) {
        console.error('Failed to send message:', error);
        if (error.message === 'Group not found') {
            console.error('Please check the group name and ensure the bot is a member of the group.');
        } else if (error.message.includes('not authorized')) {
            console.error('The bot is not authorized. Please check the QR code and re-authenticate.');
        } else {
            console.error('Unexpected error occurred. Full error:', error);
        }
        throw error; // Re-throw the error so it can be caught by the caller
    }
}

async function sendTestMessage(groupName, message, imageUrl = null) {
    console.log('Starting sendTestMessage function...');

    if (!client.info) {
        console.log('Client not ready, attempting to reconnect...');
        await client.initialize();
        console.log('Client reinitialized');
    }

    try {
        console.log('Finding group...');
        const chats = await client.getChats();
        const group = chats.find(chat => chat.name === groupName);

        if (!group) {
            throw new Error('Group not found');
        }

        if (imageUrl) {
            console.log('Getting image media...');
            const media = await MessageMedia.fromUrl(imageUrl);
            console.log('Sending message with media...');
            await group.sendMessage(media, { caption: message });
        } else {
            console.log('Sending message without media...');
            await group.sendMessage(message);
        }

        console.log('Test message sent successfully');
    } catch (error) {
        console.error('Failed to send test message:', error);
        throw error;
    }
}

async function scheduleMessage(id, cronExpression, groupName, message, imageUrl = null) {
    try {
        console.log('Scheduling message with cron:', cronExpression);
        const sanitizedGroupName = sanitizeInput(groupName);
        const sanitizedMessage = sanitizeInput(message);
        const sanitizedImageUrl = imageUrl ? sanitizeInput(imageUrl) : null;

        const normalizedCronExpression = validateAndNormalizeCronExpression(cronExpression);
        console.log('Normalized cron expression:', normalizedCronExpression);

        const job = schedule.scheduleJob(normalizedCronExpression, async () => {
            console.log(`Executing scheduled job ${id} at ${new Date()}`);
            if (client.info) {
                try {
                    await sendTestMessage(sanitizedGroupName, sanitizedMessage, sanitizedImageUrl);
                    console.log(`Scheduled message sent to ${sanitizedGroupName} at ${new Date()}`);
                } catch (error) {
                    console.error('Failed to send scheduled message:', error);
                }
            } else {
                console.log('Client not ready. Skipping scheduled message.');
            }
        });

        scheduledJobs.set(id, {
            job,
            expression: normalizedCronExpression,
            groupName: sanitizedGroupName,
            message: sanitizedMessage,
            imageUrl: sanitizedImageUrl
        });
        console.log(`Job scheduled with ID: ${id}`);
        await saveJobs();
        return { id, cronExpression: normalizedCronExpression };
    } catch (error) {
        console.error('Error scheduling message:', error);
        throw error;
    }
}

async function cancelScheduledMessage(id) {
    console.log(`Attempting to cancel job with ID: ${id}`);
    const jobInfo = scheduledJobs.get(id);
    if (jobInfo && jobInfo.job) {
        jobInfo.job.cancel();
        scheduledJobs.delete(id);
        console.log(`Job cancelled successfully: ${id}`);
        await saveJobs();
        return true;
    }
    console.log(`Job not found: ${id}`);
    return false;
}

function getScheduledJobs() {
    return Array.from(scheduledJobs.entries()).map(([id, jobInfo]) => {
        return {
            id,
            next: jobInfo.job.nextInvocation(),
            groupName: jobInfo.groupName,
            message: jobInfo.message,
            imageUrl: jobInfo.imageUrl,
            expression: jobInfo.expression
        };
    });
}

// Load jobs when the module is imported
loadJobs();

module.exports = { sendMessage, sendTestMessage, scheduleMessage, getScheduledJobs, cancelScheduledMessage };