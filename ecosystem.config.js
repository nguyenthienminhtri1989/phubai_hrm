const appCwd = process.env.PHUBAI_HRM_CWD || __dirname;
const appPort = process.env.PORT || "3000";

module.exports = {
  apps: [
    {
      name: "phubai-hrm",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${appPort}`,
      cwd: appCwd,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
