import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { captureException } from "@shopflow/observability";

/**
 * Catches every uncaught exception, reports it to Sentry with tenant context,
 * then delegates to NestJS's default handling so the client still gets the
 * expected status code.
 *
 * 4xx HTTP exceptions (validation, unauthorized, not found) are NOT reported
 * — they're expected user errors and would drown out real bugs.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { auth?: { tenantId?: string } }>();

    let status = 500;
    let body: unknown = { statusCode: 500, message: "Internal server error" };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = exception.getResponse();
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error on ${req.method} ${req.url}: ${exception.message}`, exception.stack);
    }

    if (status >= 500) {
      captureException(exception, {
        tenantId: req.auth?.tenantId,
        extra: { method: req.method, url: req.url },
      });
    }

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }
}
