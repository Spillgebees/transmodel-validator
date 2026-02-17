/**
 * Minimal debug-style logger gated on the DEBUG environment variable.
 *
 * Usage:
 *   const log = createLogger("xsd-validator");
 *   log("cache HIT for %s", xsdPath);  // only logs if DEBUG=xsd-validator or DEBUG=*
 */

/**
 * Creates a namespaced logger that only emits when the DEBUG env var matches.
 *
 * The DEBUG variable is checked at call time so that each `createLogger()`
 * invocation reads the current environment. Supported formats:
 *   - `"*"` — enables all namespaces
 *   - `"ns1,ns2"` — comma-separated list of exact namespace matches
 *
 * @param namespace - The debug namespace (e.g. `"xsd-validator"`).
 * @returns A logging function that is either a no-op or writes to `console.log`.
 */
export function createLogger(namespace: string): (...args: unknown[]) => void {
  const debug = typeof process !== "undefined" ? (process.env.DEBUG ?? "") : "";
  const enabled =
    debug === "*" || debug.split(",").some((d) => d.trim() === namespace);

  if (!enabled) return () => {};

  const prefix = `[${namespace}]`;
  return (...args: unknown[]) => {
    if (typeof args[0] === "string") {
      console.log(`${prefix} ${args[0]}`, ...args.slice(1));
    } else {
      console.log(prefix, ...args);
    }
  };
}
