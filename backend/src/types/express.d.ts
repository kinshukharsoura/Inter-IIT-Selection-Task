import { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. */
      user?: AuthUser;
    }
  }
}

export {};
