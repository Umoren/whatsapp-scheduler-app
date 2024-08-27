const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { createModuleLogger } = require('../middlewares/logger');
const { supabase } = require('../utils/supabaseClient');

const logger = createModuleLogger('UserSessionManager');

const BASE_AUTH_PATH = process.env.FLY_APP_NAME ? '/app/.wwebjs_auth' : path.join(__dirname, '..', '..', '.wwebjs_auth');

class UserSessionManager {
    constructor() {
        this.sessions = new Map();
    }

    async getOrCreateSession(userId) {
        if (!this.sessions.has(userId)) {
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

            this.sessions.set(userId, {
                client,
                state: {
                    isInitialized: false,
                    isAuthenticated: false,
                    qrCode: null,
                    lastHeartbeat: Date.now()
                }
            });

            this.setupClientListeners(userId, client);

            try {
                await client.initialize();
                this.updateSessionState(userId, { isInitialized: true });
                logger.info(`WhatsApp client initialized for user ${userId}`);
            } catch (error) {
                logger.error(`Failed to initialize WhatsApp client for user ${userId}`, error);
                throw error;
            }
        }

        return this.sessions.get(userId);
    }

    setupClientListeners(userId, client) {
        client.on('qr', async (qr) => {
            logger.info(`QR RECEIVED for user ${userId}`);
            try {
                const qrImageData = await qrcode.toDataURL(qr);
                this.updateSessionState(userId, { qrCode: qrImageData });
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
            this.updateSessionState(userId, { isAuthenticated: false });
        });

        client.on('disconnected', (reason) => {
            logger.warn(`Client was disconnected for user ${userId}`, reason);
            this.sessions.delete(userId);
        });
    }

    updateSessionState(userId, newState) {
        const session = this.sessions.get(userId);
        if (session) {
            session.state = { ...session.state, ...newState };
            this.sessions.set(userId, session);
        }
    }

    async getSessionState(userId) {
        const session = this.sessions.get(userId);
        if (!session) {
            return null;
        }

        // Check if there's a persisted state in Supabase
        const { data, error } = await supabase
            .from('user_whatsapp_sessions')
            .select('state')
            .eq('user_id', userId)
            .single();

        if (error) {
            logger.error(`Failed to fetch session state from Supabase for user ${userId}:`, error);
        }

        // Merge persisted state with in-memory state
        const persistedState = data?.state || {};
        return { ...persistedState, ...session.state };
    }

    async persistSessionState(userId) {
        const session = this.sessions.get(userId);
        if (!session) {
            return;
        }

        try {
            const { error } = await supabase
                .from('user_whatsapp_sessions')
                .upsert({
                    user_id: userId,
                    state: session.state,
                    last_activity: new Date().toISOString()
                });

            if (error) {
                logger.error(`Failed to persist session state for user ${userId}:`, error);
                // If the error is due to the table not existing, we'll log it but not throw
                // This allows the application to continue functioning even if persistence fails
            }
        } catch (error) {
            logger.error(`Unexpected error persisting session state for user ${userId}:`, error);
        }
    }
    async updateSessionHeartbeat(userId) {
        this.updateSessionState(userId, { lastHeartbeat: Date.now() });
    }

    async removeSession(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            try {
                await session.client.destroy();
                this.sessions.delete(userId);
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