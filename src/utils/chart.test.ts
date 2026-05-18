import { describe, it, expectTypeOf } from "vitest";
import type { ChartTooltipProps, TooltipPayloadItem } from "./chart";

describe("chart types", () => {
  it("ChartTooltipProps has correct shape", () => {
    const props: ChartTooltipProps = {
      active: true,
      payload: [{ value: 100, name: "Revenue" }],
      label: "Jan",
    };
    expectTypeOf(props.active).toEqualTypeOf<boolean | undefined>();
    expectTypeOf(props.payload).toEqualTypeOf<ReadonlyArray<TooltipPayloadItem> | undefined>();
  });

  it("TooltipPayloadItem supports payload object", () => {
    const item: TooltipPayloadItem = {
      value: 42,
      name: "test",
      payload: { sales: 1000, category: "Electronics" },
    };
    expectTypeOf(item.value).toEqualTypeOf<number>();
  });
});
