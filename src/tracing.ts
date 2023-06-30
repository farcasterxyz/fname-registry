import { tracer } from 'dd-trace';
import { ENVIRONMENT, SERVICE } from './env.js';

tracer.init({
  env: ENVIRONMENT,
  // Service name that appears in the Datadog UI
  service: SERVICE,
  // Include trace ID in log messages
  logInjection: ENVIRONMENT !== 'test',
  // Collect metrics on NodeJS CPU, memory, heap, event loop delay, GC events, etc.
  // See https://docs.datadoghq.com/tracing/runtime_metrics/nodejs#data-collected
  // for a list of statsd metrics.
  runtimeMetrics: ENVIRONMENT !== 'test',
  // Log configuration on startup
  startupLogs: ENVIRONMENT === 'prod',
});

tracer.use('express', {
  enabled: true,
  service: SERVICE,
  blocklist: ['/_health'],
});

tracer.use('pg', {
  enabled: true,
  service: SERVICE,
});

tracer.use('http', {
  enabled: true,
  service: SERVICE,
});

tracer.use('http2', {
  enabled: true,
  service: SERVICE,
});

tracer.use('net', {
  enabled: true,
  service: SERVICE,
});
