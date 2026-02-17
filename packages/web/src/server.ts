/**
 * Server entry point for the web UI.
 *
 * Configures the TanStack Start server handler and applies srvx's optimized
 * `FastResponse` for ~5% throughput improvement in Node.js deployments
 * using Nitro/h3/srvx. FastResponse includes an optimized `_toNodeResponse()`
 * path that avoids the overhead of standard Web Response to Node.js conversion.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 * @see https://tanstack.com/start/latest/docs/framework/react/guide/hosting#performance-tip-fastresponse
 */

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { FastResponse } from "srvx";

globalThis.Response = FastResponse as typeof Response;

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
