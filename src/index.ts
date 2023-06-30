import './tracing.js';
import { app } from './app.js';

const port = process.env.PORT || '3000';
const server = app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
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
    console.log(`Process received signal ${signalName}`);
    process.exitCode =
      {
        SIGINT: 130,
        SIGTERM: 143,
      }[signalName] || 1;
    await gracefulShutdown();
  });
}

process.on('exit', (code) => {
  console.log(`Exiting process with code ${code}`);
});
