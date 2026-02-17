/**
 * Format detection for Transmodel XML files.
 *
 * Determines whether an XML file is NeTEx or SIRI by inspecting
 * the root element's namespace. NeTEx imports SIRI types but always
 * uses a NeTEx namespace on its root element (e.g. PublicationDelivery),
 * so namespace detection is reliable.
 */

export type TransmodelFormat = "netex" | "siri";

const NETEX_NAMESPACE = "http://www.netex.org.uk/netex";
const SIRI_NAMESPACE = "http://www.siri.org.uk/siri";

/**
 * Detect whether XML content is NeTEx or SIRI.
 *
 * Reads only the first portion of the XML to find the root element namespace.
 * This avoids parsing the entire document.
 *
 * @param xml - The XML content (string or first ~4KB is sufficient)
 * @returns The detected format
 * @throws If the format cannot be determined
 */
export function detectFormat(xml: string): TransmodelFormat {
  // Look for xmlns declarations or namespace prefixes in the root element.
  // We scan a generous window to handle documents with many namespace declarations.
  const head = xml.slice(0, 4096);

  if (head.includes(NETEX_NAMESPACE)) {
    return "netex";
  }

  if (head.includes(SIRI_NAMESPACE)) {
    return "siri";
  }

  throw new Error(
    "Unable to detect Transmodel format. " +
      `Expected root element namespace to be either "${NETEX_NAMESPACE}" (NeTEx) ` +
      `or "${SIRI_NAMESPACE}" (SIRI). ` +
      "Ensure the XML file has a valid namespace declaration on the root element.",
  );
}
