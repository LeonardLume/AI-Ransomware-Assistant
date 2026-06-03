import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  chat,
  createSession,
  getProviderStatus,
  getQuestions,
  getReport,
  getScore,
  getSession,
  getTechnicalFlow,
  healthCheck,
  loadDemoProfile,
} from "./api/client";
import AssessmentStatusFooter from "./components/AssessmentStatusFooter";
import ChatPanel from "./components/ChatPanel";
import HeroDashboard from "./components/HeroDashboard";
import LandingPage from "./components/LandingPage";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Layout, { type AppView } from "./components/Layout";
import ProfileSetupPage, { type ProfileSetupValues } from "./components/ProfileSetupPage";
import RecoveryWorkspaceFooter from "./components/RecoveryWorkspaceFooter";
import SessionArtifactOverlay from "./components/SessionArtifactOverlay";
import { cn } from "./components/ui-helpers";
import {
  artifactsForResponse,
  buildReadableSessionTitle,
  buildTechnicalDetails,
  sanitizeAssistantMessage,
} from "./utils/assessmentUi";
import { t, type UiLanguage } from "./utils/i18n";
import {
  buildRecoveryAssistantPrompt,
  isRecoveryAssistantContent,
  sanitizeRecoveryAssistantMessage,
  visibleRecoveryAssistantContent,
} from "./utils/recoveryAssistant";
import {
  getStoredReport,
  getSessions,
  makeSessionSummary,
  removeSession,
  saveStoredReport,
  upsertSession,
} from "./state/sessionStore";
import type {
  ArtifactId,
  BackendChatMessage,
  ChatRequestOptions,
  ChatResponse,
  ProviderStatusResponse,
  Question,
  ReportResponse,
  ScoreResponse,
  SessionPath,
  SessionStateResponse,
  SessionSummary,
  TechnicalFlowResponse,
  UiMessage,
} from "./types/api";

function normalizeRole(role: BackendChatMessage["role"]): UiMessage["role"] {
  return role === "user" || role === "assistant" ? role : "system";
}

function stableMessageId(
  role: BackendChatMessage["role"],
  index: number,
  content: string,
): string {
  const normalizedRole = normalizeRole(role);
  const normalizedContent = visibleRecoveryAssistantContent(String(content || ""))
    .replace(/\s+/g, " ")
    .trim();
  return `${normalizedRole}-${index}-${normalizedContent}`;
}

function toUiMessages(
  history: BackendChatMessage[] | undefined,
): UiMessage[] {
  return (history || [])
    .filter((message) => Boolean(message.content))
    .map((message, index) => {
      const timestamp =
        typeof message.timestamp === "number"
          ? new Date(message.timestamp).toISOString()
          : message.timestamp || new Date().toISOString();
      return {
        id: stableMessageId(message.role, index, String(message.content || "")),
        role: normalizeRole(message.role),
        content:
          normalizeRole(message.role) === "assistant"
            ? sanitizeAssistantMessage(String(message.content || ""))
            : visibleRecoveryAssistantContent(String(message.content || "")),
        timestamp,
      };
    });
}

function toVisibleBackendHistory(
  history: BackendChatMessage[] | undefined,
): BackendChatMessage[] {
  return (history || []).map((message) =>
    normalizeRole(message.role) === "user"
      ? { ...message, content: visibleRecoveryAssistantContent(String(message.content || "")) }
      : message,
  );
}

function makeLocalMessage(
  role: UiMessage["role"],
  content: string,
  patch: Partial<UiMessage> = {},
): UiMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `${role}-${timestamp}-${Math.random().toString(16).slice(2)}`,
    role,
    content: role === "assistant" ? sanitizeAssistantMessage(content) : content,
    timestamp,
    ...patch,
  };
}

function attachLatestAssistantMetadata(
  messages: UiMessage[],
  response: ChatResponse,
  questions: Question[],
): UiMessage[] {
  const details = buildTechnicalDetails(response, questions);
  const openedArtifacts = artifactsForResponse(response);
  const lastAssistantIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;

  if (lastAssistantIndex === undefined) {
    return messages;
  }

  return messages.map((message, index) =>
    index === lastAssistantIndex
      ? {
          ...message,
          technicalDetails: details,
          assistantTransparency: response.assistant_transparency,
          openedArtifacts,
        }
      : message,
  );
}

function preserveAssistantMetadata(
  previousMessages: UiMessage[],
  nextMessages: UiMessage[],
): UiMessage[] {
  const previousAssistants = previousMessages.filter((message) => message.role === "assistant");
  let assistantIndex = 0;

  return nextMessages.map((message, index) => {
    const previousAtIndex = previousMessages[index];
    if (message.role !== "assistant") {
      if (
        previousAtIndex &&
        previousAtIndex.role === message.role &&
        previousAtIndex.content === message.content
      ) {
        return previousAtIndex;
      }
      return message;
    }

    const previous = previousAssistants[assistantIndex];
    assistantIndex += 1;
    if (!previous || previous.content !== message.content) {
      return message;
    }

    if (
      previousAtIndex &&
      previousAtIndex.role === message.role &&
      previousAtIndex.content === message.content
    ) {
      return previousAtIndex;
    }

    return {
      ...message,
      technicalDetails: previous.technicalDetails,
      assistantTransparency: previous.assistantTransparency,
      openedArtifacts: previous.openedArtifacts,
    };
  });
}

function buildSessionSnapshot(
  previous: SessionStateResponse | null,
  response: ChatResponse,
): SessionStateResponse {
  const sameSession = previous?.session_id === response.session_id;
  const nextAnswers = { ...(sameSession ? previous?.answers || {} : {}) };

  for (const [questionId, answer] of Object.entries(response.extracted_answers || {})) {
    nextAnswers[questionId] = {
      ...(nextAnswers[questionId] || {}),
      answer,
      source: nextAnswers[questionId]?.source || "ai_interview",
    };
  }

  return {
    session_id: response.session_id,
    session_path: response.session_path || (sameSession ? previous?.session_path : undefined),
    org_info: sameSession ? previous?.org_info : {},
    answers: nextAnswers,
    followups: sameSession ? previous?.followups || [] : [],
    events: sameSession ? previous?.events || [] : [],
    chat_history: response.chat_history
      ? toVisibleBackendHistory(response.chat_history)
      : previous?.chat_history || [],
    context_notes: response.context_notes || (sameSession ? previous?.context_notes || [] : []),
    pending_answer: response.pending_answer ?? (sameSession ? previous?.pending_answer ?? null : null),
    unclear_question_ids: response.unclear_questions || [],
    current_question_id: response.current_question_id,
    current_domain: response.current_domain,
    interview_complete: Boolean(response.is_complete),
    completion_mode: response.completion_mode,
    progress: {
      ...(sameSession ? previous?.progress || {} : {}),
      completion_rate: response.completion_rate,
      is_complete: response.is_complete,
    },
  };
}

function createEmptyRecoverySessionState(
  sessionId: string,
  orgInfo: Record<string, unknown> = {},
): SessionStateResponse {
  return {
    session_id: sessionId,
    session_path: "recovery-proof",
    org_info: orgInfo,
    answers: {},
    followups: [],
    events: [],
    chat_history: [],
    context_notes: [],
    pending_answer: null,
    unclear_question_ids: [],
    recovery_evidence: [],
    recovery_proof: null,
    current_question_id: null,
    current_domain: null,
    interview_complete: false,
    completion_mode: "recovery_proof_workspace",
    progress: {
      completion_rate: 0,
      is_complete: false,
    },
  };
}

function mergeChatResponseMessages(
  previousMessages: UiMessage[],
  response: ChatResponse,
  questions: Question[],
): UiMessage[] {
  const recoveryAssistantMode = (response.chat_history || []).some((message) =>
    isRecoveryAssistantContent(String(message.content || "")),
  );
  const nextMessages = response.chat_history?.length
    ? toUiMessages(response.chat_history)
    : response.assistant_message
      ? [
          ...previousMessages,
          makeLocalMessage("assistant", response.assistant_message || "", {
            technicalDetails: buildTechnicalDetails(response, questions),
            assistantTransparency: response.assistant_transparency,
            openedArtifacts: artifactsForResponse(response),
          }),
        ]
      : previousMessages;

  const merged = attachLatestAssistantMetadata(
    preserveAssistantMetadata(previousMessages, nextMessages),
    response,
    questions,
  );

  if (!recoveryAssistantMode) {
    return merged;
  }

  return merged.map((message) =>
    message.role === "assistant"
      ? {
          ...message,
          content: sanitizeRecoveryAssistantMessage(message.content),
          assistantTransparency: undefined,
        }
      : message,
  );
}

function latestAssistantMessageId(messages: UiMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return messages[index].id;
    }
  }
  return null;
}

function messageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error while talking to the backend.";
}

const UI_STATE_KEY = "ransomware-readiness.ui-state";
const PROFILE_STATE_KEY = "ransomware-readiness.profile";
const artifactIds = new Set<ArtifactId>([
  "readiness-report",
  "action-plan",
  "evidence-binder",
  "recovery-proof",
  "skills",
  "ransomware-playbook",
  "technical-json",
]);

type PersistedUiState = {
  activeSessionId: string | null;
  activeView: AppView;
  activeArtifact: ArtifactId;
  artifactOverlayOpen: boolean;
};

function viewFromLocation(): AppView | null {
  if (window.location.pathname === "/landing") return "landing";
  if (window.location.pathname === "/profile/create") return "profile-create";
  return null;
}

function readStoredProfile(): ProfileSetupValues | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const profile = parsed as Partial<ProfileSetupValues>;
    if (
      typeof profile.organizationName !== "string" ||
      typeof profile.industry !== "string" ||
      typeof profile.organizationSize !== "string" ||
      typeof profile.assessmentOwner !== "string"
    ) {
      return null;
    }
    return {
      organizationName: profile.organizationName,
      industry: profile.industry,
      organizationSize: profile.organizationSize,
      assessmentOwner: profile.assessmentOwner,
    };
  } catch {
    return null;
  }
}

function readPersistedUiState(): Partial<PersistedUiState> {
  try {
    const raw = window.localStorage.getItem(UI_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return {
      activeSessionId: typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : null,
      activeView: parsed.activeView === "interview" ? "interview" : "home",
      activeArtifact: artifactIds.has(parsed.activeArtifact) ? parsed.activeArtifact : "readiness-report",
      artifactOverlayOpen: Boolean(parsed.artifactOverlayOpen),
    };
  } catch {
    return {};
  }
}

function artifactNeedsReport(artifact: ArtifactId): boolean {
  return artifact === "readiness-report" ||
    artifact === "action-plan" ||
    artifact === "evidence-binder" ||
    artifact === "skills" ||
    artifact === "ransomware-playbook";
}

function artifactForSessionPath(artifact: ArtifactId, path: SessionPath): ArtifactId {
  const normalized = artifact === "ransomware-playbook" ? "skills" : artifact;
  if (path === "questionnaire") {
    return normalized === "recovery-proof" ? "readiness-report" : normalized;
  }
  if (
    normalized === "action-plan" ||
    normalized === "evidence-binder" ||
    normalized === "skills"
  ) {
    return "recovery-proof";
  }
  return normalized;
}

function isSessionPath(value: unknown): value is SessionPath {
  return value === "recovery-proof" || value === "questionnaire";
}

function inferSessionPath(
  summary?: SessionSummary | null,
  session?: SessionStateResponse | null,
): SessionPath {
  if (isSessionPath(session?.session_path)) {
    return session.session_path;
  }
  if (isSessionPath(summary?.path)) {
    return summary.path;
  }
  if (session?.completion_mode === "recovery_proof_workspace") {
    return "recovery-proof";
  }
  if (
    (session?.chat_history || []).some((message) =>
      isRecoveryAssistantContent(String(message.content || "")),
    )
  ) {
    return "recovery-proof";
  }
  if (
    session?.current_question_id ||
    Object.keys(session?.answers || {}).length ||
    session?.completion_mode === "full" ||
    session?.completion_mode === "preliminary"
  ) {
    return "questionnaire";
  }
  return "recovery-proof";
}

export default function App() {
  const didInitialLoadRef = useRef(false);
  const initialUiStateRef = useRef(readPersistedUiState());
  const [backendOnline, setBackendOnline] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [technicalFlow, setTechnicalFlow] = useState<TechnicalFlowResponse | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialUiStateRef.current.activeSessionId ?? null,
  );
  const [sessionState, setSessionState] = useState<SessionStateResponse | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [animateMessageId, setAnimateMessageId] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>(
    initialUiStateRef.current.activeArtifact ?? "readiness-report",
  );
  const [artifactOverlayOpen, setArtifactOverlayOpen] = useState(
    Boolean(initialUiStateRef.current.artifactOverlayOpen),
  );
  const [activeView, setActiveView] = useState<AppView>(
    viewFromLocation() ?? initialUiStateRef.current.activeView ?? "home",
  );
  const [workspaceProfile, setWorkspaceProfile] = useState<ProfileSetupValues | null>(() =>
    readStoredProfile(),
  );
  const [language, setLanguage] = useState<UiLanguage>(() => {
    const saved = window.localStorage.getItem("ransomware-readiness.language");
    return saved === "en" || saved === "ru" || saved === "et" ? saved : "et";
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sending, setSending] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastUserOptions, setLastUserOptions] = useState<ChatRequestOptions>({});
  const activeSessionSummary = sessions.find((session) => session.id === activeSessionId) || null;
  const activeSessionPath = inferSessionPath(activeSessionSummary, sessionState);

  function resetWorkspaceState() {
    setActiveSessionId(null);
    setSessionState(null);
    setScore(null);
    setReport(null);
    setLastResponse(null);
    setMessages([]);
    setAnimateMessageId(null);
    setLastUserMessage(null);
    setLastUserOptions({});
    setActiveArtifact("readiness-report");
    setArtifactOverlayOpen(false);
    setActiveView("home");
  }

  function changeLanguage(nextLanguage: UiLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("ransomware-readiness.language", nextLanguage);
  }

  const refreshSessionMetadata = useCallback(
    (
      sessionId: string,
      patch: Partial<SessionSummary> & {
        score?: ScoreResponse | null;
        session?: SessionStateResponse | null;
        explicitTitle?: string;
        touch?: boolean;
      } = {},
    ) => {
      const existing = getSessions().find((item) => item.id === sessionId);
      const shouldTouch = patch.touch !== false;
      const title = buildReadableSessionTitle({
        score: patch.score,
        session: patch.session,
        existing,
        profileName: patch.profileName,
        explicitTitle: patch.explicitTitle || patch.title,
      });
      const next = upsertSession(
        makeSessionSummary(sessionId, {
          ...existing,
          ...patch,
          title,
          createdAt: existing?.createdAt,
          updatedAt: shouldTouch ? new Date().toISOString() : existing?.updatedAt,
        }),
      );
      setSessions(next);
    },
    [],
  );

  const refreshBackendState = useCallback(
    async (
      sessionId: string,
      options: { includeReport?: boolean; updateMessages?: boolean; touchSession?: boolean } = {},
    ) => {
      const [sessionResult, scoreResult] = await Promise.allSettled([
        getSession(sessionId),
        getScore(sessionId),
      ]);

      let nextScore: ScoreResponse | null = null;
      let nextSession: SessionStateResponse | null = null;
      if (sessionResult.status === "rejected") {
        throw sessionResult.reason;
      }
      if (sessionResult.status === "fulfilled") {
        nextSession = sessionResult.value;
        setSessionState(sessionResult.value);
        if (options.updateMessages !== false && sessionResult.value.chat_history) {
          setMessages(toUiMessages(sessionResult.value.chat_history));
          setAnimateMessageId(null);
        }
      }
      if (scoreResult.status === "fulfilled") {
        nextScore = scoreResult.value;
        setScore(scoreResult.value);
      }
      if (options.includeReport) {
        const nextReport = await getReport(sessionId);
        setReport(nextReport);
        saveStoredReport(sessionId, nextReport);
        nextScore = nextReport;
      }

      refreshSessionMetadata(sessionId, {
        score: nextScore,
        session: nextSession,
        path: isSessionPath(nextSession?.session_path) ? nextSession.session_path : undefined,
        touch: options.touchSession,
        completionRate:
          nextScore?.completion_rate ??
          (sessionResult.status === "fulfilled"
            ? sessionResult.value.progress?.completion_rate
            : undefined),
        riskLevel: nextScore?.risk_level,
      });
    },
    [refreshSessionMetadata],
  );

  const applyChatResponse = useCallback(
    async (
      response: ChatResponse,
      options: {
        animateLatestAssistant?: boolean;
        sessionPath?: SessionPath;
        explicitTitle?: string;
      } = {},
    ) => {
      setActiveSessionId(response.session_id);
      setLastResponse(response);
      setBackendOnline(true);
      setError(null);
      setSessionState((current) => buildSessionSnapshot(current, response));

      let nextAnimatedMessageId: string | null = null;
      setMessages((current) => {
        const merged = mergeChatResponseMessages(current, response, questions);
        if (options.animateLatestAssistant) {
          nextAnimatedMessageId = latestAssistantMessageId(merged);
        }
        return merged;
      });
      setAnimateMessageId(options.animateLatestAssistant ? nextAnimatedMessageId : null);

      if (response.score) {
        setScore(response.score);
      }
      if (response.report) {
        setReport(response.report);
        saveStoredReport(response.session_id, response.report);
        setActiveArtifact("readiness-report");
        setArtifactOverlayOpen(true);
        setActiveView("interview");
      }

      refreshSessionMetadata(response.session_id, {
        score: response.report || response.score,
        completionRate: response.score?.completion_rate ?? response.completion_rate,
        riskLevel: response.score?.risk_level ?? response.report?.risk_level,
        path: response.session_path || options.sessionPath,
        explicitTitle: options.explicitTitle,
      });
    },
    [questions, refreshSessionMetadata],
  );

  const bootstrap = useCallback(async () => {
    const [healthResult, providerResult, questionsResult, flowResult] =
      await Promise.allSettled([
        healthCheck(),
        getProviderStatus(),
        getQuestions(),
        getTechnicalFlow(),
      ]);

    if (healthResult.status === "fulfilled") {
      setBackendOnline(healthResult.value.status === "ok");
      if (healthResult.value.llm) {
        setProviderStatus(healthResult.value.llm);
      }
    } else {
      setBackendOnline(false);
    }

    if (providerResult.status === "fulfilled") {
      setProviderStatus(providerResult.value);
      setBackendOnline(true);
    }
    if (questionsResult.status === "fulfilled") {
      setQuestions(questionsResult.value);
      setBackendOnline(true);
    }
    if (flowResult.status === "fulfilled") {
      setTechnicalFlow(flowResult.value);
      setBackendOnline(true);
    }
  }, []);

  const selectSession = useCallback(
    async (sessionId: string) => {
      const shouldKeepReport = sessionId === activeSessionId && Boolean(report);
      const shouldLoadReport =
        artifactOverlayOpen && artifactNeedsReport(activeArtifact);
      const cachedReport = getStoredReport(sessionId);
      setError(null);
      if (!shouldKeepReport) {
        setReport(cachedReport);
      }
      setMessages([]);
      setAnimateMessageId(null);
      setActiveSessionId(sessionId);
      setActiveView("interview");
      setSidebarOpen(false);
      try {
        await refreshBackendState(sessionId, {
          includeReport: (shouldLoadReport || shouldKeepReport) && !cachedReport,
          touchSession: false,
        });
      } catch (selectError) {
        if (selectError instanceof ApiError && selectError.status === 404) {
          setSessions(removeSession(sessionId));
          resetWorkspaceState();
          setMessages([
            makeLocalMessage(
              "system",
              "That local session no longer exists in the backend, so I removed it from the browser list. Start a new assessment when ready.",
            ),
          ]);
          setBackendOnline(true);
          return;
        }
        setBackendOnline(false);
        setError(messageFromError(selectError));
      }
    },
    [activeArtifact, activeSessionId, artifactOverlayOpen, refreshBackendState, report],
  );

  useEffect(() => {
    if (didInitialLoadRef.current) {
      return;
    }
    didInitialLoadRef.current = true;
    const localSessions = getSessions();
    setSessions(localSessions);
    void bootstrap();
    const restored = initialUiStateRef.current;
    const locationView = viewFromLocation();
    const restoredSessionExists = localSessions.some((session) => session.id === restored.activeSessionId);
    const sessionId = restoredSessionExists ? restored.activeSessionId : null;

    if (sessionId) {
      const cachedReport = getStoredReport(sessionId);
      setActiveSessionId(sessionId);
      setReport(cachedReport);
      setActiveView(locationView ?? restored.activeView ?? "home");
      setActiveArtifact(restored.activeArtifact ?? "readiness-report");
      setArtifactOverlayOpen(Boolean(restored.artifactOverlayOpen));
      void refreshBackendState(sessionId, {
        touchSession: false,
        includeReport: Boolean(
          restored.artifactOverlayOpen &&
          artifactNeedsReport(restored.activeArtifact ?? "readiness-report") &&
          !cachedReport,
        ),
      }).catch(async (restoreError) => {
        if (restoreError instanceof ApiError && restoreError.status === 404) {
          setSessions(removeSession(sessionId));
          resetWorkspaceState();
          return;
        }
        try {
          await refreshBackendState(sessionId, { includeReport: false, touchSession: false });
        } catch (fallbackError) {
          setBackendOnline(false);
          setError(messageFromError(fallbackError));
        }
      });
    } else {
      setActiveSessionId(null);
      setSessionState(null);
      setScore(null);
      setReport(null);
      setLastResponse(null);
      setMessages([]);
      setAnimateMessageId(null);
      setArtifactOverlayOpen(false);
      if (locationView) {
        setActiveView(locationView);
      } else if (restored.activeView === "interview") {
        setActiveView("home");
      }
    }
  }, [bootstrap, refreshBackendState]);

  useEffect(() => {
    window.localStorage.setItem(
      UI_STATE_KEY,
      JSON.stringify({
        activeSessionId,
        activeView,
        activeArtifact,
        artifactOverlayOpen,
      } satisfies PersistedUiState),
    );
  }, [activeArtifact, activeSessionId, activeView, artifactOverlayOpen]);

  useEffect(() => {
    const nextPath =
      activeView === "landing"
        ? "/landing"
        : activeView === "profile-create"
          ? "/profile/create"
          : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ activeView }, "", nextPath);
    }
  }, [activeView]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(viewFromLocation() ?? "home");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const artifactOverlayVisible = activeView === "interview" && artifactOverlayOpen;

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (artifactOverlayVisible) {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 0);
    }
  }, [activeArtifact, artifactOverlayVisible, report]);

  useEffect(() => {
    document.body.classList.toggle("artifact-page-open", artifactOverlayVisible);
    return () => document.body.classList.remove("artifact-page-open");
  }, [artifactOverlayVisible]);

  useEffect(() => {
    document.body.classList.toggle(
      "interview-page-open",
      activeView === "interview",
    );
    return () => document.body.classList.remove("interview-page-open");
  }, [activeView]);

  useEffect(() => {
    const allowedArtifact = artifactForSessionPath(activeArtifact, activeSessionPath);
    if (allowedArtifact !== activeArtifact) {
      setActiveArtifact(allowedArtifact);
    }
  }, [activeArtifact, activeSessionPath]);

  async function startRecoveryProofSession() {
    setSending(true);
    setError(null);
    setReport(null);
    setScore(null);
    setAnimateMessageId(null);
    setLastResponse(null);
    setLastUserMessage(null);
    setLastUserOptions({ session_path: "recovery-proof" });
    setArtifactOverlayOpen(false);
    setActiveView("interview");
    setSidebarOpen(false);
    try {
      const session = await createSession({}, "recovery-proof");
      setActiveSessionId(session.session_id);
      setSessionState(createEmptyRecoverySessionState(session.session_id, session.org_info || {}));
      setLastResponse(null);
      setMessages([
        makeLocalMessage(
          "assistant",
          "Start with recovery proof. Import backup, M365, Wazuh, Prowler, DefectDojo, or manual evidence, then I can help interpret proof gaps and draft MSP tickets.",
        ),
      ]);
      refreshSessionMetadata(session.session_id, {
        explicitTitle: "Recovery proof workspace",
        completionRate: 0,
        path: "recovery-proof",
      });
      setBackendOnline(true);
    } catch (startError) {
      setBackendOnline(false);
      setError(messageFromError(startError));
    } finally {
      setSending(false);
    }
  }

  async function startQuestionnaireSession() {
    setSending(true);
    setError(null);
    setReport(null);
    setScore(null);
    setSessionState(null);
    setLastResponse(null);
    setMessages([]);
    setAnimateMessageId(null);
    setLastUserMessage(null);
    setLastUserOptions({ session_path: "questionnaire" });
    setArtifactOverlayOpen(false);
    setActiveArtifact("readiness-report");
    setActiveView("interview");
    setSidebarOpen(false);

    try {
      const response = await chat(null, "", { session_path: "questionnaire" });
      await applyChatResponse(response, {
        animateLatestAssistant: true,
        sessionPath: "questionnaire",
        explicitTitle: "Questionnaire assessment",
      });
      setBackendOnline(true);
    } catch (startError) {
      setBackendOnline(false);
      setError(messageFromError(startError));
    } finally {
      setSending(false);
    }
  }

  async function startSessionPath(path: SessionPath) {
    if (path === "questionnaire") {
      await startQuestionnaireSession();
      return;
    }
    await startRecoveryProofSession();
  }

  async function startAssessment() {
    await startRecoveryProofSession();
  }

  async function sendMessage(message: string, options: ChatRequestOptions = {}) {
    const sessionPath = options.session_path || activeSessionPath;
    if (!message.trim()) {
      await startSessionPath(sessionPath);
      return;
    }

    setSending(true);
    setError(null);
    setLastUserMessage(message);
    setLastUserOptions(options);
    setAnimateMessageId(null);
    setArtifactOverlayOpen(false);
    setActiveView("interview");

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        if (sessionPath === "questionnaire") {
          const visibleMessage = options.display_message || message;
          setMessages((current) => [...current, makeLocalMessage("user", visibleMessage)]);
          const response = await chat(null, message, options);
          await applyChatResponse(response, {
            animateLatestAssistant: true,
            sessionPath,
            explicitTitle: "Questionnaire assessment",
          });
          return;
        }
        const session = await createSession({}, "recovery-proof");
        sessionId = session.session_id;
        setActiveSessionId(sessionId);
        setSessionState(createEmptyRecoverySessionState(sessionId, session.org_info || {}));
      }

      const visibleMessage = options.display_message || visibleRecoveryAssistantContent(message);
      setMessages((current) => [...current, makeLocalMessage("user", visibleMessage)]);
      const response = await chat(sessionId, message, options);
      await applyChatResponse(response, { animateLatestAssistant: true, sessionPath });
    } catch (sendError) {
      if (sendError instanceof ApiError && sendError.status === 404 && activeSessionId) {
        const staleSessionId = activeSessionId;
        setSessions(removeSession(staleSessionId));
        resetWorkspaceState();
        try {
          if (sessionPath === "questionnaire") {
            const response = await chat(null, message, options);
            await applyChatResponse(response, {
              animateLatestAssistant: true,
              sessionPath,
              explicitTitle: "Questionnaire assessment",
            });
            return;
          }
          const session = await createSession({}, "recovery-proof");
          setActiveSessionId(session.session_id);
          setMessages((current) => [
            ...current,
            makeLocalMessage("user", options.display_message || visibleRecoveryAssistantContent(message)),
          ]);
          const response = await chat(session.session_id, message, options);
          await applyChatResponse(response, { animateLatestAssistant: true, sessionPath });
          return;
        } catch (retryError) {
          setBackendOnline(false);
          setError(messageFromError(retryError));
          return;
        }
      }
      setBackendOnline(false);
      setError(messageFromError(sendError));
    } finally {
      setSending(false);
    }
  }

  async function sendNewSessionMessage(message: string, path: SessionPath = "questionnaire") {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      await startSessionPath(path);
      return;
    }

    setSending(true);
    setError(null);
    setLastUserMessage(trimmedMessage);
    setReport(null);
    setScore(null);
    setSessionState(null);
    setLastResponse(null);
    setAnimateMessageId(null);
    setArtifactOverlayOpen(false);
    setActiveView("interview");
    setSidebarOpen(false);
    setLastUserOptions({ session_path: path });
    setMessages([makeLocalMessage("user", trimmedMessage)]);

    try {
      if (path === "recovery-proof") {
        const session = await createSession({}, "recovery-proof");
        setActiveSessionId(session.session_id);
        setSessionState(createEmptyRecoverySessionState(session.session_id, session.org_info || {}));
        const response = await chat(
          session.session_id,
          buildRecoveryAssistantPrompt(trimmedMessage),
          {
            intent_mode: "advisory",
            display_message: trimmedMessage,
            session_path: "recovery-proof",
          },
        );
        await applyChatResponse(response, {
          animateLatestAssistant: true,
          sessionPath: "recovery-proof",
          explicitTitle: "Recovery proof workspace",
        });
        return;
      }
      const session = await createSession({}, "questionnaire");
      setActiveSessionId(session.session_id);
      const response = await chat(session.session_id, trimmedMessage, { session_path: "questionnaire" });
      await applyChatResponse(response, {
        animateLatestAssistant: true,
        sessionPath: "questionnaire",
        explicitTitle: "Questionnaire assessment",
      });
    } catch (sendError) {
      setBackendOnline(false);
      setError(messageFromError(sendError));
    } finally {
      setSending(false);
    }
  }

  async function retryLastMessage() {
    if (lastUserMessage) {
      await sendMessage(lastUserMessage, lastUserOptions);
    } else {
      await startSessionPath(lastUserOptions.session_path || activeSessionPath);
    }
  }

  async function handleLoadDemo(profileId: "weak_sme" | "better_sme") {
    setSending(true);
    setError(null);
    setReport(null);
    setArtifactOverlayOpen(false);
    setActiveView("interview");
    setSidebarOpen(false);
    try {
      const demo = await loadDemoProfile(profileId);
      const sessionId = demo.session_id;
      setActiveSessionId(sessionId);
      setAnimateMessageId(null);

      const [sessionResult, scoreResult, reportResult] = await Promise.allSettled([
        getSession(sessionId),
        getScore(sessionId),
        getReport(sessionId),
      ]);
      if (sessionResult.status === "fulfilled") {
        setSessionState(sessionResult.value);
      }
      if (scoreResult.status === "fulfilled") {
        setScore(scoreResult.value);
      }
      if (reportResult.status === "fulfilled") {
        setReport(reportResult.value);
        saveStoredReport(sessionId, reportResult.value);
        setActiveArtifact("readiness-report");
        setActiveView("interview");
      }
      const assistantMessage = `Demo profile "${demo.profile_name || profileId}" is loaded. The report is ready in Session artifacts.`;
      const demoResponse: ChatResponse = {
        session_id: sessionId,
        assistant_message: assistantMessage,
        provider: "not_called",
        used_fallback: false,
        response_type: "demo_profile",
        completion_rate:
          reportResult.status === "fulfilled"
            ? reportResult.value.completion_rate
            : scoreResult.status === "fulfilled"
              ? scoreResult.value.completion_rate
              : undefined,
        score: scoreResult.status === "fulfilled" ? scoreResult.value : null,
        report: reportResult.status === "fulfilled" ? reportResult.value : null,
        chat_history: [{ role: "assistant", content: assistantMessage }],
      };
      setLastResponse(demoResponse);
      setAnimateMessageId(null);
      setMessages([
        makeLocalMessage("assistant", assistantMessage, {
          technicalDetails: buildTechnicalDetails(demoResponse, questions),
          assistantTransparency: demoResponse.assistant_transparency,
          openedArtifacts: artifactsForResponse(demoResponse),
        }),
      ]);
      refreshSessionMetadata(sessionId, {
        explicitTitle: profileId === "weak_sme" ? "Weak SME demo" : "Better SME demo",
        path: "questionnaire",
        profileName: demo.profile_name || profileId,
        score:
          reportResult.status === "fulfilled"
            ? reportResult.value
            : scoreResult.status === "fulfilled"
              ? scoreResult.value
              : null,
        completionRate:
          reportResult.status === "fulfilled"
            ? reportResult.value.completion_rate
            : scoreResult.status === "fulfilled"
              ? scoreResult.value.completion_rate
              : undefined,
        riskLevel:
          reportResult.status === "fulfilled"
            ? reportResult.value.risk_level
            : scoreResult.status === "fulfilled"
              ? scoreResult.value.risk_level
              : undefined,
      });
      setBackendOnline(true);
    } catch (demoError) {
      setBackendOnline(false);
      setError(messageFromError(demoError));
    } finally {
      setSending(false);
    }
  }

  async function generateReport() {
    if (!activeSessionId) {
      setError("Start an assessment or load a demo before generating a report.");
      return;
    }
    setArtifactLoading(true);
    setError(null);
    try {
      const nextReport = await getReport(activeSessionId);
      setReport(nextReport);
      saveStoredReport(activeSessionId, nextReport);
      setScore(nextReport);
      setActiveArtifact("readiness-report");
      setArtifactOverlayOpen(true);
      setActiveView("interview");
      refreshSessionMetadata(activeSessionId, {
        score: nextReport,
        completionRate: nextReport.completion_rate,
        riskLevel: nextReport.risk_level,
        path: activeSessionPath,
      });
      setBackendOnline(true);
    } catch (reportError) {
      setBackendOnline(false);
      setError(messageFromError(reportError));
    } finally {
      setArtifactLoading(false);
    }
  }

  function deleteLocalSession(sessionId: string) {
    const next = removeSession(sessionId);
    setSessions(next);
    if (sessionId === activeSessionId) {
      resetWorkspaceState();
      setError(null);
    }
  }

  function saveWorkspaceProfile(profile: ProfileSetupValues) {
    window.localStorage.setItem(PROFILE_STATE_KEY, JSON.stringify(profile));
    setWorkspaceProfile(profile);
    setActiveView("landing");
  }

  if (activeView === "landing") {
    return (
      <LandingPage
        onBack={() => setActiveView("home")}
        onCreateProfile={() => setActiveView("profile-create")}
        onStartAssessment={startAssessment}
        profileCreated={Boolean(workspaceProfile)}
        profile={workspaceProfile}
      />
    );
  }

  if (activeView === "profile-create") {
    return (
      <ProfileSetupPage
        initialProfile={workspaceProfile}
        onBack={() => setActiveView("landing")}
        onSave={saveWorkspaceProfile}
      />
    );
  }

  return (
    <Layout
      backendOnline={backendOnline}
      providerStatus={providerStatus}
      lastResponse={lastResponse}
      activeView={activeView}
      contentKey={`${activeView}-${activeSessionId || "no-session"}`}
      workspaceOverflowVisible={artifactOverlayVisible}
      language={language}
      sidebarOpen={sidebarOpen}
      sidebarCollapsed={sidebarCollapsed}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onViewChange={setActiveView}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      onToggleSidebarCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      onCloseSidebar={() => setSidebarOpen(false)}
      onLoadDemo={handleLoadDemo}
      onSelectSession={selectSession}
      onDeleteSession={deleteLocalSession}
      pages={{
        home: (
          <HeroDashboard
            session={sessionState}
            score={score}
            sending={sending}
            language={language}
            canGenerateReport={Boolean(activeSessionId)}
            reportLoading={artifactLoading}
            onPrompt={sendNewSessionMessage}
            onStartAssessment={startAssessment}
            onStartPath={startSessionPath}
            onLoadDemo={handleLoadDemo}
            onGenerateReport={generateReport}
            onOpenTechnical={() => {
              setActiveArtifact("technical-json");
              setActiveView("interview");
            }}
            onOpenInterview={() => setActiveView("interview")}
            onOpenLanding={() => setActiveView("landing")}
          />
        ),
        interview: (
          <section
            className={cn(
              "interview-scene interview-static-scene relative isolate -m-4 flex min-h-[calc(100vh-7.75rem)] flex-col rounded-[26px] bg-[#111111] p-4 sm:-m-5 sm:min-h-[calc(100vh-8.25rem)] sm:p-5 lg:-m-6 lg:min-h-[calc(100vh-8.75rem)] lg:p-6",
              artifactOverlayOpen ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <ArtifactTopTabs
              activeArtifact={activeArtifact}
              artifactOverlayOpen={artifactOverlayOpen}
              sessionPath={activeSessionPath}
              language={language}
              onLanguageChange={changeLanguage}
              onChat={() => setArtifactOverlayOpen(false)}
              onChange={(artifact) => {
                setActiveArtifact(artifactForSessionPath(artifact, activeSessionPath));
                setArtifactOverlayOpen(true);
              }}
            />
            <div className="relative min-h-0 min-w-0 flex-1">
              {!artifactOverlayOpen ? (
                <ChatPanel
                  messages={messages}
                  animateMessageId={animateMessageId}
                  activeSessionId={activeSessionId}
                  sessionPath={activeSessionPath}
                  language={language}
                  sending={sending}
                  error={error}
                  onSend={sendMessage}
                  onStartPath={startSessionPath}
                  onRetry={retryLastMessage}
                  onOpenArtifact={(artifact) => {
                    setActiveArtifact(artifactForSessionPath(artifact, activeSessionPath));
                    setArtifactOverlayOpen(true);
                    setActiveView("interview");
                  }}
                  onOpenReport={() => {
                    setActiveArtifact("readiness-report");
                    setArtifactOverlayOpen(true);
                    setActiveView("interview");
                  }}
                />
              ) : null}
              <SessionArtifactOverlay
                open={artifactOverlayOpen}
                activeArtifact={artifactForSessionPath(activeArtifact, activeSessionPath)}
                activeSessionId={activeSessionId}
                report={report}
                sessionPath={activeSessionPath}
                session={sessionState}
                score={score}
                lastResponse={lastResponse}
                flow={technicalFlow}
                providerStatus={providerStatus}
                backendOnline={backendOnline}
                questions={questions}
                canGenerateReport={Boolean(activeSessionId)}
                loading={artifactLoading || sending}
                language={language}
                onGenerateReport={generateReport}
                onOpenArtifact={(artifact) => {
                  setActiveArtifact(artifactForSessionPath(artifact, activeSessionPath));
                  setArtifactOverlayOpen(true);
                  setActiveView("interview");
                }}
                onOpenReport={() => setActiveArtifact("readiness-report")}
                onClose={() => setArtifactOverlayOpen(false)}
              />
            </div>
            {!artifactOverlayOpen ? (
              activeSessionPath === "questionnaire" ? (
                <AssessmentStatusFooter
                  session={sessionState}
                  score={score}
                  lastResponse={lastResponse}
                  questions={questions}
                  language={language}
                />
              ) : (
                <RecoveryWorkspaceFooter
                  session={sessionState}
                  report={report}
                />
              )
            ) : null}
          </section>
        ),
      }}
    />
  );
}

const artifactTabs: Array<{
  id: ArtifactId;
  labelKey?: "report" | "actionPlan" | "recoveryProof";
  label?: string;
}> = [
  { id: "readiness-report", labelKey: "report" },
  { id: "action-plan", labelKey: "actionPlan" },
  { id: "recovery-proof", labelKey: "recoveryProof" },
];

function ArtifactTopTabs({
  activeArtifact,
  artifactOverlayOpen,
  sessionPath,
  language,
  onLanguageChange,
  onChat,
  onChange,
}: {
  activeArtifact: ArtifactId;
  artifactOverlayOpen: boolean;
  sessionPath: SessionPath;
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
  onChat: () => void;
  onChange: (artifact: ArtifactId) => void;
}) {
  const selectedArtifact = activeArtifact === "ransomware-playbook" ? "skills" : activeArtifact;
  const visibleTabs = artifactTabs.filter((tab) => {
    if (sessionPath === "questionnaire") {
      return tab.id !== "recovery-proof";
    }
    return tab.id !== "action-plan";
  });
  const reportNestedArtifacts = new Set<ArtifactId>([
    "evidence-binder",
    "skills",
    "technical-json",
  ]);
  const visibleSelectedArtifact = reportNestedArtifacts.has(selectedArtifact)
    ? "readiness-report"
    : selectedArtifact;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="scrollbar-slim flex min-w-0 flex-1 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={onChat}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out",
              !artifactOverlayOpen
                ? "border border-white/10 bg-white/[0.12] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                : "text-slate-400 hover:bg-white/10 hover:text-white",
            )}
          >
            {t(language, "chat")}
          </button>
          {visibleTabs.map((tab) => {
            const active = artifactOverlayOpen && visibleSelectedArtifact === tab.id;
            const label = tab.labelKey ? t(language, tab.labelKey) : tab.label || tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out",
                  active
                    ? "border border-white/10 bg-white/[0.12] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                    : "text-slate-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto shrink-0">
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
        </div>
      </div>
    </div>
  );
}
