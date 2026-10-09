import { Navigate, Route, Routes } from 'react-router';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { IngredientsPage } from './pages/IngredientsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeCreatePage, RecipeEditPage } from './pages/RecipeEditorPages';
import { RecipesPage } from './pages/RecipesPage';
import { ShoppingListPage } from './pages/ShoppingListPage';

export function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/recipes" replace />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeCreatePage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/shopping-list" element={<ShoppingListPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
