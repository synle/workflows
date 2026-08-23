# synle/workflows

Reusable GitHub Actions workflows for Node.js CI, formatting, artifact/release cleanup, and build-and-commit pipelines. Consumed via `workflow_call` from other repos in the `synle` org.

## Quick Start

```yaml
jobs:
  ci:
    uses: synle/workflows/.github/workflows/pr-js-yarn.yml@main
    secrets: inherit
```

See [README](README.md) for the full workflow and input list. Pin to a SHA or tag instead of `@main` for reproducible builds.

`cleanup-artifacts.yml` is not a `workflow_call` entrypoint — copy it into a consumer repo instead of referencing it with `uses:`.

## Local Development

No build output; the only local loop is formatting:

```bash
npm install           # installs oxfmt (the sole devDependency)
npm run format        # oxfmt --write .
npm run format:check  # non-mutating CI gate
```

Changes to a `*.yml` reusable workflow must be mirrored in its `*.yml.template` sibling.
