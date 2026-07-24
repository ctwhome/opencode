import { describe, expect, test } from "bun:test"

const sidebarPath = new URL("./sidebar.tsx", import.meta.url)
const newLayoutPath = new URL("../../pages/layout-new.tsx", import.meta.url)
const titlebarPath = new URL("../../components/titlebar.tsx", import.meta.url)

describe("custom sidebar integration seam", () => {
  test("does not depend on the legacy sidebar implementation", async () => {
    const source = await Bun.file(sidebarPath).text()

    expect(source).not.toContain('from "@/pages/layout')
    expect(source).not.toContain('from "../../pages/layout')
  })

  test("is mounted exactly once by NewLayout", async () => {
    const source = await Bun.file(newLayoutPath).text()

    expect(source.match(/import \{ CtwSidebar \}/g)).toHaveLength(1)
    expect(source.match(/<CtwSidebar \/>/g)).toHaveLength(1)
  })

  test("keeps the custom mobile drawer reachable from the new titlebar", async () => {
    const source = await Bun.file(titlebarPath).text()

    expect(source.match(/data-component="ctw-sidebar-mobile-toggle"/g)).toHaveLength(1)
    expect(source).toContain('aria-controls="ctw-sidebar-mobile-dialog"')
  })

  test("exposes the existing terminal toggle from the mobile session titlebar", async () => {
    const source = await Bun.file(titlebarPath).text()

    expect(source.match(/id="ctw-mobile-terminal-toggle"/g)).toHaveLength(1)
    expect(source).toContain('<Show when={mobile() && layout.route().type === "session"}>')
    expect(source).toContain('command.trigger("terminal.toggle")')
    expect(source).toContain('aria-controls="terminal-panel"')
  })
})
