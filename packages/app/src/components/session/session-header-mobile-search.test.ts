import { describe, expect, test } from "bun:test"

const headerPath = new URL("./session-header.tsx", import.meta.url)

describe("session header mobile file search", () => {
  test("exposes the desktop file search as a labeled mobile icon", async () => {
    const source = await Bun.file(headerPath).text()

    expect(source.match(/data-action="session-header-mobile-file-search"/g)).toHaveLength(1)
    expect(source).toContain('class="md:hidden')
    expect(source).toContain('icon="magnifying-glass"')
    expect(source.match(/command\.trigger\("file\.open"\)/g)).toHaveLength(2)
    expect(source.match(/aria-label=\{language\.t\("session\.header\.searchFiles"\)\}/g)).toHaveLength(2)
  })
})
