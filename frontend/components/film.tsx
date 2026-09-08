import type { ReactNode } from "react";
import { IconZoomIn, IconContrast, IconRuler, IconCompare, IconExpand, IconChevronDown } from "@/components/icons";
import type { Region } from "@/lib/demo/cases";

/* DICOM corner text — defaults to the hero case so old call sites stay 1:1 */
export type CornerInfo = { name: string; sexAge: string; id: string; date: string; acc: string };
const DEFAULT_CORNER: CornerInfo = {
  name: "KIM, S**",
  sexAge: "F/58",
  id: "PX-2026-0142",
  date: "2026-07-13 09:41",
  acc: "ACC 20260713-0042",
};

/* Evidence regions in 400x500 film space (hero case, right lower lobe) */
const DEFAULT_REGIONS: Region[] = [
  { cx: 128, cy: 330, rx: 66, ry: 56, w: 0.94 },
  { cx: 252, cy: 302, rx: 40, ry: 34, w: 0.62 },
];

/*
 * Film viewport — the only place X-ray/heatmap placeholder art lives.
 * Swap `src` for a real radiograph and everything else (DICOM corner
 * text, markers, overlays, caption) stays 1:1.
 *
 * On-film annotation rules (DESIGN.md): teal outlines only — solid when
 * confidence > 90%, 4-3 dashed for the 50-90% "suspect" band. Heatmaps:
 * jet ramp (Grad-CAM) / cyan-teal (Eigen-CAM), 40% opacity.
 */

type Variant = "plain" | "gradcam" | "eigencam";
type View = "pa" | "lateral";

export function Film({
  variant = "plain",
  view = "pa",
  src,
  label,
  meta,
  swatch,
  outline = false,
  corners = true,
  ratio = "4 / 5",
  fit = "cover",
  className = "",
  corner,
  regions,
  overlayOpacity,
}: {
  variant?: Variant;
  view?: View;
  src?: string;
  label?: string;
  meta?: string;
  swatch?: "jet" | "teal";
  outline?: boolean;
  corners?: boolean;
  ratio?: string;
  fit?: "cover" | "contain";
  className?: string;
  corner?: CornerInfo;
  regions?: Region[];
  overlayOpacity?: number;
}) {
  return (
    <figure className={`overflow-hidden rounded-lg bg-letterbox ${className}`}>
      <div className="relative w-full overflow-hidden bg-film" style={{ aspectRatio: ratio }}>
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label ?? "chest radiograph"}
              className={`h-full w-full grayscale ${fit === "contain" ? "object-contain" : "object-cover"}`}
            />
            {(variant !== "plain" || outline) && (
              <HeatOverlay variant={variant} outline={outline} regions={regions} opacity={overlayOpacity} />
            )}
          </>
        ) : (
          <ChestArt variant={variant} view={view} outline={outline} />
        )}

        {corners && <DicomCorners view={view} info={corner ?? DEFAULT_CORNER} />}
      </div>

      {(label || meta || swatch) && (
        <figcaption className="flex h-8 items-center justify-between gap-3 px-3">
          {label && <span className="microlabel !text-[#aeb6bf]">{label}</span>}
          <span className="flex items-center gap-2">
            {meta && <span className="mono text-[10.5px] tracking-wide text-[#7c848d]">{meta}</span>}
            {swatch && <HeatSwatch kind={swatch} />}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/* 64px gradient swatch — the heatmap legend (label text lives in the caption) */
function HeatSwatch({ kind }: { kind: "jet" | "teal" }) {
  return (
    <span
      className="h-1.5 w-16 shrink-0 rounded-full"
      style={{
        background:
          kind === "jet"
            ? "linear-gradient(90deg, transparent, #ffd34d, #ff9838, #ff5a4d)"
            : "linear-gradient(90deg, transparent, #38daff, #0bd8b6)",
      }}
    />
  );
}

const cornerText = "mono text-[10px] leading-[15px] tracking-wide text-[#b8c0c8]/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]";

function DicomCorners({ view, info }: { view: View; info: CornerInfo }) {
  return (
    <>
      <div className={`absolute left-2.5 top-2 ${cornerText}`}>
        {info.name}
        <br />
        {info.sexAge} · {info.id}
      </div>
      <div className={`absolute right-2.5 top-2 text-right ${cornerText}`}>
        KU MEDICAL CENTER
        <br />
        {info.date}
      </div>
      <div className={`absolute bottom-2 left-2.5 ${cornerText}`}>
        W 1500 · L -600
        <br />
        ZOOM 142%
      </div>
      <div className={`absolute bottom-2 right-2.5 text-right ${cornerText}`}>
        {view === "pa" ? "PA ERECT" : "LAT"} · 1/2
        <br />
        {info.acc}
      </div>
      {/* laterality marker, always visible like a lead marker */}
      <span className="mono absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#b8c0c8]/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        R
      </span>
    </>
  );
}

/*
 * Annotation layer for real radiographs — same heat/outline language the
 * placeholder art uses, drawn above the image. Coordinates live in the
 * 400x500 film space (right lower zone = viewer left).
 */
function HeatOverlay({
  variant,
  outline,
  regions = DEFAULT_REGIONS,
  opacity = 0.8,
}: {
  variant: Variant;
  outline: boolean;
  regions?: Region[];
  opacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="o-hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5a4d" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ff9838" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#ffd34d" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffd34d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="o-cool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38daff" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#0bd8b6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0bd8b6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {variant === "gradcam" && (
        <g opacity={opacity} className="transition-opacity duration-300">
          {regions.map((r, i) => (
            <ellipse key={i} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="url(#o-hot)" opacity={r.w} />
          ))}
        </g>
      )}
      {variant === "eigencam" && (
        <g opacity={opacity * 0.95} className="transition-opacity duration-300">
          {regions.map((r, i) => (
            <ellipse key={i} cx={r.cx + 4} cy={r.cy - 8} rx={r.rx + 4} ry={r.ry + 6} fill="url(#o-cool)" opacity={r.w} />
          ))}
        </g>
      )}
      {/* lesion outlines: solid >90%, 4-3 dash for 50-90% suspect band */}
      {outline && (
        <g fill="none">
          {regions.map((r, i) => (
            <ellipse
              key={i}
              cx={r.cx}
              cy={r.cy}
              rx={Math.max(12, r.rx - 10)}
              ry={Math.max(10, r.ry - 10)}
              stroke="#0bd8b6"
              strokeWidth={r.w >= 0.9 ? 1.8 : 1.6}
              strokeDasharray={r.w >= 0.9 ? undefined : "4 3"}
              opacity={r.w >= 0.9 ? 1 : 0.85}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ---------- placeholder radiograph art ---------- */

function ChestArt({ variant, view, outline }: { variant: Variant; view: View; outline: boolean }) {
  return view === "pa" ? (
    <PaArt variant={variant} outline={outline} />
  ) : (
    <LateralArt />
  );
}

function PaArt({ variant, outline }: { variant: Variant; outline: boolean }) {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="vig" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#11161c" />
          <stop offset="70%" stopColor="#070a0d" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id="hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5a4d" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#ff9838" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#ffd34d" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffd34d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38daff" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#0bd8b6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0bd8b6" stopOpacity="0" />
        </radialGradient>
        <filter id="soft4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="soft8"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>

      <rect width="400" height="500" fill="url(#vig)" />

      {/* soft tissue silhouette */}
      <path
        d="M116 52 C116 84 92 96 66 108 C46 118 38 150 38 200 L38 470 L362 470 L362 200 C362 150 354 118 334 108 C308 96 284 84 284 52 C284 40 260 30 200 30 C140 30 116 40 116 52Z"
        fill="#232b34"
        opacity="0.92"
        filter="url(#soft4)"
      />

      {/* lung fields (radiolucent = darker) */}
      <ellipse cx="136" cy="252" rx="84" ry="132" fill="#0c1116" filter="url(#soft4)" />
      <ellipse cx="264" cy="252" rx="84" ry="132" fill="#0c1116" filter="url(#soft4)" />

      {/* hilar vascular markings */}
      <g stroke="#3d4a56" strokeWidth="2" fill="none" opacity="0.55">
        <path d="M186 240 C160 232 140 218 124 198" />
        <path d="M186 252 C158 254 136 262 118 278" />
        <path d="M186 264 C162 278 148 296 138 318" />
        <path d="M214 240 C240 232 260 218 276 198" />
        <path d="M214 252 C242 254 264 262 282 278" />
        <path d="M214 264 C238 278 252 296 262 318" />
      </g>

      {/* posterior ribs */}
      {Array.from({ length: 8 }).map((_, i) => (
        <g key={i} stroke="#6b7887" strokeWidth="3" fill="none" opacity={0.4 - i * 0.025}>
          <path d={`M197 ${128 + i * 34} C 152 ${120 + i * 34}, 96 ${142 + i * 34}, 58 ${186 + i * 34}`} />
          <path d={`M203 ${128 + i * 34} C 248 ${120 + i * 34}, 304 ${142 + i * 34}, 342 ${186 + i * 34}`} />
        </g>
      ))}
      {/* anterior ribs, fainter, opposite slope */}
      {Array.from({ length: 5 }).map((_, i) => (
        <g key={i} stroke="#5a6673" strokeWidth="2.6" fill="none" opacity="0.2">
          <path d={`M60 ${196 + i * 40} C 104 ${226 + i * 40}, 156 ${238 + i * 40}, 196 ${240 + i * 40}`} />
          <path d={`M340 ${196 + i * 40} C 296 ${226 + i * 40}, 244 ${238 + i * 40}, 204 ${240 + i * 40}`} />
        </g>
      ))}

      {/* clavicles */}
      <path d="M110 132 C 150 118, 182 120, 197 130" stroke="#8b98a7" strokeWidth="4.5" fill="none" opacity="0.58" />
      <path d="M290 132 C 250 118, 218 120, 203 130" stroke="#8b98a7" strokeWidth="4.5" fill="none" opacity="0.58" />

      {/* trachea (air column) + spine */}
      <rect x="192" y="88" width="16" height="60" rx="8" fill="#0a0e13" opacity="0.9" />
      <rect x="191" y="118" width="18" height="270" rx="9" fill="#4d5a68" opacity="0.42" />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x="186" y={130 + i * 26} width="28" height="5" rx="2.5" fill="#5f6c7b" opacity="0.34" />
      ))}

      {/* aortic knob + heart shadow (apex toward viewer-right) */}
      <ellipse cx="188" cy="228" rx="22" ry="16" fill="#39434e" opacity="0.6" filter="url(#soft4)" />
      <path
        d="M196 258 C 172 262, 158 292, 166 330 C 174 368, 208 388, 244 378 C 274 368, 284 330, 268 296 C 254 268, 222 252, 196 258Z"
        fill="#39434e"
        opacity="0.85"
        filter="url(#soft4)"
      />

      {/* RLL consolidation — the pathology itself, visible on the plain film */}
      <ellipse cx="126" cy="330" rx="58" ry="46" fill="#46525e" opacity="0.5" filter="url(#soft8)" />
      <ellipse cx="146" cy="306" rx="30" ry="24" fill="#4a5560" opacity="0.35" filter="url(#soft8)" />

      {/* diaphragm domes + gastric bubble */}
      <path d="M56 372 C 104 402, 158 410, 196 400" stroke="#7c8896" strokeWidth="3.5" fill="none" opacity="0.55" />
      <path d="M344 366 C 300 398, 244 408, 204 400" stroke="#7c8896" strokeWidth="3.5" fill="none" opacity="0.55" />
      <ellipse cx="268" cy="422" rx="26" ry="14" fill="#0a0e13" opacity="0.8" />

      {/* heatmap overlays */}
      {variant === "gradcam" && (
        <g opacity="0.85">
          <ellipse cx="128" cy="326" rx="66" ry="56" fill="url(#hot)" />
          <ellipse cx="250" cy="300" rx="40" ry="34" fill="url(#hot)" opacity="0.55" />
        </g>
      )}
      {variant === "eigencam" && (
        <g opacity="0.8">
          <ellipse cx="134" cy="316" rx="70" ry="62" fill="url(#cool)" />
          <ellipse cx="248" cy="288" rx="36" ry="32" fill="url(#cool)" opacity="0.6" />
        </g>
      )}

      {/* lesion outlines: solid >90%, 4-3 dash for 50-90% suspect band */}
      {outline && (
        <g fill="none">
          <ellipse cx="128" cy="326" rx="56" ry="46" stroke="#0bd8b6" strokeWidth="1.8" />
          <ellipse cx="250" cy="300" rx="34" ry="28" stroke="#0bd8b6" strokeWidth="1.6" strokeDasharray="4 3" opacity="0.85" />
        </g>
      )}
    </svg>
  );
}

function LateralArt() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="vigl" cx="46%" cy="44%" r="75%">
          <stop offset="0%" stopColor="#10151a" />
          <stop offset="70%" stopColor="#060809" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id="lsoft4"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="lsoft8"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>

      <rect width="400" height="500" fill="url(#vigl)" />

      {/* torso profile */}
      <path
        d="M118 34 C 96 88, 74 128, 72 208 C 70 300, 88 392, 122 462 L 320 462 C 336 380, 340 288, 330 208 C 322 132, 300 80, 282 34 Z"
        fill="#20272f"
        opacity="0.92"
        filter="url(#lsoft4)"
      />

      {/* lung field (overlapping lungs read as one dark zone) */}
      <ellipse cx="196" cy="248" rx="104" ry="138" fill="#0b0f14" filter="url(#lsoft4)" />

      {/* spine: posterior vertebral band, brighter caudally */}
      <path d="M296 90 C 306 170, 308 300, 296 420" stroke="#55626f" strokeWidth="26" fill="none" opacity="0.4" filter="url(#lsoft4)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x="284" y={116 + i * 34} width="26" height="7" rx="3" fill="#687583" opacity={0.22 + i * 0.02} transform={`rotate(${2 + i} 297 ${120 + i * 34})`} />
      ))}

      {/* sternum edge */}
      <path d="M112 118 C 100 176, 96 240, 102 306" stroke="#7d8996" strokeWidth="5" fill="none" opacity="0.45" />

      {/* ribs crossing obliquely */}
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M282 ${118 + i * 38} C 232 ${100 + i * 38}, 150 ${112 + i * 38}, 108 ${150 + i * 38}`}
          stroke="#5e6b79"
          strokeWidth="2.6"
          fill="none"
          opacity={0.3 - i * 0.02}
        />
      ))}

      {/* heart shadow (retrosternal) */}
      <path
        d="M126 268 C 112 300, 118 344, 150 366 C 186 388, 226 374, 236 338 C 244 306, 224 272, 190 262 C 164 256, 138 258, 126 268Z"
        fill="#343e49"
        opacity="0.8"
        filter="url(#lsoft4)"
      />

      {/* posterior-basal consolidation echo */}
      <ellipse cx="238" cy="352" rx="52" ry="40" fill="#414c58" opacity="0.42" filter="url(#lsoft8)" />

      {/* diaphragm */}
      <path d="M96 390 C 160 366, 250 372, 322 402" stroke="#78848f" strokeWidth="3.5" fill="none" opacity="0.5" />
      <ellipse cx="176" cy="424" rx="30" ry="14" fill="#0a0e13" opacity="0.75" />
    </svg>
  );
}

/* ---------- viewer chrome ---------- */

function ToolButton({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ease-out ${
        active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/*
 * 48px viewer toolbar: W/L presets left, AI-overlay 3-state segment +
 * opacity right. Static mock — states are visual.
 */
export function ViewerToolbar({
  overlay = "히트맵",
}: {
  overlay?: "끄기" | "외곽선" | "히트맵";
}) {
  const segs: Array<"끄기" | "외곽선" | "히트맵"> = ["끄기", "외곽선", "히트맵"];
  return (
    <div className="flex h-12 items-center justify-between gap-3 px-3">
      <div className="flex items-center gap-1">
        <ToolButton><IconZoomIn className="h-[18px] w-[18px]" /></ToolButton>
        <ToolButton><IconRuler className="h-[18px] w-[18px]" /></ToolButton>
        <ToolButton><IconCompare className="h-[18px] w-[18px]" /></ToolButton>
        <ToolButton><IconExpand className="h-[18px] w-[18px]" /></ToolButton>
        <button
          type="button"
          className="ml-1 flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink"
        >
          <IconContrast className="h-[16px] w-[16px]" />
          폐 프리셋
          <IconChevronDown className="h-[14px] w-[14px] text-ink-3" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="microlabel hidden md:inline">AI OVERLAY</span>
        <div className="flex h-8 items-center gap-0.5 rounded-md bg-surface-2 p-0.5">
          {segs.map((s) => (
            <button
              key={s}
              type="button"
              className={`h-7 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors duration-150 ease-out ${
                s === overlay
                  ? "bg-white text-ink shadow-[0_1px_3px_rgba(22,24,29,0.12)]"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <div className="relative h-1 w-16 rounded-sm bg-hairline">
            <div className="absolute inset-y-0 left-0 w-[40%] rounded-sm bg-line-strong" />
            <span className="absolute left-[40%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(22,24,29,0.3)]" />
          </div>
          <span className="mono text-[11px] text-ink-3">40%</span>
        </div>
      </div>
    </div>
  );
}

/* 48px patient strip above a viewer */
export function PatientStrip({
  name,
  meta,
  right,
}: {
  name: string;
  meta: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
        <span className="mono truncate text-[11.5px] tracking-wide text-ink-2">{meta}</span>
      </div>
      {right}
    </div>
  );
}
