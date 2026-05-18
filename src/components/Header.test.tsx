import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";
import { AuthProvider } from "../contexts/AuthContext";

function renderHeader() {
  return render(
    <AuthProvider>
      <Header />
    </AuthProvider>,
  );
}

describe("Header", () => {
  it("renders search input with aria-label", () => {
    renderHeader();
    expect(screen.getByRole("searchbox", { name: /qidirish/i })).toBeInTheDocument();
  });

  it("renders notifications and profile buttons", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /bildirishnomalar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /profil menyusi/i })).toBeInTheDocument();
  });

  it("typing in search updates value", async () => {
    const user = userEvent.setup();
    renderHeader();
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.type(input, "Laptop");
    expect(input.value).toBe("Laptop");
  });
});
