import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOrigins, env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { buildApiRouter } from './routes';

const JSON_BODY_LIMIT = '100kb';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind nginx / a PaaS load balancer
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api', buildApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
