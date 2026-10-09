import { BookOpen, ChefHat, Leaf, LogOut, ShoppingCart } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

const navItems = [
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/ingredients', label: 'Ingredients', icon: Leaf },
  { to: '/shopping-list', label: 'Shopping list', icon: ShoppingCart },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/recipes" className="flex items-center gap-2 font-semibold text-stone-900">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ChefHat aria-hidden="true" className="size-5" />
            </span>
            <span className="hidden sm:inline">Recipe Composer</span>
          </NavLink>

          <nav aria-label="Main" className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                <span className="hidden md:inline">{label}</span>
                <span className="sr-only md:hidden">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-stone-600 sm:inline" title={user?.email}>
              {user?.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              icon={<LogOut aria-hidden="true" className="size-4" />}
            >
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
