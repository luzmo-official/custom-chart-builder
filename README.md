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

## Resources

- [Custom chart developer guide](https://developer.luzmo.com/guide/guides--custom-charts) ([markdown for AI agents](https://developer.luzmo.com/guide/guides--custom-charts.md))
- [General Luzmo AGENTS.md](https://developer.luzmo.com/AGENTS.md)
- [Public repository with example Luzmo Custom Charts](https://github.com/luzmo-official/custom-chart-examples)
- [Custom Charts academy article](https://academy.luzmo.com/article/xtau1755)
