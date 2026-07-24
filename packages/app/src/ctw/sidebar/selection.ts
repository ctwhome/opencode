export function applySidebarSessionSelection(root: ParentNode, activeSessionID: string | undefined) {
  const rows = root.querySelectorAll<HTMLElement>('[data-component="ctw-sidebar-session"]')

  for (const row of rows) {
    const selected = !!activeSessionID && row.dataset.sessionId === activeSessionID
    row.toggleAttribute("data-selected", selected)
    row.classList.toggle("bg-v2-background-bg-layer-03", selected)
    if (selected) row.setAttribute("aria-current", "page")
    else row.removeAttribute("aria-current")
  }
}
