import { Agent } from "@/agent/agent"
import { InstanceState } from "@/effect/instance-state"
import { Git } from "@/git"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { MessageID, SessionID } from "@/session/schema"
import { LLMEvent } from "@opencode-ai/llm"
import { Effect, Stream } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { CtwSourceControlError } from "../groups/ctw-source-control"

const agent: Agent.Info = {
  name: "ctw-commit-message",
  mode: "primary",
  permission: [],
  options: {},
  native: true,
  prompt: "",
}

const error = (message: string) =>
  new CtwSourceControlError({
    name: "CtwSourceControlError",
    data: { message },
  })

const output = (result: Git.Result) => result.stderr.toString("utf8").trim() || result.text().trim()

export function parseCtwGitStatus(text: string) {
  return text
    .split("\0")
    .filter(Boolean)
    .flatMap((line) => {
      const file = line.slice(3)
      if (!file) return []
      const index = line[0] ?? " "
      const worktree = line[1] ?? " "
      return [
        {
          file,
          index,
          worktree,
          staged: index !== " " && index !== "?",
          unstaged: worktree !== " " || index === "?",
        },
      ]
    })
}

export function buildCtwCommitMessageContext(nameStatus: string, statistics: string) {
  return [
    "Staged file names and statuses:",
    nameStatus.trim(),
    "",
    "Aggregate change statistics:",
    statistics.trim(),
  ].join("\n")
}

const cleanMessage = (value: string) =>
  value
    .replace(/^```[^\n]*\n?|\n?```$/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^(commit message|message):\s*/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .slice(0, 120)

const validFiles = (files: readonly string[]) =>
  files.length <= 1_000 && files.every((file) => file.length > 0 && !file.includes("\0"))

export const ctwSourceControlHandlers = HttpApiBuilder.group(InstanceHttpApi, "ctwSourceControl", (handlers) =>
  Effect.gen(function* () {
    const git = yield* Git.Service
    const llm = yield* LLM.Service
    const provider = yield* Provider.Service

    const cwd = Effect.fnUntraced(function* () {
      const ctx = yield* InstanceState.context
      if (ctx.project.vcs !== "git") return yield* error("Project is not a Git repository")
      return ctx.directory
    })

    const run = Effect.fnUntraced(function* (args: string[], maxOutputBytes?: number) {
      const result = yield* git.run(args, { cwd: yield* cwd(), maxOutputBytes })
      if (result.exitCode !== 0) return yield* error(output(result) || "Git command failed")
      return result
    })

    const status = Effect.fn("CtwSourceControl.status")(function* () {
      const directory = yield* cwd()
      const result = yield* git.run(
        ["status", "--porcelain=v1", "--untracked-files=all", "--no-renames", "-z", "--", "."],
        { cwd: directory, maxOutputBytes: 2_000_000 },
      )
      if (result.exitCode !== 0) return yield* error(output(result) || "Unable to read Git status")

      const [branch, upstreamResult] = yield* Effect.all(
        [
          git.branch(directory),
          git.run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { cwd: directory }),
        ],
        { concurrency: 2 },
      )
      const upstream = upstreamResult.exitCode === 0 ? upstreamResult.text().trim() || undefined : undefined
      const counts = upstream
        ? yield* git.run(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], { cwd: directory })
        : undefined
      const [behind = 0, ahead = 0] =
        counts?.exitCode === 0
          ? counts
              .text()
              .trim()
              .split(/\s+/)
              .map((value) => Number.parseInt(value, 10) || 0)
          : []

      return {
        branch,
        upstream,
        ahead,
        behind,
        files: parseCtwGitStatus(result.text()).toSorted((a, b) => a.file.localeCompare(b.file)),
      }
    })

    const stage = Effect.fn("CtwSourceControl.stage")(function* (files: readonly string[]) {
      if (!validFiles(files)) return yield* error("Invalid file selection")
      yield* run(["--literal-pathspecs", "add", "-A", "--", ...(files.length ? files : ["."])])
      return { success: true }
    })

    const unstage = Effect.fn("CtwSourceControl.unstage")(function* (files: readonly string[]) {
      if (!validFiles(files)) return yield* error("Invalid file selection")
      const directory = yield* cwd()
      const paths = files.length ? files : ["."]
      const args = (yield* git.hasHead(directory))
        ? ["--literal-pathspecs", "reset", "-q", "HEAD", "--", ...paths]
        : ["--literal-pathspecs", "rm", "--cached", "-r", "--ignore-unmatch", "--", ...paths]
      yield* run(args)
      return { success: true }
    })

    const generateMessage = Effect.fn("CtwSourceControl.generateMessage")(function* () {
      const nameStatus = yield* run(
        ["diff", "--cached", "--name-status", "--no-ext-diff", "--no-renames", "--", "."],
        100_000,
      )
      if (!nameStatus.text().trim()) return yield* error("Stage changes before generating a commit message")
      const statistics = yield* run(["diff", "--cached", "--stat", "--no-ext-diff", "--no-renames", "--", "."], 100_000)
      const context = buildCtwCommitMessageContext(nameStatus.text(), statistics.text()).slice(0, 20_000)

      const fallback = yield* provider.defaultModel().pipe(Effect.mapError(() => error("No default model configured")))
      const model = yield* Effect.gen(function* () {
        return (
          (yield* provider.getSmallModel(fallback.providerID)) ??
          (yield* provider.getModel(fallback.providerID, fallback.modelID))
        )
      }).pipe(Effect.mapError(() => error("Default model is unavailable")))
      const sessionID = SessionID.descending()
      const result = yield* llm
        .stream({
          agent,
          user: {
            id: MessageID.ascending(),
            sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: agent.name,
            model: { providerID: model.providerID, modelID: model.id },
          },
          system: [],
          small: true,
          tools: {},
          model,
          sessionID,
          retries: 2,
          messages: [
            {
              role: "user",
              content:
                "Write one concise conventional commit subject for the staged change summary below. " +
                "Return only subject, no markdown, no quotes, no body. Prefer at most 72 characters. " +
                "Source contents are intentionally omitted.\n\n" +
                `<staged-metadata>\n${context}\n</staged-metadata>`,
            },
          ],
        })
        .pipe(
          Stream.filter(LLMEvent.is.textDelta),
          Stream.map((event) => event.text),
          Stream.mkString,
          Effect.mapError(() => error("Commit message generation failed")),
        )
      const message = cleanMessage(result)
      if (!message) return yield* error("Commit message generation returned no text")
      return { message }
    })

    const commit = Effect.fn("CtwSourceControl.commit")(function* (message: string) {
      const value = message.trim()
      if (!value) return yield* error("Commit message is required")
      if (value.length > 10_000) return yield* error("Commit message is too long")
      const result = yield* run(["commit", "-m", value], 100_000)
      return { message: result.text().trim() || "Changes committed" }
    })

    const push = Effect.fn("CtwSourceControl.push")(function* () {
      const directory = yield* cwd()
      const upstream = yield* git.run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
        cwd: directory,
      })
      const result =
        upstream.exitCode === 0
          ? yield* run(["push"], 100_000)
          : yield* Effect.gen(function* () {
              const branch = yield* git.branch(directory)
              if (!branch) return yield* error("Current Git branch is unavailable")
              const remotes = (yield* run(["remote"])).text().trim().split(/\r?\n/).filter(Boolean)
              const remote = remotes.includes("origin") ? "origin" : remotes[0]
              if (!remote) return yield* error("No Git remote configured")
              return yield* run(["push", "-u", remote, branch], 100_000)
            })
      return { message: output(result) || "Changes pushed" }
    })

    return handlers
      .handle("status", status)
      .handle("stage", (ctx) => stage(ctx.payload.files))
      .handle("unstage", (ctx) => unstage(ctx.payload.files))
      .handle("generateMessage", generateMessage)
      .handle("commit", (ctx) => commit(ctx.payload.message))
      .handle("push", push)
  }),
)
