import { Response } from 'express';

/** Consistent success envelope: `{ success: true, data, meta? }`. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): void {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}
