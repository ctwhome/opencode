import { beforeEach, describe, expect, test } from "bun:test"
import { applySidebarSessionSelection } from "./selection"

describe("custom sidebar session selection", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="sidebar">
        <button data-component="ctw-sidebar-session" data-session-id="one"></button>
        <button data-component="ctw-sidebar-session" data-session-id="two"></button>
      </div>
    `
  })

  test("moves the selected state when tab navigation changes the active session", () => {
    const root = document.querySelector("#sidebar")!

    applySidebarSessionSelection(root, "one")
    applySidebarSessionSelection(root, "two")

    const rows = root.querySelectorAll<HTMLElement>('[data-component="ctw-sidebar-session"]')
    expect(rows[0]?.hasAttribute("data-selected")).toBe(false)
    expect(rows[0]?.hasAttribute("aria-current")).toBe(false)
    expect(rows[1]?.getAttribute("data-selected")).toBe("")
    expect(rows[1]?.getAttribute("aria-current")).toBe("page")
    expect(rows[1]?.classList.contains("bg-v2-background-bg-selected")).toBe(true)
  })

  test("clears every selected state on a non-session route", () => {
    const root = document.querySelector("#sidebar")!

    applySidebarSessionSelection(root, "one")
    applySidebarSessionSelection(root, undefined)

    expect(root.querySelector('[data-selected]')).toBeNull()
    expect(root.querySelector('[aria-current]')).toBeNull()
  })
})
