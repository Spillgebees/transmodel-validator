/**
 * Tests for NeTEx frame parsing helpers.
 *
 * Covers parsePrerequisites, findAllFrames, and buildPrerequisiteGraph.
 */

import type { DocumentInput } from "@transmodel-validator/shared";
import { describe, expect, it } from "vitest";
import {
  buildPrerequisiteGraph,
  findAllFrames,
  parsePrerequisites,
} from "./frames.js";

describe("parsePrerequisites", () => {
  it("parses ResourceFrameRef and ServiceFrameRef inside prerequisites", () => {
    // arrange
    const innerXml = `
      <prerequisites>
        <ResourceFrameRef ref="RF:1" />
        <ServiceFrameRef ref="SF:1" />
      </prerequisites>
    `;

    // act
    const result = parsePrerequisites(innerXml);

    // assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ref: "RF:1", version: undefined });
    expect(result[1]).toEqual({ ref: "SF:1", version: undefined });
  });

  it("returns empty array when no prerequisites element", () => {
    // arrange
    const innerXml = `
      <lines>
        <Line id="L1"><Name>Bus 1</Name></Line>
      </lines>
    `;

    // act
    const result = parsePrerequisites(innerXml);

    // assert
    expect(result).toHaveLength(0);
  });

  it("handles prerequisites with version attributes", () => {
    // arrange
    const innerXml = `
      <prerequisites>
        <ResourceFrameRef ref="RF:1" version="1" />
        <TimetableFrameRef ref="TF:1" version="3" />
      </prerequisites>
    `;

    // act
    const result = parsePrerequisites(innerXml);

    // assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ref: "RF:1", version: "1" });
    expect(result[1]).toEqual({ ref: "TF:1", version: "3" });
  });
});

describe("findAllFrames", () => {
  it("finds ServiceFrame and ResourceFrame in a document", () => {
    // arrange
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame id="CF:1" version="1">
      <frames>
        <ServiceFrame id="SF:1" version="2">
          <lines><Line id="L1"><Name>Bus 1</Name></Line></lines>
        </ServiceFrame>
        <ResourceFrame id="RF:1" version="1">
          <organisations/>
        </ResourceFrame>
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;

    // act
    const frames = findAllFrames(xml, "test.xml");

    // assert
    expect(frames.length).toBeGreaterThanOrEqual(3);
    const cf = frames.find((f) => f.type === "CompositeFrame");
    const sf = frames.find((f) => f.type === "ServiceFrame");
    const rf = frames.find((f) => f.type === "ResourceFrame");
    expect(cf).toBeDefined();
    expect(cf!.id).toBe("CF:1");
    expect(sf).toBeDefined();
    expect(sf!.id).toBe("SF:1");
    expect(sf!.version).toBe("2");
    expect(sf!.fileName).toBe("test.xml");
    expect(rf).toBeDefined();
    expect(rf!.id).toBe("RF:1");
    expect(rf!.version).toBe("1");
  });

  it("extracts id, version, and type correctly", () => {
    // arrange
    const xml = `<TimetableFrame id="TF:42" version="7">
      <vehicleJourneys/>
    </TimetableFrame>`;

    // act
    const frames = findAllFrames(xml, "timetable.xml");

    // assert
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe("TF:42");
    expect(frames[0].version).toBe("7");
    expect(frames[0].type).toBe("TimetableFrame");
    expect(frames[0].fileName).toBe("timetable.xml");
  });

  it("skips frames without id", () => {
    // arrange
    const xml = `
      <ServiceFrame version="1">
        <lines/>
      </ServiceFrame>
      <ResourceFrame id="RF:1" version="1">
        <organisations/>
      </ResourceFrame>
    `;

    // act
    const frames = findAllFrames(xml, "test.xml");

    // assert
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe("RF:1");
  });

  it("includes prerequisites from each frame", () => {
    // arrange
    const xml = `
      <ServiceFrame id="SF:1" version="1">
        <prerequisites>
          <ResourceFrameRef ref="RF:1" version="1" />
        </prerequisites>
        <lines/>
      </ServiceFrame>
    `;

    // act
    const frames = findAllFrames(xml, "test.xml");

    // assert
    expect(frames).toHaveLength(1);
    expect(frames[0].prerequisites).toHaveLength(1);
    expect(frames[0].prerequisites[0]).toEqual({
      ref: "RF:1",
      version: "1",
    });
  });
});

describe("buildPrerequisiteGraph", () => {
  it("builds correct graph with two documents", () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "a.xml",
      xml: `
        <ResourceFrame id="RF:1" version="1">
          <organisations/>
        </ResourceFrame>
      `,
    };
    const docB: DocumentInput = {
      fileName: "b.xml",
      xml: `
        <ServiceFrame id="SF:1" version="1">
          <prerequisites>
            <ResourceFrameRef ref="RF:1" version="1" />
          </prerequisites>
          <lines/>
        </ServiceFrame>
      `,
    };

    // act
    const { frames, graph } = buildPrerequisiteGraph([docA, docB]);

    // assert
    expect(frames).toHaveLength(2);
    expect(graph.get("SF:1")?.has("RF:1")).toBe(true);
  });

  it("frame in doc A declares prerequisite to frame in doc B", () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "a.xml",
      xml: `
        <TimetableFrame id="TF:1" version="1">
          <prerequisites>
            <ServiceFrameRef ref="SF:1" />
          </prerequisites>
          <vehicleJourneys/>
        </TimetableFrame>
      `,
    };
    const docB: DocumentInput = {
      fileName: "b.xml",
      xml: `
        <ServiceFrame id="SF:1" version="1">
          <lines/>
        </ServiceFrame>
      `,
    };

    // act
    const { frames, graph } = buildPrerequisiteGraph([docA, docB]);

    // assert
    expect(frames).toHaveLength(2);
    const tfFrame = frames.find((f) => f.id === "TF:1");
    expect(tfFrame).toBeDefined();
    expect(tfFrame!.fileName).toBe("a.xml");
    expect(graph.get("TF:1")?.has("SF:1")).toBe(true);

    const sfFrame = frames.find((f) => f.id === "SF:1");
    expect(sfFrame).toBeDefined();
    expect(sfFrame!.fileName).toBe("b.xml");
  });

  it("frames with no prerequisites have empty sets in the graph", () => {
    // arrange
    const doc: DocumentInput = {
      fileName: "standalone.xml",
      xml: `
        <ResourceFrame id="RF:1" version="1">
          <organisations/>
        </ResourceFrame>
        <ServiceFrame id="SF:1" version="1">
          <lines/>
        </ServiceFrame>
      `,
    };

    // act
    const { frames, graph } = buildPrerequisiteGraph([doc]);

    // assert
    expect(frames).toHaveLength(2);
    expect(graph.get("RF:1")).toBeDefined();
    expect(graph.get("RF:1")!.size).toBe(0);
    expect(graph.get("SF:1")).toBeDefined();
    expect(graph.get("SF:1")!.size).toBe(0);
  });
});
