import { useState, useEffect, useCallback } from "preact/hooks";

type ThemePref = "dark" | "light" | "system";

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    return (localStorage.getItem("folderex-theme") as ThemePref) || "system";
  });

  const applyTheme = useCallback((p: ThemePref) => {
    let effective = p;
    if (p === "system") {
      effective = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", effective);
  }, []);

  useEffect(() => {
    applyTheme(pref);
  }, [pref, applyTheme]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      if (pref === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref, applyTheme]);

  const cycleTheme = useCallback(() => {
    const order: ThemePref[] = ["dark", "light", "system"];
    const next = order[(order.indexOf(pref) + 1) % order.length];
    localStorage.setItem("folderex-theme", next);
    setPref(next);
  }, [pref]);

  return { pref, cycleTheme };
}
