import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AuthUser, JwtPayload } from '../types/auth';
import { conflict, unauthorized } from '../utils/errors';
import { LoginInput, RegisterInput } from '../validators/auth.validators';

const JWT_ALGORITHM = 'HS256';
const publicUserSelect = { id: true, email: true, name: true, createdAt: true } as const;

export interface AuthResult {
  user: AuthUser & { createdAt: Date };
  token: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    select: publicUserSelect,
  });
  return { user, token: signToken(user) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password to avoid account enumeration.
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('Invalid email or password');

  const { id, email, name, createdAt } = user;
  return { user: { id, email, name, createdAt }, token: signToken(user) };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw unauthorized('User no longer exists');
  return user;
}

export function signToken(user: Pick<AuthUser, 'id' | 'email'>): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw unauthorized('Invalid token');
    }
    return { sub: decoded.sub, email: String(decoded.email ?? '') };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw unauthorized('Token has expired');
    throw unauthorized('Invalid token');
  }
}
