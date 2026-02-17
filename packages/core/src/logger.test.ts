/**
 * Tests for the debug logging utility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createLogger", () => {
  const originalDebug = process.env.DEBUG;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalDebug === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = originalDebug;
    }
  });

  it("logs when DEBUG matches the namespace exactly", async () => {
    // arrange
    process.env.DEBUG = "xsd-validator";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("xsd-validator");

    // act
    log("cache HIT for %s", "test.xsd");

    // assert
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      "[xsd-validator] cache HIT for %s",
      "test.xsd",
    );
  });

  it("logs when DEBUG is wildcard '*'", async () => {
    // arrange
    process.env.DEBUG = "*";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("my-namespace");

    // act
    log("hello");

    // assert
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("[my-namespace] hello");
  });

  it("logs when DEBUG contains the namespace in a comma-separated list", async () => {
    // arrange
    process.env.DEBUG = "foo, xsd-validator, bar";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("xsd-validator");

    // act
    log("test message");

    // assert
    expect(spy).toHaveBeenCalledOnce();
  });

  it("does not log when DEBUG does not match the namespace", async () => {
    // arrange
    process.env.DEBUG = "other-namespace";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("xsd-validator");

    // act
    log("should not appear");

    // assert
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not log when DEBUG is empty", async () => {
    // arrange
    process.env.DEBUG = "";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("xsd-validator");

    // act
    log("should not appear");

    // assert
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not log when DEBUG is undefined", async () => {
    // arrange
    delete process.env.DEBUG;
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("xsd-validator");

    // act
    log("should not appear");

    // assert
    expect(spy).not.toHaveBeenCalled();
  });

  it("handles non-string first argument", async () => {
    // arrange
    process.env.DEBUG = "*";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");

    // act
    log({ key: "value" });

    // assert
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("[test]", { key: "value" });
  });

  it("handles multiple non-string arguments", async () => {
    // arrange
    process.env.DEBUG = "*";
    vi.resetModules();
    const { createLogger } = await import("./logger.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("test");

    // act
    log(42, "extra", true);

    // assert
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("[test]", 42, "extra", true);
  });
});
