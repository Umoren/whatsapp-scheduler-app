const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const efficientStringifier = winston.format((info) => {
    const stringifyReplacer = (key, value) => {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return value;
    };
    Object.keys(info).forEach((key) => {
        if (typeof info[key] === 'object' && info[key] !== null) {
            info[key] = JSON.stringify(info[key], stringifyReplacer);
        }
    });
    return info;
});

const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const fileRotateTransport = new DailyRotateFile({
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    dirname: path.join(__dirname, '..', 'logs'),
    format: winston.format.combine(
        efficientStringifier(),
        winston.format.timestamp(),
        winston.format.json()
    )
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels: logLevels,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                consoleFormat
            )
        }),
        fileRotateTransport
    ],
});

// Implement a circular buffer for recent logs
const recentLogs = [];
const MAX_RECENT_LOGS = 100;

const addToRecentLogs = (log) => {
    if (recentLogs.length >= MAX_RECENT_LOGS) {
        recentLogs.shift();
    }
    recentLogs.push(log);
};

// Optimized logging middleware
const loggingMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logEntry = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        };

        // Log to recent logs buffer
        addToRecentLogs(logEntry);

        // Only log to file if it's not a health check and duration is above threshold
        if (req.originalUrl !== '/health' && duration > 500) {
            logger.info('HTTP Request', logEntry);
        }
    });

    next();
};

// Function to create a logger for a specific module
const createModuleLogger = (moduleName) => {
    return logger.child({ module: moduleName });
};

// Function to get recent logs
const getRecentLogs = () => [...recentLogs];

module.exports = { logger, loggingMiddleware, createModuleLogger, getRecentLogs };