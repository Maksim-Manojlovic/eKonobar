// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StarRating } from "../StarRating";

// fill is on <svg> element, not <path>
function countByFill(container: HTMLElement, fill: string) {
  return container.querySelectorAll(`svg[fill="${fill}"]`).length;
}

describe("StarRating", () => {
  it("renders 5 SVG stars", () => {
    const { container } = render(<StarRating rating={3} />);
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it("3 stars = 3 orange + 2 grey", () => {
    const { container } = render(<StarRating rating={3} />);
    expect(countByFill(container, "#f97316")).toBe(3);
    expect(countByFill(container, "#d4d4d4")).toBe(2);
  });

  it("4.5 stars = 4 orange + 1 half + 0 grey", () => {
    const { container } = render(<StarRating rating={4.5} />);
    expect(countByFill(container, "#f97316")).toBe(4);
    expect(countByFill(container, "#fdba74")).toBe(1);
    expect(countByFill(container, "#d4d4d4")).toBe(0);
  });

  it("5 stars = all orange, no grey", () => {
    const { container } = render(<StarRating rating={5} />);
    expect(countByFill(container, "#f97316")).toBe(5);
    expect(countByFill(container, "#d4d4d4")).toBe(0);
  });

  it("0 stars = all grey", () => {
    const { container } = render(<StarRating rating={0} />);
    expect(countByFill(container, "#d4d4d4")).toBe(5);
  });

  it("shows count when provided", () => {
    render(<StarRating rating={4} count={42} />);
    expect(screen.getByText("· 42")).toBeInTheDocument();
  });

  it("does not render count span when count not provided", () => {
    render(<StarRating rating={4} />);
    expect(screen.queryByText(/^·/)).not.toBeInTheDocument();
  });

  it("applies className to outer span", () => {
    const { container } = render(<StarRating rating={3} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("0.4 fractional part → no half star", () => {
    const { container } = render(<StarRating rating={3.4} />);
    expect(countByFill(container, "#fdba74")).toBe(0);
  });

  it("1 star = 1 orange + 4 grey", () => {
    const { container } = render(<StarRating rating={1} />);
    expect(countByFill(container, "#f97316")).toBe(1);
    expect(countByFill(container, "#d4d4d4")).toBe(4);
  });
});
