/**
 * Rule: frameDefaultsHaveALocaleAndTimeZone
 *
 * Validates that FrameDefaults/DefaultLocale has valid:
 * - TimeZoneOffset (if present): matches /^[+-]\d{1,2}$/
 * - TimeZone (if present): valid IANA time zone
 * - SummerTimeZoneOffset (if present): same regex
 * - SummerTimeZone (if present): valid IANA time zone
 * - DefaultLanguage (if present): valid ISO 639-1 language code
 *
 * All fields are optional — only validated when present.
 */

import { consistencyError, skippedInfo } from "../../errors.js";
import type { DocumentInput, Rule, ValidationError } from "../../types.js";
import { findChildren, getChildText } from "../../xml/helpers.js";
import { FRAME_DEFAULTS, findNeTExElements } from "../../xml/paths.js";

const RULE_NAME = "frameDefaultsHaveALocaleAndTimeZone";

/**
 * ISO 639-1 language codes.
 * This is a representative subset — the full list has ~184 entries.
 */
const ISO_639_1 = new Set([
  "aa",
  "ab",
  "af",
  "ak",
  "am",
  "an",
  "ar",
  "as",
  "av",
  "ay",
  "az",
  "ba",
  "be",
  "bg",
  "bh",
  "bi",
  "bm",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "ce",
  "ch",
  "co",
  "cr",
  "cs",
  "cu",
  "cv",
  "cy",
  "da",
  "de",
  "dv",
  "dz",
  "ee",
  "el",
  "en",
  "eo",
  "es",
  "et",
  "eu",
  "fa",
  "ff",
  "fi",
  "fj",
  "fo",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gn",
  "gu",
  "gv",
  "ha",
  "he",
  "hi",
  "ho",
  "hr",
  "ht",
  "hu",
  "hy",
  "hz",
  "ia",
  "id",
  "ie",
  "ig",
  "ii",
  "ik",
  "io",
  "is",
  "it",
  "iu",
  "ja",
  "jv",
  "ka",
  "kg",
  "ki",
  "kj",
  "kk",
  "kl",
  "km",
  "kn",
  "ko",
  "kr",
  "ks",
  "ku",
  "kv",
  "kw",
  "ky",
  "la",
  "lb",
  "lg",
  "li",
  "ln",
  "lo",
  "lt",
  "lu",
  "lv",
  "mg",
  "mh",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "na",
  "nb",
  "nd",
  "ne",
  "ng",
  "nl",
  "nn",
  "no",
  "nr",
  "nv",
  "ny",
  "oc",
  "oj",
  "om",
  "or",
  "os",
  "pa",
  "pi",
  "pl",
  "ps",
  "pt",
  "qu",
  "rm",
  "rn",
  "ro",
  "ru",
  "rw",
  "sa",
  "sc",
  "sd",
  "se",
  "sg",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "sq",
  "sr",
  "ss",
  "st",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "ti",
  "tk",
  "tl",
  "tn",
  "to",
  "tr",
  "ts",
  "tt",
  "tw",
  "ty",
  "ug",
  "uk",
  "ur",
  "uz",
  "ve",
  "vi",
  "vo",
  "wa",
  "wo",
  "xh",
  "yi",
  "yo",
  "za",
  "zh",
  "zu",
]);

/** Regex for timezone offset: `+2`, `-1`, `+10`, etc. */
const TZ_OFFSET_RE = /^[+-]\d{1,2}$/;

/**
 * Basic validation for IANA time zone names.
 * We check that it looks like `Area/City` (e.g. `Europe/Oslo`).
 * Full validation would require the IANA database, but this catches
 * obvious issues.
 */
function isValidTimeZone(tz: string): boolean {
  // Must contain at least one `/` and no spaces.
  return /^[A-Za-z_]+\/[A-Za-z_/]+$/.test(tz);
}

export const frameDefaultsHaveALocaleAndTimeZone: Rule = {
  name: RULE_NAME,
  displayName: "Locale & timezone defaults",
  description:
    "`FrameDefaults` must have valid locale and timezone settings (when present).",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const frameDefaults = findNeTExElements(doc.xml, FRAME_DEFAULTS);
      if (frameDefaults.length === 0) {
        errors.push(
          skippedInfo(
            RULE_NAME,
            "Skipped: document has no `<FrameDefaults />` element",
          ),
        );
        continue;
      }

      const fd = frameDefaults[0];
      const locales = findChildren(fd.innerXml, "DefaultLocale");
      if (locales.length === 0) {
        // DefaultLocale is optional — no error if absent.
        continue;
      }

      const locale = locales[0];

      // TimeZoneOffset
      const tzOffset = getChildText(locale.innerXml, "TimeZoneOffset");
      if (tzOffset && !TZ_OFFSET_RE.test(tzOffset)) {
        errors.push(
          consistencyError(
            RULE_NAME,
            "Invalid `<TimeZoneOffset />` in `<FrameDefaults />`",
            locale.line,
          ),
        );
      }

      // TimeZone
      const tz = getChildText(locale.innerXml, "TimeZone");
      if (tz && !isValidTimeZone(tz)) {
        errors.push(
          consistencyError(
            RULE_NAME,
            "Invalid `<TimeZone />` in `<FrameDefaults />`",
            locale.line,
          ),
        );
      }

      // SummerTimeZoneOffset
      const stzOffset = getChildText(locale.innerXml, "SummerTimeZoneOffset");
      if (stzOffset && !TZ_OFFSET_RE.test(stzOffset)) {
        errors.push(
          consistencyError(
            RULE_NAME,
            "Invalid `<SummerTimeZoneOffset />` in `<FrameDefaults />`",
            locale.line,
          ),
        );
      }

      // SummerTimeZone
      const stz = getChildText(locale.innerXml, "SummerTimeZone");
      if (stz && !isValidTimeZone(stz)) {
        errors.push(
          consistencyError(
            RULE_NAME,
            "Invalid `<SummerTimeZone />` in `<FrameDefaults />`",
            locale.line,
          ),
        );
      }

      // DefaultLanguage
      const lang = getChildText(locale.innerXml, "DefaultLanguage");
      if (lang && !ISO_639_1.has(lang)) {
        errors.push(
          consistencyError(
            RULE_NAME,
            "Invalid `<DefaultLanguage />` in `<FrameDefaults />`",
            locale.line,
          ),
        );
      }
    }

    return errors;
  },
};
