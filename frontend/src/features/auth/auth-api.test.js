import { describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock("../../core/api/api-client.js", () => ({ apiRequest }));
import { loginAccount, registerAccount } from "./auth-api.js";

describe("auth API operations", () => {
  it("posts only registration fields and returns response data", async () => {
    apiRequest.mockResolvedValue({
      data: { accessToken: "memory", user: {}, organization: {} },
    });
    const input = {
      organizationName: "Acme",
      organizationSlug: "acme",
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      password: " PassWord1 ",
      ignored: true,
    };
    await expect(registerAccount(input)).resolves.toEqual(
      expect.objectContaining({ accessToken: "memory" }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({
        method: "POST",
        body: {
          organizationName: "Acme",
          organizationSlug: "acme",
          firstName: "A",
          lastName: "B",
          email: "a@b.com",
          password: " PassWord1 ",
        },
      }),
    );
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty("ignored");
    expect(localStorage.length).toBe(0);
  });

  it("posts login credentials without navigating or storing tokens", async () => {
    apiRequest.mockResolvedValue({
      data: { accessToken: "memory", user: {}, organization: null },
    });
    await expect(
      loginAccount({ email: "a@b.com", password: "PassWord1" }),
    ).resolves.toMatchObject({ organization: null });
    expect(apiRequest).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { email: "a@b.com", password: "PassWord1" },
    });
    expect(sessionStorage.length).toBe(0);
  });
});
