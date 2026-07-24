import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { Icon } from "@opencode-ai/ui/icon"
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
  beginEdgeSwipe,
  edgeSwipeOffset,
  edgeSwipeProgress,
  edgeSwipeShouldOpen,
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
    if (layout.mobileSidebar.opened()) return "translate3d(0, 0, 0)"
    const swipe = mobileSwipe()
    const offset = swipe ? edgeSwipeOffset(swipe) : 0
    return `translate3d(calc(-100% + ${offset}px), 0, 0)`
  })
  const mobileBackdropOpacity = createMemo(() => {
    if (layout.mobileSidebar.opened()) return 0.3
    const swipe = mobileSwipe()
    return swipe ? edgeSwipeProgress(swipe) * 0.3 : 0
  })

  function clearMobileSwipeTimer() {
    if (mobileSwipeTimer === undefined) return
    clearTimeout(mobileSwipeTimer)
    mobileSwipeTimer = undefined
  }

  function finishMobileSwipe(swipe: EdgeSwipeState, open: boolean) {
    clearMobileSwipeTimer()
    setMobileSwipeSettling(true)
    if (open) {
      layout.mobileSidebar.show()
      setMobileSwipe(undefined)
    } else {
      setMobileSwipe({ ...swipe, currentX: swipe.startX, currentAt: performance.now() })
    }
    mobileSwipeTimer = setTimeout(() => {
      if (!open) setMobileSwipe(undefined)
      setMobileSwipeSettling(false)
      mobileSwipeTimer = undefined
    }, 200)
  }

  function startMobileSwipe(event: TouchEvent & { currentTarget: HTMLDivElement }) {
    if (layout.mobileSidebar.opened() || event.touches.length !== 1) return
    const touch = event.touches[0]
    if (!touch) return
    const swipe = beginEdgeSwipe({
      x: touch.clientX,
      y: touch.clientY,
      at: event.timeStamp,
      width: Math.min(380, window.innerWidth),
    })
    if (!swipe) return
    clearMobileSwipeTimer()
    setMobileSwipeSettling(false)
    setMobileSwipe(swipe)
  }

  function moveMobileSwipe(event: TouchEvent & { currentTarget: HTMLDivElement }) {
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

  function endMobileSwipe(event: TouchEvent & { currentTarget: HTMLDivElement }) {
    const swipe = mobileSwipe()
    if (!swipe) return
    const touch = event.changedTouches[0]
    const next = touch
      ? updateEdgeSwipe(swipe, { x: touch.clientX, y: touch.clientY, at: event.timeStamp })
      : swipe
    finishMobileSwipe(next, edgeSwipeShouldOpen(next))
  }

  function cancelMobileSwipe() {
    const swipe = mobileSwipe()
    if (swipe) finishMobileSwipe(swipe, false)
  }

  onCleanup(clearMobileSwipeTimer)

  function mobileFocusable(root: HTMLElement) {
    return [...root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter(
      (element) => element.offsetWidth > 0 || element.offsetHeight > 0,
    )
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
    void loadSidebarProjectSessions(layout.projects.list(), (directory) => sync().project.loadSessions(directory)).catch(
      () => undefined,
    )
  })

  return (
    <>
      <aside
        data-component="ctw-sidebar-desktop"
        class="hidden xl:flex min-h-0 shrink-0 border-r border-v2-border-border-weak bg-v2-background-bg-base"
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
              "relative h-full w-full max-w-[380px] border-r border-v2-border-border-weak bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)] will-change-transform": true,
              "transition-transform duration-200 ease-out": mobileSwipeSettling(),
            }}
            style={{ transform: mobileDrawerTransform() }}
            onKeyDown={handleMobileKeys}
            onClick={(event) => event.stopPropagation()}
          >
            <SidebarPanel mobile />
          </aside>
        </div>
      </Show>
    </>
  )
}

function SidebarSessionRow(props: {
  session: SidebarSession
  onSelect: () => void
}) {
  const sync = useServerSync()

  return (
    <button
      type="button"
      data-component="ctw-sidebar-session"
      data-session-id={props.session.id}
      class="group/session flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-left hover:bg-v2-background-bg-hover"
      onClick={props.onSelect}
    >
      <span class="relative flex size-3 shrink-0 items-center justify-center" aria-hidden="true">
        <span
          classList={{
            "size-1.5 rounded-full": true,
            "bg-v2-icon-icon-interactive": sync().session.data.session_working(props.session.id),
            "bg-v2-icon-icon-muted": !sync().session.data.session_working(props.session.id),
          }}
        />
      </span>
      <span class="min-w-0 flex-1 truncate text-13-regular text-v2-text-text-base">
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
  const width = createMemo(() => Math.min(420, Math.max(280, layout.sidebar.width())))

  function projectSessions(project: LocalProject) {
    const directories = [project.worktree, ...(project.sandboxes ?? [])]
    const sessions = directories.flatMap((directory) => projectChildren().get(directory)?.session ?? [])
    return visibleProjectSessions(
      [...new Map(sessions.map((session) => [session.id, session])).values()],
      directories,
    )
  }

  createEffect(() => {
    const active = activeSessionID()
    const sessionIDs = projects()
      .flatMap((project) => projectSessions(project))
      .map((session) => session.id)
      .join("\0")
    void sessionIDs
    queueMicrotask(() => {
      if (panel.isConnected) applySidebarSessionSelection(panel, active)
    })
  })

  function selectProject(project: LocalProject) {
    server.projects.touch(project.worktree)
    layout.projects.expand(project.worktree)
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
          server.projects.touch(directory)
        }
        if (directories.length > 0) layout.sidebar.open()
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
      class="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ width: props.mobile ? "100%" : expanded() ? `${width()}px` : "56px" }}
    >
      <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2">
        <Show
          when={expanded()}
          fallback={
            <div class="flex flex-col items-center gap-1 px-2">
              <For each={projects()}>
                {(project) => (
                  <button
                    type="button"
                    data-component="ctw-sidebar-project-rail"
                    data-selected={activeProject()?.worktree === project.worktree ? "" : undefined}
                    class="group relative flex size-10 items-center justify-center rounded-md hover:bg-v2-background-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-border-border-focus data-[selected]:bg-v2-background-bg-selected"
                    title={projectLabel(project)}
                    aria-label={projectLabel(project)}
                    onClick={() => selectProject(project)}
                  >
                    <ProjectAvatar
                      fallback={projectLabel(project)}
                      src={project.icon?.override ?? project.icon?.url}
                      variant={getProjectAvatarVariant(project.icon?.color)}
                    />
                  </button>
                )}
              </For>
            </div>
          }
        >
          <div class="flex flex-col gap-1 px-2">
            <For each={projects()}>
              {(project) => {
                const sessions = createMemo(() => projectSessions(project))
                const selected = createMemo(() => activeProject()?.worktree === project.worktree)
                return (
                  <section
                    data-component="ctw-sidebar-project"
                    data-selected={selected() ? "" : undefined}
                    class="rounded-lg border border-transparent data-[selected]:border-v2-border-border-weak data-[selected]:bg-v2-background-bg-subtle"
                  >
                    <div class="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-v2-background-bg-hover">
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-expanded={project.expanded}
                        onClick={() => {
                          server.projects.touch(project.worktree)
                          if (project.expanded) layout.projects.collapse(project.worktree)
                          if (!project.expanded) layout.projects.expand(project.worktree)
                        }}
                      >
                        <ProjectAvatar
                          fallback={projectLabel(project)}
                          src={project.icon?.override ?? project.icon?.url}
                          variant={getProjectAvatarVariant(project.icon?.color)}
                        />
                        <span class="min-w-0 flex-1 truncate text-14-medium text-v2-text-text-strong">
                          {projectLabel(project)}
                        </span>
                        <IconV2
                          name="chevron-down"
                          size="small"
                          classList={{
                            "shrink-0 text-v2-icon-icon-muted transition-transform": true,
                            "-rotate-90": !project.expanded,
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        class="flex size-7 shrink-0 items-center justify-center rounded-md text-v2-icon-icon-muted opacity-0 hover:bg-v2-background-bg-active hover:text-v2-icon-icon-base group-hover:opacity-100 focus-visible:opacity-100"
                        title={language.t("command.session.new")}
                        aria-label={language.t("command.session.new")}
                        onClick={() => newSession(project)}
                      >
                        <IconV2 name="plus" size="small" />
                      </button>
                    </div>
                    <Show when={project.expanded}>
                      <div class="pb-1 pl-3 pr-1">
                        <For
                          each={sessions()}
                          fallback={
                            <button
                              type="button"
                              class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-13-regular text-v2-text-text-muted hover:bg-v2-background-bg-hover"
                              onClick={() => newSession(project)}
                            >
                              <IconV2 name="edit" size="small" />
                              {language.t("command.session.new")}
                            </button>
                          }
                        >
                          {(session) => (
                            <SidebarSessionRow
                              session={session}
                              onSelect={() => selectSession(project, session.id)}
                            />
                          )}
                        </For>
                      </div>
                    </Show>
                  </section>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
      <div class="shrink-0 border-t border-v2-border-border-weak p-2">
        <div classList={{ "flex gap-1": expanded(), "flex flex-col items-center gap-1": !expanded() }}>
          <Show when={props.mobile && activeSessionID()}>
            <button
              type="button"
              data-component="ctw-sidebar-terminal"
              class="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-md text-v2-icon-icon-muted hover:bg-v2-background-bg-hover hover:text-v2-icon-icon-base"
              title={language.t("command.terminal.toggle")}
              aria-label={language.t("command.terminal.toggle")}
              aria-controls="terminal-panel"
              onClick={toggleTerminal}
            >
              <Icon name="terminal" size="small" />
              <span class="truncate text-13-medium text-v2-text-text-base">{language.t("terminal.title")}</span>
            </button>
          </Show>
          <Show when={!props.mobile}>
            <button
              type="button"
              class="flex size-9 items-center justify-center rounded-md text-v2-icon-icon-muted hover:bg-v2-background-bg-hover hover:text-v2-icon-icon-base"
              title={language.t("command.sidebar.toggle")}
              aria-label={language.t("command.sidebar.toggle")}
              aria-expanded={layout.sidebar.opened()}
              onClick={layout.sidebar.toggle}
            >
              <IconV2
                name="sidebar-right"
                classList={{ "transition-transform": true, "rotate-180": layout.sidebar.opened() }}
              />
            </button>
          </Show>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-md text-v2-icon-icon-muted hover:bg-v2-background-bg-hover hover:text-v2-icon-icon-base"
            title={language.t("command.project.open")}
            aria-label={language.t("command.project.open")}
            onClick={addProject}
          >
            <IconV2 name="folder-add-left" />
          </button>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-md text-v2-icon-icon-muted hover:bg-v2-background-bg-hover hover:text-v2-icon-icon-base"
            title={language.t("command.settings.open")}
            aria-label={language.t("command.settings.open")}
            onClick={openSettings}
          >
            <IconV2 name="settings-gear" />
          </button>
        </div>
        <Show when={expanded() && clientVersion()}>
          {(version) => (
            <div
              data-component="ctw-sidebar-version"
              data-build-version={version()}
              class="mt-1 truncate px-1 text-center text-11-regular text-v2-text-text-muted"
              title={`Loaded client build ${version()}`}
            >
              OpenCode v{version()}
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
