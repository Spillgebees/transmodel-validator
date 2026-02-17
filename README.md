# transmodel-validator

<p align="center">
    <img alt="build &amp; test" src="https://img.shields.io/github/actions/workflow/status/spillgebees/transmodel-validator/ci.yml?branch=main&label=build%20%26%20test&style=for-the-badge" />
    <img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" />
</p>

A TypeScript tool for validating [NeTEx](https://netex-cen.eu/) and [SIRI](https://www.siri-cen.eu/) XML documents against XSD schemas and business rules. Provides a CLI, a web UI, and a programmatic API.

Built as a full rewrite of [DATA4PT Greenlight](https://github.com/EliotTerrier/DATA4PTTools).

## Features

- **NeTEx validation** — XSD schema validation (v1.2, v1.2.2, v1.2.3, v1.3.0, v1.3.1, EPIP v1.1.2) plus 12 business rules
- **SIRI validation** — XSD schema validation (v2.1, v2.2). No business rules yet — [suggest one](https://github.com/Spillgebees/transmodel-validator/issues)
- **Format auto-detection** — detects NeTEx vs SIRI from the root element XML namespace
- **Archive support** — validates `.zip`, `.gz`, `.tar`, `.tar.gz`, `.tar.bz2` archives containing XML files
- **Three interfaces** — CLI, web UI with drag & drop, and a programmatic `validate()` / `validateDocuments()` API
- **Runtime schema downloading** — XSD schemas cannot be bundled; they are fetched from GitHub on first use and cached locally

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10

### Install and build

```sh
git clone https://github.com/Spillgebees/transmodel-validator.git
cd transmodel-validator
pnpm install
pnpm build
```

### Run the web UI

```sh
pnpm --filter @transmodel-validator/web dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the CLI

```sh
node packages/cli/dist/index.js path/to/file.xml
```

Or with options:

```sh
node packages/cli/dist/index.js \
  --format netex \
  --profile netex-fast-v1.2 \
  --output pretty \
  path/to/*.xml
```

## CLI usage

```
transmodel-validator [options] <files...>

Options:
  --format <type>       Input format: auto, netex, siri (default: auto)
  --profile <name>      Validation profile (default: format-dependent)
  --schema <path>       Custom XSD schema path (zip or directory)
  --rules <rule,...>    Comma-separated rule list (overrides profile)
  --output <format>     Output format: pretty, json, csv, xml (default: pretty)
  --log-level <level>   Log level: debug, info, warn, error
  --silent              Suppress all output except results
  --help                Show help
  --version             Show version

Exit codes:
  0  All files passed validation
  1  Validation errors found
  2  Validation failed (bad input, missing schema, etc.)
```

## Supported schemas

### NeTEx

| Version | Schema ID (No Constraints) | Schema ID (Full Constraints) |
|---------|---------------------------|------------------------------|
| v1.2 | `netex@1.2-nc` | `netex@1.2` |
| v1.2.2 | `netex@1.2.2-nc` | `netex@1.2.2` |
| v1.2.3 | `netex@1.2.3-nc` | `netex@1.2.3` |
| v1.3.0 | `netex@1.3.0-nc` | `netex@1.3.0` |
| v1.3.1 | `netex@1.3.1-nc` | `netex@1.3.1` |
| EPIP v1.1.2 | — | `epip@1.1.2` |

### SIRI

| Version | Schema ID |
|---------|-----------|
| v2.1 | `siri@2.1` |
| v2.2 | `siri@2.2` |

The web UI lets you select any schema version from a dropdown, or upload a custom `.xsd` / `.zip` schema. The CLI uses profiles that bundle a schema version with a set of rules.

## NeTEx business rules

| Rule | What it checks |
|------|----------------|
| `everyLineIsReferenced` | Every `Line` is referenced by at least one `LineRef` |
| `everyStopPlaceHasAName` | Every `StopPlace` has a `Name` or `ShortName` |
| `everyStopPlaceHasACorrectStopPlaceType` | Every `StopPlace` has a valid `StopPlaceType` from the NeTEx enum |
| `everyStopPlaceIsReferenced` | Every `StopPlace` is referenced by at least one `StopPlaceRef` |
| `everyStopPointHasArrivalAndDepartureTime` | Every stop in a `ServiceJourney` has appropriate arrival/departure times |
| `everyScheduledStopPointHasAName` | Every `ScheduledStopPoint` has a `Name` or `ShortName` |
| `stopPlaceQuayDistanceIsReasonable` | Distance between a `StopPlace` centroid and each `Quay` is reasonable |
| `frameDefaultsHaveALocaleAndTimeZone` | `FrameDefaults` have valid locale and timezone settings |
| `locationsAreReferencingTheSamePoint` | `ScheduledStopPoint` and `StopPlace` in a `PassengerStopAssignment` are geographically close |
| `passingTimesIsNotDecreasing` | Passing times in a `ServiceJourney` do not decrease between consecutive stops |
| `netexKeyRefConstraints` | Cross-document `xsd:keyref` constraint validation |
| `netexUniqueConstraints` | Cross-document `xsd:unique` constraint validation |

## Schema caching

XSD schemas are downloaded from GitHub on first use and cached at `~/.cache/transmodel-validator/schemas/`. In Docker, this is persisted via the `schema-cache` volume.

NeTEx schemas are [GPL-3.0 licensed](https://github.com/NeTEx-CEN/NeTEx) (CEN, Crown Copyright). SIRI schemas are published by CEN on the [SIRI-CEN/SIRI](https://github.com/SIRI-CEN/SIRI) repository without an explicit open-source license. Neither is bundled in this repository.

## Docker

### Using Docker Compose (recommended)

```sh
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). The schema cache is persisted in a Docker volume.

### Using Docker directly

```sh
docker build -t transmodel-validator .
docker run -p 3000:3000 transmodel-validator
```

## Project structure

```
transmodel-validator/
├── packages/
│   ├── core/     # Validation engine (types, schemas, rules, profiles)
│   ├── cli/      # Command-line interface
│   └── web/      # Web UI (TanStack Start + Tailwind CSS v4)
├── Dockerfile
└── docker-compose.yml
```

## Development

```sh
pnpm install
pnpm build          # Build all packages (core must build before cli/web)
pnpm test           # Run all tests
```

### Package scripts

```sh
# Core
pnpm --filter @transmodel-validator/core build
pnpm --filter @transmodel-validator/core test

# CLI
pnpm --filter @transmodel-validator/cli build
pnpm --filter @transmodel-validator/cli test

# Web (dev server)
pnpm --filter @transmodel-validator/web dev
pnpm --filter @transmodel-validator/web build
```

### Debug logging

Server-side timing logs are gated behind the `DEBUG` environment variable:

```sh
DEBUG=xsd-validator pnpm --filter @transmodel-validator/web dev   # XSD validator timing
DEBUG=api/validate pnpm --filter @transmodel-validator/web dev    # SSE endpoint timing
DEBUG=* pnpm --filter @transmodel-validator/web dev               # All debug output
```

## License

[MIT](LICENSE) · made by [igotinfected](https://github.com/igotinfected) with [:strawberry:](https://github.com/Spillgebees)
