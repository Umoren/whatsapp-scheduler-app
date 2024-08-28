const winston = require('winston');
const path = require('path');

// Custom format to properly stringify objects
const objectStringifier = winston.format((info) => {
    Object.keys(info).forEach((key) => {
        if (typeof info[key] === 'object' && info[key] !== null) {
            info[key] = JSON.stringify(info[key]);
        }
    });
    return info;
});

// Create a Winston logger
const logger = winston.createLogger({
    level: 'debug', // Set to 'debug' to capture all levels
    format: winston.format.combine(
        objectStringifier(),
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: path.join('logs', 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join('logs', 'combined.log') }),
    ],
});

// Always add console transport, but use different formats for different environments
logger.add(new winston.transports.Console({
    format: winston.format.combine(
        objectStringifier(),
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, module, ...rest }) => {
            return `${timestamp} ${level} ${module ? `[${module}] ` : ''}${message} ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''}`;
        })
    ),
}));

const loggingMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug('HTTP Request', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        });
    });

    next();
};

// Function to create a logger for a specific module
const createModuleLogger = (moduleName) => {
    return logger.child({ module: moduleName });
};

module.exports = { logger, loggingMiddleware, createModuleLogger };