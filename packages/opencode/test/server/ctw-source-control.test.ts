import { describe, expect, test } from "bun:test"
import {
  buildCtwCommitMessageContext,
  parseCtwGitStatus,
} from "../../src/server/routes/instance/httpapi/handlers/ctw-source-control"

describe("CTW source-control status", () => {
  test("keeps staged and unstaged state separate", () => {
    expect(parseCtwGitStatus("M  staged.ts\0 M unstaged.ts\0MM both.ts\0?? new.ts\0")).toEqual([
      { file: "staged.ts", index: "M", worktree: " ", staged: true, unstaged: false },
      { file: "unstaged.ts", index: " ", worktree: "M", staged: false, unstaged: true },
      { file: "both.ts", index: "M", worktree: "M", staged: true, unstaged: true },
      { file: "new.ts", index: "?", worktree: "?", staged: false, unstaged: true },
    ])
  })

  test("builds AI context from metadata without source contents", () => {
    const context = buildCtwCommitMessageContext("M\tsrc/auth.ts", " src/auth.ts | 2 +-")
    expect(context).toContain("M\tsrc/auth.ts")
    expect(context).toContain("src/auth.ts | 2 +-")
    expect(context).not.toContain("super-secret-source-line")
  })
})
