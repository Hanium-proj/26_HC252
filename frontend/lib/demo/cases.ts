/*
 * Per-case mock datasets for the demo. One entry per worklist row so any
 * row the presenter clicks resolves to a full patient + findings + evidence
 * bundle. Copy rules follow DESIGN.md (AI "의심·감지", integer %, no
 * engineering jargon). Inline markup (`**`, `[1]`, `[영상]`) renders via
 * components/rich.tsx.
 *
 * Coordinates: `loc` is 0-1 in lung-map space (locator glyph);
 * `regions` are in the 400x500 film space used by components/film.tsx
 * (patient right = viewer left).
 */

import type { Level, Finding } from "@/lib/data";

export type Region = { cx: number; cy: number; rx: number; ry: number; w: number };

/* Real model output for a study: base film plus pre-rendered CAM layers.
   Cases without this fall back to the sample film + drawn overlays. */
export type CaseImages = {
  pa: string;
  gradcam?: string;
  eigencam?: string;
  mask?: string;
  view?: "pa" | "ap";
};

export type Patient = {
  id: string;
  masked: string;
  name: string;
  study: string;
  studyKo: string;
  accession: string;
  view: string;
  ageSex: string;
  spo2: number;
  temp: number;
  hr: number;
  rr: number;
  bp: string;
  smoking: string;
  symptoms: string[];
  note: string;
  file: { name: string; size: string };
};

export type CaseData = {
  id: string;
  patient: Patient;
  /* worklist row after analysis */
  row: { patient: string; study: string; finding: string; score: number; level: Level; status: string; time: string };
  chip: string;
  findings: Finding[];
  abnormalityScore: number;
  summary: {
    lead: string;
    rows: { k: string; note: string; tone: Level }[];
    callout: string;
    calloutLevel: Level;
  };
  agentSummary: string;
  sentenceImportance: { text: string; weight: number }[];
  tokenImportance: { token: string; weight: number }[];
  /* evidence regions per finding (en key). Missing key = nothing detected */
  regions: Record<string, Region[]>;
  literatureQuery: string;
  images?: CaseImages;
  starters?: string[];
  /* prior study for the comparison slot. undefined = same film rendered as
     an older exposure; null = no prior on record (first visit) */
  prior?: { src?: string; date: string } | null;
};

export const DEFAULT_CASE_ID = "PX-2026-0142";

/* Cases that arrive already analyzed. PX-2026-0125 is "분석 중" until run. */
export const INITIAL_ANALYZED: Record<string, boolean> = {
  "PX-2026-0142": true,
  "PX-2026-0139": true,
  "PX-2026-0137": true,
  "PX-2026-0131": true,
  "PX-2026-0128": true,
  "PX-2026-0125": false,
};

export const WORKLIST_ORDER = [
  "PX-2026-0142",
  "PX-2026-0139",
  "PX-2026-0137",
  "PX-2026-0131",
  "PX-2026-0128",
  "PX-2026-0125",
];

const c0142: CaseData = {
  id: "PX-2026-0142",
  patient: {
    id: "PX-2026-0142",
    masked: "KIM, S** · M/62",
    name: "김성** · 남성 · 62세",
    study: "CHEST AP · 2026-07-13 09:41",
    studyKo: "흉부 X-ray 이동식 AP",
    accession: "ACC 20260713-0042",
    view: "AP",
    ageSex: "62세 · 남성",
    spo2: 89,
    temp: 37.1,
    hr: 118,
    rr: 26,
    bp: "96/58",
    smoking: "흡연 30갑년",
    symptoms: ["산소포화도 급락", "우측 호흡음 감소", "기계환기 3일째", "중환자실"],
    note: "COPD 급성 악화로 중환자실 기계환기 3일째. 오늘 09시 갑작스러운 산소포화도 저하와 우측 호흡음 감소. 이동식 앙와위 촬영.",
    file: { name: "chest_ap_0142.dcm", size: "2.0 MB" },
  },
  row: { patient: "남성 · 62세", study: "AP", finding: "기흉 의심", score: 86, level: "critical", status: "우선 확인", time: "09:41" },
  chip: "기흉 의심 80%",
  findings: [
    { ko: "기흉 의심", en: "PNEUMOTHORAX", prob: 0.8, threshold: 0.3, level: "critical", loc: { x: 0.24, y: 0.3 }, note: "우측 첨부 흉막선 · 심부 고랑 징후" },
    { ko: "폐 음영 의심", en: "LUNG OPACITY", prob: 0.44, threshold: 0.35, level: "warning", loc: { x: 0.3, y: 0.7 }, note: "우하부 허탈 관련 음영" },
    { ko: "무기폐 의심", en: "ATELECTASIS", prob: 0.39, threshold: 0.34, level: "warning", loc: { x: 0.3, y: 0.62 }, note: "우측 부분 허탈" },
    { ko: "흉수", en: "PLEURAL EFFUSION", prob: 0.31, threshold: 0.36, level: "neutral", loc: { x: 0.26, y: 0.85 }, note: "우측 늑골횡격막각 경미" },
    { ko: "심비대", en: "CARDIOMEGALY", prob: 0.28, threshold: 0.4, level: "neutral", loc: { x: 0.55, y: 0.62 }, note: "AP 확대 감안 시 정상 범위" },
    { ko: "폐렴", en: "PNEUMONIA", prob: 0.24, threshold: 0.32, level: "neutral", loc: { x: 0.3, y: 0.74 }, note: "발열 없음" },
    { ko: "폐 병변", en: "LUNG LESION", prob: 0.11, threshold: 0.38, level: "neutral", loc: { x: 0.33, y: 0.4 }, note: "근거 미약" },
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.06, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
  ],
  abnormalityScore: 86,
  summary: {
    lead:
      "62세 남성의 이동식 흉부 X-ray와 임상 정보를 종합한 결과 **기흉 의심(80%)**이 최상위 소견입니다. 우측 첨부 흉막선과 심부 고랑 징후, 기계환기 중 갑작스러운 산소포화도 저하 경과가 판단에 주로 기여했으며, **폐 음영(44%) · 무기폐(39%)**가 동반 소견으로 남습니다.",
    rows: [
      { k: "기흉 의심", note: "영상·임상 근거 일치", tone: "critical" },
      { k: "폐 음영 의심", note: "우하부 허탈 관련", tone: "warning" },
      { k: "무기폐 의심", note: "우측 부분 허탈", tone: "warning" },
    ],
    callout: "기계환기 중 기흉은 긴장성으로 진행할 수 있습니다. 종격동 편위 여부를 즉시 확인하고 임상팀에 알리세요.",
    calloutLevel: "critical",
  },
  agentSummary:
    "우측 첨부 흉막선과 심부 고랑 징후, 기계환기 중 갑작스러운 산소포화도 저하·우측 호흡음 감소를 종합하면 **기흉** 가능성이 가장 높습니다[1][영상]. 긴장성 진행 위험이 있어 **즉시 판독**을 권고합니다.",
  sentenceImportance: [
    { text: "갑작스러운 산소포화도 저하와 우측 호흡음 감소", weight: 0.91 },
    { text: "중환자실 기계환기 3일째", weight: 0.7 },
    { text: "COPD 급성 악화", weight: 0.55 },
    { text: "이동식 앙와위 촬영", weight: 0.2 },
  ],
  tokenImportance: [
    { token: "호흡음 감소", weight: 0.9 },
    { token: "산소포화도 저하", weight: 0.86 },
    { token: "기계환기", weight: 0.72 },
    { token: "COPD", weight: 0.56 },
    { token: "혈압 96/58", weight: 0.48 },
    { token: "앙와위", weight: 0.2 },
  ],
  /* hotspots measured from the model's masked Grad-CAM (film space) */
  regions: {
    PNEUMOTHORAX: [
      { cx: 160, cy: 84, rx: 42, ry: 30, w: 0.92 },
      { cx: 108, cy: 272, rx: 58, ry: 42, w: 0.96 },
    ],
    "LUNG OPACITY": [{ cx: 116, cy: 280, rx: 54, ry: 40, w: 0.7 }],
    ATELECTASIS: [{ cx: 120, cy: 262, rx: 50, ry: 46, w: 0.66 }],
    "PLEURAL EFFUSION": [{ cx: 110, cy: 318, rx: 52, ry: 24, w: 0.5 }],
  },
  literatureQuery: "기계환기 중 갑작스러운 산소포화도 저하 · 앙와위 촬영 기흉 소견(심부 고랑 징후)과 처치 근거",
  /* real pipeline output (ViT classifier + lung segmentation + Grad-CAM / Eigen-CAM) */
  images: {
    pa: "/xray/model/0142/original.png",
    gradcam: "/xray/model/0142/gradcam-masked.png",
    eigencam: "/xray/model/0142/eigencam-masked.png",
    mask: "/xray/model/0142/lung-mask.png",
    view: "ap",
  },
  /* daily portable film from yesterday, same study rendered as an older exposure */
  prior: { date: "2026-07-12" },
  starters: [
    "기흉으로 봐도 될까요? 감별 포인트는?",
    "긴장성 기흉으로 진행할 위험은?",
    "흉관 삽입 적응증을 알려주세요",
    "이 검사의 근거 영역을 설명해 주세요",
  ],
};

const c0139: CaseData = {
  id: "PX-2026-0139",
  patient: {
    id: "PX-2026-0139",
    masked: "CHOI, D** · M/71",
    name: "최동** · 남성 · 71세",
    study: "CHEST PA · 2026-07-13 09:12",
    studyKo: "흉부 X-ray 정면",
    accession: "ACC 20260713-0038",
    view: "PA",
    ageSex: "71세 · 남성",
    spo2: 94,
    temp: 37.2,
    hr: 90,
    rr: 20,
    bp: "142/88",
    smoking: "흡연 40갑년",
    symptoms: ["가래 동반 기침", "체중 감소", "2주 지속"],
    note: "2주 전부터 가래 동반 기침, 최근 3kg 체중 감소. 40갑년 흡연력. COPD 진단력.",
    file: { name: "chest_pa_0139.dcm", size: "1.5 MB" },
  },
  row: { patient: "남성 · 71세", study: "PA", finding: "폐 음영 의심", score: 64, level: "warning", status: "검토 필요", time: "09:12" },
  chip: "폐 음영 의심 64%",
  findings: [
    { ko: "폐 음영 의심", en: "LUNG OPACITY", prob: 0.64, threshold: 0.35, level: "warning", loc: { x: 0.68, y: 0.42 }, note: "좌상엽 국소 음영" },
    { ko: "폐 병변 의심", en: "LUNG LESION", prob: 0.52, threshold: 0.38, level: "warning", loc: { x: 0.7, y: 0.4 }, note: "결절성 음영 가능" },
    { ko: "폐렴 의심", en: "PNEUMONIA", prob: 0.31, threshold: 0.32, level: "neutral", loc: { x: 0.66, y: 0.45 }, note: "임계값 경계" },
    { ko: "심비대", en: "CARDIOMEGALY", prob: 0.28, threshold: 0.4, level: "neutral", loc: { x: 0.55, y: 0.62 }, note: "정상 범위" },
    { ko: "무기폐", en: "ATELECTASIS", prob: 0.24, threshold: 0.34, level: "neutral", loc: { x: 0.68, y: 0.7 }, note: "근거 미약" },
    { ko: "흉수", en: "PLEURAL EFFUSION", prob: 0.12, threshold: 0.36, level: "neutral", loc: { x: 0.26, y: 0.85 }, note: "늑골횡격막각 예리" },
    { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.06, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.09, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
  ],
  abnormalityScore: 64,
  summary: {
    lead:
      "71세 남성의 흉부 X-ray와 임상 정보를 종합한 결과 **폐 음영 의심(64%)**이 최상위 소견입니다. 좌상엽 국소 음영과 흡연력·체중 감소 경과가 판단에 주로 기여했으며, **폐 병변(52%)**이 감별 대상으로 남습니다.",
    rows: [
      { k: "폐 음영 의심", note: "좌상엽 국소 분포", tone: "warning" },
      { k: "폐 병변 의심", note: "결절성 음영 가능", tone: "warning" },
      { k: "폐렴 의심", note: "임계값 경계", tone: "neutral" },
    ],
    callout: "40갑년 흡연력과 체중 감소가 동반된 국소 음영입니다. 흉부 CT로 추가 평가를 권고합니다.",
    calloutLevel: "warning",
  },
  agentSummary:
    "좌상엽 국소 음영과 40갑년 흡연력·체중 감소를 종합하면 **폐 병변 감별**이 우선입니다[2][영상]. 단순 촬영만으로는 감별이 어려워 **흉부 CT**를 권고합니다.",
  sentenceImportance: [
    { text: "최근 3kg 체중 감소", weight: 0.81 },
    { text: "40갑년 흡연력", weight: 0.77 },
    { text: "2주 전부터 가래 동반 기침", weight: 0.58 },
    { text: "COPD 진단력", weight: 0.35 },
  ],
  tokenImportance: [
    { token: "체중 감소", weight: 0.83 },
    { token: "흡연력", weight: 0.78 },
    { token: "가래", weight: 0.6 },
    { token: "COPD", weight: 0.37 },
    { token: "2주 지속", weight: 0.3 },
  ],
  regions: {
    "LUNG OPACITY": [{ cx: 272, cy: 200, rx: 44, ry: 40, w: 0.92 }],
    "LUNG LESION": [{ cx: 278, cy: 196, rx: 26, ry: 24, w: 0.7 }],
    PNEUMONIA: [{ cx: 266, cy: 214, rx: 40, ry: 36, w: 0.5 }],
  },
  literatureQuery: "좌상엽 국소 음영 · 흡연력 동반 성인, 폐 병변 감별과 CT 추가 평가 근거",
};

const c0137: CaseData = {
  id: "PX-2026-0137",
  patient: {
    id: "PX-2026-0137",
    masked: "LEE, H** · F/44",
    name: "이현** · 여성 · 44세",
    study: "CHEST PA · 2026-07-13 08:55",
    studyKo: "흉부 X-ray 정면",
    accession: "ACC 20260713-0026",
    view: "PA",
    ageSex: "44세 · 여성",
    spo2: 98,
    temp: 36.5,
    hr: 72,
    rr: 16,
    bp: "118/76",
    smoking: "비흡연",
    symptoms: ["건강검진", "무증상"],
    note: "직장 건강검진 흉부 촬영. 특이 증상 없음. 과거력 없음.",
    file: { name: "chest_pa_0137.dcm", size: "1.4 MB" },
  },
  row: { patient: "여성 · 44세", study: "PA", finding: "유의 소견 미검출", score: 12, level: "neutral", status: "확인 대기", time: "08:55" },
  chip: "유의 소견 미검출",
  findings: [
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.88, threshold: 0.5, level: "ok", note: "판독의 확인 필요" },
    { ko: "심비대", en: "CARDIOMEGALY", prob: 0.14, threshold: 0.4, level: "neutral", loc: { x: 0.55, y: 0.62 }, note: "정상 범위" },
    { ko: "폐 음영", en: "LUNG OPACITY", prob: 0.11, threshold: 0.35, level: "neutral", loc: { x: 0.42, y: 0.66 }, note: "근거 미약" },
    { ko: "무기폐", en: "ATELECTASIS", prob: 0.09, threshold: 0.34, level: "neutral", loc: { x: 0.68, y: 0.7 }, note: "근거 미약" },
    { ko: "폐 병변", en: "LUNG LESION", prob: 0.07, threshold: 0.38, level: "neutral", loc: { x: 0.33, y: 0.4 }, note: "근거 미약" },
    { ko: "흉수", en: "PLEURAL EFFUSION", prob: 0.05, threshold: 0.36, level: "neutral", loc: { x: 0.26, y: 0.85 }, note: "늑골횡격막각 예리" },
    { ko: "폐렴", en: "PNEUMONIA", prob: 0.04, threshold: 0.32, level: "neutral", loc: { x: 0.3, y: 0.74 }, note: "근거 미약" },
    { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.02, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
  ],
  abnormalityScore: 12,
  summary: {
    lead:
      "44세 여성의 건강검진 흉부 X-ray에서 **유의 소견이 검출되지 않았습니다**(이상 소견 지표 12). 모든 소견이 운영 임계값 미만이며, 임상 정보에도 판단을 바꿀 요소가 없습니다.",
    rows: [
      { k: "유의 소견 미검출", note: "전 소견 임계값 미만", tone: "ok" },
      { k: "심비대 14%", note: "심흉곽비 정상 범위", tone: "neutral" },
    ],
    callout: "AI는 이상 소견을 감지하지 못했습니다. 최종 확인은 판독의가 진행합니다.",
    calloutLevel: "ok",
  },
  agentSummary:
    "영상과 임상 정보 모두에서 **유의 소견이 검출되지 않았습니다**[영상]. 정기 검진 주기 유지를 제안하며, 최종 확인은 **판독의**가 진행합니다.",
  sentenceImportance: [
    { text: "직장 건강검진 흉부 촬영", weight: 0.41 },
    { text: "특이 증상 없음", weight: 0.38 },
    { text: "과거력 없음", weight: 0.22 },
  ],
  tokenImportance: [
    { token: "건강검진", weight: 0.44 },
    { token: "무증상", weight: 0.4 },
    { token: "과거력 없음", weight: 0.24 },
  ],
  regions: {},
  literatureQuery: "무증상 성인 건강검진 흉부 X-ray, 정상 판독 기준과 추적 권고 근거",
};

const c0131: CaseData = {
  id: "PX-2026-0131",
  patient: {
    id: "PX-2026-0131",
    masked: "JUNG, M** · M/63",
    name: "정민** · 남성 · 63세",
    study: "CHEST PA · 2026-07-13 08:33",
    studyKo: "흉부 X-ray 정면·측면",
    accession: "ACC 20260713-0022",
    view: "PA + LAT",
    ageSex: "63세 · 남성",
    spo2: 96,
    temp: 36.7,
    hr: 84,
    rr: 18,
    bp: "156/96",
    smoking: "비흡연",
    symptoms: ["운동 시 호흡곤란", "피로감", "1개월 지속"],
    note: "1개월 전부터 운동 시 호흡곤란과 피로감. 고혈압 10년. 당뇨 과거력.",
    file: { name: "chest_pa_0131.dcm", size: "1.8 MB" },
  },
  row: { patient: "남성 · 63세", study: "PA+LAT", finding: "심비대 의심", score: 58, level: "warning", status: "검토 필요", time: "08:33" },
  chip: "심비대 의심 58%",
  findings: [
    { ko: "심비대 의심", en: "CARDIOMEGALY", prob: 0.58, threshold: 0.4, level: "warning", loc: { x: 0.55, y: 0.62 }, note: "심흉곽비 0.55" },
    { ko: "폐 음영", en: "LUNG OPACITY", prob: 0.27, threshold: 0.35, level: "neutral", loc: { x: 0.42, y: 0.66 }, note: "혈관 음영 경미 증가" },
    { ko: "흉수", en: "PLEURAL EFFUSION", prob: 0.21, threshold: 0.36, level: "neutral", loc: { x: 0.26, y: 0.85 }, note: "늑골횡격막각 예리" },
    { ko: "무기폐", en: "ATELECTASIS", prob: 0.18, threshold: 0.34, level: "neutral", loc: { x: 0.68, y: 0.7 }, note: "근거 미약" },
    { ko: "폐렴", en: "PNEUMONIA", prob: 0.12, threshold: 0.32, level: "neutral", loc: { x: 0.3, y: 0.74 }, note: "근거 미약" },
    { ko: "폐 병변", en: "LUNG LESION", prob: 0.1, threshold: 0.38, level: "neutral", loc: { x: 0.33, y: 0.4 }, note: "근거 미약" },
    { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.04, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.16, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
  ],
  abnormalityScore: 58,
  summary: {
    lead:
      "63세 남성의 흉부 X-ray와 임상 정보를 종합한 결과 **심비대 의심(58%)**이 최상위 소견입니다. 심흉곽비 0.55와 고혈압·호흡곤란 경과가 판단에 주로 기여했으며, 폐 실질 소견은 모두 임계값 미만입니다.",
    rows: [
      { k: "심비대 의심", note: "심흉곽비 0.55", tone: "warning" },
      { k: "폐 음영 27%", note: "혈관 음영 경미", tone: "neutral" },
    ],
    callout: "고혈압 10년 병력을 고려하면 좌심실 비대 가능성이 있습니다. 심전도·심초음파 결과를 함께 확인하세요.",
    calloutLevel: "info",
  },
  agentSummary:
    "심흉곽비 0.55와 고혈압 10년 병력을 종합하면 **고혈압성 심장 변화** 가능성이 가장 높습니다[1][영상]. 확진을 위해 **심초음파**를 권고합니다.",
  sentenceImportance: [
    { text: "고혈압 10년", weight: 0.72 },
    { text: "1개월 전부터 운동 시 호흡곤란과 피로감", weight: 0.64 },
    { text: "혈압 156/96", weight: 0.49 },
    { text: "당뇨 과거력", weight: 0.31 },
  ],
  tokenImportance: [
    { token: "고혈압", weight: 0.74 },
    { token: "호흡곤란", weight: 0.66 },
    { token: "혈압 156/96", weight: 0.5 },
    { token: "피로감", weight: 0.42 },
    { token: "당뇨", weight: 0.33 },
  ],
  regions: {
    CARDIOMEGALY: [{ cx: 212, cy: 318, rx: 76, ry: 64, w: 0.88 }],
    "LUNG OPACITY": [{ cx: 150, cy: 300, rx: 40, ry: 36, w: 0.45 }],
  },
  literatureQuery: "심흉곽비 증가 · 고혈압 병력 성인, 심비대 판독 기준과 심초음파 의뢰 근거",
};

const c0128: CaseData = {
  id: "PX-2026-0128",
  patient: {
    id: "PX-2026-0128",
    masked: "PARK, J** · F/67",
    name: "박정** · 여성 · 67세",
    study: "CHEST PA · 2026-07-13 08:10",
    studyKo: "흉부 X-ray 정면",
    accession: "ACC 20260713-0031",
    view: "PA",
    ageSex: "67세 · 여성",
    spo2: 93,
    temp: 36.9,
    hr: 88,
    rr: 22,
    bp: "150/92",
    smoking: "비흡연",
    symptoms: ["호흡곤란", "하지 부종", "야간 기침", "1주 지속"],
    note: "1주 전부터 운동 시 호흡곤란과 하지 부종. 심부전 과거력. 야간 기침 호소.",
    file: { name: "chest_pa_0128.dcm", size: "1.6 MB" },
  },
  row: { patient: "여성 · 67세", study: "PA", finding: "흉수 의심", score: 71, level: "warning", status: "검토 필요", time: "08:10" },
  chip: "흉수 의심 71%",
  findings: [
    { ko: "흉수 의심", en: "PLEURAL EFFUSION", prob: 0.71, threshold: 0.36, level: "warning", loc: { x: 0.26, y: 0.85 }, note: "우측 늑골횡격막각 둔화" },
    { ko: "심비대 의심", en: "CARDIOMEGALY", prob: 0.58, threshold: 0.4, level: "warning", loc: { x: 0.55, y: 0.62 }, note: "심흉곽비 0.56" },
    { ko: "폐 음영 의심", en: "LUNG OPACITY", prob: 0.36, threshold: 0.35, level: "warning", loc: { x: 0.3, y: 0.7 }, note: "우하부 음영" },
    { ko: "무기폐", en: "ATELECTASIS", prob: 0.31, threshold: 0.34, level: "neutral", loc: { x: 0.3, y: 0.78 }, note: "압박성 가능" },
    { ko: "폐렴", en: "PNEUMONIA", prob: 0.22, threshold: 0.32, level: "neutral", loc: { x: 0.3, y: 0.74 }, note: "발열 없음" },
    { ko: "폐 병변", en: "LUNG LESION", prob: 0.14, threshold: 0.38, level: "neutral", loc: { x: 0.33, y: 0.4 }, note: "근거 미약" },
    { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.05, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.06, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
  ],
  abnormalityScore: 71,
  summary: {
    lead:
      "67세 여성의 흉부 X-ray와 임상 정보를 종합한 결과 **흉수 의심(71%)**이 최상위 소견입니다. 우측 늑골횡격막각 둔화와 호흡곤란·하지 부종 경과가 판단에 주로 기여했으며, **심비대(58%)**가 동반 소견으로 확인됩니다.",
    rows: [
      { k: "흉수 의심", note: "영상·임상 근거 일치", tone: "warning" },
      { k: "심비대 의심", note: "심흉곽비 0.56", tone: "warning" },
      { k: "무기폐", note: "압박성 무기폐 가능", tone: "neutral" },
    ],
    callout: "심부전 과거력과 하지 부종을 고려하면 심인성 흉수 가능성이 높습니다. BNP·심초음파 결과를 함께 확인하세요.",
    calloutLevel: "info",
  },
  agentSummary:
    "우측 늑골횡격막각 둔화와 호흡곤란·하지 부종, 심부전 과거력을 종합하면 **심인성 흉수** 가능성이 가장 높습니다[1][영상]. 흉수량 추정을 위해 **측와위 촬영 또는 초음파**를 권고합니다.",
  sentenceImportance: [
    { text: "1주 전부터 운동 시 호흡곤란과 하지 부종", weight: 0.84 },
    { text: "심부전 과거력", weight: 0.66 },
    { text: "산소포화도 93% · 호흡수 22", weight: 0.51 },
    { text: "야간 기침 호소", weight: 0.33 },
  ],
  tokenImportance: [
    { token: "호흡곤란", weight: 0.86 },
    { token: "하지 부종", weight: 0.74 },
    { token: "심부전", weight: 0.69 },
    { token: "산소포화도 93%", weight: 0.55 },
    { token: "야간 기침", weight: 0.36 },
    { token: "1주 지속", weight: 0.31 },
  ],
  regions: {
    "PLEURAL EFFUSION": [{ cx: 112, cy: 412, rx: 62, ry: 34, w: 0.95 }],
    CARDIOMEGALY: [{ cx: 214, cy: 322, rx: 74, ry: 62, w: 0.85 }],
    "LUNG OPACITY": [{ cx: 130, cy: 340, rx: 50, ry: 42, w: 0.6 }],
    ATELECTASIS: [{ cx: 126, cy: 372, rx: 44, ry: 30, w: 0.55 }],
  },
  literatureQuery: "우측 흉수 · 심부전 병력 성인, 심인성 흉수 감별과 관리 근거",
};

const c0125: CaseData = {
  id: "PX-2026-0125",
  patient: {
    id: "PX-2026-0125",
    masked: "HAN, J** · M/68",
    name: "한지** · 남성 · 68세",
    study: "CHEST AP · 2026-07-13 08:02",
    studyKo: "흉부 X-ray 이동식 AP",
    accession: "ACC 20260713-0015",
    view: "AP",
    ageSex: "68세 · 남성",
    spo2: 88,
    temp: 36.8,
    hr: 112,
    rr: 28,
    bp: "168/98",
    smoking: "과거 흡연 (금연 10년)",
    symptoms: ["급성 호흡곤란", "야간 발작성 호흡곤란", "하지 부종", "응급실 내원"],
    note: "응급실 내원. 어젯밤부터 누우면 심해지는 호흡곤란과 하지 부종. 심부전·고혈압 과거력. 이동식 앙와위 촬영.",
    file: { name: "chest_ap_0125.dcm", size: "2.1 MB" },
  },
  row: { patient: "남성 · 68세", study: "AP", finding: "폐부종 의심", score: 84, level: "critical", status: "우선 확인", time: "08:02" },
  chip: "폐부종 의심 81%",
  findings: [
    { ko: "폐부종 의심", en: "EDEMA", prob: 0.81, threshold: 0.35, level: "critical", loc: { x: 0.36, y: 0.58 }, note: "양측 폐문부 중심 음영" },
    { ko: "심비대 의심", en: "CARDIOMEGALY", prob: 0.63, threshold: 0.4, level: "warning", loc: { x: 0.55, y: 0.62 }, note: "심흉곽비 0.58 (AP 보정)" },
    { ko: "폐 음영 의심", en: "LUNG OPACITY", prob: 0.58, threshold: 0.35, level: "warning", loc: { x: 0.4, y: 0.64 }, note: "양측 하부 분포" },
    { ko: "흉수 의심", en: "PLEURAL EFFUSION", prob: 0.41, threshold: 0.36, level: "warning", loc: { x: 0.26, y: 0.85 }, note: "우측 늑골횡격막각 둔화" },
    { ko: "폐렴", en: "PNEUMONIA", prob: 0.27, threshold: 0.32, level: "neutral", loc: { x: 0.3, y: 0.74 }, note: "발열 없음" },
    { ko: "무기폐", en: "ATELECTASIS", prob: 0.22, threshold: 0.34, level: "neutral", loc: { x: 0.68, y: 0.7 }, note: "근거 미약" },
    { ko: "기흉", en: "PNEUMOTHORAX", prob: 0.04, threshold: 0.3, level: "neutral", loc: { x: 0.72, y: 0.3 }, note: "근거 미약" },
    { ko: "유의 소견 미검출", en: "NO FINDING", prob: 0.05, threshold: 0.5, level: "neutral", note: "판독의 확인 필요" },
  ],
  abnormalityScore: 84,
  summary: {
    lead:
      "68세 남성의 이동식 흉부 X-ray와 임상 정보를 종합한 결과 **폐부종 의심(81%)**이 최상위 소견입니다. 양측 폐문부 중심 음영과 야간 발작성 호흡곤란·하지 부종 경과가 판단에 주로 기여했으며, **심비대(63%) · 흉수(41%)**가 동반 소견으로 확인됩니다.",
    rows: [
      { k: "폐부종 의심", note: "영상·임상 근거 일치", tone: "critical" },
      { k: "심비대 의심", note: "심흉곽비 0.58", tone: "warning" },
      { k: "흉수 의심", note: "우측 늑골횡격막각 둔화", tone: "warning" },
    ],
    callout: "산소포화도 88%와 빈맥이 동반된 급성 폐부종 의심 소견입니다. BNP·심초음파 결과와 함께 즉시 판독을 권고합니다.",
    calloutLevel: "warning",
  },
  agentSummary:
    "양측 폐문부 중심 음영과 심비대, 야간 발작성 호흡곤란·하지 부종을 종합하면 **심인성 폐부종** 가능성이 가장 높습니다[1][영상]. 산소포화도 88%로 **즉시 판독**을 권고합니다.",
  sentenceImportance: [
    { text: "어젯밤부터 누우면 심해지는 호흡곤란과 하지 부종", weight: 0.88 },
    { text: "심부전·고혈압 과거력", weight: 0.71 },
    { text: "산소포화도 88% · 호흡수 28", weight: 0.64 },
    { text: "이동식 앙와위 촬영", weight: 0.21 },
  ],
  tokenImportance: [
    { token: "호흡곤란", weight: 0.9 },
    { token: "하지 부종", weight: 0.76 },
    { token: "심부전", weight: 0.72 },
    { token: "산소포화도 88%", weight: 0.66 },
    { token: "누우면 심해짐", weight: 0.58 },
    { token: "앙와위", weight: 0.22 },
  ],
  /* hotspots measured from the model's masked Grad-CAM (film space) */
  regions: {
    EDEMA: [
      { cx: 142, cy: 290, rx: 48, ry: 84, w: 0.95 },
      { cx: 291, cy: 228, rx: 36, ry: 46, w: 0.82 },
    ],
    CARDIOMEGALY: [{ cx: 218, cy: 340, rx: 82, ry: 66, w: 0.72 }],
    "LUNG OPACITY": [
      { cx: 142, cy: 300, rx: 46, ry: 78, w: 0.85 },
      { cx: 291, cy: 232, rx: 34, ry: 42, w: 0.7 },
    ],
    "PLEURAL EFFUSION": [{ cx: 130, cy: 432, rx: 58, ry: 26, w: 0.55 }],
  },
  literatureQuery: "양측 폐문부 음영 · 급성 호흡곤란 성인, 심인성 폐부종 감별과 관리 근거",
  /* real pipeline output (ViT classifier + lung segmentation + Grad-CAM / Eigen-CAM) */
  images: {
    pa: "/xray/model/0125/original.png",
    gradcam: "/xray/model/0125/gradcam-masked.png",
    eigencam: "/xray/model/0125/eigencam-masked.png",
    mask: "/xray/model/0125/lung-mask.png",
    view: "ap",
  },
  prior: null,
  starters: [
    "심인성 폐부종으로 봐도 될까요? 감별 포인트는?",
    "앙와위 AP 촬영에서 보정이 필요한 소견은?",
    "이뇨제 반응 평가를 위한 재촬영 시점은?",
    "이 검사의 근거 영역을 설명해 주세요",
  ],
};

export const CASES: Record<string, CaseData> = {
  [c0142.id]: c0142,
  [c0139.id]: c0139,
  [c0137.id]: c0137,
  [c0131.id]: c0131,
  [c0128.id]: c0128,
  [c0125.id]: c0125,
};

export function getCase(id: string | null | undefined): CaseData {
  return (id && CASES[id]) || CASES[DEFAULT_CASE_ID];
}

/* Prior-comparison slot: explicit prior, or the same film as an older exposure */
export function priorOf(c: CaseData): { src: string; date: string; sameStudy: boolean } | null {
  if (c.prior === null) return null;
  const src = c.prior?.src ?? c.images?.pa ?? "/xray/pa.png";
  return { src, date: c.prior?.date ?? "2025-11", sameStudy: !c.prior?.src };
}

/* Base film + projection for the viewer (upload wins over model output) */
export function filmView(c: CaseData): "pa" | "ap" {
  return c.images?.view ?? "pa";
}

/* DICOM corner text for the film viewport */
export function filmCorners(c: CaseData) {
  const [name, sexAge] = c.patient.masked.split(" · ");
  const date = c.patient.study.split(" · ")[1] ?? "";
  return { name, sexAge, id: c.id, date, acc: c.patient.accession };
}

/* Top finding that has a location (drives the evidence default target) */
export function topFinding(c: CaseData): Finding {
  return c.findings.find((f) => f.loc) ?? c.findings[0];
}

/* Analysis progress steps shown while the mock pipeline runs */
export const analysisSteps = [
  { name: "영상 품질 확인", detail: "판독 가능 품질 · 노출·자세 점검" },
  { name: "소견 분류", detail: "14개 소견 동시 평가" },
  { name: "근거 영역 계산", detail: "Grad-CAM · Eigen-CAM 생성" },
  { name: "임상 정보 결합", detail: "증상·활력징후 기여도 반영" },
];
