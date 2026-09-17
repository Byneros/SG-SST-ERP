import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/env';

async function bootstrapWorker() {
  assertProductionEnv();
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  logger.log('SG-SST worker is running');

  const shutdown = async () => {
    logger.log('Stopping SG-SST worker');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

void bootstrapWorker();
