import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { unauthorized } from '../utils/errors';

/**
 * Requires a valid `Authorization: Bearer <jwt>` header. The token's subject
 * must still exist as a user (so tokens of deleted accounts stop working).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  const payload = verifyToken(header.slice('Bearer '.length).trim());
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw unauthorized('User no longer exists');

  req.user = user;
  next();
}

/** Returns the authenticated user's id; only valid behind `authenticate`. */
export function currentUserId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}
