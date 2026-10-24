/*
 * Custom icon set — 24x24 viewBox, 20x20 live area, 1.5px center stroke,
 * round caps/joins, currentColor. Signature detail: 1.5px gap-breaks where
 * strokes cross (see DESIGN.md). No sparkles, no caduceus, no heart-pulse.
 */
type P = { className?: string };

const base = (className?: string) => ({
  className,
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* ---------- navigation ---------- */

export const IconGrid = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </svg>
);

/* lungs: trachea forks into two lobes, gap-break where bronchi meet lobes */
export const IconLungs = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3v5" />
    <path d="M12 8c0 1.6-1.1 2.4-2.6 3" />
    <path d="M12 8c0 1.6 1.1 2.4 2.6 3" />
    <path d="M7.8 12.4C9 11.6 9.5 10 9.5 8.5c0-.6-.5-1-1.1-.9C5.6 8.3 3.5 12 3.5 16.5c0 2.5 1 4 2.8 4 1.9 0 3.2-1.6 3.2-4.2 0-1.4-.6-2.8-1.7-3.9Z" />
    <path d="M16.2 12.4C15 11.6 14.5 10 14.5 8.5c0-.6.5-1 1.1-.9 2.8.7 4.9 4.4 4.9 8.9 0 2.5-1 4-2.8 4-1.9 0-3.2-1.6-3.2-4.2 0-1.4.6-2.8 1.7-3.9Z" />
  </svg>
);

/* classification: scan frame + probability ticks */
export const IconClassify = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" />
    <path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" />
    <path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" />
    <path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M7 15.5h4M7 12h7M7 8.5h10" />
  </svg>
);

/* evidence: crosshair with gap-breaks where ticks cross the circle */
export const IconCrosshair = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/* agent: flat chat outline + evidence dot, no robot face */
export const IconConsult = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.3 0-2.6-.3-3.7-.8L3 20l1.1-5.4a8 8 0 0 1-.6-3.1A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
    <path d="M8.5 10.5h7" />
    <path d="M8.5 14h4" />
  </svg>
);

export const IconBook = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13.5a1.9 1.9 0 0 0-2-1.5H5.5A1.5 1.5 0 0 1 4 16.5Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13.5a1.9 1.9 0 0 1 2-1.5h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
  </svg>
);

/* ---------- actions / chrome ---------- */

/* magnifier: handle stops 1.5px short of the ring (gap-break) */
export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20.5 20.5-3.4-3.4" />
  </svg>
);

export const IconBell = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.5 5.2 1.5 5.2H5s1.5-1 1.5-5.2Z" />
    <path d="M10.2 18.5a1.9 1.9 0 0 0 3.6 0" />
  </svg>
);

export const IconUpload = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 14.5V5" />
    <path d="m8.5 8.5 3.5-3.5 3.5 3.5" />
    <path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-2" />
  </svg>
);

export const IconArrowRight = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4.5 12h15" />
    <path d="m13.5 6 6 6-6 6" />
  </svg>
);

export const IconArrowUpRight = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconAlert = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 9v4.5" />
    <path d="M12 16.8h.01" />
    <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const IconClock = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconChevronDown = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconChevronRight = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
);

export const IconSend = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 19.5v-15" />
    <path d="m6 10 6-5.5L18 10" />
  </svg>
);

export const IconPaperclip = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7L10 16.9a1.7 1.7 0 0 1-2.4-2.4l7.3-7.2" />
  </svg>
);

export const IconCopy = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
  </svg>
);

export const IconRefresh = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M20 8.5A8.5 8.5 0 1 0 21 12" />
    <path d="M21 4v4.5h-4.5" />
  </svg>
);

/* ---------- viewer chrome ---------- */

export const IconLayers = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m12 3.5 8.5 4.7L12 12.9 3.5 8.2 12 3.5Z" />
    <path d="m4.5 12.5 7.5 4.2 7.5-4.2" />
    <path d="m4.5 16.5 7.5 4.2 7.5-4.2" />
  </svg>
);

/* window/level: half-toned circle */
export const IconContrast = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 7h4.5M12 12h6.5M12 17h4.5" />
  </svg>
);

export const IconZoomIn = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20.5 20.5-3.4-3.4" />
    <path d="M11 8.5v5M8.5 11h5" />
  </svg>
);

export const IconRuler = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="2.8" y="9.5" width="18.4" height="5" rx="1.5" transform="rotate(-45 12 12)" />
    <path d="m8.5 12.5 1.5 1.5M11.5 9.5l1.5 1.5M14.5 6.5 16 8" />
  </svg>
);

/* compare wipe: split frame + handle */
export const IconCompare = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5" />
    <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
    <path d="M12 2.5v3M12 8v3M12 13.5v3M12 19v2.5" />
  </svg>
);

export const IconExpand = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 3.5H5.5A2 2 0 0 0 3.5 5.5V9" />
    <path d="M15 3.5h3.5a2 2 0 0 1 2 2V9" />
    <path d="M20.5 15v3.5a2 2 0 0 1-2 2H15" />
    <path d="M3.5 15v3.5a2 2 0 0 0 2 2H9" />
  </svg>
);

/* ---------- data / documents ---------- */

export const IconDoc = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 3h6.5L19 8.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M13.5 3v5.5H19" />
    <path d="M8.5 13h7M8.5 16.5h5" />
  </svg>
);

export const IconFlask = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9.5 3.5h5" />
    <path d="M10 3.5v5L4.7 17a2.4 2.4 0 0 0 2.2 3.5h10.2A2.4 2.4 0 0 0 19.3 17L14 8.5v-5" />
    <path d="M7.5 14.5h9" />
  </svg>
);

export const IconStethoscope = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4.5 3.5v5a4.5 4.5 0 0 0 9 0v-5" />
    <path d="M9 13.5v2a5 5 0 0 0 10 0v-1" />
    <circle cx="19" cy="11" r="2.5" />
  </svg>
);

export const IconUser = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M5 20.5c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5" />
  </svg>
);

export const IconShieldCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 5 5.8v5.4c0 4.4 2.9 7.6 7 9.3 4.1-1.7 7-4.9 7-9.3V5.8L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const IconHistory = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 12a8 8 0 1 1 2.3 5.6" />
    <path d="M4 13V8.5" />
    <path d="M4 13h4.5" />
    <path d="M12 8.5V12l2.5 1.8" />
  </svg>
);

/* ---------- finding locator glyphs ---------- */

/*
 * Mini lung map: 14%-opacity silhouette + solid 2.2px dot marking the
 * finding location. Doctors read location instantly. `loc` is 0-1 space
 * across the 20x20 live area.
 */
export const LocatorGlyph = ({
  loc,
  tone = "var(--ink-2)",
  className,
}: {
  loc?: { x: number; y: number };
  tone?: string;
  className?: string;
}) => (
  <svg {...base(className)}>
    <g opacity="0.9">
      <path
        d="M9.6 6.2c.5 0 .9.4.8 1-.1 1.4-.7 2.6-1.7 3.5a5.9 5.9 0 0 0-1.9 4.5c0 2.4-1.2 3.9-2.9 3.9C2.3 19.1 1.5 17.7 1.5 15.4c0-4.2 2-7.7 4.6-8.6 1.2-.4 2.4-.6 3.5-.6Z"
        opacity="0.35"
        transform="translate(3.2 0)"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M14.4 6.2c-.5 0-.9.4-.8 1 .1 1.4.7 2.6 1.7 3.5a5.9 5.9 0 0 1 1.9 4.5c0 2.4 1.2 3.9 2.9 3.9 1.6 0 2.4-1.4 2.4-3.7 0-4.2-2-7.7-4.6-8.6a10 10 0 0 0-3.5-.6Z"
        opacity="0.35"
        transform="translate(-3.2 0)"
        fill="currentColor"
        stroke="none"
      />
    </g>
    {loc && (
      <circle
        cx={2 + loc.x * 20}
        cy={2 + loc.y * 20}
        r="2.2"
        fill={tone}
        stroke="none"
      />
    )}
  </svg>
);

/* Brand mark: lung glyph in a rounded tile */
export const BrandMark = ({ className }: P) => (
  <svg
    className={className}
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
  >
    <rect width="28" height="28" rx="7" fill="var(--accent-brand)" />
    <g
      stroke="var(--accent-ink)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d="M14 6.5v4" />
      <path d="M14 10.5c0 1.3-.9 2-2 2.4" />
      <path d="M14 10.5c0 1.3.9 2 2 2.4" />
      <path d="M10.6 13.8c.9-.6 1.3-1.9 1.3-3 0-.5-.4-.8-.9-.7-2.1.5-3.7 3.3-3.7 6.7 0 1.9.8 3 2.1 3 1.4 0 2.4-1.2 2.4-3.1 0-1.1-.4-2.1-1.2-2.9Z" />
      <path d="M17.4 13.8c-.9-.6-1.3-1.9-1.3-3 0-.5.4-.8.9-.7 2.1.5 3.7 3.3 3.7 6.7 0 1.9-.8 3-2.1 3-1.4 0-2.4-1.2-2.4-3.1 0-1.1.4-2.1 1.2-2.9Z" />
    </g>
  </svg>
);
