const rateLimit = require('express-rate-limit');

const messageLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    max: 10, // Limit each IP to 10 requests per day
    message: {
        error: 'Rate limit exceeded',
        message: `You have exceeded the 5 messages per day limit. Please try again tomorrow.`
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = messageLimiter;