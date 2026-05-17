import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenCheck,
  ClipboardList,
  FileText,
  ListChecks,
  MessageSquare,
  Settings2,
} from "lucide-react";
import {
  ApiError,
  chat,
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
import LanguageSwitcher from "./components/LanguageSwitcher";
import Layout, { type AppView } from "./components/Layout";
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
  getSessions,
  makeSessionSummary,
  removeSession,
  upsertSession,
} from "./state/sessionStore";
import type {
  ArtifactId,
  BackendChatMessage,
  ChatResponse,
  ProviderStatusResponse,
  Question,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  SessionSummary,
  TechnicalFlowResponse,
  UiMessage,
} from "./types/api";

function normalizeRole(role: BackendChatMessage["role"]): UiMessage["role"] {
  return role === "user" || role === "assistant" ? role : "system";
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
        id: `${message.role || "message"}-${index}-${timestamp}`,
        role: normalizeRole(message.role),
        content:
          normalizeRole(message.role) === "assistant"
            ? sanitizeAssistantMessage(String(message.content || ""))
            : String(message.content || ""),
        timestamp,
      };
    });
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
          openedArtifacts,
        }
      : message,
  );
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

export default function App() {
  const didInitialLoadRef = useRef(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [technicalFlow, setTechnicalFlow] = useState<TechnicalFlowResponse | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionStateResponse | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactId>("readiness-report");
  const [artifactOverlayOpen, setArtifactOverlayOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("home");
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
  const currentQuestion =
    lastResponse?.current_question ||
    questions.find((question) => question.id === sessionState?.current_question_id) ||
    null;
  const currentDomain =
    sessionState?.current_domain || lastResponse?.current_domain || currentQuestion?.domain;
  const quickActions = [
    "Mida tähendab MFA?",
    "Miks backup restore test on oluline?",
    "Mis on incident response?",
    "Koosta raport",
  ];

  function resetWorkspaceState() {
    setActiveSessionId(null);
    setSessionState(null);
    setScore(null);
    setReport(null);
    setLastResponse(null);
    setMessages([]);
    setLastUserMessage(null);
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
      } = {},
    ) => {
      const existing = getSessions().find((item) => item.id === sessionId);
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
          updatedAt: new Date().toISOString(),
        }),
      );
      setSessions(next);
    },
    [],
  );

  const refreshBackendState = useCallback(
    async (
      sessionId: string,
      options: { includeReport?: boolean; updateMessages?: boolean } = {},
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
        }
      }
      if (scoreResult.status === "fulfilled") {
        nextScore = scoreResult.value;
        setScore(scoreResult.value);
      }
      if (options.includeReport) {
        const nextReport = await getReport(sessionId);
        setReport(nextReport);
        nextScore = nextReport;
      }

      refreshSessionMetadata(sessionId, {
        score: nextScore,
        session: nextSession,
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
    async (response: ChatResponse) => {
      setActiveSessionId(response.session_id);
      setLastResponse(response);
      setBackendOnline(true);
      setError(null);

      if (response.chat_history?.length) {
        setMessages(attachLatestAssistantMetadata(toUiMessages(response.chat_history), response, questions));
      } else if (response.assistant_message) {
        setMessages((current) => [
          ...current,
          makeLocalMessage("assistant", response.assistant_message || "", {
            technicalDetails: buildTechnicalDetails(response, questions),
            openedArtifacts: artifactsForResponse(response),
          }),
        ]);
      }

      if (response.score) {
        setScore(response.score);
      }
      if (response.report) {
        setReport(response.report);
        setActiveArtifact("readiness-report");
        setArtifactOverlayOpen(true);
        setActiveView("interview");
      }

      refreshSessionMetadata(response.session_id, {
        score: response.report || response.score,
        completionRate: response.score?.completion_rate ?? response.completion_rate,
        riskLevel: response.score?.risk_level ?? response.report?.risk_level,
      });

      await refreshBackendState(response.session_id, { includeReport: false, updateMessages: false });
    },
    [questions, refreshBackendState, refreshSessionMetadata],
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
      setError(null);
      setReport(null);
      setMessages([]);
      setActiveSessionId(sessionId);
      setActiveView("interview");
      setSidebarOpen(false);
      try {
        await refreshBackendState(sessionId, { includeReport: false });
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
    [refreshBackendState],
  );

  useEffect(() => {
    if (didInitialLoadRef.current) {
      return;
    }
    didInitialLoadRef.current = true;
    const localSessions = getSessions();
    setSessions(localSessions);
    void bootstrap();
    if (localSessions[0]?.id) {
      void selectSession(localSessions[0].id);
    }
  }, [bootstrap, selectSession]);

  async function startAssessment() {
    setSending(true);
    setError(null);
    setReport(null);
    setArtifactOverlayOpen(false);
    setActiveView("interview");
    setSidebarOpen(false);
    try {
      const response = await chat(null, "");
      await applyChatResponse(response);
    } catch (startError) {
      setBackendOnline(false);
      setError(messageFromError(startError));
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(message: string) {
    if (!message.trim()) {
      await startAssessment();
      return;
    }

    setSending(true);
    setError(null);
    setLastUserMessage(message);
    setArtifactOverlayOpen(false);
    setActiveView("interview");

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const startResponse = await chat(null, "");
        sessionId = startResponse.session_id;
        await applyChatResponse(startResponse);
      }

      setMessages((current) => [...current, makeLocalMessage("user", message)]);
      const response = await chat(sessionId, message);
      await applyChatResponse(response);
    } catch (sendError) {
      if (sendError instanceof ApiError && sendError.status === 404 && activeSessionId) {
        const staleSessionId = activeSessionId;
        setSessions(removeSession(staleSessionId));
        resetWorkspaceState();
        try {
          const startResponse = await chat(null, "");
          await applyChatResponse(startResponse);
          setMessages((current) => [...current, makeLocalMessage("user", message)]);
          const response = await chat(startResponse.session_id, message);
          await applyChatResponse(response);
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

  async function retryLastMessage() {
    if (lastUserMessage) {
      await sendMessage(lastUserMessage);
    } else {
      await startAssessment();
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
      setMessages([
        makeLocalMessage("assistant", assistantMessage, {
          technicalDetails: buildTechnicalDetails(demoResponse, questions),
          openedArtifacts: artifactsForResponse(demoResponse),
        }),
      ]);
      refreshSessionMetadata(sessionId, {
        explicitTitle: profileId === "weak_sme" ? "Weak SME demo" : "Better SME demo",
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
      setScore(nextReport);
      setActiveArtifact("readiness-report");
      setArtifactOverlayOpen(true);
      setActiveView("interview");
      refreshSessionMetadata(activeSessionId, {
        score: nextReport,
        completionRate: nextReport.completion_rate,
        riskLevel: nextReport.risk_level,
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

  return (
    <Layout
      backendOnline={backendOnline}
      providerStatus={providerStatus}
      lastResponse={lastResponse}
      activeView={activeView}
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
            canGenerateReport={Boolean(activeSessionId)}
            reportLoading={artifactLoading}
            onPrompt={sendMessage}
            onStart={startAssessment}
            onLoadDemo={handleLoadDemo}
            onGenerateReport={generateReport}
            onOpenTechnical={() => {
              setActiveArtifact("technical-json");
              setActiveView("interview");
            }}
            onOpenInterview={() => setActiveView("interview")}
          />
        ),
        interview: (
          <section className="relative isolate -m-4 flex min-h-[calc(100vh-7.75rem)] flex-col overflow-hidden rounded-[26px] p-4 sm:-m-5 sm:min-h-[calc(100vh-8.25rem)] sm:p-5 lg:-m-6 lg:min-h-[calc(100vh-8.75rem)] lg:p-6">
            <ArtifactTopTabs
              activeArtifact={activeArtifact}
              artifactOverlayOpen={artifactOverlayOpen}
              language={language}
              onLanguageChange={changeLanguage}
              onChat={() => setArtifactOverlayOpen(false)}
              onChange={(artifact) => {
                setActiveArtifact(artifact);
                setArtifactOverlayOpen(true);
              }}
            />
            <div className="relative min-h-0 min-w-0 flex-1">
              <ChatPanel
                messages={messages}
                language={language}
                sending={sending}
                error={error}
                onStart={startAssessment}
                onSend={sendMessage}
                onRetry={retryLastMessage}
                onOpenArtifact={(artifact) => {
                  setActiveArtifact(artifact === "ransomware-playbook" ? "skills" : artifact);
                  setArtifactOverlayOpen(true);
                  setActiveView("interview");
                }}
                onCreateReport={generateReport}
              />
              <SessionArtifactOverlay
                open={artifactOverlayOpen}
                activeArtifact={activeArtifact}
                activeSessionId={activeSessionId}
                report={report}
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
                onClose={() => setArtifactOverlayOpen(false)}
              />
            </div>
            <AssessmentStatusFooter
              session={sessionState}
              score={score}
              lastResponse={lastResponse}
              questions={questions}
              language={language}
            />
          </section>
        ),
      }}
    />
  );
}

const artifactTabs: Array<{
  id: ArtifactId;
  labelKey?: "report" | "actionPlan" | "evidenceBinder" | "skills" | "technical";
  label?: string;
  icon: JSX.Element;
}> = [
  { id: "readiness-report", labelKey: "report", icon: <FileText className="h-4 w-4" /> },
  { id: "action-plan", labelKey: "actionPlan", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "evidence-binder", labelKey: "evidenceBinder", icon: <ListChecks className="h-4 w-4" /> },
  { id: "skills", labelKey: "skills", icon: <BookOpenCheck className="h-4 w-4" /> },
  { id: "technical-json", labelKey: "technical", icon: <Settings2 className="h-4 w-4" /> },
];

function ArtifactTopTabs({
  activeArtifact,
  artifactOverlayOpen,
  language,
  onLanguageChange,
  onChat,
  onChange,
}: {
  activeArtifact: ArtifactId;
  artifactOverlayOpen: boolean;
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
  onChat: () => void;
  onChange: (artifact: ArtifactId) => void;
}) {
  const selectedArtifact = activeArtifact === "ransomware-playbook" ? "skills" : activeArtifact;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-300 ease-out hover:border-white/20">
      <div className="flex flex-wrap items-center gap-2">
        <div className="scrollbar-slim flex min-w-0 flex-1 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={onChat}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5",
              !artifactOverlayOpen
                ? "bg-sky-500 text-white shadow-[0_12px_28px_rgba(14,165,233,0.22)]"
                : "text-slate-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <MessageSquare className="h-4 w-4" />
            {t(language, "chat")}
          </button>
          {artifactTabs.map((tab) => {
            const active = artifactOverlayOpen && selectedArtifact === tab.id;
            const label = tab.labelKey ? t(language, tab.labelKey) : tab.label || tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5",
                  active
                    ? "bg-sky-500 text-white shadow-[0_12px_28px_rgba(14,165,233,0.22)]"
                    : "text-slate-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {tab.icon}
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
