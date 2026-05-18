import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Package } from "lucide-react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  const defaultProps = {
    icon: Package,
    title: "Hech narsa yo'q",
    description: "Yangi element qo'shing",
    buttonText: "Qo'shish",
    onButtonClick: vi.fn(),
  };

  it("renders title and description", () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText("Hech narsa yo'q")).toBeInTheDocument();
    expect(screen.getByText("Yangi element qo'shing")).toBeInTheDocument();
  });

  it("renders the button with provided text", () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Qo'shish" })).toBeInTheDocument();
  });

  it("calls onButtonClick when button clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState {...defaultProps} onButtonClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Qo'shish" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom icon color", () => {
    const { container } = render(<EmptyState {...defaultProps} iconColor="text-blue-500" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("text-blue-500");
  });
});
