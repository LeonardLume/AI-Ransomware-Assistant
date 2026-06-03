export const RECOVERY_ASSISTANT_PROMPT_MARKER = "[[RECOVERY_PROOF_ASSISTANT_CONTEXT]]";

export function buildRecoveryAssistantPrompt(visibleMessage: string): string {
  const cleanMessage = visibleMessage.trim();
  return `${RECOVERY_ASSISTANT_PROMPT_MARKER}
You are the Recovery Proof assistant for a ransomware recovery product.

Conversation rules:
- Do not continue the legacy yes/partial/no questionnaire.
- Move the chat through the evidence-first workflow: recovery scope, evidence sources, import, proof gaps, MSP tickets, and draft report.
- Ask one practical next question at a time.
- Tell the user when to use Import evidence instead of typing long logs into chat.
- If the conversation or evidence is incomplete, say the report is a draft and explain the next input that would improve it.
- Keep the response concise, operational, and client/MSP focused.

Visible user message:
${cleanMessage}`;
}

export function visibleRecoveryAssistantContent(content: string): string {
  if (!content.includes(RECOVERY_ASSISTANT_PROMPT_MARKER)) {
    return content;
  }

  const [, visibleMessage = ""] = content.split("Visible user message:");
  return visibleMessage.trim() || "Start evidence review";
}

export function isRecoveryAssistantContent(content: string): boolean {
  return content.includes(RECOVERY_ASSISTANT_PROMPT_MARKER);
}

export function sanitizeRecoveryAssistantMessage(content: string): string {
  const cleaned = content
    .replace(/That is a slightly different topic from the current assessment question, but here is the short answer\.\s*/giu, "")
    .replace(/See on veidi erinev teema kui praegune hindamisküsimus, aga vastan lühidalt\.\s*/giu, "")
    .replace(/Kui oled valmis,\s*vasta:\s*jah,\s*osaliselt,\s*ei või ei tea\.\s*/giu, "")
    .replace(/When you are ready,\s*answer yes,\s*partial,\s*no,\s*or unsure\.\s*/giu, "")
    .replace(/Praegune küsimus:\s*.*(?:\n|$)/giu, "")
    .replace(/Current question:\s*.*(?:\n|$)/giu, "")
    .replace(/Seos hindamisega:\s*.*(?:\n|$)/giu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || "Tell me which recovery evidence source you want to review first.";
}
