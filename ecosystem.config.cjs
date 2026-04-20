/**
 * MWCode — Configuração PM2 (para rodar em VPS/produção)
 * Uso:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'mwcode',
      script: './server/src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
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
      time: true
    }
  ]
};
