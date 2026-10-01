import 'reflect-metadata';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { AppModule } from './app.module';
import { FileLogger } from './common/logging/file-logger';
import { QUEUE_PRODUCT_EMBEDDING, QUEUE_PROFILE_REFRESH, QUEUE_USER_EVENTS } from './queue/queue.constants';

async function bootstrap(): Promise<void> {
  const logger = new FileLogger();
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.enableShutdownHooks();

  if (config.get<string>('app.env') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('pick-flow')
        .setDescription('Redis semantic cache와 BullMQ로 실시간 개인화 추천을 제공하는 B2C API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    mountBullBoard(app);
  }

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port);
  logger.log(
    `pick-flow listening on ${port} (AI=${config.get<string>('ai.provider')}, loadTest=${config.get<boolean>('app.loadTest') === true})`,
    'Bootstrap',
  );
}

function mountBullBoard(app: INestApplication): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const names = [QUEUE_USER_EVENTS, QUEUE_PROFILE_REFRESH, QUEUE_PRODUCT_EMBEDDING];
  createBullBoard({
    queues: names.map((name) => new BullMQAdapter(app.get<Queue>(getQueueToken(name), { strict: false }))),
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());
}

void bootstrap();
