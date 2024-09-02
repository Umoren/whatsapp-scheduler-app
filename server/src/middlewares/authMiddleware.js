const { supabase } = require('../utils/supabaseClient');
const { createModuleLogger } = require('./logger');
const { UnauthorizedError } = require('../utils/errors');
const jwt = require('jsonwebtoken');
const config = require('../config');

const logger = createModuleLogger('authMiddleware');

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('No token provided');
        return next(new UnauthorizedError('No token provided'));
    }

    try {
        const decodedToken = jwt.verify(token, config.JWT_SECRET);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            if (error?.status === 401) {
                logger.warn('Token expired, attempting to refresh');
                const { data, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: decodedToken.refresh_token });
                if (refreshError) throw refreshError;

                user = data.user;
                res.setHeader('X-New-Token', data.session.access_token);
            } else {
                throw error || new Error('User not found');
            }
        }

        req.user = user;
        logger.info('User authenticated', { userId: user.id });

        // Update last activity
        await supabase
            .from('user_whatsapp_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('user_id', user.id);

        next();
    } catch (error) {
        logger.error('Authentication failed', { error });
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

module.exports = authMiddleware;