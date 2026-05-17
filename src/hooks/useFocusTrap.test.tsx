import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./useFocusTrap";

function Modal({ active, onEscape }: { active: boolean; onEscape?: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(active, onEscape);
  return (
    <div ref={ref} data-testid="modal">
      <button>First</button>
      <button>Second</button>
      <button>Third</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses first focusable element when active", () => {
    render(<Modal active />);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("does not focus when inactive", () => {
    render(<Modal active={false} />);
    expect(screen.getByRole("button", { name: "First" })).not.toHaveFocus();
  });

  it("wraps focus from last to first on Tab", async () => {
    const user = userEvent.setup();
    render(<Modal active />);
    const third = screen.getByRole("button", { name: "Third" });
    third.focus();
    expect(third).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps focus from first to last on Shift+Tab", async () => {
    const user = userEvent.setup();
    render(<Modal active />);
    const first = screen.getByRole("button", { name: "First" });
    first.focus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Third" })).toHaveFocus();
  });

  it("calls onEscape when Escape pressed", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<Modal active onEscape={onEscape} />);

    await user.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
