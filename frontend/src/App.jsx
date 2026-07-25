import { Navigate, Outlet, Route, Routes, Link } from 'react-router';
import { USER_ROLE } from './features/auth/auth.constants.js';
import { ProtectedRoute } from './features/auth/protected-route.jsx';
import { RoleRoute } from './features/auth/role-route.jsx';
import { getRoleHome } from './features/auth/get-role-home.js';
import { useAuth } from './features/auth/use-auth.js';
import { LoginPage } from './pages/login-page.jsx';
import { RegisterPage } from './pages/register-page.jsx';
import { AdminHomePage } from './pages/admin-home-page.jsx';
import { ClientHomePage } from './pages/client-home-page.jsx';
import { SuperAdminHomePage } from './pages/super-admin-home-page.jsx';
import { SuperAdminOrganizationsPage } from './pages/super-admin-organizations-page.jsx';
import { SuperAdminOrganizationDetailPage } from './pages/super-admin-organization-detail-page.jsx';
import { NotFoundPage } from './pages/not-found-page.jsx';
import { ClientListPage } from './pages/client-list-page.jsx';
import { ClientCreatePage } from './pages/client-create-page.jsx';
import { ClientDetailPage } from './pages/client-detail-page.jsx';
import { ProjectListPage } from './pages/project-list-page.jsx';
import { ProjectCreatePage } from './pages/project-create-page.jsx';
import { ProjectDetailPage } from './pages/project-detail-page.jsx';
import { ProjectEditPage } from './pages/project-edit-page.jsx';
import { MilestoneCreatePage } from './pages/milestone-create-page.jsx';
import { MilestoneDetailPage } from './pages/milestone-detail-page.jsx';
import { MilestoneEditPage } from './pages/milestone-edit-page.jsx';
import { ProjectFileUploadPage } from './pages/project-file-upload-page.jsx';
import { ProjectFileDetailPage } from './pages/project-file-detail-page.jsx';
import { ProjectFileEditPage } from './pages/project-file-edit-page.jsx';
import { InvoiceCreatePage } from './pages/invoice-create-page.jsx';
import { InvoiceDetailPage } from './pages/invoice-detail-page.jsx';
import { InvoiceEditPage } from './pages/invoice-edit-page.jsx';
import { OrganizationDashboardPage } from './pages/organization-dashboard-page.jsx';
import { AppNavigation } from './components/app-navigation.jsx';

function PublicRoute() {
  const { status, user } = useAuth();
  if (status === 'loading') return <div className="loading-screen" role="status">Restoring your session…</div>;
  return status === 'authenticated' ? <Navigate to={getRoleHome(user?.role)} replace /> : <Outlet />;
}

export default function App() {
  return <main className="app-shell"><header className="app-header"><Link className="brand" to="/">Client Portal</Link><AppNavigation /></header><Routes>
    <Route path="/login" element={<PublicRoute />}><Route index element={<LoginPage />} /></Route>
    <Route path="/register" element={<PublicRoute />}><Route index element={<RegisterPage />} /></Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<RoleRoute allowedRoles={[USER_ROLE.ORGANIZATION_ADMIN]} />}>
        <Route path="/dashboard" element={<OrganizationDashboardPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/clients" element={<ClientListPage />} />
        <Route path="/admin/clients/new" element={<ClientCreatePage />} />
        <Route path="/admin/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:projectId/files/new" element={<ProjectFileUploadPage />} />
        <Route
          path="/projects/:projectId/files/:fileId/edit"
          element={<ProjectFileEditPage />}
        />
        <Route
          path="/projects/:projectId/files/:fileId"
          element={<ProjectFileDetailPage />}
        />
        <Route path="/projects/:projectId/invoices/new" element={<InvoiceCreatePage />} />
        <Route
          path="/projects/:projectId/invoices/:invoiceId/edit"
          element={<InvoiceEditPage />}
        />
        <Route
          path="/projects/:projectId/invoices/:invoiceId"
          element={<InvoiceDetailPage />}
        />
        <Route path="/projects/:projectId/milestones/new" element={<MilestoneCreatePage />} />
        <Route
          path="/projects/:projectId/milestones/:milestoneId"
          element={<MilestoneDetailPage />}
        />
        <Route
          path="/projects/:projectId/milestones/:milestoneId/edit"
          element={<MilestoneEditPage />}
        />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
      </Route>
      <Route element={<RoleRoute allowedRoles={[USER_ROLE.CLIENT]} />}><Route path="/client" element={<ClientHomePage />} /></Route>
      <Route element={<RoleRoute allowedRoles={[USER_ROLE.SUPER_ADMIN]} />}>
        <Route path="/super-admin" element={<SuperAdminHomePage />} />
        <Route path="/super-admin/organizations" element={<SuperAdminOrganizationsPage />} />
        <Route
          path="/super-admin/organizations/:organizationId"
          element={<SuperAdminOrganizationDetailPage />}
        />
      </Route>
    </Route>
    <Route path="/" element={<RootRedirect />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes></main>;
}

function RootRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <div className="loading-screen" role="status">Restoring your session…</div>;
  return <Navigate to={status === 'authenticated' ? getRoleHome(user?.role) : '/login'} replace />;
}
