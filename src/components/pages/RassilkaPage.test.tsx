import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RassilkaPage from "./RassilkaPage";

describe("RassilkaPage", () => {
  it("renders the email campaigns list by default", () => {
    render(<RassilkaPage />);
    expect(screen.getByRole("heading", { name: /Email Rassilka/i })).toBeInTheDocument();
  });

  it("clicking 'Yangi qo'shish' opens the create form", async () => {
    const user = userEvent.setup();
    render(<RassilkaPage />);

    await user.click(screen.getByRole("button", { name: /yangi qo'shish/i }));
    expect(screen.getByRole("heading", { name: /yangi email kampaniya/i })).toBeInTheDocument();
  });

  // Regression test for missing form submit handler:
  it("Save button creates a new campaign (form submit works)", async () => {
    const user = userEvent.setup();
    render(<RassilkaPage />);

    await user.click(screen.getByRole("button", { name: /yangi qo'shish/i }));

    // Fill the form
    const nameInput = screen.getByLabelText(/kampaniya nomi/i);
    await user.type(nameInput, "Test kampaniya");

    const subjectInput = screen.getByLabelText(/email mavzusu/i);
    await user.type(subjectInput, "Test mavzu");

    // Click Save
    const saveBtn = screen.getByRole("button", { name: /^saqlash$/i });
    await user.click(saveBtn);

    // Form closes, we're back on the list page
    expect(screen.getByRole("heading", { name: /Email Rassilka/i })).toBeInTheDocument();
    expect(screen.getByText("Test kampaniya")).toBeInTheDocument();
  });

  it("empty name shows validation error", async () => {
    const user = userEvent.setup();
    render(<RassilkaPage />);

    await user.click(screen.getByRole("button", { name: /yangi qo'shish/i }));

    // Submit without filling
    await user.click(screen.getByRole("button", { name: /^saqlash$/i }));

    expect(screen.getByText(/bo'sh bo'lishi mumkin emas/i)).toBeInTheDocument();
  });

  it("Cancel button returns to list without saving", async () => {
    const user = userEvent.setup();
    render(<RassilkaPage />);

    await user.click(screen.getByRole("button", { name: /yangi qo'shish/i }));
    await user.click(screen.getByRole("button", { name: /^bekor$/i }));

    expect(screen.getByRole("heading", { name: /Email Rassilka/i })).toBeInTheDocument();
  });

  it("search filters the list", async () => {
    const user = userEvent.setup();
    render(<RassilkaPage />);

    const search = screen.getByPlaceholderText(/qidirish/i);
    await user.type(search, "zzznonexistentzzz");

    expect(screen.getByText(/ma'lumot topilmadi/i)).toBeInTheDocument();
  });
});
