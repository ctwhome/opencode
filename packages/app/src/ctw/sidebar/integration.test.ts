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

  test("keeps the mobile drawer above the session composer", async () => {
    const source = await Bun.file(sidebarPath).text()

    expect(source).toContain('class="fixed inset-x-0 top-10 bottom-0 z-[80] xl:hidden"')
  })

  test("owns the mobile terminal action inside the custom sidebar", async () => {
    const sidebar = await Bun.file(sidebarPath).text()
    const titlebar = await Bun.file(titlebarPath).text()

    expect(sidebar.match(/data-component="ctw-sidebar-terminal"/g)).toHaveLength(1)
    expect(sidebar).toContain("<Show when={props.mobile && activeSessionID()}>")
    expect(sidebar).toContain('language.t("terminal.title")')
    expect(sidebar).toContain('command.trigger("terminal.toggle")')
    expect(sidebar).toContain("layout.mobileSidebar.hide()")
    expect(sidebar).toContain('aria-controls="terminal-panel"')
    expect(titlebar).not.toContain('id="ctw-mobile-terminal-toggle"')
  })
})
