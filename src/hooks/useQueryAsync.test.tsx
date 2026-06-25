import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQueryAsync } from "./useQueryAsync";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const freshClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

describe("useQueryAsync", () => {
  it("data'ni yuklaydi va useAsync bilan mos shakl beradi", async () => {
    const { result } = renderHook(() => useQueryAsync(["k"], async () => 42), {
      wrapper: makeWrapper(freshClient()),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it("ikkinchi mount'da keshdan oniy beradi (loading yo'q, qayta so'rov yo'q)", async () => {
    const client = freshClient();
    let calls = 0;
    const fn = async () => {
      calls++;
      return "v";
    };
    const r1 = renderHook(() => useQueryAsync(["c"], fn), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(r1.result.current.data).toBe("v"));

    const r2 = renderHook(() => useQueryAsync(["c"], fn), { wrapper: makeWrapper(client) });
    expect(r2.result.current.loading).toBe(false);
    expect(r2.result.current.data).toBe("v");
    expect(calls).toBe(1);
  });

  it("xatoni Error sifatida beradi", async () => {
    const { result } = renderHook(
      () => useQueryAsync(["e"], async () => { throw new Error("boom"); }),
      { wrapper: makeWrapper(freshClient()) },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("boom");
  });
});
