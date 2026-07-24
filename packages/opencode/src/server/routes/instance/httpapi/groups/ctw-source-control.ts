import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"

const File = Schema.Struct({
  file: Schema.String,
  index: Schema.String,
  worktree: Schema.String,
  staged: Schema.Boolean,
  unstaged: Schema.Boolean,
})

const Status = Schema.Struct({
  branch: Schema.optional(Schema.String),
  upstream: Schema.optional(Schema.String),
  ahead: Schema.Number,
  behind: Schema.Number,
  files: Schema.Array(File),
})

const FilesPayload = Schema.Struct({ files: Schema.Array(Schema.String) })
const CommitPayload = Schema.Struct({ message: Schema.String })

export class CtwSourceControlError extends Schema.ErrorClass<CtwSourceControlError>("CtwSourceControlError")(
  {
    name: Schema.Literal("CtwSourceControlError"),
    data: Schema.Struct({ message: Schema.String }),
  },
  { httpApiStatus: 400 },
) {}

const group = HttpApiGroup.make("ctwSourceControl")
  .add(
    HttpApiEndpoint.get("status", "/experimental/ctw/source-control/status", {
      query: WorkspaceRoutingQuery,
      success: Status,
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.status" })),
    HttpApiEndpoint.post("stage", "/experimental/ctw/source-control/stage", {
      query: WorkspaceRoutingQuery,
      payload: FilesPayload,
      success: Schema.Struct({ success: Schema.Boolean }),
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.stage" })),
    HttpApiEndpoint.post("unstage", "/experimental/ctw/source-control/unstage", {
      query: WorkspaceRoutingQuery,
      payload: FilesPayload,
      success: Schema.Struct({ success: Schema.Boolean }),
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.unstage" })),
    HttpApiEndpoint.post("generateMessage", "/experimental/ctw/source-control/generate-message", {
      query: WorkspaceRoutingQuery,
      success: Schema.Struct({ message: Schema.String }),
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.generateMessage" })),
    HttpApiEndpoint.post("commit", "/experimental/ctw/source-control/commit", {
      query: WorkspaceRoutingQuery,
      payload: CommitPayload,
      success: Schema.Struct({ message: Schema.String }),
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.commit" })),
    HttpApiEndpoint.post("push", "/experimental/ctw/source-control/push", {
      query: WorkspaceRoutingQuery,
      success: Schema.Struct({ message: Schema.String }),
      error: CtwSourceControlError,
    }).annotateMerge(OpenApi.annotations({ identifier: "experimental.ctwSourceControl.push" })),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "ctwSourceControl",
      description: "CTW fork source-control actions.",
    }),
  )
  .middleware(InstanceContextMiddleware)
  .middleware(WorkspaceRoutingMiddleware)
  .middleware(Authorization)

export const CtwSourceControlApi = HttpApi.make("ctwSourceControl").add(group)
