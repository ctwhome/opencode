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

  test("owns a touch-only edge swipe that drives the custom mobile drawer", async () => {
    const sidebar = await Bun.file(sidebarPath).text()

    expect(sidebar).toContain('createMediaQuery("(hover: none) and (pointer: coarse)")')
    expect(sidebar).toContain('data-component="ctw-sidebar-edge-swipe"')
    expect(sidebar).toContain("onTouchStart={startMobileSwipe}")
    expect(sidebar).toContain("onTouchMove={moveMobileSwipe}")
    expect(sidebar).toContain("edgeSwipeShouldOpen")
    expect(sidebar).toContain("translate3d(calc(-100% +")
  })

  test("keeps the v1.17 project rail and selected-project session panel", async () => {
    const sidebar = await Bun.file(sidebarPath).text()

    expect(sidebar).toContain('data-component="ctw-sidebar-project-rail"')
    expect(sidebar).toContain('data-component="ctw-sidebar-project-panel"')
    expect(sidebar).toContain('class="size-8"')
    expect(sidebar).toContain("selectedProject()")
    expect(sidebar).toContain("selectedSessions()")
    expect(sidebar).toContain("data-active-session-id={activeSessionID()}")
    expect(sidebar).not.toContain("border-v2-border-border-weak")
    expect(sidebar).toContain("transition-colors duration-150 ease-out")
    expect(sidebar).toContain('<Spinner class="size-[15px]" />')
    expect(sidebar).not.toContain("server.projects.last() !== project.worktree")
    expect(sidebar).toContain("setSelectedProjectWorktree(project.worktree)")
    expect(sidebar).not.toContain("if (project) server.projects.touch(project.worktree)")
  })
})
