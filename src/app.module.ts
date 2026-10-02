import { MiddlewareConsumer, Module, NestModule, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { configuration } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { QueueRootModule } from './queue/queue.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RedisInfraModule } from './redis/redis.module';
import { SemanticCacheModule } from './semantic-cache/semantic-cache.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    RedisInfraModule,
    QueueRootModule,
    AiModule.register(),
    SemanticCacheModule.register(),
    UsersModule,
    AuthModule,
    CatalogModule,
    EventsModule,
    RecommendationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // 등록 순서 = 바깥쪽부터. Logging 이 Timeout 과 Response 를 감싼다.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
