module.exports = {
  apps: [
    {
      name: 'bot-sistemas',
      script: './index.js',
      cwd: './server',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 5050
      }
    }
  ]
};
