/**
 * Tests for the error factory functions and XSD message formatting.
 */

import { describe, expect, it } from "vitest";
import { formatXsdMessage, xsdError } from "./errors.js";

describe("formatXsdMessage", () => {
  it("strips namespace URIs in braces", () => {
    const raw =
      "Element '{http://www.netex.org.uk/netex}Percentage': This element is not expected.";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Percentage`: This element is not expected.",
    );
  });

  it("wraps single-quoted element names in backticks", () => {
    const raw = "Element 'Percentage': This element is not expected.";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Percentage`: This element is not expected.",
    );
  });

  it("wraps single-quoted attribute names in backticks", () => {
    const raw = "The attribute 'version' is required but missing.";
    expect(formatXsdMessage(raw)).toBe(
      "The attribute `version` is required but missing.",
    );
  });

  it("wraps single-quoted value references in backticks", () => {
    const raw = "The value 'abc' is not valid.";
    expect(formatXsdMessage(raw)).toBe("The value `abc` is not valid.");
  });

  it("wraps single-quoted type references in backticks", () => {
    const raw =
      "Element 'Foo': The type definition is not valid for type 'BarType'.";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Foo`: The type definition is not valid for type `BarType`.",
    );
  });

  it("formats expected-list with backtick-wrapped comma-separated items", () => {
    const raw =
      "Element 'Percentage': This element is not expected. Expected is one of ( Trend, Accuracy, Description, CountedItemsIdList, Extensions ).";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Percentage`: This element is not expected. Expected is one of `Trend`, `Accuracy`, `Description`, `CountedItemsIdList`, `Extensions`.",
    );
  });

  it("formats single expected element", () => {
    const raw =
      "Element 'Foo': This element is not expected. Expected is ( Bar ).";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Foo`: This element is not expected. Expected is `Bar`.",
    );
  });

  it("handles namespace URIs inside expected lists", () => {
    const raw =
      "Element '{http://www.netex.org.uk/netex}Foo': This element is not expected. Expected is one of ( {http://www.netex.org.uk/netex}Bar, {http://www.netex.org.uk/netex}Baz ).";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Foo`: This element is not expected. Expected is one of `Bar`, `Baz`.",
    );
  });

  it("passes through messages with no matching patterns", () => {
    const raw = "Some unknown error format.";
    expect(formatXsdMessage(raw)).toBe("Some unknown error format.");
  });

  it("handles multiple element references in one message", () => {
    const raw = "Element 'Foo' is not valid against type 'BarType'.";
    expect(formatXsdMessage(raw)).toBe(
      "Element `Foo` is not valid against type `BarType`.",
    );
  });
});

describe("xsdError", () => {
  it("applies formatXsdMessage to the message", () => {
    const err = xsdError("Element 'Foo': not expected.", 10, 5);
    expect(err.message).toBe("Element `Foo`: not expected.");
    expect(err.line).toBe(10);
    expect(err.column).toBe(5);
    expect(err.source).toBe("xsd");
  });
});
