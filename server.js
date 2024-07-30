const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

let qrImageData = '';
let isLoading = true;
let isClientReady = false;
const TIMEZONE = 'Europe/London';

let cachedImageMedia = null;
const WELCOME_IMAGE_URL = "https://i.imgur.com/5UFYCmC.jpeg";

fs.readdir('/app/.wwebjs_auth')
    .then(files => console.log('Contents of .wwebjs_auth:', files))
    .catch(err => console.error('Error reading .wwebjs_auth:', err));

fs.access('/app/.wwebjs_auth', fs.constants.R_OK | fs.constants.W_OK)
    .then(() => console.log('.wwebjs_auth is readable and writable'))
    .catch(err => console.error('Permission error on .wwebjs_auth:', err));

function getAuthPath() {
    // Check if we're running in a Fly.io environment
    if (process.env.FLY_APP_NAME) {
        return '/app/.wwebjs_auth';
    } else {
        // Local development path
        return path.join(__dirname, '.wwebjs_auth');
    }
}

async function testVolumePersistence() {
    const testFile = path.join(AUTH_PATH, 'persistence_test.txt');
    const timestamp = new Date().toISOString();

    try {
        await fs.writeFile(testFile, `Test at ${timestamp}`);
        console.log(`Wrote test file at ${timestamp}`);

        const content = await fs.readFile(testFile, 'utf8');
        console.log('Read test file:', content);
    } catch (error) {
        console.error('Error in persistence test:', error);
    }
}

const AUTH_PATH = getAuthPath();
const sessionDir = path.join(AUTH_PATH, 'session');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'my-wwebjs-client',
        dataPath: sessionDir
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

async function initializeApp() {
    try {
        await testVolumePersistence();

        await fs.mkdir(sessionDir, { recursive: true });
        console.log('Session directory created or already exists');

        await client.initialize();
    } catch (err) {
        console.error('Error during app initialization:', err);
    }
}

// Call the initialization function
initializeApp();

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    try {
        qrImageData = await qrcode.toDataURL(qr);
        isLoading = false;
    } catch (error) {
        console.error('Failed to generate QR code:', error);
    }
});

client.on('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;

    cron.schedule('15 7 * * *', async () => {
        console.log('Performing daily connection check...', new Date().toISOString());
        try {
            if (!client.info) {
                console.log('Client not connected, reconnecting...');
                await client.initialize();
            }
            // Ping healthchecks.io
            await axios.get('https://hc-ping.com/f51fcce0-5129-4c2d-bbce-ae2fe970cbe6');
        } catch (error) {
            console.error('Connection check failed:', error);
            // You might want to ping a different URL for failures
            await axios.get('https://hc-ping.com/f51fcce0-5129-4c2d-bbce-ae2fe970cbe6/fail');
        }
    }, {
        timezone: TIMEZONE
    });


    // Schedule the message to be sent at 7:20 AM GMT+1 every day
    cron.schedule('20 7 * * *', () => {
        if (isClientReady) {
            sendMessage().catch(error => console.error('Scheduled message failed:', error));
        }
    }, {
        timezone: TIMEZONE
    });
});


client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

client.on('disconnected', async (reason) => {
    console.log('Client was disconnected', reason);
    isClientReady = false;

    // Wait a bit before attempting to reconnect
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Attempt to reinitialize
    try {
        await client.initialize();
    } catch (e) {
        console.error('Failed to reinitialize client:', e);
    }
});

async function getImageMedia() {
    if (cachedImageMedia) {
        console.log('Using cached image data');
        return cachedImageMedia;
    }

    console.log('Downloading image...');
    try {
        const response = await axios.get(WELCOME_IMAGE_URL, { responseType: 'arraybuffer' });
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

let groupId = null;

async function findGroupId() {
    if (groupId) return groupId;

    const groupName = "Desert Island Support Group.";
    const chats = await client.getChats();
    const group = chats.find(chat => chat.name === groupName);

    if (group) {
        groupId = group.id._serialized;
        console.log('Group ID found and stored:', groupId);
        return groupId;
    } else {
        throw new Error('Group not found');
    }
}


async function sendMessage() {
    if (!isClientReady) {
        throw new Error('Client is not ready');
    }

    if (!client.info) {
        console.log('Client not ready, attempting to reconnect...');
        await client.initialize();
        // Wait for client to be ready
        await new Promise(resolve => client.once('ready', resolve));
    }

    const message = `Hi Islanders!

Join the Desert Island meeting:

Zoom Code:  ${process.env.ZOOM_CODE || '92642189858'}
Password: ${process.env.ZOOM_PASSWORD || 'Recovery'}

Or use the link:
${process.env.ZOOM_LINK || 'https://zoom.us/j/92642189858?pwd=TUpkVElab1JTVTMzV1FGelRXYU9VZz09#success'}`;

    try {
        const id = await findGroupId();
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
    }
}

app.get('/qr', (req, res) => {
    if (isLoading) {
        res.send(`
            <html>
                <body>
                    <h1>Loading QR Code...</h1>
                    <script>
                        setTimeout(() => {
                            window.location.reload();
                        }, 5000);
                    </script>
                </body>
            </html>
        `);
    } else if (qrImageData) {
        res.send(`<img src="${qrImageData}">`);
    } else {
        res.status(404).send('QR code not available. Please try again later.');
    }
});

app.get('/', (req, res) => {
    res.redirect('/qr');
});

// New route to manually trigger the message
app.get('/send-test', async (req, res) => {
    if (!isClientReady) {
        res.status(503).send('Client is not ready. Please try again later.');
        return;
    }

    try {
        await sendMessage();
        res.send('Test message sent');
    } catch (error) {
        console.error('Manual test failed:', error);
        res.status(500).send('Failed to send test message');
    }
});



app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});

const MAX_RETRIES = 5;
const RETRY_DELAY = 10000; // 10 seconds

async function initializeWithRetry() {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Attempt ${i + 1} to initialize client...`);
            await client.initialize();
            console.log('Client initialized successfully');
            return;
        } catch (error) {
            console.error(`Failed to initialize client (attempt ${i + 1}):`, error);
            if (i < MAX_RETRIES - 1) {
                console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    throw new Error('Failed to initialize client after multiple attempts');
}

initializeWithRetry().catch(err => console.error('Final initialization error:', err));


process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing WhatsApp client...');
    await client.destroy();
    process.exit(0);
});