import { useCallback, useEffect, useRef, useState } from "react";
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
import ActionPlanView from "./components/ActionPlanView";
import ChatPanel from "./components/ChatPanel";
import EvidenceBinderView from "./components/EvidenceBinderView";
import HeroDashboard from "./components/HeroDashboard";
import Layout, { type AppView } from "./components/Layout";
import ReportView from "./components/ReportView";
import SkillsView from "./components/SkillsView";
import StatusPanel from "./components/StatusPanel";
import TechnicalTransparencyView from "./components/TechnicalTransparencyView";
import TechnicalView from "./components/TechnicalView";
import {
  artifactsForResponse,
  buildReadableSessionTitle,
  buildTechnicalDetails,
  sanitizeAssistantMessage,
} from "./utils/assessmentUi";
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
  questions: Question[] = [],
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
  const [activeView, setActiveView] = useState<AppView>("home");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const currentDomain =
    sessionState?.current_domain || lastResponse?.current_domain || lastResponse?.current_question?.domain;
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
    setActiveView("interview");
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
          setMessages(toUiMessages(sessionResult.value.chat_history, questions));
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
    [questions, refreshSessionMetadata],
  );

  const applyChatResponse = useCallback(
    async (response: ChatResponse) => {
      setActiveSessionId(response.session_id);
      setLastResponse(response);
      setBackendOnline(true);
      setError(null);

      if (response.chat_history?.length) {
        setMessages(attachLatestAssistantMetadata(toUiMessages(response.chat_history, questions), response, questions));
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
        setActiveView("report");
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

  async function startHomeChat(message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      await startAssessment();
      return;
    }

    setSending(true);
    setError(null);
    setReport(null);
    setLastUserMessage(trimmed);
    setActiveArtifact("readiness-report");
    setActiveView("interview");
    setSidebarOpen(false);

    try {
      const startResponse = await chat(null, "");
      await applyChatResponse(startResponse);
      setMessages((current) => [...current, makeLocalMessage("user", trimmed)]);
      const response = await chat(startResponse.session_id, trimmed);
      await applyChatResponse(response);
    } catch (sendError) {
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

  function clearLocalChat() {
    setMessages([]);
    setLastResponse(null);
    setError(null);
  }

  async function handleLoadDemo(profileId: "weak_sme" | "better_sme") {
    setSending(true);
    setError(null);
    setReport(null);
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
        setActiveView("report");
      }
      const assistantMessage = `Demo profile "${demo.profile_name || profileId}" is loaded. The report is ready in Results.`;
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
      setActiveView("report");
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
      sidebarOpen={sidebarOpen}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onViewChange={setActiveView}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      onCloseSidebar={() => setSidebarOpen(false)}
      onNewSession={startAssessment}
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
            onPrompt={startHomeChat}
            onStart={startAssessment}
            onLoadDemo={handleLoadDemo}
            onGenerateReport={generateReport}
            onOpenTechnical={() => setActiveView("technical")}
            onOpenInterview={() => setActiveView("interview")}
          />
        ),
        interview: (
          <section className="assessment-wallpaper relative isolate -m-4 min-h-[calc(100vh-1rem)] overflow-hidden rounded-[30px] p-4 sm:-m-6 sm:min-h-[calc(100vh-1.5rem)] sm:p-6 lg:-m-8 lg:min-h-[calc(100vh-2rem)] lg:p-8">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <ChatPanel
                messages={messages}
                quickActions={quickActions}
                currentDomain={currentDomain}
                sending={sending}
                error={error}
                onStart={startAssessment}
                onSend={sendMessage}
                onRetry={retryLastMessage}
                onOpenArtifact={(artifact) => {
                  setActiveArtifact(artifact);
                  setActiveView(artifact === "technical-json" ? "technical" : "report");
                }}
                onCreateReport={generateReport}
              />
              <StatusPanel
                session={sessionState}
                score={score}
                lastResponse={lastResponse}
                questions={questions}
              />
            </div>
          </section>
        ),
        report: (
          <ReportView
            report={report}
            canGenerate={Boolean(activeSessionId)}
            loading={artifactLoading || sending}
            onGenerate={generateReport}
          />
        ),
        "action-plan": <ActionPlanView report={report} />,
        evidence: <EvidenceBinderView report={report} />,
        skills: <SkillsView report={report} />,
        technical: (
          <div className="space-y-6">
            <TechnicalTransparencyView flow={technicalFlow} providerStatus={providerStatus} />
            <TechnicalView
              backendOnline={backendOnline}
              providerStatus={providerStatus}
              lastResponse={lastResponse}
              session={sessionState}
              score={score}
              report={report}
              questions={questions}
              flow={technicalFlow}
            />
          </div>
        ),
      }}
    />
  );
}
