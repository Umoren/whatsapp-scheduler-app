const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { loggingMiddleware } = require('./logger');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

function setupMiddleware(app) {
    console.log('Setting up middleware...');

    app.set('trust proxy', 1);

    app.use(cors({
        origin: ['https://whatsapp-scheduler-client.vercel.app', 'https://whatsapp-scheduler.fly.dev'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(loggingMiddleware);

    // Rate limiting setup
    const staticFileLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip,
    });

    const catchAllLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip,
    });

    const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    console.log('Client dist path:', clientDistPath);
    console.log('Current directory:', __dirname);
    console.log('Does client dist exist?', fs.existsSync(clientDistPath));

    if (fs.existsSync(clientDistPath)) {
        console.log('Contents of client dist:', fs.readdirSync(clientDistPath));

        // Serve static files from the client/dist directory
        app.use(staticFileLimiter, express.static(clientDistPath));

        // Handle client-side routing
        app.get('*', catchAllLimiter, (req, res) => {
            res.sendFile(path.join(clientDistPath, 'index.html'));
        });
    } else {
        console.log('Client dist folder not found. Skipping static file serving.');
    }

    console.log('Middleware setup complete.');
}

module.exports = { setupMiddleware };