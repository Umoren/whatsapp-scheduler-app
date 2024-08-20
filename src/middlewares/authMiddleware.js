const { supabase } = require('../utils/supabaseClient');
const { createModuleLogger } = require('./logger');
const { UnauthorizedError } = require('../utils/errors');

const logger = createModuleLogger('authMiddleware');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('No token provided');
        return next(new UnauthorizedError('No token provided'));
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) throw error;
        if (!user) throw new Error('User not found');
        req.user = user;
        logger.info('User authenticated', { userId: user.id });
        next();
    } catch (error) {
        logger.error('Authentication failed', { error });
        next(new UnauthorizedError('Invalid token'));
    }
};

module.exports = authMiddleware;