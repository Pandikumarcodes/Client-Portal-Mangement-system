import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../features/auth/auth-context.js";
import { RegisterPage } from "./register-page.jsx";

const renderPage = (
  register = vi
    .fn()
    .mockResolvedValue({ user: { role: "organization_admin" } }),
) =>
  render(
    <AuthContext.Provider value={{ register }}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe("RegisterPage", () => {
  it("renders all registration fields and validates weak input", () => {
    renderPage();
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization URL")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      screen.getByText("Organization name must contain at least 2 characters."),
    ).toBeInTheDocument();
  });

  it("trims names and normalizes slug/email while preserving password whitespace", async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ user: { role: "organization_admin" } });
    renderPage(register);
    const values = {
      "Organization name": " Acme ",
      "Organization URL": " Acme-Team ",
      "First name": " Ada ",
      "Last name": " Lovelace ",
      Email: " ADA@Example.COM ",
      Password: " PassWord1 ",
    };
    Object.entries(values).forEach(([label, value]) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        organizationName: "Acme",
        organizationSlug: "acme-team",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: " PassWord1 ",
      }),
    );
  });
});
