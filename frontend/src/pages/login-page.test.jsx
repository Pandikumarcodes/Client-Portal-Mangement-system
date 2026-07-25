import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
});
