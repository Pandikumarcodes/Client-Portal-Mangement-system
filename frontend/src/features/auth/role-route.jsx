import { Navigate, Outlet } from "react-router";
import { getRoleHome } from "./get-role-home.js";
import { useAuth } from "./use-auth.js";

export function RoleRoute({ allowedRoles }) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0)
    throw new TypeError("RoleRoute requires a non-empty allowedRoles array.");
  const { status, user } = useAuth();
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user?.role))
    return <Navigate to={getRoleHome(user?.role)} replace />;
  return <Outlet />;
}
