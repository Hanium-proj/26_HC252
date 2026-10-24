export type Finding = {
  name: string;
  score: number;
  cam_url: string | null;
  activation_fraction: number | null;
};
export type Analysis = {
  report: {
    is_chest_xray: boolean;
    view: string;
    quality: string;
    quality_issues: string[];
    observations: {
      finding: string;
      location: string;
      description: string;
      certainty: string;
    }[];
    impression: string;
    comparison: string | null;
    limitations: string[];
  };
  classifier: {
    model: string;
    findings: Finding[];
    latency_ms: number;
    score_type: string;
  };
  segmentation?: {
    model: string;
    mask_url: string;
    lung_mask_url: string;
    lung_fraction: number;
    heart_fraction: number;
    heart_to_lung_span_ratio: number | null;
    limitations: string[];
  };
  vision_model: string;
  completed_at: string;
  latency_ms: number;
  verdict: string;
  limitations: string[];
};
export type Study = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  image_url: string;
  width: number;
  height: number;
  clinical: { note: string; prior_id: string | null; patient_ref?: string };
  analysis: Analysis | null;
};
export type Source = {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  year: string | null;
  journal: string;
  doi: string | null;
  publication_types: string[];
  url: string;
  relevance: number;
  rank_score: number;
  page?: number;
  doc_id?: string;
  source?: string;
  labels?: Record<string, number>;
};
export type SearchResult = {
  query: string;
  english_query: string;
  hits: Source[];
  total: number | null;
  candidates: number;
  cached: boolean;
  latency_ms: number;
  method: string;
  limitations: string[];
};
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  incomplete?: boolean;
};
