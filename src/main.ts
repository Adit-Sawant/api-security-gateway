import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLoggerService } from './common/logger/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(StructuredLoggerService);

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableShutdownHooks();

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `API Gateway running at http://localhost:${process.env.PORT ?? 3000}`,
  );
}

bootstrap();
