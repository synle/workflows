# gha-workflows

Reusable GitHub Actions workflows for CI/CD. Call them from any repo via `workflow_call`.

## Workflows

| Workflow                                                                                                                      | Purpose                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`build-and-commit-sh.yml`](.github/workflows/build-and-commit-sh.yml)                                                        | Node.js CI: install deps, build, format, commit artifacts, test, and optionally deploy to GitHub Pages. See [step detection priority](#build-and-commit-step-detection) below. |
| [`cleanup-pr-artifacts.yml`](.github/workflows/cleanup-pr-artifacts.yml)                                                      | Delete artifacts (and optionally workflow runs) when a PR is closed or merged                                                                                                  |
| [`cleanup-releases.yml`](.github/workflows/cleanup-releases.yml)                                                              | Cleanup GitHub releases: delete old drafts and incomplete releases (missing assets) with dry-run support                                                                       |
| [`pr-make-format.yml`](.github/workflows/pr-make-format.yml)                                                                  | Run `make format`, `npm run format`, or remote `format.sh`, then commit                                                                                                        |
| [`pr-format-and-commit-code.yml`](.github/workflows/pr-format-and-commit-code.yml)                                            | Lightweight: run `oxfmt --write` on HTML/MD files, then commit                                                                                                                 |
| [`pr-js-yarn.yml`](.github/workflows/pr-js-yarn.yml)                                                                          | Yarn-based: install, format, test, build, commit                                                                                                                               |
| [`pr-js-yarn-16.yml`](.github/workflows/pr-js-yarn-16.yml) / [`pr-js-yarn-16-v2.yml`](.github/workflows/pr-js-yarn-16-v2.yml) | Yarn variants pinned to Node 16                                                                                                                                                |

## Usage

Reference a workflow from your repo:

```yaml
name: build-main

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    uses: synle/workflows/.github/workflows/build-and-commit-sh.yml@main
    permissions:
      contents: write
      pages: write
      id-token: write
    with:
      node-version: "24.x"
```

See the `*.yml.template` files for more examples.

## Common Inputs

Most workflows accept:

| Input                   | Default              | Description                                   |
| ----------------------- | -------------------- | --------------------------------------------- |
| `node-version`          | `"24.x"`             | Node.js version                               |
| `os`                    | `"ubuntu-latest"`    | Runner OS                                     |
| `ignore-commit-pattern` | `"^dist/sw.*\\.js$"` | Regex for files to exclude from commit checks |

`build-and-commit-sh.yml` also supports:

| Input                  | Default | Description                                                    |
| ---------------------- | ------- | -------------------------------------------------------------- |
| `early-exit-on-commit` | `false` | Exit with failure after committing so the workflow re-triggers |
| `deploy-to-pages`      | `false` | Deploy to GitHub Pages after build (push to main/master only)  |

`pr-format-and-commit-code.yml` also supports:

| Input           | Default    | Description                                                              |
| --------------- | ---------- | ------------------------------------------------------------------------ |
| `oxfmt-version` | `"0.61.0"` | oxfmt version run via `npx`, pinned so upgrades don't cause silent churn |

> `cleanup-artifacts.yml` is **not** a reusable workflow — it is this repo's own scheduled
> (`cron: 0 0 * * 0`) self-maintenance job. Copy the file into a consumer repo rather than
> calling it with `uses:`.

## Cleanup Workflows

### cleanup-pr-artifacts

Deletes artifacts (and optionally workflow runs) when a PR is closed or merged. GitHub does **not** auto-delete artifacts on PR close — they persist until their retention period expires.

```yaml
name: cleanup-pr-artifacts

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    uses: synle/workflows/.github/workflows/cleanup-pr-artifacts.yml@main
    permissions:
      actions: write
    with:
      delete-runs: false
```

| Input         | Default | Description                                                   |
| ------------- | ------- | ------------------------------------------------------------- |
| `delete-runs` | `false` | Also delete the workflow runs themselves (not just artifacts) |

### cleanup-releases

Deletes old draft releases and incomplete releases (missing expected assets). Supports dry-run to preview before deleting.

```yaml
name: cleanup-releases

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Preview deletions without actually deleting"
        type: boolean
        default: true

jobs:
  cleanup:
    uses: synle/workflows/.github/workflows/cleanup-releases.yml@main
    permissions:
      contents: write
    with:
      cleanup-drafts: true
      draft-keep-count: 0
      cleanup-incomplete: true
      expected-assets: 4
      lookback-months: 3
      dry-run: ${{ inputs.dry_run || true }}
```

| Input                | Default | Description                                           |
| -------------------- | ------- | ----------------------------------------------------- |
| `cleanup-drafts`     | `true`  | Delete old draft releases                             |
| `draft-keep-count`   | `0`     | Number of most recent draft releases to keep          |
| `cleanup-incomplete` | `true`  | Delete incomplete releases (missing assets)           |
| `expected-assets`    | `4`     | Expected number of assets per release                 |
| `lookback-months`    | `3`     | How many months back to check for incomplete releases |
| `dry-run`            | `true`  | Preview deletions without actually deleting           |

## Build and Commit Step Detection

`build-and-commit-sh.yml` auto-detects which commands to run for each step using a priority order. It tries each option top-to-bottom and uses the first match:

| Step       | Priority                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Build**  | `Makefile` → `build.sh` → `npm run build` (if script exists in package.json) → skip            |
| **Format** | `Makefile` → `npm run format` (if script exists in package.json) → remote `format.sh` fallback |
| **Test**   | `Makefile` → `test.sh` → `npm run test-ci` → `npm run test:ci` → `npm run test` → skip         |

A **Job Summary** table is produced at the end of each run showing pass/fail/skip status for every step.

## Helper Scripts

- **`format.sh`** - Parameterized code formatter. Sources format functions from [`synle/bashrc`](https://github.com/synle/bashrc) and runs configurable steps (`format_cleanup`, `format_python`, `format_js`, etc.).
- **`dev.sh`** - File watcher that polls for changes every 3 seconds and runs `build.sh` on change. Cross-platform (GNU/BSD).
- **`setup-repo-node.sh`** - Bootstrap a Node repo with `.gitattributes`, `.gitignore`, `.oxfmtrc.json`, `dependabot.yml`, and oxfmt.

```bash
# Format this repo
npm run format
npm run format:check

# Run format.sh remotely
curl -fsSL "https://github.com/synle/workflows/blob/head/format.sh?raw=1" | bash

# Bootstrap a new Node repo
curl -fsSL "https://github.com/synle/workflows/blob/head/setup-repo-node.sh?raw=1" | bash
```

## Formatting

This repo (and every repo bootstrapped by `setup-repo-node.sh`) uses [oxfmt](https://www.npmjs.com/package/oxfmt) — it replaced Prettier and covers JS/TS, JSON, Markdown, YAML, HTML, and CSS in one pass. Config lives in `.oxfmtrc.json` (`printWidth: 140`); ignores come from `.gitignore` plus the config's `ignorePatterns`.
