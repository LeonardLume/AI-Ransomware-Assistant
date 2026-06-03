import {
  FileText,
  ListChecks,
  Plus,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import type {
  AssessmentAnswer,
  ChatRequestOptions,
  SessionPath,
} from "../types/api";
import type { UiLanguage } from "../utils/i18n";
import { buildRecoveryAssistantPrompt } from "../utils/recoveryAssistant";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type AssistantAction = "startReview" | "evidencePlan" | "proofGaps" | "mspTickets";
type QuestionnaireAction = AssessmentAnswer | "report";

type AssistantActionCopy = {
  label: string;
  message: string;
  mode: "clarification" | "advisory" | "context_note";
};

type QuestionnaireActionCopy = {
  label: string;
  message: string;
  selectedAnswer?: AssessmentAnswer;
};

const assistantActions: Record<UiLanguage, Record<AssistantAction, AssistantActionCopy>> = {
  et: {
    startReview: {
      label: "Start review",
      message:
        "Start an evidence-first recovery proof review. Ask me one practical question to identify scope, critical systems, and the first evidence source to import.",
      mode: "advisory",
    },
    evidencePlan: {
      label: "Plan evidence",
      message:
        "Help me plan which recovery evidence to import first from backup, M365, Wazuh, Prowler, DefectDojo, or manual files.",
      mode: "advisory",
    },
    proofGaps: {
      label: "Explain gaps",
      message:
        "Explain how to read recovery proof gaps and which missing evidence matters most for a client report.",
      mode: "advisory",
    },
    mspTickets: {
      label: "Draft tickets",
      message:
        "Draft MSP-ready remediation tickets for missing recovery proof, with owner, priority, and evidence needed.",
      mode: "advisory",
    },
  },
  en: {
    startReview: {
      label: "Start review",
      message:
        "Start an evidence-first recovery proof review. Ask me one practical question to identify scope, critical systems, and the first evidence source to import.",
      mode: "advisory",
    },
    evidencePlan: {
      label: "Plan evidence",
      message:
        "Help me plan which recovery evidence to import first from backup, M365, Wazuh, Prowler, DefectDojo, or manual files.",
      mode: "advisory",
    },
    proofGaps: {
      label: "Explain gaps",
      message:
        "Explain how to read recovery proof gaps and which missing evidence matters most for a client report.",
      mode: "advisory",
    },
    mspTickets: {
      label: "Draft tickets",
      message:
        "Draft MSP-ready remediation tickets for missing recovery proof, with owner, priority, and evidence needed.",
      mode: "advisory",
    },
  },
  ru: {
    startReview: {
      label: "Start review",
      message:
        "Start an evidence-first recovery proof review. Ask me one practical question to identify scope, critical systems, and the first evidence source to import.",
      mode: "advisory",
    },
    evidencePlan: {
      label: "Plan evidence",
      message:
        "Help me plan which recovery evidence to import first from backup, M365, Wazuh, Prowler, DefectDojo, or manual files.",
      mode: "advisory",
    },
    proofGaps: {
      label: "Explain gaps",
      message:
        "Explain how to read recovery proof gaps and which missing evidence matters most for a client report.",
      mode: "advisory",
    },
    mspTickets: {
      label: "Draft tickets",
      message:
        "Draft MSP-ready remediation tickets for missing recovery proof, with owner, priority, and evidence needed.",
      mode: "advisory",
    },
  },
};

const questionnaireActions: Record<
  UiLanguage,
  Record<QuestionnaireAction, QuestionnaireActionCopy>
> = {
  et: {
    yes: { label: "Yes", message: "yes", selectedAnswer: "yes" },
    partial: { label: "Partial", message: "partial", selectedAnswer: "partial" },
    no: { label: "No", message: "no", selectedAnswer: "no" },
    unsure: { label: "Unsure", message: "unsure", selectedAnswer: "unsure" },
    report: {
      label: "Generate report",
      message: "Create report based on the current questionnaire answers.",
    },
  },
  en: {
    yes: { label: "Yes", message: "yes", selectedAnswer: "yes" },
    partial: { label: "Partial", message: "partial", selectedAnswer: "partial" },
    no: { label: "No", message: "no", selectedAnswer: "no" },
    unsure: { label: "Unsure", message: "unsure", selectedAnswer: "unsure" },
    report: {
      label: "Generate report",
      message: "Create report based on the current questionnaire answers.",
    },
  },
  ru: {
    yes: { label: "Yes", message: "yes", selectedAnswer: "yes" },
    partial: { label: "Partial", message: "partial", selectedAnswer: "partial" },
    no: { label: "No", message: "no", selectedAnswer: "no" },
    unsure: { label: "Unsure", message: "unsure", selectedAnswer: "unsure" },
    report: {
      label: "Generate report",
      message: "Create report based on the current questionnaire answers.",
    },
  },
};

const placeholders: Record<SessionPath, string> = {
  "recovery-proof": "Ask about evidence, proof gaps, recovery verdict, or MSP tickets...",
  questionnaire: "Answer the current question, choose yes/partial/no/unsure, or ask for clarification...",
};

export default function Composer({
  disabled,
  activeSessionId,
  sessionPath = "recovery-proof",
  language = "et",
  onImportEvidence,
  onOpenReport,
  onSend,
  onStartPath,
}: {
  disabled?: boolean;
  activeSessionId?: string | null;
  sessionPath?: SessionPath;
  language?: UiLanguage;
  onImportEvidence?: () => void;
  onOpenReport?: () => void;
  onSend: (message: string, options?: ChatRequestOptions) => void;
  onStartPath: (path: SessionPath) => void;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !disabled;
  const recoveryActions = assistantActions[language] || assistantActions.en;
  const questionActions = questionnaireActions[language] || questionnaireActions.en;
  const isQuestionnaire = sessionPath === "questionnaire";

  function send() {
    const message = value.trim();
    if (!message || disabled) {
      return;
    }
    setValue("");
    if (isQuestionnaire) {
      onSend(message, {
        session_path: "questionnaire",
      });
      return;
    }
    onSend(buildRecoveryAssistantPrompt(message), {
      intent_mode: "advisory",
      display_message: message,
      session_path: "recovery-proof",
    });
  }

  function askRecovery(action: AssistantAction) {
    if (disabled) {
      return;
    }
    const next = recoveryActions[action];
    onSend(buildRecoveryAssistantPrompt(next.message), {
      intent_mode: next.mode,
      display_message: next.label,
      session_path: "recovery-proof",
    });
  }

  function askQuestionnaire(action: QuestionnaireAction) {
    if (disabled) {
      return;
    }
    const next = questionActions[action];
    onSend(next.message, {
      intent_mode: next.selectedAnswer ? "direct_answer" : undefined,
      selected_answer: next.selectedAnswer,
      display_message: next.label,
      session_path: "questionnaire",
    });
  }

  return (
    <div className="chat-composer-shell space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        {!isQuestionnaire && onImportEvidence ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onImportEvidence}
            className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-all duration-200 hover:border-cyan-300/35 hover:bg-cyan-300/[0.13] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Import evidence
          </button>
        ) : null}
        {isQuestionnaire
          ? (Object.keys(questionActions) as QuestionnaireAction[]).map((action) => (
              <button
                key={action}
                type="button"
                disabled={disabled}
                onClick={() => askQuestionnaire(action)}
                className="rounded-full border border-white/[0.1] bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-white/[0.22] hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {questionActions[action].label}
              </button>
            ))
          : (Object.keys(recoveryActions) as AssistantAction[]).map((action) => (
              <button
                key={action}
                type="button"
                disabled={disabled}
                onClick={() => askRecovery(action)}
                className="rounded-full border border-white/[0.1] bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-white/[0.22] hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {recoveryActions[action].label}
              </button>
            ))}
      </div>

      <div className="flex items-center gap-3 rounded-[999px] border border-white/10 bg-white/[0.05] px-2.5 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <SessionPathMenu
          disabled={disabled}
          activeSessionId={activeSessionId}
          sessionPath={sessionPath}
          onOpenReport={onOpenReport}
          onStartPath={onStartPath}
        />
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={placeholders[sessionPath]}
          className="max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={send}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_14px_34px_rgba(14,165,233,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-600 disabled:shadow-none"
          aria-label="Send message"
          title="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SessionPathMenu({
  disabled,
  activeSessionId,
  sessionPath,
  onOpenReport,
  onStartPath,
}: {
  disabled?: boolean;
  activeSessionId?: string | null;
  sessionPath: SessionPath;
  onOpenReport?: () => void;
  onStartPath: (path: SessionPath) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          aria-label="Choose session path"
          title="Choose session path"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[min(90vw,22rem)] p-2">
        <DropdownMenuLabel>New session path</DropdownMenuLabel>
        <PathMenuItem
          icon={ShieldCheck}
          title="Recovery Proof"
          description="Start a separate evidence-first session."
          active={sessionPath === "recovery-proof"}
          disabled={disabled}
          onSelect={() => onStartPath("recovery-proof")}
        />
        <PathMenuItem
          icon={ListChecks}
          title="Questionnaire"
          description="Start a separate legacy questions-to-report session."
          active={sessionPath === "questionnaire"}
          disabled={disabled}
          onSelect={() => onStartPath("questionnaire")}
        />
        <DropdownMenuSeparator />
        <PathMenuItem
          icon={FileText}
          title="Open report"
          description="Open the report for the selected session."
          disabled={disabled || !activeSessionId || !onOpenReport}
          onSelect={() => onOpenReport?.()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PathMenuItem({
  icon: Icon,
  title,
  description,
  active,
  disabled,
  onSelect,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className="items-start gap-3 px-3 py-3"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          {title}
          {active ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
              active
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}
