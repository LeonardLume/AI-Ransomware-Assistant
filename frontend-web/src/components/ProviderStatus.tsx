import type { ChatResponse, ProviderStatusResponse } from "../types/api";
import { Badge } from "./ui";

export default function ProviderStatus({
  backendOnline,
  providerStatus,
  lastResponse,
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
}) {
  const provider = providerStatus?.provider || lastResponse?.provider || "unknown";
  const fallbackUsed = providerStatus
    ? providerStatus.provider === "fallback"
    : (lastResponse?.used_fallback ?? provider === "fallback");

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
      <Badge tone={backendOnline ? "success" : "danger"}>Backend: {backendOnline ? "online" : "offline"}</Badge>
      <Badge tone={provider === "fallback" ? "warning" : "info"}>LLM: {provider}</Badge>
      <Badge tone={fallbackUsed ? "warning" : "success"}>Fallback: {String(Boolean(fallbackUsed))}</Badge>
    </div>
  );
}
