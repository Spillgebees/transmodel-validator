/**
 * Shared test helpers for NeTEx rule tests.
 *
 * Provides minimal XML document wrappers used across individual rule test files.
 */

import type { DocumentInput } from "@transmodel-validator/shared";

/** Wrap an XML string into a single-element DocumentInput array. */
export function doc(xml: string): DocumentInput[] {
  return [{ fileName: "test.xml", xml }];
}

/**
 * Wraps content in a minimal NeTEx PublicationDelivery with CompositeFrame.
 */
export function netex(frames: string, frameDefaults = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      ${frameDefaults ? `<FrameDefaults>${frameDefaults}</FrameDefaults>` : ""}
      <frames>
        ${frames}
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;
}

/**
 * Wraps content in a minimal NeTEx PublicationDelivery with flat frames
 * (no CompositeFrame wrapper). Frames are placed directly under dataObjects.
 */
export function netexFlat(frames: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    ${frames}
  </dataObjects>
</PublicationDelivery>`;
}
