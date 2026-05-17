import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

describe("Header", () => {
  it("renders search input with aria-label", () => {
    render(<Header />);
    expect(screen.getByRole("searchbox", { name: /qidirish/i })).toBeInTheDocument();
  });

  it("renders notifications and profile buttons with aria-labels", () => {
    render(<Header />);
    expect(screen.getByRole("button", { name: /bildirishnomalar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /profil menyusi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xabarlar/i })).toBeInTheDocument();
  });

  it("opens notifications dropdown when clicked", async () => {
    const user = userEvent.setup();
    render(<Header />);

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /bildirishnomalar/i }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("closes dropdown on Escape", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: /bildirishnomalar/i }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("opening profile closes notifications and vice versa", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: /bildirishnomalar/i }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /profil menyusi/i }));
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("typing in search updates value (controlled input)", async () => {
    const user = userEvent.setup();
    render(<Header />);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.type(input, "Laptop");
    expect(input.value).toBe("Laptop");
  });
});
