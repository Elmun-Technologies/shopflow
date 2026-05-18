import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  // Suppress React's expected console.error output during error boundary tests
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <Boom message="test error" />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/nimadir xato ketdi/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/)).toBeInTheDocument();
  });

  it("renders custom fallback if provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("offers retry and reload buttons", async () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /qayta urinish/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sahifani yangilash/i })).toBeInTheDocument();
  });

  it("retry button resets error state", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error("fail");
      return <div>recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeBoom />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /qayta urinish/i }));
    rerender(
      <ErrorBoundary>
        <MaybeBoom />
      </ErrorBoundary>
    );

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });
});
