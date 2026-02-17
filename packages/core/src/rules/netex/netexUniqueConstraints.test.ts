/**
 * Tests for the netexUniqueConstraints rule.
 *
 * Verifies that XSD unique constraints are enforced within individual
 * documents (per W3C XSD scoping rules).
 */

import { describe, expect, it } from "vitest";

import { netexUniqueConstraints } from "./netexUniqueConstraints.js";
import { doc, netex } from "./testHelpers.js";

/**
 * Minimal XSD snippet with an xsd:unique constraint.
 * Enforces uniqueness of StopPlace/@id.
 */
const UNIQUE_XSD = `
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:unique name="UniqueStopPlaceId">
    <xsd:selector xpath=".//StopPlace" />
    <xsd:field xpath="@id" />
  </xsd:unique>
</xsd:schema>
`;

describe("netexUniqueConstraints", () => {
  it("returns skippedInfo when no XSD content is provided", async () => {
    const xml = netex("<ServiceFrame />");
    const errors = await netexUniqueConstraints.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
  });

  it("passes when all values are unique", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP2" />
      <StopPlace id="SP3" />
    </root>`;
    const errors = await netexUniqueConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: UNIQUE_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("fails when duplicate values exist within a single document", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP1" />
    </root>`;
    const errors = await netexUniqueConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: UNIQUE_XSD },
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("UniqueStopPlaceId");
  });

  it("allows identical elements across documents (per-document scoping)", async () => {
    // arrange
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — per W3C XSD §3.11.4, unique constraints are scoped to the
    // declaring element (PublicationDelivery), so cross-document duplicates
    // are allowed.
    expect(errors).toHaveLength(0);
  });

  it("fails when duplicate values exist within a single document (multi-doc input)", async () => {
    // arrange
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP2" /></root>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — only the within-document duplicate in doc1 is flagged
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("UniqueStopPlaceId");
  });

  it("passes when different documents have different IDs", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP2" /></root>`,
    };
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });
    expect(errors).toHaveLength(0);
  });
});
