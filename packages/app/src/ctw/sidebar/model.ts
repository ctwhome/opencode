import { getFilename } from "@opencode-ai/core/util/path"
import { pathKey } from "@/utils/path-key"

export type SidebarSession = {
  id: string
  projectID?: string
  title: string
  directory: string
  parentID?: string
  time: {
    created: number
    updated?: number
    archived?: number
  }
}

export function visibleProjectSessions<T extends SidebarSession>(
  sessions: T[],
  directories: string | string[],
  projectID?: string,
) {
  const projects = new Set((Array.isArray(directories) ? directories : [directories]).map(pathKey))
  return sessions
    .filter(
      (session) =>
        (projectID ? session.projectID === projectID : projects.has(pathKey(session.directory))) &&
        !session.parentID &&
        session.time.archived === undefined,
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
  projectID?: string,
) {
  if (projectID) {
    const project = projects.find((item) => "id" in item && item.id === projectID)
    if (project) return project
  }
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
  return Promise.all(
    projects.flatMap((project) => [project.worktree, ...(project.sandboxes ?? [])]).map((directory) => load(directory)),
  ).then(() => undefined)
}

export function sessionIDFromRoute(route: unknown) {
  if (!route || typeof route !== "object" || !("type" in route) || route.type !== "session") return undefined
  if (!("sessionId" in route) || typeof route.sessionId !== "string") return undefined
  return route.sessionId
}

export function projectLabel(project: { name?: string; worktree: string }) {
  return project.name || getFilename(project.worktree) || project.worktree
}
