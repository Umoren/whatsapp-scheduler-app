const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { createModuleLogger } = require('../middlewares/logger');
const { supabase } = require('../utils/supabaseClient');
const NodeCache = require('node-cache');

const logger = createModuleLogger('UserSessionManager');

const BASE_AUTH_PATH = process.env.FLY_APP_NAME ? '/app/.wwebjs_auth' : path.join(__dirname, '..', '..', '.wwebjs_auth');

class UserSessionManager {
    constructor() {
        this.sessions = new Map();
        this.stateCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    }

    async getSessionState(userId) {
        logger.debug(`Getting session state for user ${userId}`);

        // Check in-memory cache first
        let cachedState = this.stateCache.get(userId);
        if (cachedState) {
            logger.debug(`Retrieved cached state for user ${userId}`);
            return cachedState;
        }

        // Check in-memory sessions
        const session = this.sessions.get(userId);
        if (session) {
            logger.debug(`Retrieved session state for user ${userId}:`, session.state);
            return session.state;
        }

        // If not in memory, check Supabase
        try {
            const { data, error } = await supabase
                .from('user_whatsapp_sessions')
                .select('state')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    logger.debug(`No session found for user ${userId}`);
                    return null;
                }
                logger.error(`Failed to fetch session state from Supabase for user ${userId}:`, error);
                throw error;
            }

            logger.debug(`Retrieved persisted state for user ${userId}:`, data?.state);
            this.stateCache.set(userId, data?.state);
            return data?.state || null;
        } catch (error) {
            logger.error(`Unexpected error fetching session state for user ${userId}:`, error);
            return null;
        }
    }

    async getOrCreateSession(userId) {
        logger.debug(`Getting or creating session for user ${userId}`);
        let session = this.sessions.get(userId);

        if (!session || !session.state.isInitialized) {
            logger.info(`Creating new WhatsApp client for user ${userId}`);
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `user-${userId}`,
                    dataPath: path.join(BASE_AUTH_PATH, userId)
                }),
                puppeteer: {
                    args: [
                        "--no-sandbox", "--disable-setuid-sandbox", "--headless=new", "--single-process"
                    ],
                    headless: false
                },
            });

            session = {
                client,
                state: {
                    isInitialized: false,
                    isAuthenticated: false,
                    qrCode: null,
                    lastHeartbeat: Date.now()
                }
            };

            this.sessions.set(userId, session);
            this.setupClientListeners(userId, client);

            try {
                logger.debug(`Initializing client for user ${userId}`);
                await client.initialize();
                await this.updateSessionState(userId, { isInitialized: true });
                logger.info(`WhatsApp client initialized for user ${userId}`);
            } catch (error) {
                logger.error(`Failed to initialize WhatsApp client for user ${userId}`, error);
                throw error;
            }
        }

        return session;
    }

    setupClientListeners(userId, client) {
        client.on('qr', async (qr) => {
            logger.info(`QR RECEIVED for user ${userId}`);
            try {
                const qrImageData = await qrcode.toDataURL(qr);
                await this.updateSessionState(userId, { qrCode: qrImageData, isAuthenticated: false });
            } catch (error) {
                logger.error(`Failed to generate QR code for user ${userId}:`, error);
            }
        });

        client.on('ready', () => {
            logger.info(`Client is ready for user ${userId}`);
            this.updateSessionState(userId, { isAuthenticated: true, qrCode: null });
        });

        client.on('authenticated', () => {
            logger.info(`Client is authenticated for user ${userId}`);
            this.updateSessionState(userId, { isAuthenticated: true, qrCode: null });
        });

        client.on('auth_failure', (msg) => {
            logger.error(`Authentication failure for user ${userId}:`, msg);
            this.updateSessionState(userId, { isAuthenticated: false, qrCode: null });
        });

        client.on('disconnected', async (reason) => {
            logger.warn(`Client was disconnected for user ${userId}`, reason);
            await this.updateSessionState(userId, {
                isAuthenticated: false,
                qrCode: null,
                isInitialized: false
            });
            // We'll reinitialize in getOrCreateSession when needed
        });
    }

    async updateSessionState(userId, newState) {
        const session = this.sessions.get(userId);
        if (session) {
            session.state = { ...session.state, ...newState };
            this.sessions.set(userId, session);
            this.stateCache.set(userId, session.state);
            await this.persistSessionState(userId);
        }
    }

    async persistSessionState(userId) {
        logger.info(`Attempting to persist session state for user ${userId}`);
        const session = this.sessions.get(userId);
        if (!session) {
            logger.warn(`No session found for user ${userId}, skipping persistence`);
            return;
        }

        try {
            const dataToInsert = {
                user_id: userId,
                state: session.state,
                last_activity: new Date().toISOString()
            };
            logger.info('Attempting to persist data');
            const { error } = await supabase
                .from('user_whatsapp_sessions')
                .upsert(dataToInsert);

            if (error) {
                logger.error(`Failed to persist session state for user ${userId}:`, { error });
            } else {
                logger.info(`Successfully persisted session state for user ${userId}`);
            }
        } catch (error) {
            logger.error(`Unexpected error persisting session state for user ${userId}:`, { error });
        }
    }

    async updateSessionHeartbeat(userId) {
        const now = Date.now();
        await this.updateSessionState(userId, { lastHeartbeat: now });

        // Update the last_activity in Supabase
        try {
            const { error } = await supabase
                .from('user_whatsapp_sessions')
                .update({ last_activity: new Date(now).toISOString() })
                .eq('user_id', userId);

            if (error) {
                logger.error(`Failed to update last_activity in Supabase for user ${userId}:`, error);
            }
        } catch (error) {
            logger.error(`Unexpected error updating last_activity in Supabase for user ${userId}:`, error);
        }
    }

    async removeSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            try {
                await session.client.destroy();
                this.sessions.delete(userId);
                this.stateCache.del(userId);
                await supabase
                    .from('user_whatsapp_sessions')
                    .delete()
                    .match({ user_id: userId });
                logger.info(`Session removed for user ${userId}`);
            } catch (error) {
                logger.error(`Error removing session for user ${userId}:`, error);
                throw error;
            }
        }
    }
}

module.exports = new UserSessionManager();