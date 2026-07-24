import { describe, expect, test } from "bun:test"

const titlebarPath = new URL("./titlebar.tsx", import.meta.url)

describe("mobile Home session search", () => {
  test("exposes the desktop session search as a labeled mobile titlebar icon", async () => {
    const source = await Bun.file(titlebarPath).text()

    expect(source.match(/data-action="home-mobile-session-search"/g)).toHaveLength(1)
    expect(source).toContain('class="!size-9 shrink-0 lg:hidden"')
    expect(source).toContain('icon={<IconV2 name="magnifying-glass" />}')
    expect(source).toContain('command.trigger("home.sessions.search.focus")')
    expect(source).toContain('language.t("home.sessions.search.placeholder")')
    expect(source).toContain('when={layout.route().type === "home"}')
  })
})
