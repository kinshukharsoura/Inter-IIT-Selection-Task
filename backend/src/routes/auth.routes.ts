import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_MAX_REQUESTS = 50;

/** Brute-force protection for credential endpoints (disabled in tests). */
const credentialsLimiter = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  limit: AUTH_RATE_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many attempts, please try again later' },
});

export const authRouter = Router();
authRouter.post('/register', credentialsLimiter, auth.register);
authRouter.post('/login', credentialsLimiter, auth.login);
authRouter.get('/me', authenticate, auth.me);
