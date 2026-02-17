/**
 * Schema registry — maps schema IDs to download URLs and entry XSD paths.
 *
 * NeTEx schemas are GPL-3.0. SIRI schemas have no explicit open-source license.
 * Neither is bundled; they are downloaded at runtime and cached.
 */

import type { SchemaId } from "../types.js";

export interface SchemaEntry {
  /** Human-readable label. */
  label: string;
  /** URL to download the zip archive containing the XSD files. */
  archiveUrl: string;
  /**
   * Relative path (within the extracted archive) to the main entry XSD.
   * The archive root is typically `{repo}-{tag}/` (GitHub source archives).
   */
  entryXsd: string;
  /** Glob to identify the archive root directory (GitHub uses `RepoName-tag/`). */
  archiveRootPrefix: string;
}

/**
 * All known schema entries, keyed by `SchemaId`.
 *
 * `"custom"` is intentionally missing — it is handled separately.
 */
export const SCHEMA_REGISTRY: Record<
  Exclude<SchemaId, "custom">,
  SchemaEntry
> = {
  // ── NeTEx ─────────────────────────────────────────────────────────────
  "netex@1.2-nc": {
    label: "NeTEx v1.2 (No Constraints)",
    archiveUrl: "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.zip",
    entryXsd: "xsd/NeTEx_publication-NoConstraint.xsd",
    archiveRootPrefix: "NeTEx-1.2/",
  },
  "netex@1.2": {
    label: "NeTEx v1.2 (Full Constraints)",
    archiveUrl: "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.zip",
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.2/",
  },
  "netex@1.2.2-nc": {
    label: "NeTEx v1.2.2 (No Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.2.zip",
    entryXsd: "xsd/NeTEx_publication-NoConstraint.xsd",
    archiveRootPrefix: "NeTEx-1.2.2/",
  },
  "netex@1.2.2": {
    label: "NeTEx v1.2.2 (Full Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.2.zip",
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.2.2/",
  },
  "netex@1.2.3-nc": {
    label: "NeTEx v1.2.3 (No Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.3.zip",
    entryXsd: "xsd/NeTEx_publication-NoConstraint.xsd",
    archiveRootPrefix: "NeTEx-1.2.3/",
  },
  "netex@1.2.3": {
    label: "NeTEx v1.2.3 (Full Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.3.zip",
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.2.3/",
  },
  "netex@1.3.0-nc": {
    label: "NeTEx v1.3.0 (No Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.3.0.zip",
    entryXsd: "xsd/NeTEx_publication-NoConstraint.xsd",
    archiveRootPrefix: "NeTEx-1.3.0/",
  },
  "netex@1.3.0": {
    label: "NeTEx v1.3.0 (Full Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.3.0.zip",
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.3.0/",
  },
  "netex@1.3.1-nc": {
    label: "NeTEx v1.3.1 (No Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.3.1.zip",
    entryXsd: "xsd/NeTEx_publication-NoConstraint.xsd",
    archiveRootPrefix: "NeTEx-1.3.1/",
  },
  "netex@1.3.1": {
    label: "NeTEx v1.3.1 (Full Constraints)",
    archiveUrl:
      "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.3.1.zip",
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.3.1/",
  },

  // ── EPIP ──────────────────────────────────────────────────────────────
  "epip@1.1.2": {
    label: "EPIP v1.1.2",
    archiveUrl: "https://github.com/NeTEx-CEN/NeTEx/archive/refs/tags/v1.2.zip",
    // EPIP uses a reduced publication schema — bundled in the NeTEx 1.2 release.
    // The exact path may vary; this is the best known location.
    entryXsd: "xsd/NeTEx_publication.xsd",
    archiveRootPrefix: "NeTEx-1.2/",
  },

  // ── SIRI ──────────────────────────────────────────────────────────────
  "siri@2.1": {
    label: "SIRI v2.1",
    archiveUrl: "https://github.com/SIRI-CEN/SIRI/archive/refs/tags/v2.1.zip",
    entryXsd: "xsd/siri.xsd",
    archiveRootPrefix: "SIRI-2.1/",
  },
  "siri@2.2": {
    label: "SIRI v2.2",
    archiveUrl: "https://github.com/SIRI-CEN/SIRI/archive/refs/tags/v2.2.zip",
    entryXsd: "xsd/siri.xsd",
    archiveRootPrefix: "SIRI-2.2/",
  },
};
