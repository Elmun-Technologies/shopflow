import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders profile tab by default", () => {
    render(<SettingsPage />);
    // Profile inputs visible
    expect(screen.getByText(/Profile|Ism/i)).toBeInTheDocument();
  });

  // Regression test for InputField focus loss bug:
  // Previously InputField was defined inside SettingsPage component,
  // causing it to be re-created on every render and lose focus on each keystroke.
  // We assert by querying by label, typing multiple chars, and verifying all land.
  it("input accepts multi-character input without focus loss (regression)", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const ismInput = screen.getByLabelText("Ism") as HTMLInputElement;
    const originalValue = ismInput.value;

    await user.click(ismInput);
    await user.type(ismInput, "ABC");

    // If InputField was re-created per render, focus would be lost between
    // keystrokes and not all 3 chars would land in the input.
    expect(ismInput.value).toBe(originalValue + "ABC");
  });
});
