require('dotenv').config({ path: "../.env" })

module.exports = {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: process.env.JWT_SECRET,

    // Memory Monitor Configuration
    memoryMonitor: {
        checkInterval: 5 * 60 * 1000, // 5 minutes
        heapGrowthThreshold: 0.1, // 10% growth
        consecutiveIncreases: 3,
        maxHeapSizeMB: 1024, // Adjust based on your server's RAM
        gcThresholdMB: 256
    }
};