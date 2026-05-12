import { LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ChatResponse } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import { Badge, Card } from "./ui";

export default function PrivacySafetyCard({
  lastResponse,
  language = "et",
}: {
  lastResponse?: ChatResponse | null;
  language?: UiLanguage;
}) {
  const redactionCount = lastResponse?.redactions_applied?.length ?? 0;
  return (
    <Card className="!border-white/10 !bg-white/10 p-4 text-sm leading-6 !text-white shadow-[0_18px_48px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="flex items-center gap-2 font-semibold text-white">
        <LockKeyhole className="h-4 w-4" />
        {privacyTitle(language)}
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-white">
            <ShieldCheck className="h-4 w-4" />
            {defensiveModeLabel(language)}
          </span>
          <Badge tone="success">{enabledLabel(language)}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white">{t(language, "redaction")}</span>
          <Badge tone={redactionCount ? "success" : "neutral"}>
            {lastResponse?.redactions_applied === undefined
              ? t(language, "notReported")
              : redactionCount
                ? `${redactionCount} ${t(language, "applied")}`
                : t(language, "notApplied")}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white">{t(language, "promptInjection")}</span>
          <Badge tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}>
            {lastResponse?.prompt_injection_blocked === undefined
              ? t(language, "notReported")
              : lastResponse.prompt_injection_blocked
                ? t(language, "blocked")
                : t(language, "notTriggered")}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex gap-2 rounded-xl border border-white/10 bg-white/10 p-3 text-white/85">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{safetyText(language)}</p>
      </div>
    </Card>
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
  return "Ära sisesta paroole, tokeneid, täpseid IP-aadresse ega saladusi. Andmed võivad minna seadistatud LLM teenusepakkujale, kui fallback või local mode pole kasutusel.";
}
