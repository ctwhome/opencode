import { getFilename } from "@opencode-ai/core/util/path"
import { pathKey } from "@/utils/path-key"

export type SidebarSession = {
  id: string
  title: string
  directory: string
  parentID?: string
  time: {
    created: number
    updated?: number
    archived?: number
  }
}

export function visibleProjectSessions<T extends SidebarSession>(sessions: T[], directories: string | string[]) {
  const projects = new Set((Array.isArray(directories) ? directories : [directories]).map(pathKey))
  return sessions
    .filter(
      (session) => projects.has(pathKey(session.directory)) && !session.parentID && session.time.archived === undefined,
    )
    .sort((left, right) => {
      const activity = (right.time.updated ?? right.time.created) - (left.time.updated ?? left.time.created)
      if (activity !== 0) return activity
      return left.id.localeCompare(right.id)
    })
}

export function projectForDirectory<T extends { worktree: string; sandboxes?: string[] }>(
  projects: T[],
  directory: string,
) {
  const key = pathKey(directory)
  return projects.find(
    (project) =>
      pathKey(project.worktree) === key || project.sandboxes?.some((workspace) => pathKey(workspace) === key),
  )
}

export function loadSidebarProjectSessions(
  projects: { worktree: string; sandboxes?: string[] }[],
  load: (directory: string) => Promise<unknown>,
) {
  return Promise.all(projects.flatMap((project) => [project.worktree, ...(project.sandboxes ?? [])]).map((directory) => load(directory))).then(
    () => undefined,
  )
}

export function sessionIDFromRoute<T extends { type: string; sessionId?: string }>(route: T) {
  if (route.type !== "session") return
  return route.sessionId
}

export function projectLabel(project: { name?: string; worktree: string }) {
  return project.name || getFilename(project.worktree) || project.worktree
}
