# CTW OpenCode thin fork

This branch keeps a deliberately small downstream patch stack on top of stable OpenCode releases.

## Branch model

- `upstream/dev`: official `anomalyco/opencode` development branch.
- `origin/dev`: clean mirror of `upstream/dev`; do not place CTW changes here.
- `shared-sidebar`: latest verified stable OpenCode release plus the CTW patch stack.

Production is built from `shared-sidebar`, never directly from `dev`.

## Downstream patch stack

Keep these concerns as separate commits, in this order:

1. `feat(app): persist web sidebar projects`
2. `fix(app): protect sidebar hydration`
3. `feat(app): mount CTW sidebar in the new layout`

The first two implement server-global sidebar state for the private single-user server. Sessions already live in the server database. The third commit is an isolated product layer: its implementation lives under `packages/app/src/ctw/sidebar/`, consumes public app contexts, and touches upstream UI only through one import and one mount in `pages/layout-new.tsx`. It must not import `LegacyLayout` or `pages/layout/*`.

## Update cadence

Check upstream releases monthly and sooner for important security or data-loss fixes. Do not auto-deploy an update.

For each stable release:

1. Fetch `upstream` and tags.
2. Fast-forward `origin/dev` to `upstream/dev` only after proving the fork has no unique `dev` commits.
3. Create a temporary candidate from `shared-sidebar`.
4. Rebase the three downstream commits from the previous stable tag onto the new stable tag.
5. Resolve conflicts without folding unrelated upstream code into the downstream commits.
6. Regenerate SDK files when the HTTP API changes.
7. Run focused tests, package typechecks, the HTTP API exerciser, and a production binary build.
8. Start the candidate on a spare local port and compare health, project IDs, session IDs, and sidebar state with production.
9. In a fresh browser origin, verify the new UI is active, the CTW sidebar hydrates projects and sessions without a reload, and collapsed/expanded state persists. Verify session clicks use server-keyed tab routes, the selected session is highlighted, and the mobile drawer leaves no hidden focusable controls.
10. Back up sidebar state, deploy the candidate atomically, and verify both local and private-network URLs.
11. Tag the verified source as `ctw-v<upstream>-new-ui-sidebar.<revision>`.

If upstream changes `NewLayout`, preserve the one-import/one-mount seam and adapt only that seam or the CTW context adapters. Never recover by importing the legacy sidebar implementation; upstream must be able to remove `LegacyLayout` without deleting the CTW sidebar.

## Scope and security

Sidebar state is global per OpenCode server, not per authenticated user. This is intentional for the private single-user deployment and is not suitable for a public multi-user OpenCode server without account/workspace scoping.
