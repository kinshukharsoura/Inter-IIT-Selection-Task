import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { RecipeGraphError } from '../domain/recipeTree';
import { AppError, ErrorDetail } from '../utils/errors';

interface ErrorBody {
  success: false;
  message: string;
  errors?: ErrorDetail[] | Record<string, unknown>;
  stack?: string;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
}

/** Central error → HTTP response mapping. Never leaks stack traces in production. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const { status, body } = toResponse(err);
  if (status >= 500) {
    // Unexpected failure: log it server-side (stderr), but return a generic message.
    console.error(err);
    if (env.NODE_ENV !== 'production' && err instanceof Error) body.stack = err.stack;
  }
  res.status(status).json(body);
}

function toResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: {
        success: false,
        message: err.message,
        ...(err.details ? { errors: err.details } : {}),
      },
    };
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = errors[0];
    const message = first
      ? `Validation failed: ${first.path ? `${first.path}: ` : ''}${first.message}`
      : 'Validation failed';
    return { status: 400, body: { success: false, message, errors } };
  }

  if (err instanceof RecipeGraphError) {
    return { status: 422, body: { success: false, message: err.message } };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return {
          status: 409,
          body: { success: false, message: 'A record with this name already exists' },
        };
      case 'P2003':
        return {
          status: 409,
          body: {
            success: false,
            message: 'This record is referenced by other data and cannot be changed',
          },
        };
      case 'P2028':
        // Interactive transaction timed out (e.g. heavy contention on the per-user lock).
        return {
          status: 503,
          body: { success: false, message: 'The server is busy, please retry the request' },
        };
      case 'P2025':
        return { status: 404, body: { success: false, message: 'Resource not found' } };
    }
  }

  if (isHttpError(err)) {
    // body-parser errors: malformed JSON (400), payload too large (413), ...
    const message =
      err.type === 'entity.parse.failed' ? 'Malformed JSON in request body' : err.message;
    return { status: err.status, body: { success: false, message } };
  }

  return { status: 500, body: { success: false, message: 'Internal server error' } };
}

function isHttpError(err: unknown): err is { status: number; message: string; type?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
  );
}
