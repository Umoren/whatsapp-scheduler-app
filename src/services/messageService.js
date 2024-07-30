const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const config = require('../config');
const { client } = require('./whatsappClient');

let cachedImageMedia = null;
let groupId = null;

async function getImageMedia() {
    if (cachedImageMedia) return cachedImageMedia;

    const response = await axios.get(config.WELCOME_IMAGE_URL, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const base64Image = imageBuffer.toString('base64');

    cachedImageMedia = new MessageMedia('image/jpeg', base64Image, '5UFYCmC.jpeg');
    return cachedImageMedia;
}

async function findGroupId() {
    if (groupId) return groupId;

    const chats = await client.getChats();
    const group = chats.find(chat => chat.name === "Desert Island Support Group.");

    if (group) {
        groupId = group.id._serialized;
        return groupId;
    } else {
        throw new Error('Group not found');
    }
}

async function sendMessage() {
    const message = `Hi Islanders!

Join the Desert Island meeting:

Zoom Code:  ${config.ZOOM_CODE}
Password: ${config.ZOOM_PASSWORD}

Or use the link:
${config.ZOOM_LINK}`;

    const id = await findGroupId();
    const chat = await client.getChatById(id);
    const media = await getImageMedia();

    await chat.sendMessage(media, { caption: message });
    console.log('Message and image sent successfully');
}

module.exports = { sendMessage };