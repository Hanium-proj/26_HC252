/*
 * Canned literature result sets keyed by query intent. The default
 * pneumonia set is the one already used across the mock (chat citations
 * 1-3 point at it); the others let the presenter type a different query
 * and still get a coherent, graded result list.
 */

import type { SourceGrade } from "@/lib/data";

export type Source = {
  n: number;
  title: string;
  source: string;
  grade: SourceGrade;
  year: number;
  relevance: number;
  snippet: string;
};

export type LiteratureResult = {
  key: string;
  sources: Source[];
  stageResults: [string, string, string, string];
  reliability: { ko: string; en: string; v: number }[];
  synthesis: { text: string; avg: number; adopted: number; level: "ok" | "warning" };
};

const pneumonia: LiteratureResult = {
  key: "pneumonia",
  sources: [
    {
      n: 1,
      title: "Community-acquired pneumonia in adults: diagnosis and management",
      source: "PubMed · PMID 34556789",
      grade: "가이드라인",
      year: 2024,
      relevance: 0.94,
      snippet: "우하엽 폐포성 음영과 발열·기침 동반 시 세균성 지역사회획득 폐렴을 우선 감별하며, 혈액검사와 염증 수치로 보강한다.",
    },
    {
      n: 2,
      title: "Deep learning for chest radiograph interpretation: external validation",
      source: "PMC · PMCID 8123456",
      grade: "논문",
      year: 2023,
      relevance: 0.89,
      snippet: "판독자 간 일치도가 낮은 소견에서는 확률 보정과 근거 위치 일치도(mIoU)를 함께 보고할 때 임상 신뢰도가 높아진다.",
    },
    {
      n: 3,
      title: "무기폐와 폐렴 음영의 영상 감별 — 좌하엽 사례",
      source: "원내 유사 사례 · C-4471",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.81,
      snippet: "경계가 선상으로 이동하고 부피 감소가 보이면 무기폐를, 공기기관지음영을 동반하면 폐렴을 시사한다.",
    },
  ],
  stageResults: ["질문 3건", "후보 50건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.91 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.87 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.94 },
  ],
  synthesis: { text: "3개 출처가 **폐렴 감별 방향을 일관되게 지지**합니다. 근거 충분성 점검을 통과해 웹 검색 보강 없이 답변을 구성했습니다.", avg: 0.88, adopted: 3, level: "ok" },
};

const severity: LiteratureResult = {
  key: "severity",
  sources: [
    {
      n: 1,
      title: "Diagnosis and treatment of adults with community-acquired pneumonia: ATS/IDSA guideline",
      source: "PubMed · PMID 31573350",
      grade: "가이드라인",
      year: 2019,
      relevance: 0.95,
      snippet: "외래·입원 결정에는 CURB-65 또는 PSI 같은 검증된 중증도 도구를 임상 판단과 함께 사용할 것을 권고한다.",
    },
    {
      n: 2,
      title: "CURB-65 versus PSI for predicting 30-day mortality: meta-analysis",
      source: "PMC · PMCID 6543210",
      grade: "논문",
      year: 2021,
      relevance: 0.9,
      snippet: "CURB-65 0-1점은 저위험군으로 외래 치료를 고려할 수 있으며, 2점 이상에서 입원 치료가 사망률을 낮춘다.",
    },
    {
      n: 3,
      title: "CURB-65 1점 외래 치료 후 72시간 재평가 사례",
      source: "원내 유사 사례 · C-4390",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.79,
      snippet: "외래 항생제 치료 후 72시간 재평가에서 해열과 산소포화도 회복을 확인해 입원 없이 완치한 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 44건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.93 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.9 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.95 },
  ],
  synthesis: { text: "3개 출처가 **CURB-65 기반 외래·입원 결정**을 일관되게 지지합니다. 근거 충분성 점검을 통과했습니다.", avg: 0.88, adopted: 3, level: "ok" },
};

const effusion: LiteratureResult = {
  key: "effusion",
  sources: [
    {
      n: 1,
      title: "Investigation of a unilateral pleural effusion in adults: BTS guideline",
      source: "PubMed · PMID 37553157",
      grade: "가이드라인",
      year: 2023,
      relevance: 0.93,
      snippet: "일측성 흉수는 초음파로 양을 평가하고, 심부전이 의심되면 이뇨 치료 반응을 먼저 확인한 뒤 천자를 고려한다.",
    },
    {
      n: 2,
      title: "Light's criteria revisited: diagnostic accuracy for transudate versus exudate",
      source: "PMC · PMCID 7654321",
      grade: "논문",
      year: 2022,
      relevance: 0.87,
      snippet: "Light 기준은 삼출액 판별 민감도가 높지만 이뇨 치료 중인 심부전 환자에서는 위양성이 흔하다.",
    },
    {
      n: 3,
      title: "심부전 동반 일측성 흉수 — 이뇨 치료 후 호전 사례",
      source: "원내 유사 사례 · C-3812",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.8,
      snippet: "우측 늑골횡격막각 둔화가 이뇨 치료 5일 후 소실되어 심인성 흉수로 확인된 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 47건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.9 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.86 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.93 },
  ],
  synthesis: { text: "3개 출처가 **심인성 흉수 우선 감별**을 일관되게 지지합니다. 근거 충분성 점검을 통과했습니다.", avg: 0.87, adopted: 3, level: "ok" },
};

const edema: LiteratureResult = {
  key: "edema",
  sources: [
    {
      n: 1,
      title: "2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure",
      source: "PubMed · PMID 34447992",
      grade: "가이드라인",
      year: 2021,
      relevance: 0.94,
      snippet: "급성 호흡곤란 환자에서 흉부 X-ray의 폐울혈·폐부종 소견과 나트륨이뇨펩티드를 함께 평가해 급성 심부전을 진단하고, 이뇨제 반응을 확인한다.",
    },
    {
      n: 2,
      title: "Radiographic grading of pulmonary edema on portable chest radiographs: reliability and outcomes",
      source: "PMC · PMCID 8234567",
      grade: "논문",
      year: 2022,
      relevance: 0.88,
      snippet: "폐문부 중심 음영과 혈관 재분포는 심인성 폐부종을, 말초 우세 음영은 비심인성 폐부종을 시사하며, 앙와위 촬영에서는 흉수가 과소평가된다.",
    },
    {
      n: 3,
      title: "급성 심부전 동반 양측 폐부종 — 이뇨 치료 후 12시간 추적 사례",
      source: "원내 유사 사례 · C-3655",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.82,
      snippet: "이동식 AP 촬영에서 양측 폐문부 음영이 이뇨제 투여 12시간 후 뚜렷이 호전되어 심인성 폐부종으로 확인된 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 48건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.92 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.88 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.95 },
  ],
  synthesis: { text: "3개 출처가 **심인성 폐부종 우선 감별과 BNP·심초음파 확인** 경로를 일관되게 지지합니다. 근거 충분성 점검을 통과했습니다.", avg: 0.88, adopted: 3, level: "ok" },
};

const edemaFollowup: LiteratureResult = {
  key: "edema-followup",
  sources: [
    {
      n: 1,
      title: "2021 ESC Guidelines for acute and chronic heart failure — acute HF: initial management and reassessment",
      source: "PubMed · PMID 34447992",
      grade: "가이드라인",
      year: 2021,
      relevance: 0.93,
      snippet: "급성 심부전에서 이뇨제 투여 후 첫 수 시간 내 소변량과 증상으로 반응을 평가하고, 불충분하면 용량을 두 배로 늘린다. 영상 재평가는 임상 경과에 맞춰 시행한다.",
    },
    {
      n: 2,
      title: "Radiographic resolution of cardiogenic pulmonary edema lags clinical improvement: a serial chest radiograph study",
      source: "PMC · PMCID 8345678",
      grade: "논문",
      year: 2020,
      relevance: 0.9,
      snippet: "임상 호전 후 흉부 X-ray의 폐부종 소견 소실은 평균 12-24시간 지연되며, 24시간 이전 재촬영만으로 반응을 판단하면 오도될 수 있다.",
    },
    {
      n: 3,
      title: "Lung ultrasound B-lines for monitoring decongestion in acute heart failure",
      source: "PMC · PMCID 9123456",
      grade: "논문",
      year: 2023,
      relevance: 0.85,
      snippet: "폐 초음파 B-line 수 감소는 흉부 X-ray보다 빠르게 이뇨 반응을 반영하며, 재촬영 사이의 경과 관찰 지표로 유용하다.",
    },
    {
      n: 4,
      title: "급성 심부전 동반 양측 폐부종 — 이뇨 치료 후 12시간 추적 사례",
      source: "원내 유사 사례 · C-3655",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.82,
      snippet: "이동식 AP 촬영에서 양측 폐문부 음영이 이뇨제 투여 12시간 후 부분 호전, 24시간 직립 촬영에서 뚜렷이 호전되어 심인성 폐부종으로 확인된 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 52건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.93 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.89 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.95 },
  ],
  synthesis: {
    text: "4개 출처가 **24시간 전후 재촬영과 초음파 병행** 방향을 일관되게 지지합니다. 영상 호전 지연을 고려해 조기 재촬영 단독으로 반응을 판단하는 것은 권고하지 않습니다.",
    avg: 0.88,
    adopted: 4,
    level: "ok",
  },
};

const nodule: LiteratureResult = {
  key: "nodule",
  sources: [
    {
      n: 1,
      title: "Guidelines for management of incidental pulmonary nodules: Fleischner Society 2017",
      source: "PubMed · PMID 28240562",
      grade: "가이드라인",
      year: 2017,
      relevance: 0.95,
      snippet: "6-8mm 고형 결절은 저위험군에서 6-12개월 CT 추적, 고위험군에서 6-12개월 후 18-24개월 추가 추적을 권고한다.",
    },
    {
      n: 2,
      title: "Lung-RADS v2022: reporting and follow-up categories",
      source: "PMC · PMCID 9012345",
      grade: "논문",
      year: 2022,
      relevance: 0.88,
      snippet: "8mm 이상 고형 결절은 카테고리 4A로 분류해 3개월 추적 CT 또는 PET-CT를 고려한다.",
    },
    {
      n: 3,
      title: "우상엽 8mm 결절 — 12개월 추적에서 크기 변화 없음",
      source: "원내 유사 사례 · C-4102",
      grade: "유사 사례",
      year: 2024,
      relevance: 0.79,
      snippet: "동일 프로토콜 CT 추적에서 크기 변화가 없어 양성 결절로 판단하고 24개월 추적으로 종료한 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 38건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.94 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.89 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.96 },
  ],
  synthesis: { text: "3개 출처가 **위험군별 CT 추적 간격**을 일관되게 제시합니다. 근거 충분성 점검을 통과했습니다.", avg: 0.87, adopted: 3, level: "ok" },
};

const cardiomegaly: LiteratureResult = {
  key: "cardiomegaly",
  sources: [
    {
      n: 1,
      title: "2022 AHA/ACC/HFSA guideline for the management of heart failure",
      source: "PubMed · PMID 35363499",
      grade: "가이드라인",
      year: 2022,
      relevance: 0.9,
      snippet: "흉부 X-ray의 심비대 소견은 심부전 진단의 보조 근거이며, 확진과 원인 평가는 심초음파와 나트륨이뇨펩티드로 진행한다.",
    },
    {
      n: 2,
      title: "Cardiothoracic ratio on chest radiography: diagnostic value and pitfalls",
      source: "PMC · PMCID 8456789",
      grade: "논문",
      year: 2021,
      relevance: 0.88,
      snippet: "심흉곽비 0.5 초과는 심비대를 시사하나 촬영 자세·호흡 상태에 따라 변동이 크므로 심초음파로 확인한다.",
    },
    {
      n: 3,
      title: "고혈압성 심비대 — 심초음파에서 좌심실 비대 확인",
      source: "원내 유사 사례 · C-3990",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.78,
      snippet: "심흉곽비 0.55와 고혈압 병력에서 심초음파로 좌심실 비대를 확인하고 혈압 조절 강화로 관리한 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 41건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.89 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.85 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.93 },
  ],
  synthesis: { text: "3개 출처가 **심초음파 확인 후 원인 평가** 경로를 일관되게 지지합니다.", avg: 0.85, adopted: 3, level: "ok" },
};

const lesion: LiteratureResult = {
  key: "lesion",
  sources: [
    {
      n: 1,
      title: "ACR Appropriateness Criteria: lung cancer screening and incidental findings",
      source: "PubMed · PMID 30392590",
      grade: "가이드라인",
      year: 2023,
      relevance: 0.92,
      snippet: "흡연력이 있는 성인의 국소 폐 음영은 단순 촬영만으로 감별하지 않으며, 흉부 CT를 1차 추가 검사로 권고한다.",
    },
    {
      n: 2,
      title: "Missed lung cancer on chest radiography: patterns and lessons",
      source: "PMC · PMCID 7001234",
      grade: "논문",
      year: 2020,
      relevance: 0.86,
      snippet: "상엽 국소 음영은 쇄골·늑골 겹침으로 놓치기 쉬우며, 체중 감소 동반 시 악성 가능성을 우선 배제해야 한다.",
    },
    {
      n: 3,
      title: "좌상엽 국소 음영 — CT에서 결절 확인 후 조직검사 사례",
      source: "원내 유사 사례 · C-4210",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.77,
      snippet: "40갑년 흡연력 남성의 좌상엽 음영이 CT에서 2.1cm 결절로 확인되어 기관지내시경 조직검사로 진행한 사례.",
    },
  ],
  stageResults: ["질문 3건", "후보 46건", "상위 5건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.9 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.84 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.92 },
  ],
  synthesis: { text: "3개 출처가 **흉부 CT 추가 평가**를 일관되게 권고합니다. 근거 충분성 점검을 통과했습니다.", avg: 0.85, adopted: 3, level: "ok" },
};

const normal: LiteratureResult = {
  key: "normal",
  sources: [
    {
      n: 1,
      title: "ACR Appropriateness Criteria: routine chest radiography",
      source: "PubMed · PMID 29101979",
      grade: "가이드라인",
      year: 2021,
      relevance: 0.88,
      snippet: "무증상 성인의 정기 흉부 촬영은 근거가 제한적이며, 위험 인자가 없으면 추가 촬영을 권고하지 않는다.",
    },
    {
      n: 2,
      title: "Normal chest radiograph: systematic review approach and reporting",
      source: "PMC · PMCID 7112233",
      grade: "논문",
      year: 2020,
      relevance: 0.82,
      snippet: "정상 판독 시에도 심흉곽비·늑골횡격막각·폐문 대칭성을 체계적으로 기술해 추적 비교 기준을 남긴다.",
    },
  ],
  stageResults: ["질문 2건", "후보 29건", "상위 4건", "통과"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.86 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.88 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.95 },
  ],
  synthesis: { text: "2개 출처가 **추가 촬영 불필요** 방향을 지지합니다. 유사 사례는 채택 기준 미달로 제외했습니다.", avg: 0.85, adopted: 2, level: "ok" },
};

const general: LiteratureResult = {
  key: "general",
  sources: [
    {
      n: 1,
      title: "ACR Appropriateness Criteria: acute respiratory illness in immunocompetent patients",
      source: "PubMed · PMID 30392590",
      grade: "가이드라인",
      year: 2018,
      relevance: 0.84,
      snippet: "급성 호흡기 증상 성인의 초기 영상 검사는 흉부 X-ray가 적절하며, 소견에 따라 CT를 추가한다.",
    },
    {
      n: 2,
      title: "Chest radiograph interpretation: systematic approach and common pitfalls",
      source: "PMC · PMCID 7001234",
      grade: "논문",
      year: 2020,
      relevance: 0.8,
      snippet: "체계적 판독 순서(기도·심장·폐야·횡격막·뼈)를 따르면 놓침 소견이 유의하게 감소한다.",
    },
    {
      n: 3,
      title: "유사 임상 경과의 판독 사례",
      source: "원내 유사 사례 · C-4300",
      grade: "유사 사례",
      year: 2025,
      relevance: 0.72,
      snippet: "질문과 직접 대응하는 사례가 제한적이라 근거 등급을 낮춰 참고용으로만 채택했다.",
    },
  ],
  stageResults: ["질문 3건", "후보 33건", "상위 5건", "보강"],
  reliability: [
    { ko: "검색 관련성", en: "RELEVANCE", v: 0.81 },
    { ko: "추론 일관성", en: "CONSISTENCY", v: 0.83 },
    { ko: "출처 없는 서술 차단", en: "GROUNDEDNESS", v: 0.9 },
  ],
  synthesis: { text: "질문과 직접 대응하는 근거가 제한적입니다. **근거 충분성 점검에서 보강 단계**로 넘어가 웹 검색 결과를 참고 등급으로 추가했습니다.", avg: 0.79, adopted: 2, level: "warning" },
};

const INTENTS: { match: RegExp; result: LiteratureResult }[] = [
  { match: /결절|nodule|mm/i, result: nodule },
  { match: /이뇨|재촬영|반응 평가|호전|decongestion/i, result: edemaFollowup },
  { match: /외래|중증도|입원|CURB|PSI/i, result: severity },
  { match: /폐부종|부종|edema|폐울혈/i, result: edema },
  { match: /흉수|심인성|삼출|effusion/i, result: effusion },
  { match: /심비대|심흉곽|심부전|cardiomegaly/i, result: cardiomegaly },
  { match: /병변|결절성|국소 음영|CT|흡연|lesion/i, result: lesion },
  { match: /정상|무증상|건강검진|미검출/, result: normal },
  { match: /폐렴|음영|발열|pneumonia|기침/i, result: pneumonia },
];

/* null when the query has no recognizable intent (caller falls back to the case query) */
export function matchLiterature(query: string): LiteratureResult | null {
  return INTENTS.find((i) => i.match.test(query))?.result ?? null;
}

export function pickLiterature(query: string): LiteratureResult {
  return matchLiterature(query) ?? general;
}

export const defaultLiterature = pneumonia;
