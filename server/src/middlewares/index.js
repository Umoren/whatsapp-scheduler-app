const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { loggingMiddleware } = require('./logger');
const rateLimit = require('express-rate-limit');

function setupMiddleware(app) {
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

    if (process.env.NODE_ENV === 'production') {
        app.use(staticFileLimiter, express.static(path.join(__dirname, '..', '..', 'client', 'dist')));
        app.get('*', catchAllLimiter, (req, res) => {
            res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
        });
    }
}

module.exports = { setupMiddleware };