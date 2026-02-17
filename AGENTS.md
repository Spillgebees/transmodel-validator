# AGENTS.md

Agent guidelines for the `transmodel-validator` monorepo (pnpm workspaces, TypeScript, ESM).

## Build / Test / Lint Commands

```bash
# Install dependencies
pnpm install

# Build all packages (core must build before cli/web can use it)
pnpm build

# Build a single package
pnpm --filter @transmodel-validator/core build
pnpm --filter @transmodel-validator/cli build
pnpm --filter @transmodel-validator/web build

# Run all tests
pnpm test

# Run tests for a single package
pnpm --filter @transmodel-validator/core test
pnpm --filter @transmodel-validator/cli test

# Run a single test file
pnpm --filter @transmodel-validator/core exec vitest run src/rules/netex/rules.test.ts

# Run a single test by name
pnpm --filter @transmodel-validator/core exec vitest run -t "everyLineIsReferenced"

# Watch mode (single package)
pnpm --filter @transmodel-validator/core exec vitest

# Lint and format (Biome)
pnpm check              # Check lint + formatting (no writes)
pnpm lint               # Lint only
pnpm format             # Format and write

# Web dev server
pnpm --filter @transmodel-validator/web dev
```

**Important**: After changing core source, you must rebuild core (`pnpm --filter @transmodel-validator/core build`) before the web or CLI packages will see the changes. The web dev server caches the old core dist and must be restarted.

## Project Structure

```
packages/core/   # @transmodel-validator/core — validation engine, rules, XSD, schema download
packages/cli/    # @transmodel-validator/cli  — CLI wrapper (no framework, uses node:util parseArgs)
packages/web/    # @transmodel-validator/web  — TanStack Start (React) web UI, Tailwind CSS v4
```

- **Node >= 22**, **pnpm 10.28.2**, all packages are **ESM** (`"type": "module"`)
- Test framework: **Vitest 3.2.x**. Lint/format: **Biome 2.4.x** (`biome.json` at root).
- CI runs on ubuntu-latest: `pnpm install --frozen-lockfile && pnpm build && pnpm test`

## Code Style

### Formatting

- 2-space indentation, semicolons always, double quotes, trailing commas in multi-line constructs.

### Imports

- **core/cli**: Use `.js` extensions in all relative imports (`import { foo } from "./bar.js"`). Required by Node16 module resolution.
- **web**: No `.js` extensions (uses Bundler resolution). Use the `~/` path alias for src-relative imports (`import { X } from "~/components/X"`).
- Use `import type { ... }` for type-only imports — enforced by `verbatimModuleSyntax` in core/cli tsconfig.
- Use `export type { ... }` for type-only re-exports in barrel files.
- Prefer named exports everywhere. Default exports are not used.

### Naming Conventions

| What | Convention | Examples |
|---|---|---|
| Files (core/cli) | camelCase | `detect.ts`, `helpers.ts`, `everyLineIsReferenced.ts` |
| Files (web components) | PascalCase | `ConfigCard.tsx`, `FileDropZone.tsx` |
| Files (web routes) | TanStack Router convention | `__root.tsx`, `results.$sessionId.tsx` |
| Functions | camelCase | `validateXsd`, `detectFormat`, `haversineMeters` |
| React components | PascalCase | `ConfigCard`, `XmlViewer` |
| Types / Interfaces | PascalCase | `ValidationError`, `Rule`, `SchemaEntry` |
| Module-level constants | SCREAMING_SNAKE_CASE | `RULE_REGISTRY`, `SCHEMA_REGISTRY`, `CACHE_TTL_MS` |
| Local constants | camelCase | `const xsdContent = ...` |

### Types

- Use `interface` for object shapes and contracts (`Rule`, `ValidationError`, `Profile`).
- Use `type` for unions, string-literal unions, and simple aliases (`ErrorSeverity`, `TransmodelFormat`, `ProgressPhase`).
- `strict: true` in all tsconfigs. Never use `any` — prefer `unknown` and narrow.

### Error Handling

- **Validation errors**: Always create via factory functions from `errors.ts` (`consistencyError()`, `qualityError()`, `notFoundError()`, `generalError()`, `xsdError()`, `skippedInfo()`). Never construct `ValidationError` objects directly.
- **Skipped rules**: Return `skippedInfo(ruleName, message)` when prerequisites are missing (e.g., no XSD content available).
- **Caught exceptions**: Use `err instanceof Error ? err.message : String(err)` to extract messages.
- **Rules accumulate errors** — they return `ValidationError[]`, never throw.
- **WASM cleanup**: `libxml2-wasm` objects (`XmlDocument`, `XsdValidator`) require manual `.dispose()` calls. Always use try/finally.

### Comments and Documentation

- File-level JSDoc block at the top of every file describing its purpose.
- `NOTE:` prefix for important implementation notes.
- JSDoc with `@param`/`@returns`/`@throws` on public API functions. Internal helpers may omit JSDoc.

## Architecture Patterns

### Rule Pattern

Each business rule is one file in `packages/core/src/rules/netex/`, exporting a `const` that implements the `Rule` interface:

```ts
export const myRule: Rule = {
  name: "myRule",
  description: "What this rule checks.",
  formats: ["netex"],
  async run(documents: DocumentInput[], config?: RuleConfig): Promise<ValidationError[]> {
    // ...
  },
};
```

Register new rules in `packages/core/src/rules/registry.ts`. The rule's `name` must match its filename.

### Cross-Document Rules

Rules in `CROSS_DOC_RULES` (e.g., `netexKeyRefConstraints`, `netexUniqueConstraints`) receive all documents at once and run once per validation session. They require `config.xsdContent` — return `skippedInfo()` when it's absent.

### Registries

Rules, profiles, and schemas use `ReadonlyMap` registries with typed getter functions that throw on unknown keys.

### Client/Server Split (Web)

`@transmodel-validator/core` uses Node.js APIs and must never be imported directly in client-side web code. Core is only imported via:
- Dynamic `import()` inside TanStack Start server functions (`createServerFn`)
- The SSE API route handler (`routes/api/validate.tsx`)

Client-safe constants (profile names, rule names) are duplicated in `packages/web/src/lib/constants.ts`.

### Schema Management

XSD schemas are GPL-licensed and cannot be bundled. They are downloaded at runtime from GitHub and cached at `~/.cache/transmodel-validator/schemas/`. The `XsdValidator` instances are cached in memory with a 60-second TTL.

## Testing Conventions

- Test files: `*.test.ts`, co-located with source in core, in `test/` directory in cli.
- Use `describe()` to group by feature/rule name, `it()` for individual cases (not `test()`).
- Descriptive test names: `"passes when all Lines have LineRefs"`, `"fails when a Line has no LineRef"`.
- Test both positive (pass) and negative (fail) cases for every rule.
- Use helper functions like `doc(xml)` to wrap XML strings into `DocumentInput[]`.
- Rules tests use `"netex-rules-only"` profile to avoid downloading XSD schemas.
- CLI tests spawn the CLI as a child process and assert on stdout, stderr, and exit code.
- Excluded from TypeScript build output via tsconfig `exclude`.

## Web UI Notes

- TanStack Start v1.159.x with TanStack Router (file-based routing).
- Tailwind CSS v4 with `@tailwindcss/vite` plugin. Dark mode only.
- Fonts: Inter Variable (UI) and JetBrains Mono Variable (code), self-hosted in `public/fonts/`.
- All icons are inline SVGs — no icon library.
- Validation uses SSE: client POSTs to `/api/validate`, server streams progress events + final results.
- Session data stored in localStorage (version-migrated, `CURRENT_VERSION = 7`).
- Rule messages contain inline markdown (`` `code` ``, `**bold**`, `*italic*`) rendered by `InlineMarkdown` component.
- Footer format: `made by igotinfected with` :strawberry: `· MIT · [GitHub icon]`
