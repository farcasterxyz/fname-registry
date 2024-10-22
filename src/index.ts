import './tracing.js';
import { app } from './app.js';
import { log } from './log.js';

const port = parseInt(process.env.PORT || '3000');
const server = app.listen(port, '0.0.0.0', () => {
  log.info(`⚡️[server]: Server is running at http://0.0.0.0:${port}`);
});

// Ensure this is larger than the ALB's keep-alive timeout (default 60s).
// See: https://adamcrowder.net/posts/node-express-api-and-aws-alb-502/
server.keepAliveTimeout = 61000;

const gracefulShutdown = async () => {
  // TODO: Close any open connections/resources to other services (currently none?)
  process.exit();
};

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async (signalName: string) => {
    log.info(`Process received signal ${signalName}`);
    process.exitCode =
      {
        SIGINT: 130,
        SIGTERM: 143,
      }[signalName] || 1;
    await gracefulShutdown();
  });
}

process.on('exit', (code) => {
  log.info(`Exiting process with code ${code}`);
});
