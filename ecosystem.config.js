module.exports = {
    apps: [
        {
            name: 'tunnelforge_server',
            script: 'npm',
            args: 'run server:prod',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            log_date_format: 'YYYY-MM-DD HH:mm Z',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};