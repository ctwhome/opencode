import { describe, expect, test } from "bun:test"
import {
  isAppUpgrade,
  layoutTransitionState,
  legacyLayoutPinned,
  maximumSunsetTimeout,
  newLayoutDesignsDefault,
  nextSunsetCheckDelay,
  oldInterfaceSunset,
  resolveNewLayoutDesigns,
  shouldDisplayTabsToast,
  shouldEnableNewLayout,
} from "./settings"

describe("layout transition", () => {
  test("custom builds pin the legacy layout", () => {
    expect(legacyLayoutPinned).toBe(true)
    expect(newLayoutDesignsDefault).toBe(false)
    expect(oldInterfaceSunset).toBeNull()
    expect(resolveNewLayoutDesigns(false, true, true)).toBe(false)
    expect(resolveNewLayoutDesigns(true, true, true)).toBe(false)
  })

  test("hides the transition until a sunset is scheduled", () => {
    expect(layoutTransitionState(false, true, false, false)).toEqual({ available: false, notice: false })
  })

  test("existing profiles can switch before sunset", () => {
    expect(layoutTransitionState(true, true, false, false)).toEqual({ available: true, notice: false })
  })

  test("preserves explicit and default layout preferences when unpinned", () => {
    expect(resolveNewLayoutDesigns(false, false, true, false)).toBe(false)
    expect(resolveNewLayoutDesigns(false, undefined, false, false)).toBe(false)
    expect(resolveNewLayoutDesigns(false, undefined, true, false)).toBe(true)
  })

  test("sunset replaces the toggle with a dismissible notice when unpinned", () => {
    expect(layoutTransitionState(true, true, true, false)).toEqual({ available: false, notice: true })
    expect(layoutTransitionState(true, true, true, true)).toEqual({ available: false, notice: false })
    expect(resolveNewLayoutDesigns(true, false, true, false)).toBe(true)
  })

  test("caps checks for sunsets beyond the browser timeout limit", () => {
    expect(nextSunsetCheckDelay(maximumSunsetTimeout + 1_000, 0)).toBe(maximumSunsetTimeout)
    expect(nextSunsetCheckDelay(10_000, 9_000)).toBe(1_000)
    expect(nextSunsetCheckDelay(9_000, 10_000)).toBe(0)
  })

  test("enables the new layout when upgrading from 1.17.19 or earlier", () => {
    expect(shouldEnableNewLayout("v1.17.19", "1.17.20")).toBe(true)
    expect(shouldEnableNewLayout("1.16.9", "2.0.0")).toBe(true)
  })

  test("enables the new layout when no previous version was recorded", () => {
    expect(shouldEnableNewLayout(undefined, "1.17.20")).toBe(true)
  })

  test("detects upgrades only when a previous version is older", () => {
    expect(isAppUpgrade("1.17.19", "1.17.20")).toBe(true)
    expect(isAppUpgrade(undefined, "1.17.20")).toBe(false)
    expect(isAppUpgrade("1.17.20", "1.17.20")).toBe(false)
    expect(isAppUpgrade("1.17.21", "1.17.20")).toBe(false)
  })

  test("shows the tabs toast for upgrades and existing installs without a recorded version", () => {
    expect(shouldDisplayTabsToast("1.17.19", "1.17.20", false)).toBe(true)
    expect(shouldDisplayTabsToast(undefined, "1.17.20", true)).toBe(true)
    expect(shouldDisplayTabsToast(undefined, "1.17.20", false)).toBe(false)
  })

  test("does not enable the new layout without a qualifying upgrade", () => {
    expect(shouldEnableNewLayout("1.17.19", "1.17.19")).toBe(false)
    expect(shouldEnableNewLayout("1.17.20", "1.17.21")).toBe(false)
    expect(shouldEnableNewLayout(undefined, "1.17.19")).toBe(false)
    expect(shouldEnableNewLayout("dev", "1.17.20")).toBe(false)
  })
})
