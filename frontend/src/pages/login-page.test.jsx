import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../features/auth/auth-context.js";
import { LoginPage } from "./login-page.jsx";

const renderPage = (
  login = vi.fn().mockResolvedValue({ user: { role: "client" } }),
) =>
  render(
    <AuthContext.Provider value={{ login }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("LoginPage", () => {
  it("renders fields and validates empty submissions", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("normalizes email, preserves password whitespace, and submits", async () => {
    const login = vi.fn().mockResolvedValue({ user: { role: "client" } });
    renderPage(login);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " USER@Example.COM " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: " PassWord1 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "user@example.com",
        password: " PassWord1 ",
      }),
    );
  });

  it("maps invalid credentials to a safe message", async () => {
    const login = vi
      .fn()
      .mockRejectedValue({ code: "INVALID_CREDENTIALS", message: "secret" });
    renderPage(login);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "PassWord1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The email or password is incorrect.",
      ),
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("prevents duplicate submissions while login is pending", () => {
    const login = vi.fn(() => new Promise(() => {}));
    renderPage(login);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "PassWord1" },
    });
    const form = screen.getByRole("button", { name: "Sign in" }).closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(login).toHaveBeenCalledOnce();
  });

  it.each([
    ["organization_admin", "/dashboard", "Organization Dashboard destination"],
    ["client", "/client", "Client destination"],
    ["super_admin", "/super-admin", "Super Admin destination"],
  ])("redirects %s to its existing role home", async (role, path, destination) => {
    const login = vi.fn().mockResolvedValue({ user: { role } });
    render(
      <AuthContext.Provider value={{ login }}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path={path} element={<div>{destination}</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "PassWord1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(destination)).toBeInTheDocument();
  });
});
