<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="128" alt="databara logo" />

# Databara

**A modern, lightweight desktop database client for PostgreSQL.**

Built with [Tauri](https://tauri.app), [React](https://react.dev) and [Rust](https://www.rust-lang.org) — fast, native, and beautifully dark.

[![Download](https://img.shields.io/github/v/release/ClaudioGuevaraDev/databara-app?include_prereleases&label=download&color=0DC6D3)](https://github.com/ClaudioGuevaraDev/databara-app/releases)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0DC6D3)](https://github.com/ClaudioGuevaraDev/databara-app/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB)](https://tauri.app)

</div>

---

## ✨ Features

- 🐘 **Native PostgreSQL client** — connect over plain, Prefer or Require TLS.
- 🌲 **Schema explorer** — browse schemas, tables, views, columns and indexes, pulled straight from `pg_catalog`.
- 📝 **SQL editor with autocompletion** — powered by Monaco, with schema-aware completions.
- 🔢 **Paginated results** — run `SELECT`/`WITH` (and `RETURNING`) and page through rows; non-row statements report rows affected.
- 🗂️ **Per-tab, multi-connection workspace** — every query tab keeps its own results, across all your connected databases at once.
- 💾 **Saved connections** — drafts persist locally; **passwords are never stored** and are prompted on reconnect.
- 🎨 **Polished dark UI** — a deep navy theme with a cyan accent, designed to be easy on the eyes.
- 🖥️ **Cross-platform** — ships as native installers for Windows, macOS and Linux.

## ⬇️ Download

Grab the latest installer for your OS from the [**Releases page**](https://github.com/ClaudioGuevaraDev/databara-app/releases):

| OS          | File                                                   |
| ----------- | ------------------------------------------------------ |
| **Windows** | `Databara_x.y.z_x64-setup.exe` (or `.msi`)             |
| **macOS**   | `Databara_x.y.z_universal.dmg` (Intel + Apple Silicon) |
| **Linux**   | `Databara_x.y.z_amd64.AppImage`, `.deb` or `.rpm`      |

> [!NOTE]
> The installers are currently **unsigned**. On first launch:
>
> - **macOS** → right-click the app → **Open** (or run `xattr -dr com.apple.quarantine /Applications/Databara.app`).
> - **Windows** → SmartScreen → **More info → Run anyway**.

## 🛠️ Tech stack

| Layer    | Technology                                                  |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · Monaco Editor |
| Backend  | Rust · Tauri v2 · `tokio-postgres` · `native-tls`           |
| Tooling  | pnpm · ESLint · Prettier                                    |

## 🚀 Development

> Requires [Node.js](https://nodejs.org), [pnpm](https://pnpm.io) and the [Rust toolchain](https://rustup.rs) + your platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
# Install dependencies
pnpm install

# Run the full desktop app (frontend + Rust backend)
pnpm run tauri:dev

# Frontend only, in the browser (no DB access)
pnpm run dev
```

### Validation gate

```bash
pnpm run lint          # tsc --noEmit + eslint
pnpm run format:check  # prettier
pnpm run build         # tsc typecheck + vite build
cd src-tauri && cargo check
```

## 📦 Building installers

```bash
pnpm tauri build       # native installers for the current OS
```

Cross-platform installers are produced automatically by GitHub Actions when a `v*` tag is pushed — see [`RELEASING.md`](RELEASING.md) for the full release flow.

## 🏗️ Architecture

All frontend ↔ backend communication funnels through a single service (`src/app/databaraService.ts`) into a small set of Rust commands. App state lives in one workspace context provider. For the full picture, see [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).

## 🤝 Contributing

Use **pnpm only** and keep dependency versions **exact** (no `^`/`~`). Commits follow [Conventional Commits](https://www.conventionalcommits.org). Run the validation gate above before opening a PR.

## 📄 License

Released under the [MIT License](LICENSE) © 2026 Claudio Guevara.
