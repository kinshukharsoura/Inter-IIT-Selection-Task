export interface ErrorDetail {
  path: string;
  message: string;
}

/** An expected, client-facing error carrying an HTTP status. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: ErrorDetail[] | Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: AppError['details']) =>
  new AppError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, message);
export const notFound = (message = 'Resource not found') => new AppError(404, message);
export const conflict = (message: string, details?: AppError['details']) =>
  new AppError(409, message, details);
export const unprocessable = (message: string) => new AppError(422, message);
