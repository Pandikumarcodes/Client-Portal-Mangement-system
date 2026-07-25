import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const getOrganizationDashboard = vi.hoisted(() => vi.fn());
vi.mock('../features/dashboard/dashboard-api.js', () => ({ getOrganizationDashboard }));
import { OrganizationDashboardPage } from './organization-dashboard-page.jsx';

const dashboard = {
  clients: { total: 12, active: 9, inactive: 3 },
  projects: { total: 15, active: 5, onHold: 2, completed: 6, archived: 2 },
  milestones: { total: 18, pending: 7, inProgress: 4, completed: 7 },
  files: { total: 20, active: 16, archived: 4 },
  invoices: { total: 11, draft: 2, sent: 3, paid: 5, void: 1 },
};

function renderPage(authOverrides = {}) {
  const auth = {
    accessToken: 'memory-token',
    clearSession: vi.fn(),
    ...authOverrides,
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<OrganizationDashboardPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return auth;
}

function section(name) {
  return screen.getByRole('heading', { level: 2, name }).closest('section');
}

function metric(sectionName, label) {
  return within(section(sectionName)).getByText(label).closest('div').querySelector('dd');
}

beforeEach(() => {
  getOrganizationDashboard.mockReset();
  getOrganizationDashboard.mockResolvedValue(dashboard);
  localStorage.clear();
  sessionStorage.clear();
});

describe('OrganizationDashboardPage', () => {
  it('renders the page title, subtitle, and initial loading state', () => {
    getOrganizationDashboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/current overview of your clients, projects, milestones, files, and invoices/i))
      .toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('renders all five summary sections with their approved counts', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'Clients' });

    expect(metric('Clients', 'Total')).toHaveTextContent('12');
    expect(metric('Clients', 'Active')).toHaveTextContent('9');
    expect(metric('Clients', 'Inactive')).toHaveTextContent('3');

    expect(metric('Projects', 'Total')).toHaveTextContent('15');
    expect(metric('Projects', 'Active')).toHaveTextContent('5');
    expect(metric('Projects', 'On hold')).toHaveTextContent('2');
    expect(metric('Projects', 'Completed')).toHaveTextContent('6');
    expect(metric('Projects', 'Archived')).toHaveTextContent('2');

    expect(metric('Milestones', 'Total')).toHaveTextContent('18');
    expect(metric('Milestones', 'Pending')).toHaveTextContent('7');
    expect(metric('Milestones', 'In progress')).toHaveTextContent('4');
    expect(metric('Milestones', 'Completed')).toHaveTextContent('7');

    expect(metric('Files', 'Total')).toHaveTextContent('20');
    expect(metric('Files', 'Active')).toHaveTextContent('16');
    expect(metric('Files', 'Archived')).toHaveTextContent('4');

    expect(metric('Invoices', 'Total')).toHaveTextContent('11');
    expect(metric('Invoices', 'Draft')).toHaveTextContent('2');
    expect(metric('Invoices', 'Sent')).toHaveTextContent('3');
    expect(metric('Invoices', 'Paid')).toHaveTextContent('5');
    expect(metric('Invoices', 'Void')).toHaveTextContent('1');

    expect(getOrganizationDashboard).toHaveBeenCalledWith(
      { signal: expect.any(AbortSignal) },
      'memory-token',
    );
  });

  it('labels every supported status and links only to existing list routes', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'Invoices' });
    expect(within(section('Clients')).getByText('Active')).toBeInTheDocument();
    expect(within(section('Clients')).getByText('Inactive')).toBeInTheDocument();
    expect(within(section('Projects')).getByText('On hold')).toBeInTheDocument();
    expect(within(section('Projects')).getByText('Completed')).toBeInTheDocument();
    expect(within(section('Projects')).getByText('Archived')).toBeInTheDocument();
    expect(within(section('Milestones')).getByText('Pending')).toBeInTheDocument();
    expect(within(section('Milestones')).getByText('In progress')).toBeInTheDocument();
    expect(within(section('Files')).getByText('Archived')).toBeInTheDocument();
    expect(within(section('Invoices')).getByText('Draft')).toBeInTheDocument();
    expect(within(section('Invoices')).getByText('Sent')).toBeInTheDocument();
    expect(within(section('Invoices')).getByText('Paid')).toBeInTheDocument();
    expect(within(section('Invoices')).getByText('Void')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View clients' }))
      .toHaveAttribute('href', '/admin/clients');
    expect(screen.getAllByRole('link', { name: 'View projects' }))
      .toHaveLength(4);
    expect(screen.queryByRole('link', { name: /view milestones/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view files/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view invoices/i })).not.toBeInTheDocument();
  });

  it('renders an all-zero dashboard as valid structured content', async () => {
    getOrganizationDashboard.mockResolvedValue({
      clients: { total: 0, active: 0, inactive: 0 },
      projects: { total: 0, active: 0, onHold: 0, completed: 0, archived: 0 },
      milestones: { total: 0, pending: 0, inProgress: 0, completed: 0 },
      files: { total: 0, active: 0, archived: 0 },
      invoices: { total: 0, draft: 0, sent: 0, paid: 0, void: 0 },
    });
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'Invoices' });
    expect(screen.getAllByText('0')).toHaveLength(20);
    expect(screen.queryByText(/no data available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View clients' })).toBeInTheDocument();
  });

  it('shows a safe error and loads successfully on retry', async () => {
    getOrganizationDashboard
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private tenant details' })
      .mockResolvedValueOnce(dashboard);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText(/private tenant details/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading dashboard' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getOrganizationDashboard).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate retry requests while a retry is loading', async () => {
    let resolveRetry;
    getOrganizationDashboard
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
      .mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve; }));
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry loading dashboard' });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(getOrganizationDashboard).toHaveBeenCalledTimes(2);
    resolveRetry(dashboard);
    await screen.findByRole('heading', { level: 2, name: 'Clients' });
  });

  it('clears authentication and redirects after an authentication failure', async () => {
    getOrganizationDashboard.mockRejectedValue({ code: 'AUTHENTICATION_REQUIRED' });
    const auth = renderPage();
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
  });

  it('renders forbidden and unknown failures with safe messages', async () => {
    getOrganizationDashboard.mockRejectedValueOnce({
      code: 'FORBIDDEN',
      message: '<b>private</b>',
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to view this dashboard.',
    );
    expect(screen.queryByText('<b>private</b>')).not.toBeInTheDocument();
    cleanup();

    getOrganizationDashboard.mockRejectedValueOnce({ code: 'SERVER_ERROR', tenantId: 'hidden' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The dashboard could not be loaded.',
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('renders no deferred analytics or private fields and uses no browser storage', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: 'Invoices' });
    const body = document.body;
    expect(body).not.toHaveTextContent(/tenantId|revenue|paid amount|outstanding balance|overdue/i);
    expect(body).not.toHaveTextContent(/completion percentage|storage total|trend/i);
    expect(document.querySelector('svg, canvas')).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
