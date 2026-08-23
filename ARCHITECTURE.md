# workflows — Architecture

`synle/workflows` centralizes CI/CD building blocks for downstream repos: reusable workflows (`workflow_call`) referenced as `uses: synle/workflows/.github/workflows/<file>@<ref>`, and composite actions referenced as `uses: synle/workflows/actions/<name>@<ref>`.

## Layout

- `.github/workflows/` — Reusable workflows, each with a matching `*.yml.template` caller-side snippet. Exception: `cleanup-artifacts.yml` is this repo's scheduled self-maintenance job (no template).
  - `build-and-commit-sh.yml` — Full Node.js CI with priority-based step detection and a Job Summary status table.
  - `pr-js-yarn.yml` + `-16` / `-16-v2` variants — JS/Yarn PR pipelines.
  - `pr-format-and-commit-code.yml`, `pr-make-format.yml` — Format-and-commit flows.
  - `cleanup-pr-artifacts.yml`, `cleanup-releases.yml` — Artifact / release cleanup with dry-run support.
- `actions/release/` — Two-phase release flow:
  - `begin-release/` — Checkout, resolve tag, clean prior release, create draft placeholder.
  - `end-release/` — Generate notes, upload assets, set final release flags.
  - `_common/{draft,finalize,notes,resolve-tag}/` — Sub-actions composed by begin/end.
- Root scripts — `dev.sh`, `format.sh`, `setup-repo-node.sh`.

## Notes

- No build output; consumers pin to a tag or branch via `@<ref>`; releases publish from `main`.
- Formatting is [oxfmt](https://www.npmjs.com/package/oxfmt) (`printWidth: 140`, `.oxfmtrc.json`); `setup-repo-node.sh` provisions the same setup in downstream repos.
