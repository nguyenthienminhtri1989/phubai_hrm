module.exports = {
  apps: [
    {
      name: "phubai-hrm",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      // DÒNG QUAN TRỌNG NHẤT: Trỏ trực tiếp vào thư mục làm việc của Runner HRM
      cwd: "D:\\actions-runner-hrm\\_work\\phubai-hrm\\phubai-hrm",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G", // Thêm giới hạn RAM để server chạy ổn định hơn
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
