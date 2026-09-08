import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { DemoProvider } from "@/lib/demo/store";

export const metadata: Metadata = {
  title: "Chest AI · 판독실",
  description: "흉부 X-ray 영상과 임상정보 기반 폐 질환 진단 지원 플랫폼",
};

/*
 * Flowing gradient atmosphere behind the canvas: blurred organic bands
 * (yellow → mint → lime → teal) sweeping diagonally, finished with a
 * visible monochrome grain. Chrome only — the white sidebar covers it.
 */
function FlowBackground() {
  return (
    <div className="flow-bg" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="flow-blur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="72" />
          </filter>
          <filter id="flow-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        <rect width="1440" height="900" fill="#eef0f4" />

        <g filter="url(#flow-blur)">
          {/* yellow stream: sweeps from top-left down across the header zone */}
          <path
            d="M -160 40 C 240 -80, 420 240, 760 150 C 980 90, 1080 -60, 1520 20 L 1520 -260 L -160 -260 Z"
            fill="#f2d478"
            opacity="0.55"
          />
          {/* mint ribbon: crosses the upper-right diagonally */}
          <path
            d="M 640 -120 C 900 120, 1180 60, 1360 220 C 1480 330, 1560 300, 1620 260 L 1620 -200 L 640 -200 Z"
            fill="#86dab0"
            opacity="0.5"
          />
          {/* lime current: thin S-curve through the middle */}
          <path
            d="M -120 520 C 320 380, 620 560, 960 440 C 1200 360, 1360 420, 1560 380 L 1560 470 C 1300 520, 1150 460, 940 540 C 640 650, 300 480, -120 620 Z"
            fill="#cfe79c"
            opacity="0.38"
          />
          {/* teal tide: rises from the bottom */}
          <path
            d="M -160 980 C 260 760, 620 900, 920 800 C 1180 715, 1360 800, 1600 740 L 1600 1100 L -160 1100 Z"
            fill="#38a293"
            opacity="0.34"
          />
        </g>

        {/* monochrome grain — the texture layer */}
        <rect
          width="1440"
          height="900"
          filter="url(#flow-grain)"
          opacity="0.16"
          style={{ mixBlendMode: "multiply" }}
        />
      </svg>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <FlowBackground />
        <DemoProvider>
          <div className="relative flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-7 py-6">{children}</main>
            </div>
          </div>
        </DemoProvider>
      </body>
    </html>
  );
}
