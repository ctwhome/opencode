import type { ExperimentalCtwSourceControlStatusResponse } from "@opencode-ai/sdk/v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { LoaderV2 } from "@opencode-ai/ui/v2/loader-v2"
import { Icon } from "@opencode-ai/ui/icon"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { createMemo, createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { formatServerError } from "@/utils/server-errors"
import { showToast } from "@/utils/toast"

type File = ExperimentalCtwSourceControlStatusResponse["files"][number]

export function CtwSourceControl(props: {
  activeFile?: string
  filter: string
  version?: number
  onSelectFile: (file: string) => void
  onChanged: () => void
}) {
  const sdk = useSDK()
  const language = useLanguage()
  const [state, setState] = createStore<{
    message: string
    pending?: string
    notice?: string
  }>({ message: "" })
  const [status, { refetch }] = createResource(
    () => [sdk().directory, props.version] as const,
    () =>
      sdk()
        .client.experimental.ctwSourceControl.status()
        .then((result) => result.data),
  )

  const filter = (files: File[]) => {
    const value = props.filter.trim().toLowerCase()
    return value ? files.filter((file) => file.file.toLowerCase().includes(value)) : files
  }
  const stagedAll = createMemo(() => status()?.files.filter((file) => file.staged) ?? [])
  const changedAll = createMemo(() => status()?.files.filter((file) => file.unstaged) ?? [])
  const staged = createMemo(() => filter(stagedAll()))
  const changed = createMemo(() => filter(changedAll()))
  const ahead = createMemo(() => Number(status()?.ahead ?? 0))
  const behind = createMemo(() => Number(status()?.behind ?? 0))

  const fail = (error: unknown) => {
    const description = formatServerError(error, language.t, language.t("common.requestFailed"))
    setState("notice", description)
    showToast({ variant: "error", title: language.t("common.requestFailed"), description })
  }

  const action = async (name: string, run: () => Promise<string | undefined>) => {
    if (state.pending) return
    setState("pending", name)
    setState("notice", undefined)
    try {
      const next = await run()
      if (next) setState("notice", next)
      await refetch()
      props.onChanged()
    } catch (error) {
      fail(error)
    } finally {
      setState("pending", undefined)
    }
  }

  const stage = (files: string[]) =>
    action("stage", async () => {
      await sdk().client.experimental.ctwSourceControl.stage({ files })
      return files.length ? "File staged" : "All changes staged"
    })

  const unstage = (files: string[]) =>
    action("unstage", async () => {
      await sdk().client.experimental.ctwSourceControl.unstage({ files })
      return files.length ? "File unstaged" : "All changes unstaged"
    })

  const generate = () =>
    action("generate", async () => {
      const result = await sdk().client.experimental.ctwSourceControl.generateMessage()
      setState("message", result.data?.message ?? "")
      return "Commit message generated"
    })

  const commit = () =>
    action("commit", async () => {
      const result = await sdk().client.experimental.ctwSourceControl.commit({ message: state.message })
      setState("message", "")
      return result.data?.message || "Changes committed"
    })

  const push = () =>
    action("push", async () => {
      const result = await sdk().client.experimental.ctwSourceControl.push()
      return result.data?.message || "Changes pushed"
    })

  return (
    <div class="flex min-h-0 flex-1 flex-col border-b border-v2-border-border-muted">
      <div class="flex flex-col gap-2 border-b border-v2-border-border-muted p-2">
        <div class="flex items-center justify-between gap-2 text-12-regular text-v2-text-text-muted">
          <span class="truncate">{status()?.branch ?? "Git"}</span>
          <Show when={ahead() > 0 || behind() > 0}>
            <span class="shrink-0">
              ↑{ahead()} ↓{behind()}
            </span>
          </Show>
        </div>
        <div class="relative">
          <TextareaV2
            class="!w-full !min-h-16 [&_[data-slot=textarea-v2-textarea]]:!min-h-16"
            rows={2}
            value={state.message}
            placeholder="Commit message"
            disabled={!!state.pending}
            onInput={(event) => setState("message", event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void commit()
            }}
          />
          <button
            type="button"
            class="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded text-v2-icon-icon-muted transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base disabled:opacity-50"
            disabled={!!state.pending || stagedAll().length === 0}
            aria-label="Generate commit message from staged metadata"
            title="Generate with AI from staged file names and change statistics"
            onClick={() => void generate()}
          >
            <Show when={state.pending === "generate"} fallback={<Icon name="models" size="small" />}>
              <LoaderV2 width={14} height={14} />
            </Show>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <ButtonV2
            variant="contrast"
            disabled={!!state.pending || !state.message.trim() || stagedAll().length === 0}
            onClick={() => void commit()}
          >
            <Show when={state.pending === "commit"} fallback="Commit">
              <LoaderV2 width={14} height={14} />
            </Show>
          </ButtonV2>
          <ButtonV2 variant="neutral" disabled={!!state.pending} onClick={() => void push()}>
            <Show when={state.pending === "push"} fallback="Push">
              <LoaderV2 width={14} height={14} />
            </Show>
          </ButtonV2>
        </div>
        <Show when={state.notice}>
          <div class="text-11-regular text-v2-text-text-muted" role="status">
            {state.notice}
          </div>
        </Show>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto" data-scrollable>
        <Show when={!status.loading} fallback={<Loading />}>
          <Show when={!status.error} fallback={<ErrorText error={status.error} />}>
            <Section
              title="Staged Changes"
              files={staged()}
              action="Unstage All"
              disabled={!!state.pending}
              onAction={() => unstage([])}
            >
              {(file) => (
                <FileRow
                  file={file}
                  active={props.activeFile === file.file}
                  label="Unstage file"
                  icon="arrow-undo-down"
                  disabled={!!state.pending}
                  onSelect={props.onSelectFile}
                  onAction={(path) => unstage([path])}
                />
              )}
            </Section>
            <Section
              title="Changes"
              files={changed()}
              action="Stage All"
              disabled={!!state.pending}
              onAction={() => stage([])}
            >
              {(file) => (
                <FileRow
                  file={file}
                  active={props.activeFile === file.file}
                  label="Stage file"
                  icon="plus-small"
                  disabled={!!state.pending}
                  onSelect={props.onSelectFile}
                  onAction={(path) => stage([path])}
                />
              )}
            </Section>
            <Show when={staged().length === 0 && changed().length === 0}>
              <div class="px-3 py-4 text-12-regular text-v2-text-text-muted">No changes</div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  )
}

function Section(props: {
  title: string
  files: File[]
  action: string
  disabled: boolean
  onAction: () => void
  children: (file: File) => ReturnType<typeof FileRow>
}) {
  return (
    <Show when={props.files.length > 0}>
      <div>
        <div class="flex h-8 items-center justify-between border-b border-v2-border-border-muted px-2">
          <span class="text-12-medium text-v2-text-text-base">
            {props.title} <span class="text-v2-text-text-muted">{props.files.length}</span>
          </span>
          <button
            type="button"
            class="rounded px-1.5 py-1 text-11-medium text-v2-text-text-muted transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-base disabled:opacity-50"
            disabled={props.disabled}
            onClick={props.onAction}
          >
            {props.action}
          </button>
        </div>
        <For each={props.files}>{props.children}</For>
      </div>
    </Show>
  )
}

function FileRow(props: {
  file: File
  active: boolean
  label: string
  icon: "plus-small" | "arrow-undo-down"
  disabled: boolean
  onSelect: (file: string) => void
  onAction: (file: string) => void
}) {
  const code = () => (props.file.staged ? props.file.index : props.file.worktree)
  return (
    <div
      class="group flex h-8 items-center px-1 transition-colors hover:bg-v2-overlay-simple-overlay-hover"
      classList={{ "bg-v2-overlay-simple-overlay-pressed": props.active }}
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 px-1 text-left"
        onClick={() => props.onSelect(props.file.file)}
      >
        <FileIcon node={{ path: props.file.file, type: "file" }} class="size-4 shrink-0" />
        <span class="min-w-0 flex-1 truncate text-12-regular text-v2-text-text-base">{props.file.file}</span>
        <span class="text-11-medium text-v2-text-text-muted">{code()}</span>
      </button>
      <button
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded text-v2-icon-icon-muted opacity-0 transition-all hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base focus:opacity-100 group-hover:opacity-100 disabled:opacity-30"
        disabled={props.disabled}
        aria-label={`${props.label}: ${props.file.file}`}
        title={props.label}
        onClick={() => props.onAction(props.file.file)}
      >
        <Icon name={props.icon} size="small" />
      </button>
    </div>
  )
}

function Loading() {
  return (
    <div class="flex items-center gap-2 px-3 py-4 text-12-regular text-v2-text-text-muted">
      <LoaderV2 width={14} height={14} />
      Loading changes
    </div>
  )
}

function ErrorText(props: { error: unknown }) {
  return (
    <div class="px-3 py-4 text-12-regular text-v2-state-fg-danger">
      {props.error instanceof Error ? props.error.message : "Unable to load Git status"}
    </div>
  )
}
