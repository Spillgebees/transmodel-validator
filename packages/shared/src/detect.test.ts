/**
 * Tests for the format detection utility.
 */

import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect.js";

describe("detectFormat", () => {
  it("detects NeTEx from namespace", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.15:NO-NeTEx-networktimetable:1.3">
</PublicationDelivery>`;

    expect(detectFormat(xml)).toBe("netex");
  });

  it("detects SIRI from namespace", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="http://www.siri.org.uk/siri" version="2.1">
</Siri>`;

    expect(detectFormat(xml)).toBe("siri");
  });

  it("detects NeTEx with prefixed namespace", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<netex:PublicationDelivery xmlns:netex="http://www.netex.org.uk/netex">
</netex:PublicationDelivery>`;

    expect(detectFormat(xml)).toBe("netex");
  });

  it("detects SIRI with prefixed namespace", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<siri:Siri xmlns:siri="http://www.siri.org.uk/siri" version="2.1">
</siri:Siri>`;

    expect(detectFormat(xml)).toBe("siri");
  });

  it("prefers NeTEx when both namespaces present (NeTEx imports SIRI types)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" xmlns:siri="http://www.siri.org.uk/siri">
</PublicationDelivery>`;

    expect(detectFormat(xml)).toBe("netex");
  });

  it("throws on unknown namespace", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://example.com/unknown">
</Root>`;

    expect(() => detectFormat(xml)).toThrow(
      "Unable to detect Transmodel format",
    );
  });

  it("throws on empty/minimal XML", () => {
    expect(() => detectFormat("<Root/>")).toThrow(
      "Unable to detect Transmodel format",
    );
  });
});
