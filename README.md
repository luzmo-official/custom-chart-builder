# Luzmo Custom Chart Builder

A local development environment for building, previewing, and packaging Luzmo Custom Charts.

> [!NOTE]
> The full guide for writing a custom chart (manifest schema, `render` / `resize` / `buildQuery`, data formatting, theming, dashboard interactions, etc.) lives in the Luzmo developer docs:
>
> - Human-readable: <https://developer.luzmo.com/guide/guides--custom-charts>
> - Markdown version (recommended for AI coding agents): <https://developer.luzmo.com/guide/guides--custom-charts.md>
>
> This README only covers how to use **this repo**. For anything about the chart API itself, follow the links above.

## Quick start

### Prerequisites

- Node.js v22.13 or newer.
- npm

### Installation

```bash
git clone https://github.com/luzmo-official/custom-chart-builder.git
cd custom-chart-builder
npm install
```

### Development

```bash
npm run start
```

Open <http://localhost:4200> and log in with your Luzmo account to start testing your custom chart against your own datasets.

Logs from the dev server are prefixed: `[ANGULAR]` (builder UI), `[BUNDLE]` (bundle server), `[WATCHER]` (chart watcher).

## Building and packaging

```bash
npm run build       # builds, validates manifest.json, produces bundle.zip for upload
npm run validate    # only validates manifest.json
```

## Uploading from the command line

List and upload charts without starting the builder UI. Copy
[`.env.example`](.env.example) to `.env.local` in the repository root (gitignored)
and set `LUZMO_API_KEY` and `LUZMO_API_TOKEN` with access to manage custom charts.
`LUZMO_API_URL` defaults to Europe; use `https://api.us.luzmo.com` for the US.
Environment variables override the file. Browser login is not used.

```bash
npm run charts -- list
npm run charts -- upload --type my-chart --name "My chart"
npm run charts -- upload --id <chart-id>
npm run charts -- --help
```

Uploads build, validate, and package the chart first; build failures stop the
upload. New charts require a unique type and name. Use `--id` to replace an
existing chart's code, keeping its name and type.

> **Agent approval required:** Re-uploading with `--id` is a destructive overwrite.
> Never run it without the user's explicit approval for that overwrite and target
> chart ID. General permission to build or upload is not sufficient; ask first if
> approval is missing. The same rule applies to equivalent API or UI actions.

For agents, use `--silent` and `--json` for machine-readable output:

```bash
npm run --silent charts -- list --json
```

Both flags also work with `upload`. List returns `{ "charts": [...] }`; upload
returns `action`, `id`, and available chart metadata. Save the ID for later updates.
JSON results go to stdout; logs and errors go to stderr, with final errors as
`{ "error": "..." }`. Exit codes: **0** success, **1** build/API failure,
**2** invalid arguments/configuration.

Commands never prompt or retry automatically. After a timeout or connection
failure, check `list` before retrying: the upload may have succeeded.

## Resources

- [Custom chart developer guide](https://developer.luzmo.com/guide/guides--custom-charts) ([markdown for AI agents](https://developer.luzmo.com/guide/guides--custom-charts.md))
- [General Luzmo AGENTS.md](https://developer.luzmo.com/AGENTS.md)
- [Public repository with example Luzmo Custom Charts](https://github.com/luzmo-official/custom-chart-examples)
- [Custom Charts academy article](https://academy.luzmo.com/article/xtau1755)
