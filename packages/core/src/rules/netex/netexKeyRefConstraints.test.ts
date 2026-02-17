/**
 * Tests for the netexKeyRefConstraints rule.
 *
 * Verifies that XSD keyref constraints are checked across documents,
 * ensuring referential integrity of NeTEx identifiers.
 */

import { describe, expect, it } from "vitest";

import { netexKeyRefConstraints } from "./netexKeyRefConstraints.js";
import { doc, netex } from "./testHelpers.js";

/**
 * Minimal XSD snippet with xsd:key and xsd:keyref definitions.
 * Defines a key on StopPlace/@id and a keyref from StopPlaceRef/@ref
 * pointing to it.
 */
const KEYREF_XSD = `
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:key name="StopPlaceIdKey">
    <xsd:selector xpath=".//StopPlace" />
    <xsd:field xpath="@id" />
  </xsd:key>
  <xsd:keyref name="StopPlaceIdRef" refer="StopPlaceIdKey">
    <xsd:selector xpath=".//StopPlaceRef" />
    <xsd:field xpath="@ref" />
  </xsd:keyref>
</xsd:schema>
`;

describe("netexKeyRefConstraints", () => {
  it("returns skippedInfo when no XSD content is provided", async () => {
    const xml = netex("<ServiceFrame />");
    const errors = await netexKeyRefConstraints.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
  });

  it("passes when all keyrefs resolve to existing keys", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP2" />
      <StopPlaceRef ref="SP1" />
      <StopPlaceRef ref="SP2" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("fails when a keyref points to a missing key", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef ref="SP1" />
      <StopPlaceRef ref="SP_MISSING" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("SP_MISSING");
  });

  it("resolves keyrefs across multiple documents", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlaceRef ref="SP1" /></root>`,
    };
    const errors = await netexKeyRefConstraints.run([doc1, doc2], {
      xsdContent: KEYREF_XSD,
    });
    expect(errors).toHaveLength(0);
  });

  it("fails for cross-doc ref pointing to missing key", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlaceRef ref="SP999" /></root>`,
    };
    const errors = await netexKeyRefConstraints.run([doc1, doc2], {
      xsdContent: KEYREF_XSD,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SP999");
  });

  it("skips elements with versionRef attribute", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef ref="SP_MISSING" versionRef="1" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("skips refs where all fields are empty", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });
});
