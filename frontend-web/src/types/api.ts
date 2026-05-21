export type ProviderName = "openai" | "ollama" | "fallback" | "guardrail" | string;
export type RiskLevel = "Low" | "Medium" | "High" | "Critical" | string;
export type ScoreStatus = "preliminary" | "final" | "not ready" | string;
export type ChatIntentMode = "direct_answer";
export type AssessmentAnswer = "yes" | "partial" | "no" | "unsure";
export type ArtifactId =
  | "readiness-report"
  | "action-plan"
  | "evidence-binder"
  | "skills"
  | "ransomware-playbook"
  | "technical-json";

export interface HealthResponse {
  status?: string;
  service?: string;
  version?: string;
  docs?: string;
  llm?: ProviderStatusResponse;
}

export interface ProviderStatusResponse {
  provider?: ProviderName;
  provider_ready?: boolean;
  reason?: string;
  openai_api_key_present?: boolean;
  openai_model?: string;
  openai_base_url?: string;
  ollama_model?: string;
  ollama_url?: string;
  request_timeout_seconds?: number;
  used_fallback?: boolean;
  fallback_used?: boolean;
}

export interface Question {
  id: string;
  domain: string;
  question: string;
  help?: string;
  options?: string[];
  required?: boolean;
  source_refs?: string[];
}

export interface AnswerRecord {
  answer?: string;
  details?: string;
  source?: string;
  confidence?: number;
}

export interface SessionProgress {
  answered_required?: number;
  total_required?: number;
  completion_rate?: number;
  is_complete?: boolean;
  followups_total?: number;
  followups_answered?: number;
}

export interface BackendChatMessage {
  role?: "user" | "assistant" | string;
  content?: string;
  timestamp?: string | number;
}

export interface AssistantSourceRef {
  label: string;
  url?: string;
  kind?: string;
}

export interface AssistantSavedAnswer {
  question_id: string;
  answer: string;
}

export interface AssistantTransparency {
  answer_type?: string;
  answer_status?: string;
  sources?: AssistantSourceRef[];
  saved_answers?: AssistantSavedAnswer[];
}

export interface SessionStateResponse {
  session_id: string;
  org_info?: Record<string, unknown>;
  answers?: Record<string, AnswerRecord>;
  followups?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  chat_history?: BackendChatMessage[];
  context_notes?: Array<Record<string, unknown>>;
  pending_answer?: Record<string, unknown> | null;
  unclear_question_ids?: string[];
  current_question_id?: string | null;
  current_domain?: string | null;
  interview_complete?: boolean;
  completion_mode?: string | null;
  progress?: SessionProgress;
}

export interface DomainScore {
  title?: string;
  score?: number;
  answered_questions?: number;
  total_questions?: number;
  unanswered_questions?: string[];
  critical_negative_answers?: string[];
  risk_level?: RiskLevel;
}

export interface ScoreResponse {
  overall_score?: number;
  risk_level?: RiskLevel;
  score_status?: ScoreStatus;
  is_complete?: boolean;
  answered_questions?: number;
  total_questions?: number;
  completion_rate?: number;
  domain_scores?: Record<string, number>;
  domain_details?: Record<string, DomainScore>;
  unanswered_questions?: string[];
}

export interface RiskItem {
  domain?: string;
  title?: string;
  score?: string | number;
  risk_level?: RiskLevel;
  risk?: string;
  skill_references?: string[];
  nist_csf?: string[];
  recommended_actions?: string[];
}

export interface ActionItem {
  title?: string;
  priority?: RiskLevel;
  domain?: string;
  owner?: string;
  owner_suggestion?: string;
  deadline?: string;
  effort?: string;
  evidence_required?: string[];
  based_on_skill?: string;
}

export interface EvidenceItem {
  domain?: string;
  based_on_skill?: string;
  title?: string;
  nist_csf?: string[];
  items?: string[];
}

export interface SkillReference {
  id?: string;
  title?: string;
  domain?: string;
  safe_use?: string;
  nist_csf?: string[];
  tags?: string[];
}

export interface FindingCard {
  id?: string;
  title?: string;
  severity?: RiskLevel;
  domain?: string;
  evidence?: string;
  business_impact?: string;
  recommended_fix?: string;
  owner?: string;
  deadline?: string;
  verification?: string;
}

export interface AdvisoryChecklistItem {
  id?: string;
  question?: string;
  recommendation?: string;
  evidence?: string[];
  answer?: string;
  details?: string;
  status?: string;
}

export interface ReportResponse extends ScoreResponse {
  summary?: string;
  top_risks?: RiskItem[];
  findings?: FindingCard[];
  next_steps?: string[];
  action_plan?: ActionItem[];
  evidence_checklist?: EvidenceItem[];
  skill_references?: SkillReference[];
  overall_confidence?: string;
  domain_confidence?: Record<string, string>;
  employee_hygiene_checklist?: {
    domain?: string;
    type?: string;
    scoring_impact?: string;
    items?: AdvisoryChecklistItem[];
  };
  external_exposure_self_check?: {
    type?: string;
    scanning_performed?: boolean;
    external_services_queried?: boolean;
    note?: string;
    items?: AdvisoryChecklistItem[];
  };
  llm_report_text?: string;
  llm?: {
    provider?: ProviderName;
    model?: string;
    used_real_llm?: boolean;
    error?: string | null;
    report_prompt_preview?: string;
  };
  sources?: unknown;
}

export interface ChatResponse {
  session_id: string;
  assistant_message?: string;
  intent?: string;
  extracted_answers?: Record<string, string>;
  missing_required_questions?: string[];
  unclear_questions?: string[];
  completion_rate?: number;
  is_complete?: boolean;
  score?: ScoreResponse | null;
  report?: ReportResponse | null;
  provider?: ProviderName;
  used_fallback?: boolean;
  response_type?: string;
  current_question_id?: string | null;
  current_question?: Question | null;
  current_domain?: string | null;
  completion_mode?: string | null;
  context_notes?: Array<Record<string, unknown>>;
  pending_answer?: Record<string, unknown> | null;
  chat_history?: BackendChatMessage[];
  redactions_applied?: string[];
  redacted_for_llm?: boolean;
  prompt_injection_blocked?: boolean;
  prompt_injection_reason?: string;
  knowledge_sources?: Array<Record<string, unknown>>;
  assistant_transparency?: AssistantTransparency;
}

export interface ChatRequestOptions {
  intent_mode?: ChatIntentMode;
  selected_answer?: AssessmentAnswer;
}

export interface SessionCreateResponse {
  session_id: string;
  org_info?: Record<string, unknown>;
}

export interface AnswerSubmitResponse {
  session_id: string;
  saved?: Record<string, AnswerRecord>;
  answers_count?: number;
  progress?: SessionProgress;
}

export interface DemoProfileResponse {
  session_id: string;
  profile_name?: string;
  org_info?: Record<string, unknown>;
}

export interface TechnicalFlowResponse {
  workflow?: string[];
  ai_parts?: string[];
  prompts?: string[];
  rule_based_parts?: string[];
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  profileName?: string;
  completionRate?: number;
  riskLevel?: RiskLevel;
}

export interface ExtractedAnswerItem {
  questionId: string;
  questionText?: string;
  answer: string;
  answerLabel?: string;
}

export interface ChatTechnicalDetails {
  intent?: string;
  provider?: ProviderName;
  usedFallback?: boolean;
  responseType?: string;
  currentQuestionId?: string | null;
  currentDomain?: string | null;
  completionRate?: number;
  scoreStatus?: ScoreStatus;
  redactionsApplied?: string[];
  redactedForLlm?: boolean;
  promptInjectionBlocked?: boolean;
  promptInjectionReason?: string;
  extractedAnswers?: ExtractedAnswerItem[];
  missingRequiredQuestions?: string[];
  unclearQuestions?: string[];
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  technicalDetails?: ChatTechnicalDetails;
  assistantTransparency?: AssistantTransparency;
  openedArtifacts?: ArtifactId[];
}
