const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');
const { createModuleLogger } = require('../middlewares/logger');
const path = require('path');

const logger = createModuleLogger(path.basename(__filename));

const errorHandler = (err, req, res, next) => {
    logger.error('Error occurred', { error: err, stack: err.stack });

    if (err instanceof ZodError) {
        logger.warn('Validation error', { errors: err.errors });
        return res.status(400).json({
            error: 'Validation failed',
            details: err.errors.map(e => e.message)
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message
        });
    }

    // If it's not one of our custom errors, it's an unexpected error
    logger.error('Unexpected error', { error: err, stack: err.stack });
    res.status(500).json({
        error: 'An unexpected error occurred'
    });
};

module.exports = errorHandler;