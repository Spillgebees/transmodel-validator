/// <reference types="vite/client" />

import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { migrateIfNeeded } from "~/lib/sessions";
import "~/styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "transmodel-validator" },
    ],
    links: [
      {
        rel: "preload",
        href: "/fonts/inter-latin-wght-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/jetbrains-mono-latin-wght-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    migrateIfNeeded();
  }, []);

  return (
    <RootDocument>
      <div className="flex min-h-dvh flex-col">
        <Nav />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </RootDocument>
  );
}

/**
 * Inline @font-face so the browser knows about fonts before any CSS loads.
 *
 * Why inline? In Vite dev mode, CSS is injected asynchronously via JS,
 * so @font-face rules in .css files arrive after first paint — causing
 * font swaps (FOUT). Inlining in <head> ensures the browser can apply
 * font-display: block from the very first render.
 *
 * The preload <link>s above tell the browser to start downloading the
 * woff2 files immediately during HTML parsing. Combined with block mode,
 * text is invisible for a few ms then appears with the correct font.
 * No swap, no layout shift.
 *
 * Font files are in public/fonts/ (sourced from @fontsource-variable).
 */
const inlineFontFaces = `
@font-face {
  font-family: "Inter Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  src: url("/fonts/inter-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
@font-face {
  font-family: "Inter Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  src: url("/fonts/inter-latin-ext-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
@font-face {
  font-family: "JetBrains Mono Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 800;
  src: url("/fonts/jetbrains-mono-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
}
@font-face {
  font-family: "JetBrains Mono Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 800;
  src: url("/fonts/jetbrains-mono-latin-ext-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
}
`;

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: inlineFontFaces }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isValidateActive = pathname === "/" || pathname.startsWith("/results");
  const isHistoryActive = pathname === "/history";

  return (
    <header className="border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-6 w-6" aria-hidden="true" />
          <span className="font-mono text-sm font-semibold text-text">
            transmodel-validator
          </span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <Link
            to="/"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:text-text ${
              isValidateActive
                ? "bg-surface-overlay text-text"
                : "text-text-muted"
            }`}
          >
            Validate
          </Link>
          <Link
            to="/history"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:text-text ${
              isHistoryActive
                ? "bg-surface-overlay text-text"
                : "text-text-muted"
            }`}
          >
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-4 text-center text-xs text-text-muted">
      <div className="flex items-center justify-center gap-1.5">
        <span>made by</span>
        <a
          href="https://github.com/igotinfected"
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-text"
        >
          igotinfected
        </a>
        <span>with</span>
        <a
          href="https://github.com/Spillgebees"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
          aria-label="Spillgebees on GitHub"
        >
          <span role="img" aria-label="strawberry">
            🍓
          </span>
        </a>
        <span>&middot;</span>
        <span>MIT</span>
        <span>&middot;</span>
        <a
          href="https://github.com/Spillgebees/transmodel-validator"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted transition-colors hover:text-text"
          aria-label="View source on GitHub"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span className="sr-only">GitHub</span>
        </a>
      </div>
    </footer>
  );
}
