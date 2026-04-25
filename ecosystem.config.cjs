/**
 * MWCode — Configuração PM2 (para rodar em VPS/produção)
 * Uso:
 *   pnpm build              # Primeiro faça o build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'mwcode',
      script: './server/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '500M',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};