import { Suspense } from "react";
import { SessionProvider } from "@/lib/live/session";
import { WorkflowBar } from "@/components/workflow";
import type { Metadata } from "next";
import "./globals.css";
import { ConversationsProvider } from "@/lib/live/conversations";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { WorkspaceProvider } from "@/lib/live/store";

export const metadata: Metadata = {
  title: "Chest AI · 판독실",
  description: "흉부 X-ray 영상과 임상정보 기반 폐 질환 진단 지원 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <Suspense
          fallback={
            <div className="loading-panel m-8" role="status">
              검사 워크스페이스를 불러오고 있습니다…
            </div>
          }
        >
          <SessionProvider>
            <WorkspaceProvider>
              <ConversationsProvider>
                <div className="relative flex min-h-screen">
                  <Sidebar />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Topbar />
                    <main id="main-content" className="workspace-main">
                      <WorkflowBar />
                      {children}
                    </main>
                  </div>
                </div>
              </ConversationsProvider>
            </WorkspaceProvider>
          </SessionProvider>
        </Suspense>
      </body>
    </html>
  );
}
