/**
 * Tests for the netexUniqueConstraints rule.
 *
 * Verifies that XSD unique constraints are enforced within individual
 * documents (per W3C XSD scoping rules) and across frames linked by
 * `<prerequisites>`.
 */

import type { DocumentInput } from "@transmodel-validator/shared";
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

  it("detects duplicate across prerequisite-linked frames", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "a.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ResourceFrame id="RF:1">
            <StopPlace id="SP1" />
          </ResourceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };
    const docB: DocumentInput = {
      fileName: "b.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ServiceFrame id="SF:1">
            <prerequisites>
              <ResourceFrameRef ref="RF:1" />
            </prerequisites>
            <StopPlace id="SP1" />
          </ServiceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([docA, docB], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — cross-prerequisite duplicate detected, attributed to declaring frame's file
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("prerequisite-linked frames");
    expect(errors[0].message).toContain("SF:1");
    expect(errors[0].message).toContain("RF:1");
    expect(errors[0].fileName).toBe("b.xml");
  });

  it("allows identical elements across unrelated frames (no prerequisites)", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "a.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ResourceFrame id="RF:1">
            <StopPlace id="SP1" />
          </ResourceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };
    const docB: DocumentInput = {
      fileName: "b.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ServiceFrame id="SF:1">
            <StopPlace id="SP1" />
          </ServiceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([docA, docB], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — independent frames can have overlapping IDs
    expect(errors).toHaveLength(0);
  });

  it("detects per-document duplicate and cross-prerequisite duplicate independently", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "a.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ResourceFrame id="RF:1">
            <StopPlace id="SP1" />
            <StopPlace id="SP1" />
          </ResourceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };
    const docB: DocumentInput = {
      fileName: "b.xml",
      xml: `<PublicationDelivery>
        <dataObjects>
          <ServiceFrame id="SF:1">
            <prerequisites>
              <ResourceFrameRef ref="RF:1" />
            </prerequisites>
            <StopPlace id="SP1" />
          </ServiceFrame>
        </dataObjects>
      </PublicationDelivery>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([docA, docB], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — one per-document duplicate in doc A, one cross-prerequisite duplicate
    expect(errors).toHaveLength(2);
    const perDocError = errors.find(
      (e) => !e.message.includes("prerequisite-linked"),
    );
    const crossPrereqError = errors.find((e) =>
      e.message.includes("prerequisite-linked"),
    );
    expect(perDocError).toBeDefined();
    expect(perDocError!.message).toContain("UniqueStopPlaceId");
    expect(perDocError!.fileName).toBe("a.xml");
    expect(crossPrereqError).toBeDefined();
    expect(crossPrereqError!.message).toContain("SF:1");
    expect(crossPrereqError!.message).toContain("RF:1");
    expect(crossPrereqError!.fileName).toBe("b.xml");
  });
});
