# AGENTS

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Reusable GitHub Actions workflows and composite actions repository (`synle/workflows`). Provides shared CI/CD workflow templates (`workflow_call`) and composable release actions for other repositories. Also includes helper shell scripts for formatting and dev file-watching.

## Cross-Agent File Layout

- Store shared repository context in `AGENTS.md` and portable skills in `.agents/skills/<name>/SKILL.md`.
- When `CLAUDE.md` exists without `AGENTS.md` in the same scope, migrate its guidance to `AGENTS.md`. If both exist, preserve all distinct instructions in `AGENTS.md` before replacing the legacy file; retain compatibility when a verified consumer still requires it.
- Keep nested context scoped and move complete skill folders, including support files. Match the kebab-case folder name to frontmatter `name`; portable frontmatter contains only `name` and `description`.
- Update references to migrated context and skills. Do not create duplicate guidance bodies or new skills in vendor-specific directories.

## Important Rules

- **Always use `curl -fsSL` for curl commands.** Standard curl flag convention across all scripts.
- **Bash functions must use the `function` keyword**: Write `function foo() {` not `foo() {`.
- **Always run `bash format.sh` after making changes.**
- **URLs must use `synle/workflows/`.** The repo was renamed from `gha-workflow` to `workflows`. Never use the old `synle/gha-workflow/` URL.
- **oxfmt, not Prettier.** Formatting is handled by [oxfmt](https://www.npmjs.com/package/oxfmt) (JS/TS, JSON, Markdown, YAML, HTML, CSS in one pass). Config lives in `.oxfmtrc.json`. Do not reintroduce Prettier, `.prettierignore`, or `.prettier-cache`.

## Commands

```bash
npm run format          # Run oxfmt --write . (printWidth 140 from .oxfmtrc.json)
npm run format:check    # Run oxfmt --check . (non-mutating; use in CI)
bash format.sh          # Full format pipeline: sources remote format functions from bashrc repo, runs cleanup/python/JS/custom steps
bash dev.sh             # File watcher: runs build.sh on changes, starts dev server
bash setup-repo-node.sh # Bootstrap a new Node repo with .gitattributes, .gitignore, .oxfmtrc.json, dependabot, oxfmt
```

## Architecture

### Reusable Workflows (`.github/workflows/`)

Every `*.yml` here is a reusable workflow triggered via `workflow_call`, each with a matching `*.yml.template` showing how consumers should reference it — with one exception: `cleanup-artifacts.yml` is this repo's own scheduled self-maintenance job, not a reusable workflow, so it has no template and cannot be called with `uses:`.

| Workflow                                     | Purpose                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `build-and-commit-sh.yml`                    | Full Node.js CI: install deps, `make build` or `build.sh`, format, commit artifacts, optionally test and deploy to GitHub Pages |
| `cleanup-pr-artifacts.yml`                   | Delete artifacts (and optionally workflow runs) when a PR is closed or merged                                                   |
| `cleanup-releases.yml`                       | Cleanup GitHub releases: delete old drafts and incomplete releases (missing assets) with dry-run support                        |
| `pr-format-and-commit-code.yml`              | Lightweight: runs `oxfmt --write` on HTML/MD files, then commits (pin via the `oxfmt-version` input)                            |
| `pr-js-yarn.yml`                             | Yarn-based: `yarn install`, format, test-ci, build, commit                                                                      |
| `pr-js-yarn-16.yml` / `pr-js-yarn-16-v2.yml` | Yarn variants for Node 16                                                                                                       |
| `pr-make-format.yml`                         | Format-only: runs `make format`, `npm run format`, or remote `format.sh`, then commits                                          |
| `cleanup-artifacts.yml`                      | **Not reusable.** Scheduled (`cron: 0 0 * * 0`) repo-local cleanup of artifacts, draft releases, and old workflow runs          |

### Release Composite Actions (`actions/release/`)

Composable actions for GitHub release workflows. Repos keep their own build steps; these actions handle the common release bookkeeping (tag resolution, cleanup, changelog, asset upload, finalize).

**High-level actions** (what repos call directly):

| Action                          | When         | Purpose                                                                 |
| ------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `actions/release/begin-release` | Before build | Checkout + resolve tag + cleanup old release + create draft placeholder |
| `actions/release/end-release`   | After build  | Checkout + generate changelog + upload assets + set final title/flags   |

**Low-level actions** (`actions/release/_common/`, called by the high-level actions):

| Action                | Purpose                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `_common/resolve-tag` | Resolve tag + SHA. Official: reads version from file → `v{version}`. Beta: generates `release-beta-{date}-{sha}`        |
| `_common/draft`       | Delete existing release/tag, create draft prerelease placeholder                                                        |
| `_common/notes`       | Generate changelog markdown from git log (prev tag to HEAD, max N commits, diff link, optional user notes + extra body) |
| `_common/finalize`    | Upload assets, update release body, set title and draft/prerelease/latest flags based on mode + build result            |

**Usage pattern** (same for both official and beta, across all repos):

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.pre.outputs.tag }}
      sha: ${{ steps.pre.outputs.sha }}
    steps:
      - uses: synle/workflows/actions/release/begin-release@main
        id: pre
        with:
          mode: official # or beta
          project_name: my-project
          version_file: package.json # or Cargo.toml

  build:
    needs: [prepare]
    # Repo-specific build steps (npm, cargo, tauri, etc.)

  release:
    needs: [prepare, build]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: synle/workflows/actions/release/end-release@main
        with:
          tag: ${{ needs.prepare.outputs.tag }}
          project_name: my-project
          mode: official # or beta
          build_result: ${{ needs.build.result }}
          files: |
            artifacts/my-asset.zip
```

**Finalize behavior matrix:**

| Mode     | Build Result | Title                   | Draft             | Prerelease | Latest |
| -------- | ------------ | ----------------------- | ----------------- | ---------- | ------ |
| official | success      | `project tag`           | false (published) | false      | true   |
| official | failure      | `project tag [Error]`   | true              | true       | false  |
| beta     | success      | `project tag [Success]` | true              | true       | false  |
| beta     | failure      | `project tag [Error]`   | true              | true       | false  |

**Repos using these actions:** url-porter, display-dj, display-dj-cli, sqlui-native.

### Common Patterns Across Workflows

- **Commit gating**: All workflows use a "Check for Meaningful Changes" step that filters diffs against `ignore-commit-pattern` (default: `^dist/sw.*\.js$`). Only commits if meaningful files changed.
- **Auto-commit**: Uses `EndBug/add-and-commit@v9` with `default_author: github_actions` by default. `build-and-commit-sh.yml` additionally supports `amend-triggering-commit: true`: successful validation precedes push-only amendment with an explicit triggering-SHA lease; PRs and manual dispatches never commit in this mode.
- **Checkout**: Normally uses `github.head_ref || github.ref_name`. The build workflow's amend mode checks out `github.sha` with full history and persists credentials only for push events.
- **Amend validation**: Setup, install, build, format, available npm lint, and detected tests must succeed. In amend mode, `test:coverage` takes precedence over ordinary `test`, after existing Makefile, `test.sh`, `test-ci`, and `test:ci` choices. Preserve the default mode's existing tolerant behavior and `early-exit-on-commit` contract.
- **Concurrency**: Templates include `cancel-in-progress: true` grouped by workflow + ref.

### Template Files (`*.yml.template`)

Show consumers how to reference each workflow. The pattern is:

```yaml
uses: synle/workflows/.github/workflows/<workflow>.yml@main
```

## GitHub Raw File URLs

When fetching raw file content from GitHub repos, always use the `?raw=1` blob URL format:

```
https://github.com/{owner}/{repo}/blob/main/{path}?raw=1
```

Use the default branch name (`main`) in the path — `head` is not a real ref and 404s.

Do NOT use:

- `https://api.github.com/repos/{owner}/{repo}/contents/{path}` (GitHub Contents API)
- `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`

### Helper Scripts

- **`format.sh`** — Parameterized formatter. Args: `$1` = format command (default `npm run format`), `$2` = timeout in seconds (default 20), remaining args = format steps. Sources the actual format functions from `synle/bashrc` repo's `.build/format.sh` via curl. Available steps: `format_cleanup`, `format_cleanup_light`, `format_other_text_based_files`, `format_python`, `format_js`.
- **`dev.sh`** — File watcher with configurable patterns. Args: `$1` = glob patterns, `$2` = start command, `$3` = max file size KB. Polls every 3 seconds using `find` + `stat`, runs `build.sh` on changes. Cross-platform stat detection (GNU vs BSD).
- **`setup-repo-node.sh`** — One-shot repo bootstrapper. Sets up `.gitattributes` (LF line endings), `.gitignore`, `.oxfmtrc.json` (ignore patterns + `printWidth: 140`), `dependabot.yml` (monthly npm updates), and adds `oxfmt` plus `format` / `format:check` scripts to `package.json`. Idempotent — safe to re-run, and it removes a leftover `prettier` dependency if one is present.

## Git / PR Merge Policy

- Always use **squash and merge** when merging PRs. Never use merge commits or rebase merges. This keeps the git history clean with one commit per PR.
- You may `git merge origin/main` or `git merge origin/master` locally to sync branches, but PR merges must always be squash merges.
