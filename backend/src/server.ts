import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(env.PORT, () => {
  console.info(`Recipe API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
