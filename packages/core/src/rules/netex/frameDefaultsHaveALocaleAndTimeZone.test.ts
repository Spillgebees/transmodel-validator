/**
 * Tests for the frameDefaultsHaveALocaleAndTimeZone rule.
 *
 * Verifies that FrameDefaults contain valid locale settings including
 * timezone offsets, timezone names, and language codes.
 */

import { describe, expect, it } from "vitest";

import { frameDefaultsHaveALocaleAndTimeZone } from "./frameDefaultsHaveALocaleAndTimeZone.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("frameDefaultsHaveALocaleAndTimeZone", () => {
  it("passes with valid locale settings", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZoneOffset>+1</TimeZoneOffset>
        <TimeZone>Europe/Oslo</TimeZone>
        <SummerTimeZoneOffset>+2</SummerTimeZoneOffset>
        <SummerTimeZone>Europe/Oslo</SummerTimeZone>
        <DefaultLanguage>no</DefaultLanguage>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passes with FrameDefaults but no DefaultLocale (optional)", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    // DefaultLocale is optional — no error when it's absent.
    expect(errors).toHaveLength(0);
  });

  it("fails with invalid timezone offset", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZoneOffset>abc</TimeZoneOffset>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZoneOffset");
  });

  it("fails with invalid language code", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <DefaultLanguage>zzz</DefaultLanguage>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("DefaultLanguage");
  });

  it("passes when TimeZone is a common abbreviation (CET)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>CET</TimeZone>
        <SummerTimeZone>CEST</SummerTimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("passes when TimeZone is UTC offset (UTC+1)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>UTC+1</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("passes when TimeZone is GMT offset (GMT+01:00)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>GMT+01:00</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("skips validation when TimeZone is empty string (falsy, treated as absent)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone></TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert — empty string is falsy so the guard skips validation
    expect(errors).toHaveLength(0);
  });

  it("fails when TimeZone is random text", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>not a timezone</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZone");
  });

  it("skips when FrameDefaults is missing (info severity)", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      <frames><ServiceFrame></ServiceFrame></frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
    expect(errors[0].message).toContain("Skipped");
  });

  it("reports correct line number for deeply nested invalid TimeZone", async () => {
    // arrange
    // NOTE: Each line is numbered explicitly so we can assert the exact line.
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <FrameDefaults>`, // line 5
      `        <DefaultLocale>`, // line 6
      `          <TimeZone>INVALID_TZ</TimeZone>`, // line 7
      `          <DefaultLanguage>en</DefaultLanguage>`, // line 8
      `        </DefaultLocale>`, // line 9
      `      </FrameDefaults>`, // line 10
      `      <frames>`, // line 11
      `        <ServiceFrame></ServiceFrame>`, // line 12
      `      </frames>`, // line 13
      `    </CompositeFrame>`, // line 14
      `  </dataObjects>`, // line 15
      `</PublicationDelivery>`, // line 16
    ].join("\n");

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZone");
    expect(errors[0].line).toBe(6);
  });

  it("reports correct line number for invalid DefaultLanguage deep in document", async () => {
    // arrange
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <FrameDefaults>`, // line 5
      `        <DefaultLocale>`, // line 6
      `          <TimeZoneOffset>+1</TimeZoneOffset>`, // line 7
      `          <TimeZone>Europe/Oslo</TimeZone>`, // line 8
      `          <SummerTimeZoneOffset>+2</SummerTimeZoneOffset>`, // line 9
      `          <SummerTimeZone>Europe/Oslo</SummerTimeZone>`, // line 10
      `          <DefaultLanguage>zzz</DefaultLanguage>`, // line 11
      `        </DefaultLocale>`, // line 12
      `      </FrameDefaults>`, // line 13
      `      <frames>`, // line 14
      `        <ServiceFrame></ServiceFrame>`, // line 15
      `      </frames>`, // line 16
      `    </CompositeFrame>`, // line 17
      `  </dataObjects>`, // line 18
      `</PublicationDelivery>`, // line 19
    ].join("\n");

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("DefaultLanguage");
    expect(errors[0].line).toBe(6);
  });

  describe("flat-frame structure", () => {
    it("passes with flat ResourceFrame", async () => {
      const xml = netexFlat(`
        <ResourceFrame>
          <FrameDefaults>
            <DefaultLocale>
              <TimeZoneOffset>+1</TimeZoneOffset>
              <TimeZone>Europe/Oslo</TimeZone>
              <DefaultLanguage>no</DefaultLanguage>
            </DefaultLocale>
          </FrameDefaults>
        </ResourceFrame>
      `);
      const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
      expect(errors).toHaveLength(0);
    });

    it("fails with flat ServiceFrame", async () => {
      const xml = netexFlat(`
        <ServiceFrame>
          <FrameDefaults>
            <DefaultLocale>
              <TimeZoneOffset>abc</TimeZoneOffset>
            </DefaultLocale>
          </FrameDefaults>
        </ServiceFrame>
      `);
      const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("TimeZoneOffset");
    });
  });
});
