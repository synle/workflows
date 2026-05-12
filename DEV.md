# synle/workflows

Reusable GitHub Actions workflows for Node.js CI, formatting, artifact/release cleanup, and build-and-commit pipelines. Consumed via `workflow_call` from other repos in the `synle` org.

## Quick Start

Reference a reusable workflow from a consumer repo's `.github/workflows/*.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    uses: synle/workflows/.github/workflows/pr-js-yarn.yml@main
    secrets: inherit
```

Available reusable workflows (all under `synle/workflows/.github/workflows/`):

- `build-and-commit-sh.yml` — Full Node.js CI: install, build, format, commit artifacts, test, optional GH Pages deploy.
- `pr-js-yarn.yml` / `pr-js-yarn-16.yml` / `pr-js-yarn-16-v2.yml` — PR validation for yarn-based JS projects.
- `pr-format-and-commit-code.yml` — Auto-format PR code and commit back.
- `pr-make-format.yml` — Run `make format` on PRs.
- `cleanup-pr-artifacts.yml` — Delete artifacts when a PR closes.
- `cleanup-releases.yml` — Prune old GitHub releases.

Pin to a SHA or tag instead of `@main` for reproducible builds.
