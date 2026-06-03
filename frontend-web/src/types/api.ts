export type ProviderName = "openai" | "ollama" | "fallback" | "guardrail" | string;
export type RiskLevel = "Low" | "Medium" | "High" | "Critical" | string;
export type ScoreStatus = "preliminary" | "final" | "not ready" | string;
export type ChatIntentMode = "direct_answer" | "clarification" | "advisory" | "context_note";
export type AssessmentAnswer = "yes" | "partial" | "no" | "unsure";
export type SessionPath = "recovery-proof" | "questionnaire";
export type ArtifactId =
  | "readiness-report"
  | "action-plan"
  | "evidence-binder"
  | "recovery-proof"
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
  why_it_matters?: string;
  what_good_looks_like?: string;
  evidence_examples?: string[];
  how_to_answer?: string;
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
  session_path?: SessionPath;
  org_info?: Record<string, unknown>;
  answers?: Record<string, AnswerRecord>;
  followups?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  chat_history?: BackendChatMessage[];
  context_notes?: Array<Record<string, unknown>>;
  pending_answer?: Record<string, unknown> | null;
  unclear_question_ids?: string[];
  recovery_evidence?: RecoveryEvidenceItem[];
  recovery_proof?: RecoveryProofReport | null;
  current_question_id?: string | null;
  current_domain?: string | null;
  interview_complete?: boolean;
  completion_mode?: string | null;
  progress?: SessionProgress;
}

export interface RecoveryControl {
  id?: string;
  title?: string;
  category?: string;
  description?: string;
  required_evidence_types?: string[];
  weak_if_missing?: string[];
  mapped_existing_question_ids?: string[];
  client_friendly_risk?: string;
  technical_risk?: string;
  remediation_template?: Record<string, unknown>;
  framework_mappings?: Record<string, string[]>;
}

export interface RecoveryEvidenceItem {
  id?: string;
  source?: string;
  type?: string;
  title?: string;
  summary?: string;
  raw?: unknown;
  confidence?: "high" | "medium" | "low" | string;
  related_control_ids?: string[];
}

export interface RecoveryControlResult extends RecoveryControl {
  control_id?: string;
  status?: "proven" | "partially_proven" | "not_proven" | "unknown" | string;
  status_score?: number;
  reason?: string;
  evidence_confidence?: number;
  supporting_evidence?: RecoveryEvidenceItem[];
  matched_evidence_types?: string[];
  missing_evidence_types?: string[];
  answer_support?: {
    signal?: string;
    mapped_question_ids?: string[];
    answers?: Record<string, string>;
    missing_question_ids?: string[];
  };
}

export interface ProofGap {
  id?: string;
  control_id?: string;
  control_title?: string;
  severity?: RiskLevel;
  status?: string;
  missing_evidence_types?: string[];
  description?: string;
  client_friendly_risk?: string;
  technical_risk?: string;
  recommended_action?: string;
}

export interface RemediationTicket {
  id?: string;
  title?: string;
  priority?: RiskLevel;
  description?: string;
  evidence_needed?: string[];
  affected_controls?: string[];
  affected_business_processes?: string[];
  suggested_owner?: string;
  client_friendly_explanation?: string;
  technical_notes?: string;
}

export interface RecoveryProofReport {
  safe_defensive_only?: boolean;
  engine_version?: string;
  recovery_proof_score?: number;
  evidence_confidence?: number;
  controls_count?: number;
  evidence_items_count?: number;
  proven_controls?: RecoveryControlResult[];
  partially_proven_controls?: RecoveryControlResult[];
  unproven_controls?: RecoveryControlResult[];
  control_results?: RecoveryControlResult[];
  proof_gaps?: ProofGap[];
  remediation_tickets?: RemediationTicket[];
  client_summary?: string;
  technical_summary?: string;
  error?: string;
}

export interface RecoveryEvidenceResponse {
  session_id: string;
  count?: number;
  stored_count?: number;
  items?: RecoveryEvidenceItem[];
}

export interface RecoveryImportAdaptersResponse {
  safe_defensive_only?: boolean;
  execution_enabled?: boolean;
  network_calls_enabled?: boolean;
  adapters?: Array<{
    id?: string;
    name?: string;
    formats?: string[];
    execution_enabled?: boolean;
  }>;
}

export interface RecoveryTicketExportResponse {
  session_id?: string;
  safe_defensive_only?: boolean;
  format?: string;
  content_type?: string;
  content?: string;
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

export interface SourceLink {
  id?: string;
  name?: string;
  publisher?: string;
  type?: string;
  url?: string;
  note?: string;
}

export interface EvidenceItem {
  domain?: string;
  based_on_skill?: string;
  title?: string;
  nist_csf?: string[];
  items?: string[];
  source_refs?: string[];
  source_links?: SourceLink[];
  framework_mappings?: Record<string, string[]>;
  evidence_examples?: string[];
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
  source_refs?: string[];
  framework_mappings?: Record<string, string[]>;
  scoring_rationale_summary?: string;
  evidence_examples?: string[];
  attack_mappings?: Array<Record<string, unknown>>;
  attack_path_notes?: string;
}

export interface ScoreExplanationQuestion {
  question_id: string;
  question?: string;
  answer?: string | null;
  points_awarded: number;
  max_points: number;
  points_lost: number;
  rationale?: string;
  deduction_explanation?: string;
  recommendation_hint?: string;
  source_refs?: string[];
  framework_mappings?: Record<string, string[]>;
  attack_mappings?: Array<Record<string, unknown>>;
  evidence_examples?: string[];
}

export interface ScoreExplanationDomain {
  domain: string;
  title?: string;
  score: number;
  max_points: number;
  earned_points: number;
  questions: ScoreExplanationQuestion[];
}

export interface AssessmentMethodologySummary {
  methodology_name?: string;
  methodology_version?: string;
  questions_version?: string;
  scoring_version?: string;
  score_scale?: {
    min?: number;
    max?: number;
    higher_is_better?: boolean;
  };
  important_note?: string;
  scoring_principles?: string[];
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
  action_plan_generation?: {
    provider?: ProviderName;
    model?: string;
    used_real_llm?: boolean;
    error?: string | null;
    prompt_preview?: string;
  };
  sources?: unknown;
  methodology?: AssessmentMethodologySummary;
  score_explanation?: {
    methodology_version?: string;
    overall_score?: number;
    score_status?: ScoreStatus;
    domains?: ScoreExplanationDomain[];
  };
  threat_overlay?: {
    status?: string;
    description?: string;
    does_not_affect_score_yet?: boolean;
    planned_inputs?: string[];
  };
  recovery_proof?: RecoveryProofReport;
  recovery_proof_score?: number;
  evidence_confidence?: number;
  proof_gaps?: ProofGap[];
  remediation_tickets?: RemediationTicket[];
}

export interface ChatResponse {
  session_id: string;
  session_path?: SessionPath;
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
  display_message?: string;
  session_path?: SessionPath;
}

export interface SessionCreateResponse {
  session_id: string;
  session_path?: SessionPath;
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
  session_path?: SessionPath;
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
  path?: SessionPath;
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
