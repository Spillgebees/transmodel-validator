/**
 * Rule: netexPrerequisitesAreSatisfied
 *
 * Validates that all frames declaring `<prerequisites>` have their
 * prerequisite frames present in the provided document set. Also
 * recommends using `<prerequisites>` when cross-file references are
 * detected without corresponding prerequisite declarations.
 *
 * NOTE: This rule operates across all documents and must be in
 * `CROSS_DOC_RULES` so it receives the full document set.
 */

import type {
  DocumentInput,
  Rule,
  RuleConfig,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError, qualityError } from "@transmodel-validator/shared";
import { buildPrerequisiteGraph } from "../../xml/frames.js";

const RULE_NAME = "netexPrerequisitesAreSatisfied";

export const netexPrerequisitesAreSatisfied: Rule = {
  name: RULE_NAME,
  displayName: "Frame prerequisites",
  description:
    "Validates that declared frame `<prerequisites>` are present and recommends their use for cross-file references.",
  formats: ["netex"],

  async run(
    documents: DocumentInput[],
    _config?: RuleConfig,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const { frames } = buildPrerequisiteGraph(documents);

    // Build a set of all known frame IDs.
    const knownFrameIds = new Set(frames.map((f) => f.id));

    // ── Part 1: Check that every declared prerequisite exists. ───────────

    for (const frame of frames) {
      for (const prereq of frame.prerequisites) {
        if (!knownFrameIds.has(prereq.ref)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Frame \`${frame.id}\` declares prerequisite \`${prereq.ref}\` which is not present in the provided documents`,
              frame.line,
              frame.fileName,
            ),
          );
        }
      }
    }

    // ── Part 2: Detect cross-file references without prerequisites. ─────

    // Build id → fileName map (all elements with @id across all docs).
    const idToFile = new Map<string, string>();
    for (const doc of documents) {
      const idRe = /<[a-zA-Z][a-zA-Z0-9_]*\s[^>]*?\bid\s*=\s*"([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = idRe.exec(doc.xml)) !== null) {
        idToFile.set(m[1], doc.fileName);
      }
    }

    // Build frame-level prerequisite coverage: for each file, which other
    // files' frames are covered by prerequisites.
    const filePrerequisiteCoverage = new Map<string, Set<string>>();
    for (const frame of frames) {
      if (!filePrerequisiteCoverage.has(frame.fileName)) {
        filePrerequisiteCoverage.set(frame.fileName, new Set());
      }
      const covered = filePrerequisiteCoverage.get(frame.fileName)!;
      for (const prereq of frame.prerequisites) {
        // Find which file the prerequisite frame lives in.
        const prereqFrame = frames.find((f) => f.id === prereq.ref);
        if (prereqFrame) {
          covered.add(prereqFrame.fileName);
        }
      }
    }

    // Find cross-file references without prerequisite coverage.
    // Deduplicate by (source file, target file) pair.
    const warned = new Set<string>();

    for (const doc of documents) {
      // Find all *Ref elements (elements whose name ends with "Ref").
      const refRe = /<[a-zA-Z][a-zA-Z0-9_]*Ref\s[^>]*?\bref\s*=\s*"([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = refRe.exec(doc.xml)) !== null) {
        const refValue = m[1];
        const targetFile = idToFile.get(refValue);
        if (!targetFile || targetFile === doc.fileName) continue;

        // Cross-file reference detected. Check prerequisite coverage.
        const covered = filePrerequisiteCoverage.get(doc.fileName);
        if (covered?.has(targetFile)) continue;

        // No prerequisite coverage for this cross-file reference.
        const pairKey = `${doc.fileName}\u2192${targetFile}`;
        if (warned.has(pairKey)) continue;
        warned.add(pairKey);

        errors.push(
          qualityError(
            RULE_NAME,
            `Cross-file reference from \`${doc.fileName}\` to \`${targetFile}\` detected without \`<prerequisites>\` \u2014 consider declaring frame prerequisites to express this dependency`,
            undefined,
            doc.fileName,
          ),
        );
      }
    }

    return errors;
  },
};
