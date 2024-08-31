const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const { loggingMiddleware } = require('./logger');
const path = require('path');

function setupMiddleware(app) {
    // Trust proxy setup
    app.set('trust proxy', 1);

    // CORS setup
    app.use(cors({
        origin: ['https://whatsapp-scheduler-client.vercel.app', 'https://whatsapp-scheduler.fly.dev'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    // Body parsing middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Logging middleware
    app.use(loggingMiddleware);

    // Rate limiting
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

    // Apply rate limiting to static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(staticFileLimiter, express.static(path.join(__dirname, '..', '..', 'client', 'dist')));
        app.get('*', catchAllLimiter, (req, res) => {
            res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
        });
    }
}

module.exports = { setupMiddleware };