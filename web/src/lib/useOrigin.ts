"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The site's origin (e.g. "https://settl.app"), or "" while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}
