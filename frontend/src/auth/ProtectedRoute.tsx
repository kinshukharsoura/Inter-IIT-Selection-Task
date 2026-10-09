import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/States';
import { useAuth } from './AuthContext';

/** Renders child routes only for signed-in users; otherwise redirects to /login. */
export function ProtectedRoute() {
  const { status, retrySession, logout } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Restoring your session…" />;
  if (status === 'unavailable') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <ErrorState
          message="Cannot reach the server to restore your session."
          onRetry={retrySession}
        />
        <button type="button" onClick={logout} className="text-sm text-stone-600 underline">
          Sign out instead
        </button>
      </div>
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** For /login and /register: signed-in users continue to where they were going (or the dashboard). */
export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner label="Loading…" />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/recipes'} replace />;
  }
  return <Outlet />;
}
