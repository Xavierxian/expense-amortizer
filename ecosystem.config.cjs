module.exports = {
  apps: [
    {
      name: "expense-amortizer",
      script: "./dist/index.cjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 5100
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
