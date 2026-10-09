import { Request, Response } from 'express';
import { currentUserId } from '../middleware/authenticate';
import * as authService from '../services/auth.service';
import { sendSuccess } from '../utils/http';
import { loginSchema, registerSchema } from '../validators/auth.validators';

export async function register(req: Request, res: Response) {
  const result = await authService.register(registerSchema.parse(req.body));
  sendSuccess(res, result, 201);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(loginSchema.parse(req.body));
  sendSuccess(res, result);
}

export async function me(req: Request, res: Response) {
  sendSuccess(res, await authService.getProfile(currentUserId(req)));
}
