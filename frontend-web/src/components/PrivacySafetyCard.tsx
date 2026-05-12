import { LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ChatResponse } from "../types/api";
import { Badge, Card } from "./ui";

export default function PrivacySafetyCard({ lastResponse }: { lastResponse?: ChatResponse | null }) {
  return (
    <Card className="!border-white/10 !bg-white/10 p-4 text-sm leading-6 !text-white shadow-[0_18px_48px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      <div className="flex items-center gap-2 font-semibold text-white">
        <LockKeyhole className="h-4 w-4" />
        Privacy & Safety
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-white">
            <ShieldCheck className="h-4 w-4" />
            Defensive-only mode
          </span>
          <Badge tone="success">enabled</Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white">Redaction status</span>
          <Badge tone={lastResponse?.redactions_applied ? "success" : "neutral"}>
            {lastResponse?.redactions_applied === undefined
              ? "not reported"
              : lastResponse.redactions_applied
                ? "applied"
                : "not applied"}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-white">Prompt injection status</span>
          <Badge tone={lastResponse?.prompt_injection_blocked ? "danger" : "neutral"}>
            {lastResponse?.prompt_injection_blocked === undefined
              ? "not reported"
              : lastResponse.prompt_injection_blocked
                ? "blocked"
                : "not triggered"}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex gap-2 rounded-xl border border-white/10 bg-white/10 p-3 text-white/85">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Do not enter passwords, tokens, exact IP addresses, or secrets. Data may be sent to the
          configured LLM provider unless fallback or local mode is used.
        </p>
      </div>
    </Card>
  );
}
