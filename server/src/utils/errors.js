class AppError extends Error {
    constructor(message, statusCode, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad Request', stack = '') {
        super(message, 400, true, stack);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', stack = '') {
        super(message, 401, true, stack);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', stack = '') {
        super(message, 403, true, stack);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Not Found', stack = '') {
        super(message, 404, true, stack);
    }
}

class WhatsAppClientError extends AppError {
    constructor(message = 'WhatsApp Client Error', stack = '') {
        super(message, 500, true, stack);
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    WhatsAppClientError
};