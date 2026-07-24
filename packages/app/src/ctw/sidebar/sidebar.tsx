import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, type JSX } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Icon } from "@opencode-ai/ui/icon"
import { Spinner } from "@opencode-ai/ui/spinner"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { useDirectoryPicker } from "@/components/directory-picker"
import { useSettingsDialog } from "@/components/settings-dialog"
import { useCommand } from "@/context/command"
import { getProjectAvatarVariant, useLayout, type LocalProject } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"
import { sessionTitle } from "@/utils/session-title"
import { applySidebarSessionSelection } from "./selection"
import {
  beginDrawerSwipe,
  beginEdgeSwipe,
  edgeSwipeOffset,
  edgeSwipeProgress,
  edgeSwipeShouldOpen,
  settleEdgeSwipe,
  updateEdgeSwipe,
  type EdgeSwipeState,
} from "./edge-swipe"
import {
  loadSidebarProjectSessions,
  projectForDirectory,
  projectLabel,
  sessionIDFromRoute,
  type SidebarSession,
  visibleProjectSessions,
} from "./model"

export function CtwSidebar(): JSX.Element {
  const layout = useLayout()
  const sync = useServerSync()
  const touchInput = createMediaQuery("(hover: none) and (pointer: coarse)")
  const [mobileSwipe, setMobileSwipe] = createSignal<EdgeSwipeState>()
  const [mobileSwipeSettling, setMobileSwipeSettling] = createSignal(false)
  let mobileDialog: HTMLElement | undefined
  let mobileSwipeTimer: ReturnType<typeof setTimeout> | undefined

  const mobileDrawerVisible = createMemo(() => layout.mobileSidebar.opened() || !!mobileSwipe())
  const mobileDrawerTransform = createMemo(() => {
    const swipe = mobileSwipe()
    if (!swipe && layout.mobileSidebar.opened()) return "translate3d(0, 0, 0)"
    const offset = swipe ? edgeSwipeOffset(swipe) : 0
    return `translate3d(calc(-100% + ${offset}px), 0, 0)`
  })
  const mobileBackdropOpacity = createMemo(() => {
    const swipe = mobileSwipe()
    if (swipe) return edgeSwipeProgress(swipe) * 0.3
    return layout.mobileSidebar.opened() ? 0.3 : 0
  })

  function clearMobileSwipeTimer() {
    if (mobileSwipeTimer === undefined) return
    clearTimeout(mobileSwipeTimer)
    mobileSwipeTimer = undefined
  }

  function finishMobileSwipe(swipe: EdgeSwipeState, open: boolean) {
    clearMobileSwipeTimer()
    setMobileSwipeSettling(true)
    setMobileSwipe(settleEdgeSwipe(swipe, open, performance.now()))
    mobileSwipeTimer = setTimeout(() => {
      if (open) layout.mobileSidebar.show()
      else layout.mobileSidebar.hide()
      setMobileSwipe(undefined)
      setMobileSwipeSettling(false)
      mobileSwipeTimer = undefined
    }, 200)
  }

  function startMobileSwipe(event: TouchEvent) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    if (!touch) return
    const input = {
      x: touch.clientX,
      y: touch.clientY,
      at: event.timeStamp,
      width: Math.min(380, window.innerWidth),
    }
    const swipe = layout.mobileSidebar.opened() ? beginDrawerSwipe(input) : beginEdgeSwipe(input)
    if (!swipe) return
    clearMobileSwipeTimer()
    setMobileSwipeSettling(false)
    setMobileSwipe(swipe)
  }

  function moveMobileSwipe(event: TouchEvent) {
    const swipe = mobileSwipe()
    const touch = event.touches[0]
    if (!swipe || !touch || event.touches.length !== 1) return
    const next = updateEdgeSwipe(swipe, { x: touch.clientX, y: touch.clientY, at: event.timeStamp })
    if (next.axis === "vertical") {
      setMobileSwipe(undefined)
      return
    }
    if (next.axis === "horizontal" && event.cancelable) event.preventDefault()
    setMobileSwipe(next)
  }

  function endMobileSwipe(event: TouchEvent) {
    const swipe = mobileSwipe()
    if (!swipe) return
    const touch = event.changedTouches[0]
    const next = touch ? updateEdgeSwipe(swipe, { x: touch.clientX, y: touch.clientY, at: event.timeStamp }) : swipe
    finishMobileSwipe(next, edgeSwipeShouldOpen(next))
  }

  function cancelMobileSwipe() {
    const swipe = mobileSwipe()
    if (swipe) finishMobileSwipe(swipe, swipe.initiallyOpen)
  }

  onCleanup(clearMobileSwipeTimer)

  function mobileFocusable(root: HTMLElement) {
    return [
      ...root.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((element) => element.offsetWidth > 0 || element.offsetHeight > 0)
  }

  function handleMobileKeys(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      layout.mobileSidebar.hide()
      return
    }
    if (event.key !== "Tab") return
    const root = event.currentTarget as HTMLElement
    const focusable = mobileFocusable(root)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  createEffect(() => {
    if (!layout.mobileSidebar.opened()) return
    queueMicrotask(() => {
      if (layout.mobileSidebar.opened() && mobileDialog) mobileFocusable(mobileDialog)[0]?.focus()
    })
  })

  createEffect(() => {
    void loadSidebarProjectSessions(layout.projects.list(), (directory) =>
      sync().project.loadSessions(directory),
    ).catch(() => undefined)
  })

  return (
    <>
      <aside
        data-component="ctw-sidebar-desktop"
        class="hidden xl:flex min-h-0 shrink-0 border-r border-v2-border-border-muted bg-v2-background-bg-base"
      >
        <SidebarPanel />
      </aside>
      <Show when={touchInput() && !layout.mobileSidebar.opened()}>
        <div
          data-component="ctw-sidebar-edge-swipe"
          class="fixed left-0 top-10 bottom-0 z-[79] w-6 xl:hidden"
          style={{ "touch-action": "pan-y" }}
          aria-hidden="true"
          onTouchStart={startMobileSwipe}
          onTouchMove={moveMobileSwipe}
          onTouchEnd={endMobileSwipe}
          onTouchCancel={cancelMobileSwipe}
        />
      </Show>
      <Show when={mobileDrawerVisible()}>
        <div
          data-component="ctw-sidebar-mobile"
          class="fixed inset-x-0 top-10 bottom-0 z-[80] xl:hidden"
          onClick={(event) => {
            if (layout.mobileSidebar.opened() && event.target === event.currentTarget) layout.mobileSidebar.hide()
          }}
        >
          <div
            classList={{
              "absolute inset-0 bg-black": true,
              "transition-opacity duration-200 ease-out": mobileSwipeSettling(),
            }}
            style={{ opacity: mobileBackdropOpacity() }}
            aria-hidden="true"
            onClick={() => {
              if (layout.mobileSidebar.opened()) layout.mobileSidebar.hide()
            }}
          />
          <aside
            id="ctw-sidebar-mobile-dialog"
            ref={mobileDialog}
            role="dialog"
            aria-modal={layout.mobileSidebar.opened() ? "true" : undefined}
            aria-hidden={layout.mobileSidebar.opened() ? undefined : "true"}
            inert={!layout.mobileSidebar.opened()}
            aria-label="Projects and sessions"
            classList={{
              "relative h-full w-full max-w-[380px] border-r border-v2-border-border-muted bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)] will-change-transform": true,
              "transition-transform duration-200 ease-out": mobileSwipeSettling(),
            }}
            style={{ transform: mobileDrawerTransform(), "touch-action": "pan-y" }}
            onKeyDown={handleMobileKeys}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={startMobileSwipe}
            onTouchMove={moveMobileSwipe}
            onTouchEnd={endMobileSwipe}
            onTouchCancel={cancelMobileSwipe}
          >
            <SidebarPanel mobile />
          </aside>
        </div>
      </Show>
    </>
  )
}

function SidebarSessionRow(props: { session: SidebarSession; onSelect: () => void }) {
  const sync = useServerSync()
  const working = createMemo(() => sync().session.data.session_working(props.session.id))

  return (
    <button
      type="button"
      data-component="ctw-sidebar-session"
      data-session-id={props.session.id}
      class="group/session flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02"
      onClick={props.onSelect}
    >
      <Show when={working()}>
        <span class="flex size-4 shrink-0 items-center justify-center text-v2-icon-icon-accent" aria-hidden="true">
          <Spinner class="size-[15px]" />
        </span>
      </Show>
      <span class="min-w-0 flex-1 truncate text-14-regular text-v2-text-text-base">
        {sessionTitle(props.session.title)}
      </span>
    </button>
  )
}

function SidebarPanel(props: { mobile?: boolean }) {
  const layout = useLayout()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()
  const sync = useServerSync()
  const tabs = useTabs()
  const pickDirectory = useDirectoryPicker()
  const openSettings = useSettingsDialog()
  const [selectedProjectWorktree, setSelectedProjectWorktree] = createSignal(server.projects.last())
  const expanded = createMemo(() => props.mobile || layout.sidebar.opened())
  const clientVersion = () => import.meta.env.VITE_OPENCODE_VERSION || platform.version
  const projects = createMemo(() => layout.projects.list())
  const projectChildren = createMemo(() => {
    const children = new Map<string, ReturnType<ReturnType<typeof sync>["child"]>[0]>()
    for (const project of projects()) {
      for (const directory of [project.worktree, ...(project.sandboxes ?? [])]) {
        children.set(directory, sync().child(directory, { bootstrap: false })[0])
      }
    }
    return children
  })
  const activeSessionID = createMemo(() => sessionIDFromRoute(layout.route()))
  let panel!: HTMLDivElement
  const activeSession = createMemo(() => {
    const sessionID = activeSessionID()
    if (!sessionID) return
    return sync().session.lineage.peek(sessionID)?.session ?? sync().session.get(sessionID)
  })
  const activeProject = createMemo(() => {
    const session = activeSession()
    if (!session) return
    return projectForDirectory(projects(), session.directory)
  })
  const selectedProject = createMemo(
    () =>
      projects().find((project) => project.worktree === selectedProjectWorktree()) ?? activeProject() ?? projects()[0],
  )
  const selectedProjectPath = createMemo(() => {
    const project = selectedProject()
    if (!project) return ""
    const home = sync().data.path.home
    return home ? project.worktree.replace(home, "~") : project.worktree
  })
  const width = createMemo(() => Math.min(420, Math.max(344, layout.sidebar.width())))

  function projectSessions(project: LocalProject) {
    const directories = [project.worktree, ...(project.sandboxes ?? [])]
    const sessions = directories.flatMap((directory) => projectChildren().get(directory)?.session ?? [])
    return visibleProjectSessions([...new Map(sessions.map((session) => [session.id, session])).values()], directories)
  }

  const selectedSessions = createMemo(() => {
    const project = selectedProject()
    return project ? projectSessions(project) : []
  })

  createEffect(
    on(
      () => activeProject()?.worktree,
      (worktree) => {
        if (worktree) setSelectedProjectWorktree(worktree)
      },
    ),
  )

  createEffect(() => {
    const active = activeSessionID()
    const project = selectedProject()?.worktree
    const sessionIDs = projects()
      .flatMap((project) => projectSessions(project))
      .map((session) => session.id)
      .join("\0")
    void project
    void sessionIDs
    queueMicrotask(() => {
      if (panel.isConnected) applySidebarSessionSelection(panel, active)
    })
  })

  function selectProject(project: LocalProject) {
    setSelectedProjectWorktree(project.worktree)
    layout.sidebar.open()
  }

  function selectSession(project: LocalProject, sessionID: string) {
    server.projects.touch(project.worktree)
    const tab = tabs.addSessionTab({ server: server.key, sessionId: sessionID })
    tabs.select(tab)
    if (props.mobile) layout.mobileSidebar.hide()
  }

  function newSession(project: LocalProject) {
    server.projects.touch(project.worktree)
    void tabs.newDraft({ server: server.key, directory: project.worktree, worktree: project.worktree })
    if (props.mobile) layout.mobileSidebar.hide()
  }

  function addProject() {
    const current = server.current
    if (!current) return
    pickDirectory({
      server: current,
      title: language.t("command.project.open"),
      multiple: true,
      onSelect(result) {
        const directories = Array.isArray(result) ? result : result ? [result] : []
        for (const directory of directories) {
          layout.projects.open(directory)
        }
        const directory = directories.at(-1)
        if (!directory) return
        setSelectedProjectWorktree(directory)
        layout.sidebar.open()
      },
    })
  }

  function toggleTerminal() {
    command.trigger("terminal.toggle")
    layout.mobileSidebar.hide()
  }

  return (
    <div
      ref={panel}
      data-component="ctw-sidebar-panel"
      data-active-session-id={activeSessionID()}
      class="flex h-full min-h-0 overflow-hidden bg-v2-background-bg-base"
      style={{ width: props.mobile ? "100%" : expanded() ? `${width()}px` : "64px" }}
    >
      <div
        data-component="ctw-sidebar-project-rail"
        class="flex w-16 shrink-0 flex-col items-center overflow-hidden border-r border-v2-border-border-muted bg-v2-background-bg-base"
      >
        <div class="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <div class="flex flex-col items-center gap-3">
            <For each={projects()}>
              {(project) => (
                <button
                  type="button"
                  data-component="ctw-sidebar-project"
                  data-selected={selectedProject()?.worktree === project.worktree ? "" : undefined}
                  class="group relative flex size-10 items-center justify-center overflow-hidden rounded-lg border border-transparent p-1 transition-colors duration-150 ease-out hover:border-v2-border-border-muted hover:bg-v2-background-bg-layer-02 focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-border-border-focus data-[selected]:border-2 data-[selected]:border-v2-border-border-strong"
                  title={projectLabel(project)}
                  aria-label={projectLabel(project)}
                  aria-pressed={selectedProject()?.worktree === project.worktree}
                  onClick={() => selectProject(project)}
                >
                  <ProjectAvatar
                    class="size-8"
                    fallback={projectLabel(project)}
                    src={project.icon?.override ?? project.icon?.url}
                    variant={getProjectAvatarVariant(project.icon?.color)}
                  />
                </button>
              )}
            </For>
            <button
              type="button"
              class="flex size-10 items-center justify-center rounded-lg text-v2-icon-icon-muted transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02 hover:text-v2-icon-icon-base"
              title={language.t("command.project.open")}
              aria-label={language.t("command.project.open")}
              onClick={addProject}
            >
              <IconV2 name="plus" />
            </button>
          </div>
        </div>
        <div class="flex w-full shrink-0 flex-col items-center gap-2 px-3 pb-6 pt-3">
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-lg text-v2-icon-icon-muted transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02 hover:text-v2-icon-icon-base"
            title={language.t("command.settings.open")}
            aria-label={language.t("command.settings.open")}
            onClick={openSettings}
          >
            <IconV2 name="settings-gear" />
          </button>
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-lg text-v2-icon-icon-muted transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02 hover:text-v2-icon-icon-base"
            title={language.t("sidebar.help")}
            aria-label={language.t("sidebar.help")}
            onClick={() => platform.openLink("https://opencode.ai/desktop-feedback")}
          >
            <IconV2 name="help" />
          </button>
        </div>
      </div>

      <Show when={expanded()}>
        <div
          data-component="ctw-sidebar-project-panel"
          class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-v2-background-bg-base"
        >
          <Show when={selectedProject()} keyed>
            {(project) => (
              <>
                <div class="shrink-0 px-5 pb-2 pt-4">
                  <div class="truncate text-14-medium text-v2-text-text-strong">{projectLabel(project)}</div>
                  <div class="truncate text-12-regular text-v2-text-text-muted" title={project.worktree}>
                    {selectedProjectPath()}
                  </div>
                </div>
                <div class="shrink-0 px-3 py-4">
                  <button
                    type="button"
                    class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-v2-border-border-muted bg-v2-background-bg-base text-14-regular text-v2-text-text-base transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02"
                    onClick={() => newSession(project)}
                  >
                    <IconV2 name="edit" size="small" class="text-v2-icon-icon-muted" />
                    {language.t("command.session.new")}
                  </button>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
                  <For each={selectedSessions()}>
                    {(session) => (
                      <SidebarSessionRow session={session} onSelect={() => selectSession(project, session.id)} />
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>

          <Show when={props.mobile && activeSessionID()}>
            <div class="shrink-0 border-t border-v2-border-border-muted p-2">
              <button
                type="button"
                data-component="ctw-sidebar-terminal"
                class="flex h-9 w-full items-center justify-center gap-2 rounded-md text-v2-icon-icon-muted transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02 hover:text-v2-icon-icon-base"
                title={language.t("command.terminal.toggle")}
                aria-label={language.t("command.terminal.toggle")}
                aria-controls="terminal-panel"
                onClick={toggleTerminal}
              >
                <Icon name="terminal" size="small" />
                <span class="truncate text-13-medium text-v2-text-text-base">{language.t("terminal.title")}</span>
              </button>
            </div>
          </Show>

          <Show when={clientVersion()}>
            {(version) => (
              <button
                type="button"
                data-component="ctw-sidebar-version"
                data-build-version={version()}
                class="mx-3 mb-2 flex h-7 shrink-0 items-center justify-center gap-2 rounded-md px-2 text-11-regular text-v2-text-text-muted transition-colors duration-150 ease-out hover:bg-v2-background-bg-layer-02 hover:text-v2-text-text-base"
                title={`Reload OpenCode ${version()}`}
                aria-label={`Reload OpenCode ${version()}`}
                onClick={() => void platform.restart()}
              >
                <svg viewBox="0 0 16 16" class="size-3.5 shrink-0" fill="none" aria-hidden="true">
                  <path
                    d="M13.25 3.75V7.75H9.25M13.25 7.75A5.5 5.5 0 1 0 11.64 11.64"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="truncate">OpenCode v{version()}</span>
              </button>
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}
