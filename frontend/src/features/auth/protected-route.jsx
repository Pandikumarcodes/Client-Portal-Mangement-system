import { Navigate, Outlet } from 'react-router';
import { useAuth } from './use-auth.js';

export function ProtectedRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <div className="loading-screen" role="status">Restoring your session…</div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
}
