const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const config = require('../config');
const { client } = require('./whatsappClient');

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

    console.log('Searching for group: Desert Island Support Group.');
    const group = chats.find(chat => chat.name === "Desert Island Support Group.");

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

module.exports = { sendMessage };