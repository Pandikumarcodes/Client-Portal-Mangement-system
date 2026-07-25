import { describe, expect, it, vi } from 'vitest';
import { createDashboardController } from '../../../src/modules/dashboard/dashboard.controller.js';

describe('dashboard controller', () => {
  it('uses only authenticated tenant context and returns the safe HTTP 200 envelope', async () => {
    const getOrganizationDashboard = vi.fn().mockResolvedValue({ clients: { total: 1 } });
    const response = { setHeader: vi.fn(), status: vi.fn(() => response), json: vi.fn() };
    const controller = createDashboardController({ getOrganizationDashboard });

    expect(Object.isFrozen(controller)).toBe(true);
    await controller.getOrganization(
      {
        auth: { tenantId: 'trusted' },
        query: { tenantId: 'untrusted' },
        body: { tenantId: 'untrusted' },
      },
      response,
    );
    expect(getOrganizationDashboard).toHaveBeenCalledWith({ tenantId: 'trusted' });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: { dashboard: { clients: { total: 1 } } },
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('trusted');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('untrusted');
  });

  it('propagates service errors without logging or calculating a fallback', async () => {
    const failure = new Error('service failed');
    const getOrganizationDashboard = vi.fn().mockRejectedValue(failure);
    const response = { setHeader: vi.fn(), status: vi.fn(() => response), json: vi.fn() };
    const request = {
      auth: { tenantId: 'trusted' },
      log: { info: vi.fn(), error: vi.fn() },
    };

    const controller = createDashboardController({ getOrganizationDashboard });

    await expect(controller.getOrganization(request, response)).rejects.toBe(failure);
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(request.log.info).not.toHaveBeenCalled();
    expect(request.log.error).not.toHaveBeenCalled();
  });
});
