const path = require('path');

const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'kandahar-wms-backend',
      cwd: path.join(root, 'Backend'),
      script: 'dist/server.js',
      interpreter: 'node',
      autorestart: true,
      max_memory_restart: '512M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      listen_timeout: 15000,
      min_uptime: '10s',
      max_restarts: 10,
      time: true,
      filter_env: ['ANTHROPIC_', 'CLAUDE_', 'CODEX_', 'OPENAI_', 'GITHUB_', 'SLACK_', 'AWS_', 'GOOGLE_', 'AZURE_'],
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3001',
      },
    },
    {
      name: 'kandahar-wms-frontend',
      cwd: path.join(root, 'Frontend'),
      script: 'server.cjs',
      interpreter: 'node',
      autorestart: true,
      max_memory_restart: '384M',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      listen_timeout: 15000,
      min_uptime: '10s',
      max_restarts: 10,
      time: true,
      filter_env: ['ANTHROPIC_', 'CLAUDE_', 'CODEX_', 'OPENAI_', 'GITHUB_', 'SLACK_', 'AWS_', 'GOOGLE_', 'AZURE_'],
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '5000',
        API_HOST: '127.0.0.1',
        API_PORT: '3001',
      },
    },
  ],
};
