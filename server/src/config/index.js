require('dotenv').config({ path: "../.env" })

module.exports = {
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};