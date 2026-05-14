import type {
  ArtifactId,
  ChatResponse,
  ChatTechnicalDetails,
  Question,
  ScoreResponse,
  SessionStateResponse,
  SessionSummary,
} from "../types/api";
import type { Tone } from "../components/ui";

const answerLabels: Record<string, string> = {
  yes: "Yes",
  partial: "Partial",
  no: "No",
  unsure: "Unsure",
};

const domainLabels: Record<string, string> = {
  backups: "Backups",
  mfa_access: "MFA",
  mfa: "MFA",
  patching: "Patching",
  admin_rights: "Admin rights",
  incident_response: "Incident response",
  detection_monitoring: "Detection & monitoring",
  employee_security_hygiene: "Employee hygiene",
};

const quickActionsByDomain: Record<string, string[]> = {
  backups: [
    "Why do we need to test backup restore?",
    "What counts as an offline or immutable backup?",
    "How should we answer if backups exist but restore is untested?",
    "Show the next backup question",
  ],
  mfa_access: [
    "What does MFA mean?",
    "Why is admin MFA more important?",
    "How should remote access MFA be checked?",
    "Show the next MFA question",
  ],
  mfa: [
    "What does MFA mean?",
    "Why is admin MFA more important?",
    "How should remote access MFA be checked?",
    "Show the next MFA question",
  ],
  patching: [
    "What is a critical patch SLA?",
    "Is 30 days fast enough for critical patches?",
    "How do we identify internet-facing systems?",
    "Show the next patching question",
  ],
  admin_rights: [
    "What does least privilege mean?",
    "Why review admin rights regularly?",
    "What evidence proves admin access is controlled?",
    "Show the next admin rights question",
  ],
  incident_response: [
    "What is an incident response plan?",
    "Why run a ransomware tabletop exercise?",
    "When should CERT-EE or legal counsel be involved?",
    "Show the next IR question",
  ],
  detection_monitoring: [
    "What logs matter for ransomware readiness?",
    "Who should review endpoint alerts?",
    "What counts as failed login monitoring?",
    "Show the next detection question",
  ],
  employee_security_hygiene: [
    "Why use a password manager?",
    "What should employees do with recovery codes?",
    "How should phishing be reported?",
    "Show the next question",
  ],
};

export function sanitizeAssistantMessage(content: string): string {
  return content
    .replace(
      /Selge,\s*m\S*rkisin vastused:\s*(?:[\w-]+\s*=\s*(?:yes|partial|no|unsure)(?:;\s*)?)+\./giu,
      "Selge, marked the answers.",
    )
    .replace(
      /Selge,\s*m\S*rkisin vastuse:\s*[\w-]+\s*=\s*(?:yes|partial|no|unsure)\./giu,
      "Selge, marked the answer.",
    )
    .replace(
      /I recorded the answer:\s*[\w-]+\s*=\s*(?:yes|partial|no|unsure)\./giu,
      "I recorded the answer.",
    )
    .replace(
      /I recorded the answers:\s*(?:[\w-]+\s*=\s*(?:yes|partial|no|unsure)(?:;\s*)?)+\./giu,
      "I recorded the answers.",
    );
}

export function buildTechnicalDetails(
  response: ChatResponse,
  questions: Question[],
): ChatTechnicalDetails {
  const questionLookup = new Map(questions.map((question) => [question.id, question]));
  const extractedAnswers = Object.entries(response.extracted_answers || {}).map(
    ([questionId, answer]) => ({
      questionId,
      questionText: questionLookup.get(questionId)?.question,
      answer,
      answerLabel: answerLabels[answer] || answer,
    }),
  );

  return {
    intent: response.intent,
    provider: response.provider,
    usedFallback: response.used_fallback,
    responseType: response.response_type,
    currentQuestionId: response.current_question_id,
    currentDomain: response.current_domain,
    completionRate: response.score?.completion_rate ?? response.completion_rate,
    scoreStatus: response.score?.score_status ?? response.report?.score_status,
    redactionsApplied: response.redactions_applied,
    redactedForLlm: response.redacted_for_llm,
    promptInjectionBlocked: response.prompt_injection_blocked,
    promptInjectionReason: response.prompt_injection_reason,
    extractedAnswers,
    missingRequiredQuestions: response.missing_required_questions,
    unclearQuestions: response.unclear_questions,
  };
}

export function artifactsForResponse(response: ChatResponse): ArtifactId[] {
  if (response.report) {
    return [
      "readiness-report",
      "action-plan",
      "evidence-binder",
      "skills",
      "technical-json",
    ];
  }
  if (response.score || Object.keys(response.extracted_answers || {}).length) {
    return ["technical-json"];
  }
  return [];
}

export function getQuickActions(domain?: string | null): string[] {
  const normalized = String(domain || "").toLowerCase();
  return (
    quickActionsByDomain[normalized] || [
      "What does MFA mean?",
      "Why test backup restore?",
      "What is incident response?",
      "Create report",
      "Show next question",
    ]
  );
}

export function domainLabel(domain?: string | null): string {
  const normalized = String(domain || "").toLowerCase();
  return domainLabels[normalized] || String(domain || "Assessment");
}

export function isEarlyPreview(completionRate?: number): boolean {
  return Number(completionRate || 0) < 50;
}

export function scoreConfidenceLabel(completionRate?: number): string {
  if (isEarlyPreview(completionRate)) {
    return "Confidence low";
  }
  if (Number(completionRate || 0) < 100) {
    return "Confidence medium";
  }
  return "Confidence high";
}

export function riskToneForCompletion(riskLevel?: string, completionRate?: number): Tone {
  if (isEarlyPreview(completionRate)) {
    return "neutral";
  }
  const normalized = String(riskLevel || "").toLowerCase();
  if (normalized === "low") {
    return "success";
  }
  if (normalized === "medium") {
    return "warning";
  }
  if (normalized === "high") {
    return "orange";
  }
  if (normalized === "critical") {
    return "danger";
  }
  return "neutral";
}

export function buildReadableSessionTitle({
  score,
  session,
  existing,
  profileName,
  explicitTitle,
}: {
  score?: ScoreResponse | null;
  session?: SessionStateResponse | null;
  existing?: SessionSummary;
  profileName?: string;
  explicitTitle?: string;
}): string {
  if (explicitTitle) {
    return explicitTitle;
  }
  if (profileName) {
    const lowered = profileName.toLowerCase();
    if (lowered.includes("weak") || lowered.includes("nork")) {
      return "Weak SME demo";
    }
    if (lowered.includes("better") || lowered.includes("parem")) {
      return "Better SME demo";
    }
    return profileName;
  }
  if (existing?.profileName) {
    return existing.title;
  }

  const completionRate =
    score?.completion_rate ?? session?.progress?.completion_rate ?? existing?.completionRate;
  const domainDetails = Object.entries(score?.domain_details || {});
  if (domainDetails.length && completionRate !== undefined) {
    const [domain, detail] = domainDetails.sort(
      (a, b) => Number(a[1].score || 0) - Number(b[1].score || 0),
    )[0];
    const title = detail.title || domainLabel(domain);
    const risk = String(detail.risk_level || score?.risk_level || "risk").toLowerCase();
    return `${title} ${risk} risk · ${completionRate}% complete`;
  }

  if (completionRate !== undefined && completionRate > 0) {
    return `Standard assessment · ${completionRate}% complete`;
  }

  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return `Standard assessment · ${date}`;
}
