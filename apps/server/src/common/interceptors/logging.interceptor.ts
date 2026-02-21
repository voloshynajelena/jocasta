import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = (request as any).user?.id || 'anonymous';

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.log({
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            userId,
            ip,
            userAgent: userAgent.substring(0, 100),
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logger.error({
            method,
            url,
            error: error.message,
            duration: `${duration}ms`,
            userId,
            ip,
          });
        },
      }),
    );
  }
}
