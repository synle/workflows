# workflows — Architecture

## High-Level Overview

`synle/workflows` is a collection of reusable GitHub Actions workflows and composite actions that other repositories call into. Workflows are exposed via `workflow_call` so caller repos can reference them as
`uses: synle/workflows/.github/workflows/<file>@<ref>`. Composite actions under `actions/` are exposed via
`uses: synle/workflows/actions/<name>@<ref>`.

The repo centralizes CI/CD building blocks — Node.js build/test/format pipelines, formatting-and-commit
flows, artifact and release cleanup, and a two-phase release pipeline (begin/end) — so downstream apps
get a single source of truth for pipeline behavior. Each reusable workflow has a matching `*.template`
file under `.github/workflows/` that serves as the caller-side snippet downstream repos copy in.

## Key Directories

- `.github/workflows/` — All reusable workflows (`workflow_call` entrypoints) plus `.yml.template`
  caller-side snippets. The major workflows are:
  - `build-and-commit-sh.yml` — full Node.js CI: install, build, format, commit artifacts, test, optional Pages deploy.
  - `pr-format-and-commit-code.yml` — formats code and commits the result back to the PR branch.
  - `pr-js-yarn.yml`, `pr-js-yarn-16.yml`, `pr-js-yarn-16-v2.yml` — JS/Yarn PR pipelines (default Node 24, Node 16 variants).
  - `pr-make-format.yml` — Makefile-driven format/check PR pipeline.
  - `cleanup-artifacts.yml` — scheduled bulk artifact cleanup.
  - `cleanup-pr-artifacts.yml` — per-PR artifact cleanup on `pull_request: closed`.
  - `cleanup-releases.yml` — draft / incomplete-release cleanup with dry-run support.
- `actions/release/` — Composite actions for a two-phase release flow:
  - `begin-release/` — pre-build setup: tag resolution, cleanup, draft release placeholder.
  - `end-release/` — post-build finalization: release notes, asset upload, flag promotion.
  - `_common/` — shared sub-actions used by `begin`/`end` (`draft/`, `finalize/`, `notes/`, `resolve-tag/`).
- Root scripts — `dev.sh`, `format.sh`, `setup-repo-node.sh`: helper scripts referenced by the workflows
  (e.g. remote `format.sh` fallback).

## Important Files

- `.github/workflows/build-and-commit-sh.yml` — Reusable Node.js pipeline with priority-based detection
  (Makefile → `build.sh` → `npm run build`, etc.) and a Job Summary status table.
- `.github/workflows/pr-format-and-commit-code.yml` — Runs formatter and commits formatted code back to
  the PR branch (default Node 24.x, configurable `os`/`node-version`).
- `.github/workflows/pr-js-yarn.yml` — Base JS+Yarn PR workflow (Node 24.x default).
- `.github/workflows/pr-js-yarn-16.yml` — Thin wrapper around `pr-js-yarn.yml` pinned to Node 16.
- `.github/workflows/pr-js-yarn-16-v2.yml` — Variant Node-16 wrapper around `pr-js-yarn.yml`.
- `.github/workflows/pr-make-format.yml` — Format/check pipeline driven by a repo `Makefile`.
- `.github/workflows/cleanup-artifacts.yml` — Scheduled (`cron: 0 0 * * 0`) + `workflow_dispatch`
  cleanup keeping the last N successful builds' artifacts and pruning runs older than N days.
- `.github/workflows/cleanup-pr-artifacts.yml` — Deletes all workflow-run artifacts tied to a PR head
  branch immediately on PR close, since GitHub does not auto-prune until retention expiry.
- `.github/workflows/cleanup-releases.yml` — Two-mode release cleanup (old drafts + incomplete-asset
  releases) with dry-run; uses `gh` CLI; emits a Job Summary table.
- `.github/workflows/*.yml.template` — Caller-side snippets matching each reusable workflow; copied into
  downstream repos as a starting point.
- `actions/release/begin-release/action.yml` — Composite action: checkout, resolve tag, clean prior
  release, create draft placeholder. Inputs: `mode` (official/beta), `project_name`, `version`, `sha`, …
- `actions/release/end-release/action.yml` — Composite action: generate notes, upload assets, set final
  release flags. Inputs: `tag`, `project_name`, `mode`, `build_result`, …
- `actions/release/_common/{draft,finalize,notes,resolve-tag}/` — Sub-actions composed by begin/end.

## Build & Release Flow

No build artifacts. Consumers pin to a release tag or branch via `@<ref>`; the repo itself is versioned
via release tags published from `main`.
