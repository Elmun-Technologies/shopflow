import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App routing", () => {
  it("renders Dashboard by default", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /dashboard/i, level: 1 })).toBeInTheDocument();
  });

  it("navigates to Orders page from sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: /dashboard/i, level: 1 });
    await user.click(screen.getByRole("button", { name: /^orders$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(/dashboard/i);
    });
  });

  it("Dashboard Export Report button is wired", async () => {
    render(<App />);
    const btn = await screen.findByRole("button", { name: /export report/i });
    expect(btn).toBeEnabled();
  });
});
