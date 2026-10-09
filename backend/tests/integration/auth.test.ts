import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, prisma, registerUser, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/register', () => {
  it('creates a user, hashes the password and returns a token', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'Alice@Example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(typeof res.body.data.token).toBe('string');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
    expect(stored.passwordHash).not.toBe('secret123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash
  });

  it('rejects a duplicate email with 409', async () => {
    const body = { name: 'Alice', email: 'alice@example.com', password: 'secret123' };
    await api().post('/api/auth/register').send(body);
    const res = await api()
      .post('/api/auth/register')
      .send({ ...body, email: 'ALICE@example.com' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'An account with this email already exists',
    });
  });

  it.each([
    [{ name: 'A', email: 'not-an-email', password: 'secret123' }, 'email'],
    [{ name: 'A', email: 'a@example.com', password: 'short' }, 'password'],
    [{ email: 'a@example.com', password: 'secret123' }, 'name'],
  ])('validates input (%j)', async (body, field) => {
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toContain(field);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await api()
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'secret123' });
  });

  it('returns a token for valid credentials', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('bob@example.com');
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrong = await api()
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'nope12345' });
    const unknown = await api()
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'secret123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });
});

describe('GET /api/auth/me and protected routes', () => {
  it('returns the current user for a valid token', async () => {
    const user = await registerUser('Carol');
    const res = await api().get('/api/auth/me').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, name: 'Carol' });
  });

  it('rejects missing, malformed, tampered and expired tokens', async () => {
    const user = await registerUser();
    const expired = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        expiresIn: -10,
      },
    );
    const forged = jwt.sign(
      { sub: user.id, email: user.email },
      'some-other-secret-that-is-long-enough!!',
    );

    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Token abc')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(
      401,
    );
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token has expired');
  });

  it('protects all recipe and ingredient endpoints', async () => {
    for (const path of ['/api/recipes', '/api/ingredients', '/api/units']) {
      const res = await api().get(path);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it('serves a public health check', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    const missing = await api().get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);

    const malformed = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ success: false, message: 'Malformed JSON in request body' });
  });
});
