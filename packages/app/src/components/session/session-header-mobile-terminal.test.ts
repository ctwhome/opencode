import { describe, expect, test } from "bun:test"

const headerPath = new URL("./session-header.tsx", import.meta.url)

describe("V2 session header mobile terminal", () => {
  test("exposes the existing terminal toggle as an accessible mobile titlebar icon", async () => {
    const source = await Bun.file(headerPath).text()

    expect(source.match(/data-action="session-header-mobile-terminal-toggle"/g)).toHaveLength(1)
    expect(source).toContain('class="!size-9 shrink-0 md:hidden"')
    expect(source).toContain("onTerminalToggle: toggleTerminal")
    expect(source).toContain("terminalOpened: view().terminal.opened()")
    expect(source).toContain("onClick={props.state.onTerminalToggle}")
    expect(source).toContain('aria-controls="terminal-panel"')
    expect(source).toContain("aria-expanded={props.state.terminalOpened}")
  })
})
