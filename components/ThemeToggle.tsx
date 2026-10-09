"use client";

import { useEffect, useState } from "react";

function isDark() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(isDark());
  }, []);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sppk-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      className="btn-ghost h-9 min-w-9 px-3"
      onClick={toggle}
      aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
    >
      {dark === null ? (
        <span className="inline-block h-4 w-4" />
      ) : dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
