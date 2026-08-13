// Configuração do PM2 — mantém o PontoCerto rodando como serviço, reinicia
// sozinho se cair, e sobrevive a reboot da VPS (depois de `pm2 startup` +
// `pm2 save`, ver DEPLOY_HOSTGATOR_VPS.md).
//
// Uso:
//   pm2 start ecosystem.config.js
//   pm2 logs pontocerto
//   pm2 restart pontocerto   (depois de um deploy novo)
//   pm2 status
module.exports = {
  apps: [
    {
      name: 'pontocerto',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      autorestart: true,
      watch: false,
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
