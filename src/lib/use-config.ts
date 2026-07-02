"use client";

import * as React from "react";

/**
 * Reads the customizable option lists managed on the Config page.
 * Returns `{}` until loaded; callers should fall back to built-in defaults.
 */
export function useConfig() {
  const [config, setConfig] = React.useState<Record<string, string[]>>({});
  React.useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => { if (active) setConfig(j.data ?? {}); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return config;
}
