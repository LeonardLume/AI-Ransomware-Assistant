import type { ChatResponse } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";

export default function PrivacySafetyCard({
  lastResponse,
  language = "et",
}: {
  lastResponse?: ChatResponse | null;
  language?: UiLanguage;
}) {
  const redactionCount = lastResponse?.redactions_applied?.length ?? 0;
  return (
    <section className="report-panel rounded-[30px] px-5 py-5 text-sm leading-6 text-slate-400 sm:px-6">
      <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">
        {privacyTitle(language)}
      </h3>

      <div className="mt-4 grid gap-2">
        <StatusRow
          label={defensiveModeLabel(language)}
          value={enabledLabel(language)}
          tone="success"
        />
        <StatusRow
          label={t(language, "redaction")}
          value={
            lastResponse?.redactions_applied === undefined
              ? t(language, "notReported")
              : redactionCount
                ? `${redactionCount} ${t(language, "applied")}`
                : t(language, "notApplied")
          }
          tone={redactionCount ? "success" : "neutral"}
        />
        <StatusRow
          label={t(language, "promptInjection")}
          value={
            lastResponse?.prompt_injection_blocked === undefined
              ? t(language, "notReported")
              : lastResponse.prompt_injection_blocked
                ? t(language, "blocked")
                : t(language, "notTriggered")
          }
          tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}
        />
      </div>

      <div className="mt-4 rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-slate-400">
        {safetyText(language)}
      </div>
    </section>
  );
}

type StatusTone = "neutral" | "success" | "danger";

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.025] px-3 py-3">
      <span className="text-slate-400">{label}</span>
      <StatusPill value={value} tone={tone} />
    </div>
  );
}

function StatusPill({ value, tone }: { value: string; tone: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    neutral: "border-white/[0.08] bg-white/[0.035] text-slate-300",
    success: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100",
    danger: "border-rose-300/20 bg-rose-300/[0.08] text-rose-100",
  };
  return (
    <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${toneClass[tone]}`}>
      <span className="truncate">{value}</span>
    </span>
  );
}

function privacyTitle(language: UiLanguage): string {
  if (language === "en") return "Privacy & Safety";
  if (language === "ru") return "Приватность и безопасность";
  return "Privaatsus ja turvalisus";
}

function defensiveModeLabel(language: UiLanguage): string {
  if (language === "en") return "Defensive-only mode";
  if (language === "ru") return "Только защитный режим";
  return "Ainult kaitsev režiim";
}

function enabledLabel(language: UiLanguage): string {
  if (language === "en") return "enabled";
  if (language === "ru") return "включено";
  return "sees";
}

function safetyText(language: UiLanguage): string {
  if (language === "en") {
    return "Do not enter passwords, tokens, exact IP addresses, or secrets. Data may be sent to the configured LLM provider unless fallback or local mode is used.";
  }
  if (language === "ru") {
    return "Не вводи пароли, токены, точные IP-адреса или секреты. Данные могут отправляться настроенному LLM provider, если не используется fallback или local mode.";
  }
  return "Ära sisesta paroole, tokeneid, täpseid IP-aadresse ega saladusi. Andmed võivad minna seadistatud LLM-teenusepakkujale, kui varurežiim või kohalik režiim pole kasutusel.";
}
