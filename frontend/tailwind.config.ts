import type { Config } from "tailwindcss";

/*
 * Design tokens live in app/globals.css as CSS custom properties
 * (see DESIGN.md — "판독실" system). Tailwind only maps utility
 * names onto those variables; values are never re-invented inline.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0", sm: "8px", md: "var(--r-md)", lg: "var(--r-md)",
      xl: "var(--r-lg)", "2xl": "var(--r-xl)", full: "9999px",
    },
    extend: {
      colors: {
        film: "var(--film)",
        letterbox: "var(--letterbox)",
        canvas: "var(--canvas)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          hover: "var(--surface-hover)",
        },
        hairline: "var(--hairline)",
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--accent-text)",
          fill: "var(--accent-fill)",
          strong: "var(--accent-strong)",
          ink: "var(--accent-ink)",
          brand: "var(--accent-brand)",
          film: "var(--film-accent)",
        },
        critical: { DEFAULT: "var(--critical-text)", fill: "var(--critical-fill)" },
        warning: { DEFAULT: "var(--warning-text)", fill: "var(--warning-fill)" },
        ok: { DEFAULT: "var(--ok-text)", fill: "var(--ok-fill)" },
        info: { DEFAULT: "var(--info-text)" },
      },
      backgroundColor: {
        "accent-wash": "var(--accent-wash)",
        "accent-wash-2": "var(--accent-wash-2)",
        "critical-wash": "var(--critical-wash)",
        "warning-wash": "var(--warning-wash)",
        "ok-wash": "var(--ok-wash)",
        "info-wash": "var(--info-wash)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        e1: "var(--shadow-1)",
        e2: "var(--shadow-2)",
        e3: "var(--shadow-3)",
        sidebar: "var(--shadow-sidebar)",
        accent: "var(--shadow-accent)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
