// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapFilters } from "../useMapFilters";
import { EMPTY_FILTERS } from "../map-constants";

describe("useMapFilters", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useMapFilters());
    expect(result.current.filters).toEqual(EMPTY_FILTERS);
    expect(result.current.activeCount).toBe(0);
  });

  it("setField updates one key and leaves the rest alone", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.setField("engagementType", "WEEKEND"));
    expect(result.current.filters).toEqual({ ...EMPTY_FILTERS, engagementType: "WEEKEND" });
  });

  it("toggleField sets a value when inactive", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.toggleField("venueType", "BAR"));
    expect(result.current.filters.venueType).toBe("BAR");
  });

  it("toggleField clears when re-clicking the active value (chip behaviour)", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.toggleField("venueType", "BAR"));
    act(() => result.current.toggleField("venueType", "BAR"));
    expect(result.current.filters.venueType).toBe("");
  });

  it("toggleField switches between values without clearing", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.toggleField("venueType", "BAR"));
    act(() => result.current.toggleField("venueType", "CAFE"));
    expect(result.current.filters.venueType).toBe("CAFE");
  });

  it("toggleField on a boolean flips it off again", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.toggleField("redAlertOnly", true));
    expect(result.current.filters.redAlertOnly).toBe(true);
    act(() => result.current.toggleField("redAlertOnly", false));
    expect(result.current.filters.redAlertOnly).toBe(false);
  });

  it("activeCount tracks how many fields differ from empty", () => {
    const { result } = renderHook(() => useMapFilters());
    expect(result.current.activeCount).toBe(0);
    act(() => result.current.setField("redAlertOnly", true));
    expect(result.current.activeCount).toBe(1);
    act(() => result.current.setField("engagementType", "WEEKEND"));
    expect(result.current.activeCount).toBe(2);
  });

  it("reset returns to empty", () => {
    const { result } = renderHook(() => useMapFilters());
    act(() => result.current.setField("redAlertOnly", true));
    act(() => result.current.setField("venueType", "BAR"));
    act(() => result.current.reset());
    expect(result.current.filters).toEqual(EMPTY_FILTERS);
    expect(result.current.activeCount).toBe(0);
  });

  it("filters object identity changes on update (drives the refetch effect)", () => {
    const { result } = renderHook(() => useMapFilters());
    const first = result.current.filters;
    act(() => result.current.setField("redAlertOnly", true));
    expect(result.current.filters).not.toBe(first);
  });
});
