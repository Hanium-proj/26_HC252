/*
 * Shared types + copy that is the same for every case (KPIs, retrieval
 * stages, tool catalogue, starters). Per-case clinical data lives in
 * lib/demo/cases.ts; canned answers in lib/demo/agent-script.ts and
 * lib/demo/literature-script.ts. Every user-facing string follows
 * DESIGN.md copy rules: doctors are the users, AI "감지·제안" / physician
 * "확인·판독", integer probabilities, no engineering jargon.
 */

import { CASES, DEFAULT_CASE_ID } from "@/lib/demo/cases";
import { defaultLiterature } from "@/lib/demo/literature-script";

export type Level = "critical" | "warning" | "ok" | "info" | "neutral";

export const MODEL_STAMP = "CXR-Net v2.4 · 2026-07-13 09:41";

/* Disease-level findings (multi-label). threshold = operating point. */
export type Finding = {
  ko: string;
  en: string;
  prob: number; // 0-1, rendered as integer %
  threshold: number; // operating threshold tick position
  level: Level;
  loc?: { x: number; y: number }; // locator-glyph dot, 0-1 in lung map space
  note: string;
};

/* Localization agreement (CheXlocalize protocol) — model-level, not per case */
export const localizationMetrics = [
  { ko: "폐렴 의심", en: "PNEUMONIA", mIoU: 0.61, hitRate: 0.88 },
  { ko: "폐 음영 의심", en: "LUNG OPACITY", mIoU: 0.57, hitRate: 0.83 },
  { ko: "무기폐 의심", en: "ATELECTASIS", mIoU: 0.49, hitRate: 0.74 },
  { ko: "심비대 의심", en: "CARDIOMEGALY", mIoU: 0.55, hitRate: 0.8 },
  { ko: "흉수 의심", en: "PLEURAL EFFUSION", mIoU: 0.66, hitRate: 0.9 },
  { ko: "폐 병변 의심", en: "LUNG LESION", mIoU: 0.44, hitRate: 0.71 },
];

/* Tool catalogue for the agent right rail (counts come from the demo store) */
export const agentTools: {
  name: "흉부 영상 분석" | "문헌 검색" | "임상 정보 분석" | "웹 검색";
  desc: string;
  calls: number;
  state: "완료" | "대기";
}[] = [
  { name: "흉부 영상 분석", desc: "근거 영역 감지 · 히트맵", calls: 2, state: "완료" },
  { name: "문헌 검색", desc: "가이드라인 · 논문 · 사례", calls: 3, state: "완료" },
  { name: "임상 정보 분석", desc: "증상 · 활력징후 기여도", calls: 1, state: "완료" },
  { name: "웹 검색", desc: "최신 자료 보강", calls: 0, state: "대기" },
];

export type SourceGrade = "가이드라인" | "논문" | "유사 사례";

/* Retrieval pipeline, doctor-friendly naming */
export const retrievalStages = [
  { n: "01", name: "질문 해석", desc: "진단 맥락에서 검색 질문 생성", result: "질문 3건" },
  { n: "02", name: "의미 + 키워드 결합 검색", desc: "문헌 12,480건 색인에서 후보 확보", result: "후보 50건" },
  { n: "03", name: "정밀 재정렬", desc: "질문과의 근거 적합도 순 재배열", result: "상위 5건" },
  { n: "04", name: "근거 충분성 점검", desc: "부족 시 웹 검색으로 보강", result: "통과" },
];

/* Worklist (dashboard) */
export type WorkItem = {
  id: string;
  patient: string;
  study: string;
  finding: string;
  score: number;
  level: Level;
  status: string;
  time: string;
  selected?: boolean;
};

export const kpis = [
  { label: "판독 대기", value: "7", unit: "건", delta: "+2", deltaTone: "warning" as const, caption: "오늘 09:40 기준" },
  { label: "오늘 판독 완료", value: "23", unit: "건", delta: "+18%", deltaTone: "ok" as const, caption: "어제 같은 시간 대비" },
  { label: "우선 확인", value: "2", unit: "건", delta: "신규 1", deltaTone: "critical" as const, caption: "높은 확률 소견 감지" },
  { label: "평균 판독 시간", value: "4.2", unit: "분", delta: "-0.8분", deltaTone: "ok" as const, caption: "최근 7일 평균" },
];

/* Agent chat transcript */
export type ChatCitation = { n?: number; kind: "paper" | "image"; label: string };
export type AgentStep = { name: string; state: "done" | "active" | "waiting"; tool?: string; detail?: string };
export type ChatMsg =
  | { role: "user"; text: string; time: string }
  | {
      role: "agent";
      time: string;
      receipt?: string;
      steps?: AgentStep[];
      streaming?: boolean;
      blocks: AgentBlock[];
      followups?: string[];
    };

export type AgentBlock =
  | { type: "p"; text: string; cites?: ChatCitation[] }
  | {
      type: "ddx";
      buckets: {
        title: string;
        tone: Level;
        items: { name: string; reason: string; cites?: ChatCitation[] }[];
      }[];
    }
  | { type: "checklist"; title: string; items: string[] };

export const chatStarters = [
  "이 검사의 근거 영역을 설명해 주세요",
  "8mm 폐결절의 추적 관찰 기준은?",
  "과거 영상과 비교해 주세요",
  "폐렴 외래 치료 기준을 알려주세요",
];

export const levelText: Record<Level, string> = {
  critical: "우선 확인",
  warning: "검토 필요",
  ok: "확인 완료",
  info: "분석 중",
  neutral: "확인 대기",
};

/* ---------- back-compat: default case + default literature set ----------
 * Screens are migrating to lib/demo/store.tsx; until then the static
 * exports resolve to the hero case so nothing renders differently. */
const hero = CASES[DEFAULT_CASE_ID];
export const patient = hero.patient;
export const findings = hero.findings;
export const abnormalityScore = hero.abnormalityScore;
export const sentenceImportance = hero.sentenceImportance;
export const tokenImportance = hero.tokenImportance;
export const sources = defaultLiterature.sources;
export const reliabilityChecks = defaultLiterature.reliability;

export const worklist: WorkItem[] = [
  { id: "PX-2026-0142", patient: "여성 · 58세", study: "PA+LAT", finding: "폐렴 의심", score: 87, level: "critical", status: "우선 확인", time: "09:41", selected: true },
  { id: "PX-2026-0139", patient: "남성 · 71세", study: "PA", finding: "폐 음영 의심", score: 64, level: "warning", status: "검토 필요", time: "09:12" },
  { id: "PX-2026-0137", patient: "여성 · 44세", study: "PA", finding: "유의 소견 미검출", score: 12, level: "neutral", status: "확인 대기", time: "08:55" },
  { id: "PX-2026-0131", patient: "남성 · 63세", study: "PA+LAT", finding: "심비대 의심", score: 58, level: "warning", status: "검토 필요", time: "08:33" },
  { id: "PX-2026-0128", patient: "여성 · 67세", study: "PA", finding: "흉수 의심", score: 71, level: "warning", status: "검토 필요", time: "08:10" },
  { id: "PX-2026-0125", patient: "남성 · 52세", study: "PA", finding: "분석 중", score: -1, level: "info", status: "분석 중", time: "08:02" },
];

export const chat: ChatMsg[] = [
  {
    role: "user",
    time: "09:44",
    text: "우하엽 음영, 폐렴으로 봐도 될까요? 다른 가능성도 함께 정리해 주세요.",
  },
  {
    role: "agent",
    time: "09:44",
    receipt: "5단계 실행 · 문헌 3편 인용 · 12초",
    blocks: [
      {
        type: "p",
        text: "우하엽 폐포성 음영과 마른기침·미열(37.8도) 경과를 종합하면 지역사회획득 폐렴 가능성이 가장 높습니다. 근거 영역이 실제 음영 위치와 일치하며, 아래 순서로 감별을 제안합니다.",
        cites: [
          { n: 1, kind: "paper", label: "가이드라인" },
          { kind: "image", label: "영상" },
        ],
      },
      {
        type: "ddx",
        buckets: [
          {
            title: "가장 유력",
            tone: "critical",
            items: [
              {
                name: "폐렴 47%",
                reason: "우하엽 음영 + 발열·기침, 근거 위치 일치도 높음",
                cites: [{ n: 1, kind: "paper", label: "1" }, { kind: "image", label: "영상" }],
              },
            ],
          },
          {
            title: "확장 감별",
            tone: "warning",
            items: [
              {
                name: "무기폐 37%",
                reason: "좌하엽 경계 선상 이동 여부 확인 필요 — 부피 감소 동반 시 무기폐 우선",
                cites: [{ n: 3, kind: "paper", label: "3" }],
              },
            ],
          },
          {
            title: "놓치면 안 됨",
            tone: "info",
            items: [
              {
                name: "흉수 동반",
                reason: "늑골횡격막각 무딤이 경미하게 관찰 — 측와위 촬영으로 배제 권장",
                cites: [{ n: 2, kind: "paper", label: "2" }],
              },
            ],
          },
        ],
      },
      {
        type: "checklist",
        title: "추가 확인 제안",
        items: ["혈액검사 · 염증 수치(CRP) 확인", "공기기관지음영 유무 재검토", "과거 영상과 비교 판독"],
      },
    ],
    followups: ["외래 치료 가능한 중증도인가요?", "과거 영상과 비교해 주세요"],
  },
  {
    role: "user",
    time: "09:47",
    text: "폐렴이면 외래 치료 가능한 중증도인지 판단 기준을 알려주세요.",
  },
  {
    role: "agent",
    time: "09:47",
    streaming: true,
    steps: [
      { name: "질문 이해 완료", state: "done" },
      { name: "진료 가이드라인 검색 중", state: "active" },
    ],
    blocks: [],
  },
];
