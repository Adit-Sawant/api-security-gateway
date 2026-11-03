import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { RateLimitingModule } from './rate-limiter/rate-limiter.module';
import { GatewayModule } from './gateway/gateway.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import rateLimitConfig from './config/rate-limit.config';
import { validateEnvironment } from './config/env.validation';
import { AppController } from './app.controller';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [rateLimitConfig],
      validate: validateEnvironment,
    }),

    AuthModule,
    UsersModule,
    SubscriptionsModule,
    RateLimitingModule,
    GatewayModule,
    RedisModule,
    HealthModule,
    MetricsModule
  ],
  controllers: [AppController],
  providers: [
    StructuredLoggerService,
    HttpExceptionFilter
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
