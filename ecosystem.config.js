module.exports = [
  {
    script: "main.js",
    name: "RisPort Data",
    autorestart: true,
    exp_backoff_restart_delay: 60000,
    env: {
      NODE_ENV: "development"
    }
  }
];
