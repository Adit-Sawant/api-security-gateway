import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { StructuredLoggerService } from '../logger/structured-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const requestId = request.headers['x-request-id'];

    this.logger.error('HTTP exception occurred', {
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode,
      error: errorMessage,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(statusCode).json({
      statusCode,
      message:
        statusCode === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
