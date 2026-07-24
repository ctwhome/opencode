import { describe, expect, test } from "bun:test"
import {
  beginEdgeSwipe,
  edgeSwipeOffset,
  edgeSwipeProgress,
  edgeSwipeShouldOpen,
  updateEdgeSwipe,
} from "./edge-swipe"

describe("mobile sidebar edge swipe", () => {
  test("starts only inside the left-edge activation zone", () => {
    expect(beginEdgeSwipe({ x: 24, y: 120, at: 0, width: 380 })).toBeDefined()
    expect(beginEdgeSwipe({ x: 25, y: 120, at: 0, width: 380 })).toBeUndefined()
    expect(beginEdgeSwipe({ x: 0, y: 120, at: 0, width: 0 })).toBeUndefined()
  })

  test("tracks a rightward drag and clamps it to the drawer width", () => {
    const start = beginEdgeSwipe({ x: 8, y: 120, at: 0, width: 380 })!
    const moved = updateEdgeSwipe(start, { x: 108, y: 124, at: 200 })

    expect(moved.axis).toBe("horizontal")
    expect(edgeSwipeOffset(moved)).toBe(100)
    expect(edgeSwipeProgress(moved)).toBeCloseTo(100 / 380)
    expect(edgeSwipeOffset(updateEdgeSwipe(moved, { x: 500, y: 124, at: 220 }))).toBe(380)
    expect(edgeSwipeOffset(updateEdgeSwipe(moved, { x: -20, y: 124, at: 220 }))).toBe(0)
  })

  test("classifies a vertical gesture without opening the drawer", () => {
    const start = beginEdgeSwipe({ x: 8, y: 120, at: 0, width: 380 })!
    const moved = updateEdgeSwipe(start, { x: 12, y: 152, at: 120 })

    expect(moved.axis).toBe("vertical")
    expect(edgeSwipeOffset(moved)).toBe(0)
    expect(edgeSwipeShouldOpen(moved)).toBe(false)
  })

  test("opens after enough deliberate travel", () => {
    const start = beginEdgeSwipe({ x: 8, y: 120, at: 0, width: 380 })!
    const moved = updateEdgeSwipe(start, { x: 148, y: 122, at: 600 })

    expect(edgeSwipeProgress(moved)).toBeGreaterThan(0.35)
    expect(edgeSwipeShouldOpen(moved)).toBe(true)
  })

  test("opens on a fast intentional flick but not a short slow drag", () => {
    const start = beginEdgeSwipe({ x: 8, y: 120, at: 0, width: 380 })!
    const fast = updateEdgeSwipe(start, { x: 78, y: 122, at: 100 })
    const slow = updateEdgeSwipe(start, { x: 78, y: 122, at: 1000 })

    expect(edgeSwipeShouldOpen(fast)).toBe(true)
    expect(edgeSwipeShouldOpen(slow)).toBe(false)
  })
})
