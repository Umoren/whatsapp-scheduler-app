const rateLimit = require('express-rate-limit');

const messageLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    max: 5, // Limit each user to 5 requests per day
    message: {
        error: 'Rate limit exceeded',
        message: `You have exceeded the 5 messages per day limit. Please try again tomorrow.`
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user ? req.user.id : req.ip;
    },
    trustProxy: true
});

module.exports = messageLimiter;