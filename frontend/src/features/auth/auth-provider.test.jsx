import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../core/api/api-client.js";
import { AuthProvider } from "./auth-provider.jsx";
import { useAuth } from "./use-auth.js";

vi.mock("../../core/api/api-client.js", () => ({
  apiRequest: vi.fn(),
}));

function AuthState() {
  const { status, user, bootstrapError } = useAuth();

  return (
    <>
      <p>Auth status: {status}</p>
      {user && <p>Signed in as {user.firstName}</p>}
      {bootstrapError && <div role="alert">{bootstrapError}</div>}
    </>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthState />
    </AuthProvider>,
  );
}

describe("AuthProvider session restoration", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("treats an initial 401 as signed out without a restoration error", async () => {
    apiRequest.mockRejectedValue({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });

    renderProvider();

    expect(
      await screen.findByText("Auth status: unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats a missing refresh cookie as signed out without an error", async () => {
    apiRequest.mockRejectedValue({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });

    renderProvider();

    expect(
      await screen.findByText("Auth status: unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["server failure", { status: 500, code: "REQUEST_FAILED" }],
    ["network failure", { status: 0, code: "NETWORK_ERROR" }],
  ])("shows a safe restoration error for an unexpected %s", async (_, error) => {
    apiRequest.mockRejectedValue(error);

    renderProvider();

    expect(
      await screen.findByText("Auth status: unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not restore your session.",
    );
  });

  it("authenticates the user when restoration succeeds", async () => {
    apiRequest.mockResolvedValue({
      data: {
        user: { firstName: "Ada", role: "organization_admin" },
        organization: { name: "Acme" },
        accessToken: "restored-memory-token",
      },
    });

    renderProvider();

    expect(
      await screen.findByText("Auth status: authenticated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Signed in as Ada")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/auth/refresh", {
        method: "POST",
      }),
    );
  });
});
