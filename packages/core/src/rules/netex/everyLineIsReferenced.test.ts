/**
 * Tests for the everyLineIsReferenced rule.
 *
 * Verifies that every Line element in a NeTEx document is referenced
 * by at least one LineRef.
 */

import type { DocumentInput } from "@transmodel-validator/shared";
import { describe, expect, it } from "vitest";
import { everyLineIsReferenced } from "./everyLineIsReferenced.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("everyLineIsReferenced", () => {
  it("passes when all Lines have LineRefs", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
        </lines>
        <routes>
          <Route><LineRef ref="L1" /></Route>
        </routes>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when a Line has no LineRef", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
          <Line id="L2"><Name>Bus 2</Name></Line>
        </lines>
        <routes>
          <Route><LineRef ref="L1" /></Route>
        </routes>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("L2");
  });

  it("fails when a Line has no id", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line><Name>No ID</Name></Line>
        </lines>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("missing attribute `@id`");
  });

  it("passes with no Lines (empty ServiceFrame)", async () => {
    const xml = netex(`<ServiceFrame><lines></lines></ServiceFrame>`);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passes when Line is in one file and LineRef is in another", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "lines.xml",
      xml: netex(`
        <ServiceFrame id="SF:lines" version="1">
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "routes.xml",
      xml: netex(`
        <ServiceFrame id="SF:routes" version="1">
          <prerequisites>
            <ServiceFrameRef ref="SF:lines" version="1" />
          </prerequisites>
          <routes>
            <Route><LineRef ref="L1" /></Route>
          </routes>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyLineIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("fails when Line has no LineRef in any document", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "lines.xml",
      xml: netex(`
        <ServiceFrame>
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "other.xml",
      xml: netex(`
        <ServiceFrame>
          <routes>
            <Route><LineRef ref="L99" /></Route>
          </routes>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyLineIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("L1");
    expect(errors[0].fileName).toBe("lines.xml");
  });

  describe("flat-frame structure", () => {
    it("passes with flat ServiceFrame", async () => {
      const xml = netexFlat(`
        <ServiceFrame>
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
          <routes>
            <Route><LineRef ref="L1" /></Route>
          </routes>
        </ServiceFrame>
      `);
      const errors = await everyLineIsReferenced.run(doc(xml));
      expect(errors).toHaveLength(0);
    });

    it("fails with flat ServiceFrame", async () => {
      const xml = netexFlat(`
        <ServiceFrame>
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
        </ServiceFrame>
      `);
      const errors = await everyLineIsReferenced.run(doc(xml));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("L1");
    });
  });
});
