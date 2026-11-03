"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

type Theme = "system" | "light" | "dark";

// "system" means: no data-theme on <html>, so the css follows the OS setting
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // private windows can block storage. the theme still works for this visit
  }
}

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

// the theme lives on <html data-theme>, so read it from there instead of keeping a copy in state.
// the observer re-renders the toggle whenever that attribute changes
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  const current = document.documentElement.getAttribute("data-theme");
  return current === "light" || current === "dark" ? current : "system";
}

export default function ThemeToggle() {
  // on the server there is no <html> to read yet, so it starts as "system"
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  return (
    <div className="flex rounded-lg border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => apply(value)}
          className={
            "flex flex-1 items-center justify-center rounded-md py-1.5 px-2 transition-colors " +
            (theme === value ? "bg-surface text-fg shadow-sm" : "text-faint hover:text-fg")
          }
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
