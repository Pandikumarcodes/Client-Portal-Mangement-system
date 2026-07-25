import { NavLink } from 'react-router';
import { USER_ROLE } from '../features/auth/auth.constants.js';
import { useAuth } from '../features/auth/use-auth.js';

export function AppNavigation() {
  const { status, user, logout } = useAuth();
  if (status !== 'authenticated') return null;

  return (
    <nav className="app-navigation" aria-label="Main navigation">
      {user?.role === USER_ROLE.ORGANIZATION_ADMIN && (
        <>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/admin">Home</NavItem>
          <NavItem to="/admin/clients">Clients</NavItem>
          <NavItem to="/projects">Projects</NavItem>
        </>
      )}
      {user?.role === USER_ROLE.SUPER_ADMIN && (
        <>
          <NavItem to="/super-admin">Platform Overview</NavItem>
          <NavItem to="/super-admin/organizations">Organizations</NavItem>
        </>
      )}
      <button type="button" className="nav-logout" onClick={logout}>Log out</button>
    </nav>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
    >
      {children}
    </NavLink>
  );
}
