/*
 * Canned agent answers, keyed by question intent. Each script is a
 * function of the selected case so the same intent reads correctly for
 * a pneumonia, effusion or no-finding study. Steps carry the tool they
 * represent so the right rail can count tool calls live.
 */

import type { AgentBlock, ChatCitation } from "@/lib/data";
import type { CaseData } from "./cases";

export type ToolName = "흉부 영상 분석" | "문헌 검색" | "임상 정보 분석" | "웹 검색";

export type ScriptStep = { name: string; tool?: ToolName; ms: number; detail?: string };

export type Verdict = { overall: "ACCEPT" | "CAUTION" | "NEED_MORE_EVIDENCE"; agreement: number };

export type AgentScript = {
  id: string;
  match: RegExp;
  caseIds?: string[];
  steps: (c: CaseData) => ScriptStep[];
  blocks: (c: CaseData) => AgentBlock[];
  followups: (c: CaseData) => string[];
  citations: number;
  verdict: (c: CaseData) => Verdict;
};

const PRIOR_DATE = "2025-11";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const paper = (n: number): ChatCitation => ({ n, kind: "paper", label: String(n) });
const image: ChatCitation = { kind: "image", label: "영상" };

function isPneumonia(c: CaseData) {
  return c.findings[0].en === "PNEUMONIA";
}

/* CURB-65 items we can actually read off the mock chart */
function curb(c: CaseData) {
  const p = c.patient;
  const age = parseInt(p.ageSex, 10);
  const [sbp, dbp] = p.bp.split("/").map(Number);
  const items = [
    { k: "의식 저하", hit: false, note: "임상 메모에 해당 기록 없음" },
    { k: "요소질소(BUN) 상승", hit: false, note: "혈액검사 결과 미연동 — 확인 필요", unknown: true },
    { k: "호흡수 30회 이상", hit: p.rr >= 30, note: `현재 ${p.rr}회` },
    { k: "혈압 저하 (수축기 90 미만 또는 이완기 60 이하)", hit: sbp < 90 || dbp <= 60, note: `현재 ${p.bp}` },
    { k: "65세 이상", hit: age >= 65, note: `${age}세` },
  ];
  const score = items.filter((i) => i.hit).length;
  return { items, score };
}

const ddx: AgentScript = {
  id: "ddx",
  match: /폐렴|감별|가능성|봐도|진단|의심|소견/,
  citations: 3,
  verdict: () => ({ overall: "CAUTION", agreement: 0.62 }),
  steps: (c) => [
    { name: "질문 이해", ms: 500 },
    { name: "작업 계획", ms: 450, detail: "소견 분석 · 근거 확인 · 문헌 검색" },
    { name: "흉부 영상 분석", tool: "흉부 영상 분석", ms: 1100, detail: `근거 영역 ${(c.regions[c.findings[0].en] ?? []).length}곳 감지` },
    { name: "문헌 검색", tool: "문헌 검색", ms: 1300, detail: "가이드라인 1건 · 논문 1건 · 유사 사례 1건" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 700 },
    { name: "근거 통합", ms: 800 },
  ],
  blocks: (c) => {
    if (c.id === "PX-2026-0142") {
      return [
        {
          type: "p",
          text: "우하엽 폐포성 음영과 마른기침·미열(37.8도) 경과를 종합하면 지역사회획득 폐렴 가능성이 가장 높습니다. 근거 영역이 실제 음영 위치와 일치하며, 아래 순서로 감별을 제안합니다.",
          cites: [paper(1), image],
        },
        {
          type: "ddx",
          buckets: [
            {
              title: "가장 유력",
              tone: "critical",
              items: [{ name: "폐렴 47%", reason: "우하엽 음영 + 발열·기침, 근거 위치 일치도 높음", cites: [paper(1), image] }],
            },
            {
              title: "확장 감별",
              tone: "warning",
              items: [{ name: "무기폐 37%", reason: "좌하엽 경계 선상 이동 여부 확인 필요 — 부피 감소 동반 시 무기폐 우선", cites: [paper(3)] }],
            },
            {
              title: "놓치면 안 됨",
              tone: "info",
              items: [{ name: "흉수 동반", reason: "늑골횡격막각 무딤이 경미하게 관찰 — 측와위 촬영으로 배제 권장", cites: [paper(2)] }],
            },
          ],
        },
        { type: "checklist", title: "추가 확인 제안", items: ["혈액검사 · 염증 수치(CRP) 확인", "공기기관지음영 유무 재검토", "과거 영상과 비교 판독"] },
      ];
    }
    const [top, second, third] = c.findings;
    const below = c.findings.find((f) => f.prob < f.threshold && f.loc);
    if (top.en === "NO FINDING") {
      return [
        {
          type: "p",
          text: `영상 14개 소견이 모두 운영 임계값 미만이고, 임상 정보(${c.sentenceImportance[0].text})에도 판단을 바꿀 요소가 없습니다. AI는 유의 소견을 감지하지 못했으며, 최종 확인은 판독의가 진행합니다.`,
          cites: [image],
        },
        {
          type: "ddx",
          buckets: [
            { title: "가장 유력", tone: "ok", items: [{ name: "유의 소견 미검출", reason: "전 소견 임계값 미만 · 근거 영역 없음", cites: [image] }] },
            { title: "확인 권장", tone: "info", items: [{ name: `${second.ko} ${pct(second.prob)}`, reason: `${second.note} — 임계값 ${pct(second.threshold)} 미만`, cites: [] }] },
          ],
        },
        { type: "checklist", title: "추가 확인 제안", items: ["정기 검진 주기 유지", "증상 발생 시 재촬영"] },
      ];
    }
    return [
      {
        type: "p",
        text: `${top.note}과(와) ${c.sentenceImportance[0].text} 경과를 종합하면 ${top.ko} 가능성이 가장 높습니다(${pct(top.prob)}). 근거 영역이 소견 위치와 일치하며, 아래 순서로 감별을 제안합니다.`,
        cites: [paper(1), image],
      },
      {
        type: "ddx",
        buckets: [
          { title: "가장 유력", tone: top.level === "critical" ? "critical" : "warning", items: [{ name: `${top.ko} ${pct(top.prob)}`, reason: `${top.note} · 임상 경과 일치`, cites: [paper(1), image] }] },
          {
            title: "확장 감별",
            tone: "warning",
            items: [
              { name: `${second.ko} ${pct(second.prob)}`, reason: second.note, cites: [paper(2)] },
              ...(third && third.prob >= third.threshold ? [{ name: `${third.ko} ${pct(third.prob)}`, reason: third.note, cites: [paper(3)] }] : []),
            ],
          },
          ...(below
            ? [{ title: "놓치면 안 됨", tone: "info" as const, items: [{ name: below.ko, reason: `${below.note} — 임계값 미만이지만 임상 경과상 배제 권장`, cites: [paper(3)] }] }]
            : []),
        ],
      },
      { type: "checklist", title: "추가 확인 제안", items: nextSteps(c) },
    ];
  },
  followups: (c) =>
    isPneumonia(c)
      ? ["외래 치료 가능한 중증도인가요?", "과거 영상과 비교해 주세요"]
      : ["다음에 어떤 검사가 필요한가요?", "이 검사의 근거 영역을 설명해 주세요"],
};

function nextSteps(c: CaseData): string[] {
  switch (c.findings[0].en) {
    case "PNEUMONIA":
      return ["혈액검사 · 염증 수치(CRP) 확인", "객담 배양 검사", "과거 영상과 비교 판독"];
    case "EDEMA":
      return ["BNP · 심초음파로 심인성 여부 확인", "이뇨제 투여 후 6-12시간 내 재촬영", "산소 공급 · 산소포화도 지속 감시"];
    case "PLEURAL EFFUSION":
      return ["흉부 초음파로 흉수량 추정", "BNP · 심초음파 결과 확인", "흉수 천자 필요성 판단"];
    case "LUNG OPACITY":
    case "LUNG LESION":
      return ["흉부 CT 추가 촬영", "과거 영상과 비교 판독", "객담 세포진 검사"];
    case "CARDIOMEGALY":
      return ["심전도 · 심초음파 의뢰", "혈압 조절 상태 확인", "측면 촬영으로 심장 윤곽 재평가"];
    default:
      return ["정기 검진 주기 유지", "증상 발생 시 재촬영"];
  }
}

const severity: AgentScript = {
  id: "severity",
  match: /외래|중증도|입원|CURB|PSI|위험도/i,
  citations: 2,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.78 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "진료 가이드라인 검색", tool: "문헌 검색", ms: 1400, detail: "CURB-65 · IDSA/ATS 기준" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 900, detail: "활력징후 4항목 대조" },
    { name: "근거 통합", ms: 700 },
  ],
  blocks: (c) => {
    const { items, score } = curb(c);
    const p = c.patient;
    const outpatient = score <= 1;
    return [
      {
        type: "p",
        text: `외래 치료 가능 여부는 CURB-65 점수로 1차 판단합니다. 현재 기록된 활력징후를 대조하면 ${score}점(요소질소 미확인)으로, ${
          outpatient ? "외래 치료를 고려할 수 있는 범위" : "입원 치료를 고려해야 하는 범위"
        }입니다. 산소포화도 ${p.spo2}%와 체온 ${p.temp}도는 점수에 포함되지 않지만 경과 관찰에 반영합니다.`,
        cites: [paper(1)],
      },
      {
        type: "ddx",
        buckets: [
          {
            title: `CURB-65 · ${score}점`,
            tone: outpatient ? "ok" : "warning",
            items: items.map((i) => ({ name: `${i.hit ? "해당" : i.unknown ? "미확인" : "해당 없음"} · ${i.k}`, reason: i.note })),
          },
        ],
      },
      {
        type: "checklist",
        title: outpatient ? "외래 치료 시 확인 사항" : "입원 판단 시 확인 사항",
        items: ["혈액검사로 요소질소 확인 후 점수 확정", "48-72시간 내 재평가 · 악화 시 재촬영", "동반 질환(고혈압·당뇨) 조절 상태 확인"],
      },
    ];
  },
  followups: () => ["항생제 선택 기준을 알려주세요", "재촬영은 언제 하나요?"],
};

const compare: AgentScript = {
  id: "compare",
  match: /과거|비교|이전|prior|변화/i,
  citations: 1,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.7 }),
  steps: (c) =>
    c.prior === null
      ? [
          { name: "질문 이해", ms: 450 },
          { name: "과거 영상 조회", tool: "흉부 영상 분석", ms: 900, detail: "저장된 이전 검사 없음" },
          { name: "근거 통합", ms: 600 },
        ]
      : [
          { name: "질문 이해", ms: 450 },
          { name: "과거 영상 불러오기", tool: "흉부 영상 분석", ms: 900, detail: `${PRIOR_DATE} PA 1건` },
          { name: "두 시점 정합 · 차이 계산", tool: "흉부 영상 분석", ms: 1200, detail: "차이 영역 1곳" },
          { name: "근거 통합", ms: 700 },
        ],
  blocks: (c) => {
    const top = c.findings[0];
    if (c.prior === null) {
      return [
        {
          type: "p",
          text: `이 환자는 저장된 이전 흉부 촬영이 없어 시점 비교를 할 수 없습니다. 이번 검사를 기준 영상으로 등록하고, 치료 후 재촬영에서 ${top.note} 영역의 변화를 비교하는 것을 제안합니다.`,
          cites: [image],
        },
        {
          type: "checklist",
          title: "비교 판독 준비",
          items: ["이번 검사를 기준(baseline) 영상으로 등록", ...nextSteps(c).slice(1, 2), "재촬영 시 같은 자세(앙와위 여부) 유지 — 심흉곽비 비교 오차 방지"],
        },
      ];
    }
    if (top.en === "NO FINDING") {
      return [
        { type: "p", text: `${PRIOR_DATE} 촬영과 정합한 결과 새로 나타난 음영이나 윤곽 변화가 없습니다. 심흉곽비와 횡격막 높이도 이전과 같은 범위입니다.`, cites: [image] },
        { type: "checklist", title: "비교 요약", items: ["신규 음영 없음", "심흉곽비 변화 없음", "늑골횡격막각 양측 예리"] },
      ];
    }
    return [
      {
        type: "p",
        text: `${PRIOR_DATE} 촬영과 정합한 결과 ${top.note} 영역이 새로 나타났습니다. 이전 영상에서는 같은 위치에 유의한 음영이 없었으므로 급성 경과로 해석합니다. 심흉곽비와 횡격막 높이는 이전과 같은 범위입니다.`,
        cites: [image],
      },
      {
        type: "ddx",
        buckets: [
          { title: "새로 나타남", tone: "critical", items: [{ name: top.ko, reason: `${top.note} · 이전 영상 해당 위치 음영 없음`, cites: [image] }] },
          { title: "변화 없음", tone: "neutral", items: [{ name: "심장 윤곽 · 횡격막", reason: "심흉곽비 이전과 동일 범위 · 늑골횡격막각 형태 유지" }] },
        ],
      },
      { type: "checklist", title: "비교 판독 제안", items: ["급성 경과에 맞는 원인 우선 감별", "치료 후 2-4주 추적 촬영으로 소실 확인"] },
    ];
  },
  followups: () => ["추적 촬영은 언제 하나요?", "이 검사의 근거 영역을 설명해 주세요"],
};

const evidence: AgentScript = {
  id: "evidence",
  match: /근거|왜|히트맵|영역|판단|설명|어디/,
  citations: 1,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.74 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "흉부 영상 분석", tool: "흉부 영상 분석", ms: 1100, detail: "히트맵 · 외곽선 재계산" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 800, detail: "문장 기여도 산출" },
    { name: "근거 통합", ms: 600 },
  ],
  blocks: (c) => {
    const top = c.findings.find((f) => f.loc) ?? c.findings[0];
    const regions = c.regions[top.en] ?? [];
    const [s1, s2] = c.sentenceImportance;
    if (regions.length === 0) {
      return [
        { type: "p", text: "히트맵에서 모델이 집중한 영역이 없습니다. 폐야 전반의 활성도가 고르게 낮아 유의 소견 미검출 판단과 일치합니다.", cites: [image] },
        { type: "checklist", title: "임상 문장 기여도", items: c.sentenceImportance.map((s) => `“${s.text}” · ${s.weight.toFixed(2)}`) },
      ];
    }
    return [
      {
        type: "p",
        text: `${top.ko} 판단의 영상 근거는 ${regions.length}곳입니다. 가장 강한 영역은 ${top.note}이며 히트맵 중심이 실제 음영 위치와 겹칩니다. ${
          regions.length > 1 ? "두 번째 영역은 확신 50-90% 구간이라 점선 외곽선으로 표시됩니다." : "외곽선은 확신 90% 초과 구간이라 실선으로 표시됩니다."
        }`,
        cites: [image],
      },
      {
        type: "ddx",
        buckets: [
          {
            title: "영상 근거",
            tone: "info",
            items: regions.map((r, i) => ({ name: `근거 영역 ${i + 1} · 확신 ${pct(r.w)}`, reason: i === 0 ? top.note : "보조 영역 · 판독의 확인 권장", cites: [image] })),
          },
          {
            title: "임상 문장 근거",
            tone: "neutral",
            items: [s1, s2].filter(Boolean).map((s) => ({ name: `“${s.text}”`, reason: `기여도 ${s.weight.toFixed(2)}` })),
          },
        ],
      },
      { type: "checklist", title: "근거 해석 시 유의", items: ["히트맵은 모델 주목 영역의 상대 강도 — 진단이 아닌 판독 참고 정보", "근거 위치 일치도(mIoU)는 근거 시각화 화면에서 확인"] },
    ];
  },
  followups: () => ["과거 영상과 비교해 주세요", "다음에 어떤 검사가 필요한가요?"],
};

const nodule: AgentScript = {
  id: "nodule",
  match: /결절|mm|nodule/i,
  citations: 2,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.81 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "진료 가이드라인 검색", tool: "문헌 검색", ms: 1300, detail: "Fleischner 2017 · Lung-RADS 2022" },
    { name: "웹 검색", tool: "웹 검색", ms: 900, detail: "최신 개정 여부 확인" },
    { name: "근거 통합", ms: 600 },
  ],
  blocks: () => [
    {
      type: "p",
      text: "8mm 고형 결절은 Fleischner Society 기준으로 6-8mm 구간에 해당하며, 위험군에 따라 추적 간격이 달라집니다. 단순 촬영으로는 크기 측정 오차가 크므로 첫 평가는 CT로 하는 것을 권고합니다.",
      cites: [paper(1)],
    },
    {
      type: "ddx",
      buckets: [
        { title: "저위험군", tone: "ok", items: [{ name: "6-12개월 CT 추적", reason: "변화 없으면 18-24개월에 추가 추적 고려", cites: [paper(1)] }] },
        { title: "고위험군 (흡연력 · 상엽 위치 · 침상 경계)", tone: "warning", items: [{ name: "6-12개월 CT 추적 후 18-24개월 재추적", reason: "8mm 이상이면 3개월 추적 또는 PET-CT 고려", cites: [paper(2)] }] },
      ],
    },
    { type: "checklist", title: "추적 시 확인 사항", items: ["동일 프로토콜 CT로 크기 비교", "석회화 · 지방 성분 유무로 양성 여부 판단", "성장 시 조직 검사 의뢰"] },
  ],
  followups: () => ["이 환자는 어느 위험군인가요?", "PET-CT 적응증을 알려주세요"],
};

const next: AgentScript = {
  id: "next",
  match: /다음|검사|추가|권고|어떻게|해야/,
  citations: 2,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.76 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "진료 가이드라인 검색", tool: "문헌 검색", ms: 1300 },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 700 },
    { name: "근거 통합", ms: 600 },
  ],
  blocks: (c) => {
    const top = c.findings[0];
    return [
      {
        type: "p",
        text: `현재 최상위 소견은 ${top.ko}(${pct(top.prob)})입니다. 진료 가이드라인과 임상 경과를 대조해 다음 단계를 우선순위 순으로 정리했습니다.`,
        cites: [paper(1), image],
      },
      { type: "checklist", title: "권고 순서", items: nextSteps(c) },
      {
        type: "ddx",
        buckets: [{ title: "근거", tone: "info", items: [{ name: "가이드라인 권고", reason: "동일 소견 성인 환자 초기 평가 경로", cites: [paper(1)] }, { name: "임상 경과", reason: c.sentenceImportance[0].text, cites: [paper(2)] }] }],
      },
    ];
  },
  followups: () => ["과거 영상과 비교해 주세요", "이 검사의 근거 영역을 설명해 주세요"],
};

const effusion: AgentScript = {
  id: "effusion",
  match: /흉수|심인성|삼출|여출|원인/,
  caseIds: ["PX-2026-0128"],
  citations: 3,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.72 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "흉부 영상 분석", tool: "흉부 영상 분석", ms: 1000, detail: "늑골횡격막각 · 심흉곽비 측정" },
    { name: "문헌 검색", tool: "문헌 검색", ms: 1300, detail: "BTS 흉수 가이드라인 · Light 기준" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 700 },
    { name: "근거 통합", ms: 700 },
  ],
  blocks: () => [
    {
      type: "p",
      text: "우측 늑골횡격막각 둔화와 심흉곽비 0.56, 심부전 과거력·하지 부종을 종합하면 심인성(여출성) 흉수 가능성이 가장 높습니다. 일측성이라는 점은 비전형적이므로 이뇨 치료 반응을 먼저 확인한 뒤 천자를 고려합니다.",
      cites: [paper(1), image],
    },
    {
      type: "ddx",
      buckets: [
        { title: "가장 유력", tone: "warning", items: [{ name: "심인성 흉수", reason: "심부전 병력 · 심비대 동반 · 하지 부종", cites: [paper(1), image] }] },
        { title: "확장 감별", tone: "info", items: [{ name: "부폐렴성 삼출액", reason: "발열 없음 · 염증 수치로 배제", cites: [paper(2)] }, { name: "악성 흉수", reason: "이뇨 치료 무반응 시 세포진 검사", cites: [paper(3)] }] },
      ],
    },
    { type: "checklist", title: "추가 확인 제안", items: ["BNP · 심초음파 결과 확인", "흉부 초음파로 흉수량 추정", "이뇨 치료 5-7일 후 재촬영"] },
  ],
  followups: () => ["흉수 천자 적응증을 알려주세요", "과거 영상과 비교해 주세요"],
};

const edema: AgentScript = {
  id: "edema",
  match: /폐부종|부종|심인성|음영|감별|가능성|봐도|진단|의심|소견|심부전/,
  caseIds: ["PX-2026-0125"],
  citations: 3,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.79 }),
  steps: () => [
    { name: "질문 이해", ms: 500 },
    { name: "작업 계획", ms: 450, detail: "소견 분석 · 근거 확인 · 문헌 검색" },
    { name: "흉부 영상 분석", tool: "흉부 영상 분석", ms: 1100, detail: "폐 분할 마스크 적용 · 근거 영역 2곳 감지" },
    { name: "문헌 검색", tool: "문헌 검색", ms: 1300, detail: "가이드라인 1건 · 논문 1건 · 유사 사례 1건" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 700, detail: "활력징후 · 병력 대조" },
    { name: "근거 통합", ms: 800 },
  ],
  blocks: () => [
    {
      type: "p",
      text: "양측 폐문부를 중심으로 퍼지는 음영과 심비대, 어젯밤부터 누우면 심해지는 호흡곤란과 하지 부종을 종합하면 심인성 폐부종 가능성이 가장 높습니다(81%). Grad-CAM 근거 영역이 폐 분할 마스크 안의 양측 음영과 일치하며, 아래 순서로 감별을 제안합니다.",
      cites: [paper(1), image],
    },
    {
      type: "ddx",
      buckets: [
        {
          title: "가장 유력",
          tone: "critical",
          items: [{ name: "심인성 폐부종 81%", reason: "양측 폐문부 중심 음영 + 심비대 63% + 심부전 병력 · 기립 시 호전되는 호흡곤란", cites: [paper(1), image] }],
        },
        {
          title: "확장 감별",
          tone: "warning",
          items: [
            { name: "비심인성 폐부종 (ARDS 등)", reason: "발열·감염 징후 없음 — BNP 정상이면 재고려", cites: [paper(2)] },
            { name: "폐렴 27%", reason: "임계값 미만 · 발열 없음 · 폐엽에 국한된 음영 아님" },
          ],
        },
        {
          title: "놓치면 안 됨",
          tone: "info",
          items: [{ name: "흉수 동반 41%", reason: "우측 늑골횡격막각 둔화 — 앙와위 촬영이라 소량 흉수는 가려질 수 있음", cites: [paper(3)] }],
        },
      ],
    },
    { type: "checklist", title: "추가 확인 제안", items: ["BNP · 심초음파로 심인성 여부 확인", "이뇨제 투여 후 6-12시간 내 재촬영", "산소 공급 · 산소포화도 지속 감시"] },
  ],
  followups: () => ["앙와위 AP 촬영이라 보정이 필요한 소견은?", "이뇨제 반응 평가를 위한 재촬영 시점과 호전 기준은?"],
};

/* Scenario turn 2 (PX-2026-0125): what a supine portable AP does to the read */
const apLimits: AgentScript = {
  id: "ap-limits",
  match: /앙와위|\bAP\b|보정|한계|신뢰|이동식|supine|portable/i,
  caseIds: ["PX-2026-0125"],
  citations: 2,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.76 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "촬영 조건 판독", tool: "흉부 영상 분석", ms: 1000, detail: "이동식 · 앙와위 · AP 확인 · 심흉곽비 재측정" },
    { name: "판독 기준 문헌 검색", tool: "문헌 검색", ms: 1100, detail: "이동식 AP 판독 보정 기준" },
    { name: "근거 통합", ms: 600 },
  ],
  blocks: () => [
    {
      type: "p",
      text: "이동식 앙와위 AP 촬영은 심장 음영이 확대되고 흉수가 뒤쪽으로 고여 직립 PA와 판독 기준이 다릅니다. 이 영상에서 그대로 신뢰할 수 있는 소견과 보정이 필요한 소견을 나눴습니다.",
      cites: [paper(2), image],
    },
    {
      type: "ddx",
      buckets: [
        {
          title: "그대로 신뢰 가능",
          tone: "ok",
          items: [
            { name: "양측 폐문부 중심 음영 · 폐부종 81%", reason: "촬영 자세와 무관한 실질 소견 — Grad-CAM 근거 영역이 폐 분할 마스크 안에서 양측 대칭 분포", cites: [image] },
            { name: "기관지 주위 비후 · 간질성 선상 음영", reason: "폐부종의 간질기 소견 · 배율 영향 없음" },
          ],
        },
        {
          title: "보정 필요",
          tone: "warning",
          items: [
            { name: "심비대 63% · 심흉곽비 0.58", reason: "AP 촬영은 심장 음영이 10-15% 확대 — PA 기준 약 0.52로 추정, 경계역", cites: [paper(2)] },
            { name: "흉수 41%", reason: "앙와위에서는 뒤쪽에 층을 이뤄 늑골횡격막각 둔화가 약해짐 — 실제 양은 더 많을 수 있음" },
            { name: "혈관 재분포", reason: "앙와위에서는 상엽 혈관 확장이 자세 때문에도 생겨 판단 보류" },
          ],
        },
        {
          title: "확인 방법",
          tone: "info",
          items: [
            { name: "안정되면 직립 PA 재촬영", reason: "심흉곽비 · 흉수 재평가" },
            { name: "흉부 초음파", reason: "흉수량과 B-line 으로 폐부종 정량" },
          ],
        },
      ],
    },
    {
      type: "checklist",
      title: "판독문 기재 제안",
      items: ["‘이동식 앙와위 AP 촬영으로 심장 음영 확대 가능’ 명시", "흉수는 ‘소량 이상 가능성’으로 기술", "직립 촬영 후 재평가 권고"],
    },
  ],
  followups: () => ["이뇨제 반응 평가를 위한 재촬영 시점과 호전 기준은?", "이 검사의 근거 영역을 설명해 주세요"],
};

/* Scenario turn 3 (PX-2026-0125): treatment response and re-imaging plan */
const edemaFollowup: AgentScript = {
  id: "edema-followup",
  match: /이뇨|재촬영|반응 평가|호전|추적|경과/,
  caseIds: ["PX-2026-0125"],
  citations: 3,
  verdict: () => ({ overall: "ACCEPT", agreement: 0.81 }),
  steps: () => [
    { name: "질문 이해", ms: 450 },
    { name: "진료 가이드라인 검색", tool: "문헌 검색", ms: 1300, detail: "ESC 급성 심부전 · 영상 추적 연구" },
    { name: "임상 정보 분석", tool: "임상 정보 분석", ms: 800, detail: "활력징후 · 소변량 항목 대조" },
    { name: "기준 영상 등록", tool: "흉부 영상 분석", ms: 900, detail: "근거 영역 2곳을 비교 지표로 저장" },
    { name: "근거 통합", ms: 600 },
  ],
  blocks: () => [
    {
      type: "p",
      text: "이뇨제 반응은 임상 지표가 먼저 좋아지고 영상은 12-24시간 늦게 따라옵니다. 따라서 첫 재촬영은 24시간 전후가 적절하고, 6-12시간 시점에는 산소포화도·호흡수·소변량으로 반응을 판단하는 것을 권고합니다.",
      cites: [paper(1), paper(2)],
    },
    {
      type: "ddx",
      buckets: [
        {
          title: "재촬영 시점",
          tone: "info",
          items: [
            { name: "24시간 전후 · 직립 PA 가능 시", reason: "영상 호전 지연을 고려한 1차 재평가 시점", cites: [paper(2)] },
            { name: "6-12시간", reason: "임상 악화 시에만 조기 촬영 — 비침습 환기 · 삽관 결정용" },
          ],
        },
        {
          title: "호전 판단 기준 · 영상",
          tone: "ok",
          items: [
            { name: "양측 폐문부 음영 감소", reason: "이번 검사 Grad-CAM 근거 영역 2곳과 같은 위치를 비교", cites: [image] },
            { name: "혈관경 폭 감소 · 흉수 감소", reason: "직립 촬영에서 늑골횡격막각 회복 여부" },
          ],
        },
        {
          title: "재고려 기준",
          tone: "warning",
          items: [{ name: "24시간 내 호전 없음", reason: "비심인성 폐부종(ARDS) 재고려 — BNP · 심초음파 · 흉부 CT", cites: [paper(1)] }],
        },
      ],
    },
    {
      type: "checklist",
      title: "추적 계획",
      items: ["이번 검사를 기준(baseline) 영상으로 등록", "6-12시간: 산소포화도 · 호흡수 · 소변량 재평가", "24시간: 직립 PA 재촬영 후 근거 영역 비교", "호전 없으면 BNP · 심초음파 · 흉부 CT"],
    },
  ],
  followups: () => ["문헌 검색: 급성 심인성 폐부종 이뇨제 반응 평가와 재촬영 시점", "이 검사의 근거 영역을 설명해 주세요"],
};

const fallback: AgentScript = {
  id: "fallback",
  match: /.*/,
  citations: 2,
  verdict: () => ({ overall: "CAUTION", agreement: 0.58 }),
  steps: () => [
    { name: "질문 이해", ms: 500 },
    { name: "작업 계획", ms: 400 },
    { name: "흉부 영상 분석", tool: "흉부 영상 분석", ms: 900 },
    { name: "문헌 검색", tool: "문헌 검색", ms: 1200 },
    { name: "근거 통합", ms: 700 },
  ],
  blocks: (c) => {
    const top = c.findings[0];
    return [
      {
        type: "p",
        text: `질문을 이 검사의 영상·임상·문헌 근거로 검토했습니다. 현재 가장 확실한 근거는 ${top.ko}(${pct(top.prob)})이며, ${c.sentenceImportance[0].text} 경과가 이를 뒷받침합니다. 질문에 직접 대응하는 가이드라인 근거는 제한적이라 판독의 확인 권고로 답합니다.`,
        cites: [paper(1), image],
      },
      { type: "checklist", title: "확인 가능한 항목", items: ["소견별 확률과 근거 영역 — 분류 분석 · 근거 시각화 화면", "관련 문헌 — 문헌 검색 화면에서 질문 수정 가능", ...nextSteps(c).slice(0, 1)] },
    ];
  },
  followups: (c) => (isPneumonia(c) ? ["외래 치료 가능한 중증도인가요?", "이 검사의 근거 영역을 설명해 주세요"] : ["다음에 어떤 검사가 필요한가요?", "이 검사의 근거 영역을 설명해 주세요"]),
};

/* Order matters: specific intents before broad ones */
/* Case-scoped scenario scripts first, then specific intents, then broad ones */
const SCRIPTS: AgentScript[] = [edemaFollowup, apLimits, edema, nodule, severity, compare, effusion, evidence, next, ddx, fallback];

export function pickScript(query: string, c: CaseData): AgentScript {
  const q = query.trim();
  return (
    SCRIPTS.find((s) => (!s.caseIds || s.caseIds.includes(c.id)) && s.match.test(q)) ?? fallback
  );
}
