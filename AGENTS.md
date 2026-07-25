# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reusable GitHub Actions workflows and composite actions repository (`synle/workflows`). Provides shared CI/CD workflow templates (`workflow_call`) and composable release actions for other repositories. Also includes helper shell scripts for formatting and dev file-watching.

## Important Rules

- **Always use `curl -fsSL` for curl commands.** Standard curl flag convention across all scripts.
- **Bash functions must use the `function` keyword**: Write `function foo() {` not `foo() {`.
- **Always run `bash format.sh` after making changes.**
- **URLs must use `synle/workflows/`** (plural). The repo was renamed from `gha-workflow` to `gha-workflows`. Never use the old `synle/gha-workflow/` URL.

## Commands

```bash
npm run format          # Run Prettier (--write --print-width 140)
bash format.sh          # Full format pipeline: sources remote format functions from bashrc repo, runs cleanup/python/JS/custom steps
bash dev.sh             # File watcher: runs build.sh on changes, starts dev server
bash setup-repo-node.sh # Bootstrap a new Node repo with .gitattributes, .gitignore, .prettierignore, dependabot, prettier
```

## Architecture

### Reusable Workflows (`.github/workflows/`)

All `*.yml` files are reusable workflows triggered via `workflow_call`. Each has a matching `*.yml.template` showing how consumers should reference it.

| Workflow                                     | Purpose                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `build-and-commit-sh.yml`                    | Full Node.js CI: install deps, `make build` or `build.sh`, format, commit artifacts, optionally test and deploy to GitHub Pages |
| `cleanup-pr-artifacts.yml`                   | Delete artifacts (and optionally workflow runs) when a PR is closed or merged                                                   |
| `cleanup-releases.yml`                       | Cleanup GitHub releases: delete old drafts and incomplete releases (missing assets) with dry-run support                        |
| `pr-format-and-commit-code.yml`              | Lightweight: runs `npx --yes prettier --write` on HTML/MD files, then commits                                                   |
| `pr-js-yarn.yml`                             | Yarn-based: `yarn install`, format, test-ci, build, commit                                                                      |
| `pr-js-yarn-16.yml` / `pr-js-yarn-16-v2.yml` | Yarn variants for Node 16                                                                                                       |
| `pr-make-format.yml`                         | Format-only: runs `make format`, `npm run format`, or remote `format.sh`, then commits                                          |

### Release Composite Actions (`actions/release/`)

Composable actions for GitHub release workflows. Repos keep their own build steps; these actions handle the common release bookkeeping (tag resolution, cleanup, changelog, asset upload, finalize).

**High-level actions** (what repos call directly):

| Action | When | Purpose |
|--------|------|---------|
| `actions/release/begin-release` | Before build | Checkout + resolve tag + cleanup old release + create draft placeholder |
| `actions/release/end-release` | After build | Checkout + generate changelog + upload assets + set final title/flags |

**Low-level actions** (`actions/release/_common/`, called by the high-level actions):

| Action | Purpose |
|--------|---------|
| `_common/resolve-tag` | Resolve tag + SHA. Official: reads version from file → `v{version}`. Beta: generates `release-beta-{date}-{sha}` |
| `_common/draft` | Delete existing release/tag, create draft prerelease placeholder |
| `_common/notes` | Generate changelog markdown from git log (prev tag to HEAD, max N commits, diff link, optional user notes + extra body) |
| `_common/finalize` | Upload assets, update release body, set title and draft/prerelease/latest flags based on mode + build result |

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
          mode: official  # or beta
          project_name: my-project
          version_file: package.json  # or Cargo.toml

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
          mode: official  # or beta
          build_result: ${{ needs.build.result }}
          files: |
            artifacts/my-asset.zip
```

**Finalize behavior matrix:**

| Mode | Build Result | Title | Draft | Prerelease | Latest |
|------|-------------|-------|-------|------------|--------|
| official | success | `project tag` | false (published) | false | true |
| official | failure | `project tag [Error]` | true | true | false |
| beta | success | `project tag [Success]` | true | true | false |
| beta | failure | `project tag [Error]` | true | true | false |

**Repos using these actions:** url-porter, display-dj, display-dj-cli, sqlui-native.

### Common Patterns Across Workflows

- **Commit gating**: All workflows use a "Check for Meaningful Changes" step that filters diffs against `ignore-commit-pattern` (default: `^dist/sw.*\.js$`). Only commits if meaningful files changed.
- **Auto-commit**: Uses `EndBug/add-and-commit@v9` with `default_author: github_actions`.
- **Checkout**: Always checks out `github.head_ref || github.ref_name` to work on the correct branch for both PRs and pushes.
- **Concurrency**: Templates include `cancel-in-progress: true` grouped by workflow + ref.

### Template Files (`*.yml.template`)

Show consumers how to reference each workflow. The pattern is:

```yaml
uses: synle/workflows/.github/workflows/<workflow>.yml@main
```

## GitHub Raw File URLs

When fetching raw file content from GitHub repos, always use the `?raw=1` blob URL format:

```
https://github.com/{owner}/{repo}/blob/head/{path}?raw=1
```

Do NOT use:

- `https://api.github.com/repos/{owner}/{repo}/contents/{path}` (GitHub Contents API)
- `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`

### Helper Scripts

- **`format.sh`** — Parameterized formatter. Args: `$1` = format command (default `npm run format`), `$2` = timeout in seconds (default 20), remaining args = format steps. Sources the actual format functions from `synle/bashrc` repo's `.build/format.sh` via curl. Available steps: `format_cleanup`, `format_cleanup_light`, `format_other_text_based_files`, `format_python`, `format_js`.
- **`dev.sh`** — File watcher with configurable patterns. Args: `$1` = glob patterns, `$2` = start command, `$3` = max file size KB. Polls every 3 seconds using `find` + `stat`, runs `build.sh` on changes. Cross-platform stat detection (GNU vs BSD).
- **`setup-repo-node.sh`** — One-shot repo bootstrapper. Sets up `.gitattributes` (LF line endings), `.gitignore`, `.prettierignore`, `dependabot.yml` (monthly npm updates), and adds `prettier` + format script to `package.json`.


## Git / PR Merge Policy

- Always use **squash and merge** when merging PRs. Never use merge commits or rebase merges. This keeps the git history clean with one commit per PR.
- You may `git merge origin/main` or `git merge origin/master` locally to sync branches, but PR merges must always be squash merges.
