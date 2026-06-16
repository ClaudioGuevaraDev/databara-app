# Repository Guidelines

## Project Structure & Module Organization

Databara is a Tauri v2 desktop app with a React/TypeScript frontend and Rust backend.

- `src/`: React application code. Current UI entry points are `src/main.tsx` and `src/app/App.tsx`.
- `src/lib/`: shared frontend helpers such as `utils.ts`.
- `src/styles/`: global CSS and Tailwind layers.
- `src-tauri/`: Rust/Tauri application shell, config, icons, and Cargo project.
- `dist/`, `node_modules/`, and `src-tauri/target/` are generated and ignored.

Keep UI, domain logic, and data access separated. Frontend components should not call database drivers directly; future database work should go through Tauri commands and Rust services.

## Build, Test, and Development Commands

Use pnpm only.

Dependency versions in `package.json` must be exact. Do not use semver range
prefixes such as `^` or `~` when adding or updating frontend dependencies.

```bash
pnpm install
pnpm run dev
pnpm run tauri:dev
pnpm run build
pnpm run lint
pnpm run format:check
```

- `pnpm run dev`: starts the Vite frontend on port `1420`.
- `pnpm run tauri:dev`: starts the full desktop app.
- `pnpm run build`: runs TypeScript checks and builds the frontend.
- `pnpm run lint`: runs ESLint.
- `pnpm run format:check`: verifies Prettier formatting.

For Rust-only validation, run `cargo check` inside `src-tauri/`.

## Coding Style & Naming Conventions

Use TypeScript strict mode, React function components, and explicit types for shared data structures. Avoid `any` unless there is a narrow, documented reason.

Prettier controls formatting: 2 spaces, semicolons, double quotes, 100-character print width, and Tailwind class sorting. Use `pnpm run format` before large UI changes.

Naming patterns:

- React components: `PascalCase`
- one React component per `.tsx` file; if a file needs multiple components, extract each one to its own file
- hooks/utilities: `camelCase`
- files containing components: `PascalCase.tsx` when split out
- shared helpers: `camelCase.ts`

## Testing Guidelines

No test framework is configured yet. Until one is added, every change should pass:

```bash
pnpm run lint
pnpm run format:check
pnpm run build
cargo check
```

When tests are introduced, prefer frontend `*.test.tsx` files and Rust unit tests inside relevant modules.

## Commit & Pull Request Guidelines

This repository has no commit history yet. Use concise Conventional Commit-style messages, for example:

- `feat: add connection dialog layout`
- `fix: ignore tauri target in vite watcher`
- `chore: configure prettier`

Pull requests should include a short summary, screenshots for UI changes, validation commands run, and linked issues when applicable.

## Security & Configuration Tips

Do not commit credentials, local database URLs, generated build output, or logs. Database passwords should eventually use the operating system keychain, not frontend state or plain text files.
