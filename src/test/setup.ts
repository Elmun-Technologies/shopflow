import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Node 25 exposes a partial `localStorage` global when no
// `--localstorage-file` is configured. jsdom then inherits that unusable
// value instead of installing its own Storage implementation. Keep the test
// environment deterministic across supported Node versions.
const createStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

const testStorage = createStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: testStorage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: testStorage,
});

afterEach(() => {
  cleanup();
  testStorage.clear();
});

// Mock framer-motion to keep tests fast and avoid animation flakiness.
// IMPORTANT: components are cached per tag so each `motion.div` access returns
// the SAME component identity across renders — otherwise React would remount
// the subtree on every parent render and inputs would lose focus.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = new Set([
    "initial", "animate", "exit", "transition", "variants", "whileHover",
    "whileTap", "whileFocus", "whileDrag", "whileInView", "layout", "layoutId",
    "drag", "dragConstraints", "dragElastic", "onAnimationStart", "onAnimationComplete",
    "custom", "viewport",
  ]);
  const cache = new Map<string, React.ComponentType<React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>>();
  const passthrough = (tag: string) => {
    let comp = cache.get(tag);
    if (!comp) {
      comp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & Record<string, unknown>>(
        ({ children, ...props }, ref) => {
          const cleaned: Record<string, unknown> = {};
          for (const k in props) {
            if (!ANIMATION_PROPS.has(k)) cleaned[k] = props[k];
          }
          return React.createElement(tag, { ...cleaned, ref }, children as React.ReactNode);
        }
      ) as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>;
      cache.set(tag, comp);
    }
    return comp;
  };
  return {
    motion: new Proxy({}, { get: (_, tag: string) => passthrough(tag) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    useScroll: () => ({ scrollY: { get: () => 0, on: () => () => {} } }),
    useTransform: <T,>(_: unknown, __: unknown, ___: unknown, ____?: unknown): T => 0 as unknown as T,
    useMotionValue: <T,>(initial: T) => ({ get: () => initial, set: () => {}, on: () => () => {} }),
  };
});

// ResizeObserver mock for jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

// matchMedia mock for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
