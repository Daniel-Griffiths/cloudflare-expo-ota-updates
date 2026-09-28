import { describe, expect, it } from "vite-plus/test";

import { deliverButtonPoint } from "./transporter";

describe("deliverButtonPoint", () => {
  it("lands on the DELIVER button of the top Active row at the default window width", () => {
    // Measured 2026-09-07: window at (888,214) 840x626 → button clicked at (1571,388).
    expect(deliverButtonPoint({ x: 888, y: 214, width: 840, height: 626 })).toEqual({
      x: 1571,
      y: 388,
    });
  });

  it("scales the horizontal offset with the window width", () => {
    const wide = deliverButtonPoint({ x: 0, y: 0, width: 1680, height: 626 });
    expect(wide).toEqual({ x: 1366, y: 174 });
  });
});
