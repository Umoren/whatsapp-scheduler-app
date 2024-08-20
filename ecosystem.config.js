module.exports = {
    apps: [
        {
            name: 'whatsapp-scheduler-backend',
            script: 'src/server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env_production: {
                NODE_ENV: 'production',
            },
            env_staging: {
                NODE_ENV: 'staging',
            }
        },
        {
            name: 'whatsapp-scheduler-frontend',
            script: 'npm',
            args: 'run preview',
            env_production: {
                NODE_ENV: 'production',
            },
            env_staging: {
                NODE_ENV: 'staging',
            }
        }
    ]
};