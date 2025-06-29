// ecosystem.config.js (của Backend)

module.exports = {
  apps: [
    {
      name: 'confhub-backend',
      script: 'dist/main.js',
      // ĐIỀU CHỈNH QUAN TRỌNG: Chỉ chạy 1 instance bên trong mỗi container
      instances: 1,
      exec_mode: 'cluster', // Vẫn giữ cluster mode để PM2 quản lý tốt hơn
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};