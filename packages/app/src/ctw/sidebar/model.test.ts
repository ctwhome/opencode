import { describe, expect, test } from "bun:test"
import {
  loadSidebarProjectSessions,
  projectForDirectory,
  projectLabel,
  sessionIDFromRoute,
  visibleProjectSessions,
} from "./model"

const session = (input: {
  id: string
  projectID?: string
  directory: string
  title?: string
  parentID?: string
  archived?: number
  created?: number
  updated?: number
}) => ({
  id: input.id,
  projectID: input.projectID,
  directory: input.directory,
  title: input.title ?? input.id,
  parentID: input.parentID,
  time: {
    created: input.created ?? 1,
    updated: input.updated,
    archived: input.archived,
  },
})

describe("custom sidebar model", () => {
  test("shows only unarchived root sessions for the selected project directory", () => {
    const sessions = [
      session({ id: "root", directory: "/repo", updated: 30 }),
      session({ id: "child", directory: "/repo", parentID: "root", updated: 40 }),
      session({ id: "archived", directory: "/repo", archived: 50, updated: 50 }),
      session({ id: "other", directory: "/other", updated: 60 }),
    ]

    expect(visibleProjectSessions(sessions, "/repo").map((item) => item.id)).toEqual(["root"])
  })

  test("sorts sessions by newest activity with a stable id tiebreak", () => {
    const sessions = [
      session({ id: "older", directory: "/repo", updated: 10 }),
      session({ id: "z", directory: "/repo", updated: 20 }),
      session({ id: "a", directory: "/repo", updated: 20 }),
      session({ id: "created", directory: "/repo", created: 15 }),
    ]

    expect(visibleProjectSessions(sessions, "/repo").map((item) => item.id)).toEqual(["a", "z", "created", "older"])
  })

  test("groups sessions from a project root and its workspaces", () => {
    const sessions = [
      session({ id: "root", directory: "/repo", updated: 20 }),
      session({ id: "workspace", directory: "/repo-workspace", updated: 30 }),
      session({ id: "other", directory: "/other", updated: 40 }),
    ]

    expect(visibleProjectSessions(sessions, ["/repo", "/repo-workspace"]).map((item) => item.id)).toEqual([
      "workspace",
      "root",
    ])
  })

  test("resolves a project from either its root or workspace directory", () => {
    const projects = [
      { worktree: "/repo", sandboxes: ["/repo-workspace"] },
      { worktree: "/other", sandboxes: [] },
    ]

    expect(projectForDirectory(projects, "/repo")?.worktree).toBe("/repo")
    expect(projectForDirectory(projects, "/repo-workspace")?.worktree).toBe("/repo")
    expect(projectForDirectory(projects, "/missing")).toBeUndefined()
  })

  test("uses project id when a symlink resolves sessions to a different path", () => {
    const projects = [{ id: "project", worktree: "/repo-alias", sandboxes: [] }]
    const sessions = [session({ id: "linked", projectID: "project", directory: "/repo-real", updated: 20 })]

    expect(projectForDirectory(projects, "/repo-real", "project")?.worktree).toBe("/repo-alias")
    expect(visibleProjectSessions(sessions, "/repo-alias", "project").map((item) => item.id)).toEqual(["linked"])
  })

  test("loads root and sandbox directories once per project", async () => {
    const loaded: string[] = []

    await loadSidebarProjectSessions(
      [
        { worktree: "/one", sandboxes: ["/one-a", "/one-b"] },
        { worktree: "/two", sandboxes: ["/two-a"] },
      ],
      async (directory) => {
        loaded.push(directory)
      },
    )

    expect(loaded).toEqual(["/one", "/one-a", "/one-b", "/two", "/two-a"])
  })

  test("identifies only an active session route", () => {
    expect(sessionIDFromRoute({ type: "session", sessionId: "ses_1" })).toBe("ses_1")
    expect(sessionIDFromRoute({ type: "home" })).toBeUndefined()
    expect(sessionIDFromRoute({ type: "draft", draftID: "draft_1" })).toBeUndefined()
  })

  test("uses an explicit project name and falls back to its final path segment", () => {
    expect(projectLabel({ name: "OpenCode", worktree: "/repo/opencode" })).toBe("OpenCode")
    expect(projectLabel({ worktree: "/repo/opencode" })).toBe("opencode")
    expect(projectLabel({ worktree: "/" })).toBe("/")
  })
})
