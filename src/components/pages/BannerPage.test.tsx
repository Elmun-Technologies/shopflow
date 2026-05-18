import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BannerPage from "./BannerPage";

describe("BannerPage", () => {
  it("renders banners list with correct heading", () => {
    render(<BannerPage />);
    expect(screen.getByRole("heading", { name: /^bannerlar$/i })).toBeInTheDocument();
  });

  it("create form: 'Faol' checkbox toggles state", async () => {
    const user = userEvent.setup();
    render(<BannerPage />);

    await user.click(screen.getByRole("button", { name: /yangi banner/i }));

    const checkbox = screen.getByRole("checkbox", { name: /faol/i }) as HTMLInputElement;
    // By default new banner is active
    expect(checkbox.checked).toBe(true);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("save button persists form data via submit handler", async () => {
    const user = userEvent.setup();
    render(<BannerPage />);

    await user.click(screen.getByRole("button", { name: /yangi banner/i }));

    await user.type(screen.getByLabelText(/sarlavha/i), "Promo banner");
    await user.click(screen.getByRole("button", { name: /^saqlash$/i }));

    // Returns to list
    expect(screen.getByRole("heading", { name: /^bannerlar$/i })).toBeInTheDocument();
    expect(screen.getByText("Promo banner")).toBeInTheDocument();
  });
});
