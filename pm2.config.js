// Configures the process manager we use (pm2) for the NodeJS server.
//
// This is used by both dev and prod, though they are invoked using different
// commands (pm2-dev and pm2-runtime, respectively).

const prod = process.env.ENVIRONMENT === 'prod';

module.exports = {
  apps: [
    {
      name: `fname-registry-api`,
      interpreter: prod ? undefined : './node_modules/.bin/ts-node',
      script: prod ? `./index.js` : `./src/index.ts`,
      exec_mode: 'cluster',
      kill_timeout: prod ? 10_000 : 1_000,
      kill_retry_time: 5_000,
      exp_backoff_restart_delay: 1000, // On continued failures, starts app after 1000ms, 1500ms, 2250ms, etc.
      min_uptime: 10_000,
      instances: 'max',
      err_file: '/dev/stderr',
      log_type: prod ? 'json' : 'raw',
      watch_delay: 500,
      watch: prod ? false : ['src'],
      ignore_watch: ['node_modules'],
    },
  ],
};
