import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);
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
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port);
  logger.log(`pick-flow listening on ${port} (AI=${config.get<string>('ai.provider')})`);
}

void bootstrap();
