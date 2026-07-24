import { describe, expect, test } from "bun:test"

const sidebarPath = new URL("./sidebar.tsx", import.meta.url)
const buildPath = new URL("../../../../opencode/script/build.ts", import.meta.url)

describe("CTW sidebar client version", () => {
  test("shows the build-time client version with a development fallback", async () => {
    const sidebar = await Bun.file(sidebarPath).text()
    const build = await Bun.file(buildPath).text()

    expect(sidebar).toContain('data-component="ctw-sidebar-version"')
    expect(sidebar).toContain("import.meta.env.VITE_OPENCODE_VERSION || platform.version")
    expect(sidebar).toContain("OpenCode v{version()}")
    expect(build).toContain("VITE_OPENCODE_VERSION=${Script.version}")
  })
})
