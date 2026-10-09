import { ChefHat } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/FormControls';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Recipe Composer`;
  }, [title]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-emerald-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <ChefHat aria-hidden="true" className="size-7" />
          </span>
          <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
          <p className="mt-1 text-stone-600">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-stone-600">{footer}</p>
      </div>
    </main>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your recipes."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Email">
          {({ id }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Password">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
      <div className="mt-6 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
        Demo account (after seeding): <span className="font-mono">demo@recipes.local</span> /{' '}
        <span className="font-mono">Demo@12345</span>
      </div>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [submitError, setSubmitError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(undefined);
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
    } catch (err) {
      setSubmitError(errorMessage(err));
      setLoading(false);
    }
  };

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Build recipes from ingredients and other recipes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          )}
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
          )}
        </Field>
        {submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {submitError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
