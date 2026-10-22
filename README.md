# workflows

Reusable GitHub Actions workflows and release actions. Call from any repo via `workflow_call`.

## Workflows

| Workflow                                                                                                                      | Purpose                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`build-and-commit-sh.yml`](.github/workflows/build-and-commit-sh.yml)                                                        | Node.js CI: install, build, format, commit artifacts, test, optional Pages deploy |
| [`pr-js-yarn.yml`](.github/workflows/pr-js-yarn.yml)                                                                          | Yarn PR pipeline: install, format, test, build, commit                            |
| [`pr-js-yarn-16.yml`](.github/workflows/pr-js-yarn-16.yml) / [`pr-js-yarn-16-v2.yml`](.github/workflows/pr-js-yarn-16-v2.yml) | Node 16 variants of `pr-js-yarn`                                                  |
| [`pr-format-and-commit-code.yml`](.github/workflows/pr-format-and-commit-code.yml)                                            | Run `oxfmt --write` on HTML/MD, then commit                                       |
| [`pr-make-format.yml`](.github/workflows/pr-make-format.yml)                                                                  | Run `make format`, `npm run format`, or remote `format.sh`, then commit           |
| [`cleanup-pr-artifacts.yml`](.github/workflows/cleanup-pr-artifacts.yml)                                                      | Delete artifacts (and optionally workflow runs) when a PR closes                  |
| [`cleanup-releases.yml`](.github/workflows/cleanup-releases.yml)                                                              | Delete old drafts and incomplete releases; dry-run support                        |

> `cleanup-artifacts.yml` is not reusable — this repo's scheduled self-maintenance job. Copy it instead of calling with `uses:`.

## Usage

```yaml
jobs:
  build:
    uses: synle/workflows/.github/workflows/build-and-commit-sh.yml@main
    permissions:
      contents: write
      pages: write
      id-token: write
```

See the `*.yml.template` files for per-workflow snippets.

## Inputs

Most workflows:

| Input                   | Default              | Description                                   |
| ----------------------- | -------------------- | --------------------------------------------- |
| `node-version`          | `"24.x"`             | Node.js version                               |
| `os`                    | `"ubuntu-latest"`    | Runner OS                                     |
| `ignore-commit-pattern` | `"^dist/sw.*\\.js$"` | Regex for files to exclude from commit checks |

Extras:

| Workflow                        | Inputs                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-and-commit-sh.yml`       | `amend-triggering-commit` (`false`), `early-exit-on-commit` (`false`), `deploy-to-pages` (`false`)                                                       |
| `pr-format-and-commit-code.yml` | `oxfmt-version` (`"0.61.0"`)                                                                                                                             |
| `cleanup-pr-artifacts.yml`      | `delete-runs` (`false`)                                                                                                                                  |
| `cleanup-releases.yml`          | `cleanup-drafts` (`true`), `draft-keep-count` (`0`), `cleanup-incomplete` (`true`), `expected-assets` (`4`), `lookback-months` (`3`), `dry-run` (`true`) |

### Opt-in source-commit amendment

Set `amend-triggering-commit: true` in the calling job's `with:` block to fold build/format changes into the triggering commit. The default remains a separate bot commit; existing callers do not opt in automatically. This option adds no Python or other caller-side tooling requirement.

Amend mode checks out the triggering SHA with full history and requires successful setup, dependency installation, build, formatting, available npm lint, and detected tests before amendment. Repositories without a lint or test entrypoint skip that check.

Only branch `push` events may amend. PRs, manual dispatches, and tag pushes never amend; PR/dispatch checkout does not retain credentials. The meaningful-change filter suppresses ignored-only churn, and no changes means no rewrite. Amendment preserves the source author, message, and parent history; an explicit triggering-SHA `--force-with-lease` rejects stale runs even after fetching newer remote history.

Branch rules must permit the leased force-push. A rejected push fails the job; there is no fallback to an extra commit or an unleased force-push. `early-exit-on-commit` applies only to the default separate-commit mode. Pages remains controlled by `deploy-to-pages`, with the existing push-only upload/deployment behavior.

## Build Step Detection

`build-and-commit-sh.yml` picks the first match per step:

| Step       | Priority                                                                               |
| ---------- | -------------------------------------------------------------------------------------- |
| **Build**  | `Makefile` → `build.sh` → `npm run build` → skip                                       |
| **Format** | `Makefile` → `npm run format` → remote `format.sh` fallback                            |
| **Test**   | `Makefile` → `test.sh` → `npm run test-ci` → `npm run test:ci` → `npm run test` → skip |

In amend mode, available npm `lint` also runs, and `test:coverage` takes priority over ordinary `test`, after Makefile, `test.sh`, `test-ci`, and `test:ci`. Unlike the default mode, setup/install/format/test failures are fatal before amendment.

A Job Summary table reports pass/fail/skip per step.

## Helper Scripts

- **`format.sh`** — Parameterized formatter; sources format functions from [`synle/bashrc`](https://github.com/synle/bashrc).
- **`dev.sh`** — File watcher; polls every 3s and runs `build.sh` on change.
- **`setup-repo-node.sh`** — Bootstrap a Node repo: `.gitattributes`, `.gitignore`, `.oxfmtrc.json`, `dependabot.yml`, oxfmt.

```bash
curl -fsSL "https://github.com/synle/workflows/blob/main/format.sh?raw=1" | bash
curl -fsSL "https://github.com/synle/workflows/blob/main/setup-repo-node.sh?raw=1" | bash
```

## Formatting

[oxfmt](https://www.npmjs.com/package/oxfmt) everywhere: JS/TS, JSON, Markdown, YAML, HTML, CSS in one pass. Config in `.oxfmtrc.json` (`printWidth: 140`). Local loop:

```bash
npm install && npm run format   # format:check is the non-mutating CI gate
```
