/*
 * Mock clinical data + shared copy.
 * Mirrors the report's system (multi-label chest X-ray classification,
 * Grad-CAM/Eigen-CAM evidence, diagnosis agent, literature RAG) but every
 * user-facing string follows DESIGN.md copy rules: doctors are the users,
 * AI "감지·제안" / physician "확인·판독", integer probabilities, no
 * engineering jargon. Realistic but synthetic.
 */

export type Level = "critical" | "warning" | "ok" | "info" | "neutral";

export const MODEL_STAMP = "CXR-Net v2.4 · 2026-07-13 09:41";

export const patient = {
  id: "PX-2026-0142",
  masked: "KIM, S** · F/58",
  name: "김성** · 여성 · 58세",
  study: "CHEST PA · 2026-07-13 09:41",
  studyKo: "흉부 X-ray 정면·측면",
  accession: "ACC 20260713-0042",
  view: "PA + LAT",
  spo2: 95,
  temp: 37.8,
  hr: 96,
  rr: 20,
  bp: "138/84",
  smoking: "비흡연",
  symptoms: ["마른기침", "미열", "흉부 불편감", "3일 지속"],
  note: "3일 전부터 마른기침과 미열 지속. 고혈압 과거력. 흉부 불편감 호소.",
};

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

export const findings: Finding[] = [
  { ko: "폐렴 의심", en: "PNEUMONIA", prob: 0.47, threshold: 0.32, level: "critical", loc: { x: 0.3, y: 0.74 }, note: "우하엽 음영 집중" },
  { ko: "폐 음영 의심", en: "LUNG OPACITY", prob: 0.43, threshold: 0.35, level: "warning", loc: { x: 0.42, y: 0.66 }, note: "양측 하부 분포" },
  { ko: "무기폐 의심", en: "ATELECTASIS", prob: 0.37, threshold: 0.34, level: "warning", loc: { x: 0.68, y: 0.7 }, note: "좌하엽 경계" },
  { ko: "심비대 의심", en: "CARDIOMEGALY", prob: 0.34, threshold: 0.4, level: "neutral", loc: { x: 0.55, y: 0.62 }, note: "심흉곽비 경계역" },
  { ko: "폐 병변", en: "LUNG LESION", prob: 0.29, threshold: 0.38, level: "neutral", loc: { x: 0.33, y: 0.4 }, note: "국소 소견 낮음" },
  { ko: "흉수", en: "PLEURAL EFFUSION", prob: 0.27, threshold: 0.36, level: "neutral", loc: { x: 0.26, y: 0.85 }, note: "늑골횡격막각 무딤 경미" },
  { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.08, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
  { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.12, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
];

export const abnormalityScore = 87; // hero score, 0-100

/* Clinical text contribution (language-model path) */
export const sentenceImportance = [
  { text: "3일 전부터 마른기침과 미열 지속", weight: 0.79 },
  { text: "흉부 불편감 호소", weight: 0.52 },
  { text: "산소포화도 95% · 체온 37.8도", weight: 0.46 },
  { text: "고혈압 과거력", weight: 0.24 },
];

export const tokenImportance = [
  { token: "마른기침", weight: 0.82 },
  { token: "미열", weight: 0.71 },
  { token: "3일 지속", weight: 0.63 },
  { token: "산소포화도 95%", weight: 0.58 },
  { token: "흉부 불편감", weight: 0.44 },
  { token: "고혈압 과거력", weight: 0.29 },
];

/* Localization agreement (CheXlocalize protocol) */
export const localizationMetrics = [
  { ko: "폐렴 의심", en: "PNEUMONIA", mIoU: 0.61, hitRate: 0.88 },
  { ko: "폐 음영 의심", en: "LUNG OPACITY", mIoU: 0.57, hitRate: 0.83 },
  { ko: "무기폐 의심", en: "ATELECTASIS", mIoU: 0.49, hitRate: 0.74 },
  { ko: "심비대 의심", en: "CARDIOMEGALY", mIoU: 0.55, hitRate: 0.8 },
];

/* Diagnosis-agent working steps (doctor-facing names, no pipeline jargon) */
export type StepStatus = "done" | "active" | "waiting";
export const agentSteps: { name: string; detail: string; status: StepStatus }[] = [
  { name: "질문 이해", detail: "영상 1건과 임상 정보가 포함된 판독 지원 요청으로 파악", status: "done" },
  { name: "작업 계획", detail: "소견 분석 · 근거 확인 · 문헌 검색 세 갈래로 계획", status: "done" },
  { name: "흉부 영상 분석", detail: "근거 영역 2곳 감지 — 우하엽 음영 집중", status: "done" },
  { name: "문헌 검색", detail: "진료 가이드라인 1건 · 논문 1건 · 유사 사례 1건 확보", status: "done" },
  { name: "근거 통합", detail: "소견별 확신도 정리, 상충 근거 조정 후 종합 소견 작성", status: "done" },
];

export const agentTools = [
  { name: "흉부 영상 분석", desc: "근거 영역 감지 · 히트맵", calls: 2, state: "완료" as const },
  { name: "문헌 검색", desc: "가이드라인 · 논문 · 사례", calls: 3, state: "완료" as const },
  { name: "임상 정보 분석", desc: "증상 · 활력징후 기여도", calls: 1, state: "완료" as const },
  { name: "웹 검색", desc: "최신 자료 보강", calls: 0, state: "대기" as const },
];

/* Literature sources with evidence grades */
export type SourceGrade = "가이드라인" | "논문" | "유사 사례";
export const sources: {
  n: number;
  title: string;
  source: string;
  grade: SourceGrade;
  year: number;
  relevance: number;
  snippet: string;
}[] = [
  {
    n: 1,
    title: "Community-acquired pneumonia in adults: diagnosis and management",
    source: "PubMed · PMID 34556789",
    grade: "가이드라인",
    year: 2024,
    relevance: 0.94,
    snippet:
      "우하엽 폐포성 음영과 발열·기침 동반 시 세균성 지역사회획득 폐렴을 우선 감별하며, 혈액검사와 염증 수치로 보강한다.",
  },
  {
    n: 2,
    title: "Deep learning for chest radiograph interpretation: external validation",
    source: "PMC · PMCID 8123456",
    grade: "논문",
    year: 2023,
    relevance: 0.89,
    snippet:
      "판독자 간 일치도가 낮은 소견에서는 확률 보정과 근거 위치 일치도(mIoU)를 함께 보고할 때 임상 신뢰도가 높아진다.",
  },
  {
    n: 3,
    title: "무기폐와 폐렴 음영의 영상 감별 — 좌하엽 사례",
    source: "원내 유사 사례 · C-4471",
    grade: "유사 사례",
    year: 2025,
    relevance: 0.81,
    snippet:
      "경계가 선상으로 이동하고 부피 감소가 보이면 무기폐를, 공기기관지음영을 동반하면 폐렴을 시사한다.",
  },
];

/* Retrieval pipeline, doctor-friendly naming */
export const retrievalStages = [
  { n: "01", name: "질문 해석", desc: "진단 맥락에서 검색 질문 3개 생성", result: "질문 3건" },
  { n: "02", name: "의미 + 키워드 결합 검색", desc: "문헌 12,480건 색인에서 후보 확보", result: "후보 50건" },
  { n: "03", name: "정밀 재정렬", desc: "질문과의 근거 적합도 순 재배열", result: "상위 5건" },
  { n: "04", name: "근거 충분성 점검", desc: "부족 시 웹 검색으로 보강", result: "통과" },
];

export const reliabilityChecks = [
  { ko: "검색 관련성", en: "RELEVANCE", v: 0.91 },
  { ko: "추론 일관성", en: "CONSISTENCY", v: 0.87 },
  { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.94 },
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

export const worklist: WorkItem[] = [
  { id: "PX-2026-0142", patient: "여성 · 58세", study: "PA+LAT", finding: "폐렴 의심", score: 87, level: "critical", status: "우선 확인", time: "09:41", selected: true },
  { id: "PX-2026-0139", patient: "남성 · 71세", study: "PA", finding: "폐 음영 의심", score: 64, level: "warning", status: "검토 필요", time: "09:12" },
  { id: "PX-2026-0137", patient: "여성 · 44세", study: "PA", finding: "유의 소견 미검출", score: 12, level: "neutral", status: "확인 대기", time: "08:55" },
  { id: "PX-2026-0131", patient: "남성 · 63세", study: "PA+LAT", finding: "심비대 의심", score: 58, level: "warning", status: "검토 필요", time: "08:33" },
  { id: "PX-2026-0128", patient: "여성 · 67세", study: "PA", finding: "흉수 의심", score: 71, level: "warning", status: "검토 필요", time: "08:10" },
  { id: "PX-2026-0125", patient: "남성 · 52세", study: "PA", finding: "분석 중", score: -1, level: "info", status: "분석 중", time: "08:02" },
];

export const kpis = [
  { label: "판독 대기", value: "7", unit: "건", delta: "+2", deltaTone: "warning" as const, caption: "오늘 09:40 기준" },
  { label: "오늘 판독 완료", value: "23", unit: "건", delta: "+18%", deltaTone: "ok" as const, caption: "어제 같은 시간 대비" },
  { label: "우선 확인", value: "2", unit: "건", delta: "신규 1", deltaTone: "critical" as const, caption: "높은 확률 소견 감지" },
  { label: "평균 판독 시간", value: "4.2", unit: "분", delta: "-0.8분", deltaTone: "ok" as const, caption: "최근 7일 평균" },
];

/* Agent chat transcript */
export type ChatCitation = { n?: number; kind: "paper" | "image"; label: string };
export type ChatMsg =
  | { role: "user"; text: string; time: string }
  | {
      role: "agent";
      time: string;
      receipt?: string;
      steps?: { name: string; state: "done" | "active" }[];
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
