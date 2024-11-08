module.exports = [
  {
    script: "main.js",
    name: "RisPort Data",
    watch: true,
    autorestart: true,
    exp_backoff_restart_delay: 60000,
    stop_exit_codes: [1],
    env: {
      NODE_ENV: "development"
    }
  }
];
