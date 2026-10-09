import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 bytes

const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Must be a valid email address' }));

export const registerSchema = z.object({
  name: z.string({ message: 'Name is required' }).trim().min(1, 'Name is required').max(80),
  email: emailSchema,
  password: z
    .string({ message: 'Password is required' })
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
