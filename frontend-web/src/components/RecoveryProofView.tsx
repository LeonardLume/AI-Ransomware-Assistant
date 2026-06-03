import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  exportRecoveryTickets,
  getRecoveryControls,
  getRecoveryEvidence,
  getRecoveryImportAdapters,
  importRecoveryEvidence,
  importRecoveryToolOutput,
  runRecoveryProof,
} from "../api/client";
import type {
  ProofGap,
  RecoveryControl,
  RecoveryControlResult,
  RecoveryEvidenceItem,
  RecoveryImportAdaptersResponse,
  RecoveryProofReport,
  RecoveryTicketExportResponse,
  RemediationTicket,
} from "../types/api";
import type { UiLanguage } from "../utils/i18n";
import { cn } from "./ui-helpers";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type BadgeVariant = "neutral" | "success" | "info" | "warning" | "orange" | "danger";
type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";
type RecoveryTab = "overview" | "evidence" | "controls" | "tickets" | "advanced";

type TopFix = {
  id: string;
  title: string;
  priority?: string;
  why: string;
  evidenceNeeded: string[];
  ticket?: RemediationTicket;
  gap?: ProofGap;
};

const BUTTON_CLASS = "rounded-lg shadow-none backdrop-blur-0";
const PANEL_CLASS = "rounded-lg border border-white/[0.08] bg-white/[0.015]";
const CARD_CLASS = "rounded-lg border border-white/[0.07] bg-white/[0.018]";
const FIELD_CLASS =
  "rounded-lg border border-white/[0.08] bg-black/[0.18] text-slate-200 outline-none focus:border-cyan-300/35";

const CONTROL_CATEGORY_ORDER = [
  "Assets",
  "Backup",
  "Identity",
  "Detection",
  "Incident Response",
  "Exposure",
  "Recovery Planning",
];

const CONTROL_CATEGORY_LABELS: Record<string, string> = {
  recovery_scope: "Assets",
  backup_recoverability: "Backup",
  backup_resilience: "Backup",
  identity_recovery_protection: "Identity",
  privilege_separation: "Identity",
  detection_readiness: "Detection",
  response_coordination: "Incident Response",
  exposure_readiness: "Exposure",
  recovery_validation: "Recovery Planning",
  recovery_planning: "Recovery Planning",
};

const fallbackAdapters = [
  { id: "generic", name: "Generic JSON/CSV/YAML" },
  { id: "prowler", name: "Prowler import" },
  { id: "scubagear", name: "CISA ScubaGear import" },
  { id: "wazuh", name: "Wazuh summary import" },
  { id: "defectdojo", name: "DefectDojo findings import" },
  { id: "sigma", name: "Sigma rule metadata import" },
  { id: "complianceascode", name: "ComplianceAsCode control import" },
];

const demoBackupEvidence = [
  {
    id: "demo_backup_coverage_2026_q2",
    source: "manual",
    type: "backup_config",
    title: "Backup coverage for critical systems",
    summary:
      "Backup jobs cover accounting, email export, domain controller system state, and the shared file server. Daily schedule and retention are documented.",
    confidence: "high",
    related_control_ids: ["backup_exists_for_critical_systems"],
  },
  {
    id: "demo_backup_immutability_2026_q2",
    source: "manual",
    type: "backup_config",
    title: "Immutable backup policy enabled",
    summary:
      "Repository immutability is enabled for 30 days and backup console access uses a separate protected administrator account.",
    confidence: "high",
    related_control_ids: [
      "backup_isolation_or_immutability_proven",
      "backup_admin_separation_proven",
    ],
  },
  {
    id: "demo_restore_test_2026_q2",
    source: "manual",
    type: "restore_test_report",
    title: "Restore test report for shared file server",
    summary:
      "A controlled restore test was completed on 2026-05-15. A sample shared folder was restored, validated by the business owner, and RTO/RPO notes were recorded.",
    confidence: "high",
    related_control_ids: ["restore_test_proven"],
  },
] satisfies RecoveryEvidenceItem[];

const demoM365Evidence = [
  {
    id: "demo_m365_conditional_access_admins",
    source: "scubagear",
    type: "mfa_config",
    title: "M365 conditional access for admin roles",
    summary:
      "Conditional access requires MFA for most privileged roles. Two emergency accounts are excluded and need compensating control evidence.",
    confidence: "medium",
    related_control_ids: ["admin_mfa_proven"],
  },
  {
    id: "demo_m365_signin_logs",
    source: "scubagear",
    type: "logging_config",
    title: "M365 sign-in logging enabled",
    summary:
      "Sign-in logs are retained and failed administrator sign-ins can be reviewed by the tenant administrator.",
    confidence: "medium",
    related_control_ids: ["endpoint_detection_or_logging_present"],
  },
] satisfies RecoveryEvidenceItem[];

const demoWeakEvidence = [
  {
    id: "demo_weak_asset_note",
    source: "manual",
    type: "asset_inventory",
    title: "Partial critical systems note",
    summary:
      "Accounting, email, and shared files are considered important, but there is no owner list or dependency map.",
    confidence: "low",
    related_control_ids: ["critical_assets_identified", "recovery_priority_list_exists"],
  },
  {
    id: "demo_weak_backup_note",
    source: "manual",
    type: "backup_config",
    title: "Backup vendor confirmation without restore evidence",
    summary:
      "MSP notes that backups exist for the file server, but no restore test report or immutability setting was provided.",
    confidence: "low",
    related_control_ids: ["backup_exists_for_critical_systems"],
  },
] satisfies RecoveryEvidenceItem[];

export default function RecoveryProofView({
  activeSessionId,
}: {
  activeSessionId: string;
  language?: UiLanguage;
}) {
  const pastePanelRef = useRef<HTMLElement>(null);
  const topFixesRef = useRef<HTMLElement>(null);
  const [controls, setControls] = useState<RecoveryControl[]>([]);
  const [storedEvidence, setStoredEvidence] = useState<RecoveryEvidenceItem[]>([]);
  const [adapters, setAdapters] = useState<RecoveryImportAdaptersResponse["adapters"]>([]);
  const [proofReport, setProofReport] = useState<RecoveryProofReport | null>(null);
  const [activeTab, setActiveTab] = useState<RecoveryTab>("overview");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [importSource, setImportSource] = useState("generic");
  const [importFormat, setImportFormat] = useState("auto");
  const [ticketExport, setTicketExport] = useState<RecoveryTicketExportResponse | null>(null);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getRecoveryControls(),
      getRecoveryEvidence(activeSessionId),
      getRecoveryImportAdapters(),
    ])
      .then(([controlsResponse, evidenceResponse, adaptersResponse]) => {
        if (cancelled) return;
        setControls(controlsResponse);
        setStoredEvidence(evidenceResponse.items || []);
        setAdapters(adaptersResponse.adapters || []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(messageFromError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  const controlResults = useMemo(() => proofReport?.control_results || [], [proofReport]);
  const displayControls = useMemo(
    () => (controlResults.length ? controlResults : controlsToResults(controls)),
    [controlResults, controls],
  );
  const groupedControls = useMemo(() => groupControlsByCategory(displayControls), [displayControls]);
  const categoryHealth = useMemo(() => buildCategoryHealth(displayControls), [displayControls]);
  const sourceCounts = useMemo(() => countEvidenceBySource(storedEvidence), [storedEvidence]);
  const typeCounts = useMemo(() => countEvidenceByType(storedEvidence), [storedEvidence]);
  const sortedGaps = useMemo(() => sortGapsByPriority(proofReport?.proof_gaps || []), [proofReport]);
  const sortedTickets = useMemo(
    () => sortTicketsByPriority(proofReport?.remediation_tickets || []),
    [proofReport],
  );
  const ticketGroups = useMemo(() => groupTicketsByPriority(sortedTickets), [sortedTickets]);
  const topFixes = useMemo(() => getTopFixes(sortedGaps, sortedTickets, 3), [sortedGaps, sortedTickets]);
  const evidenceCoverage = useMemo(
    () => summarizeEvidenceCoverage(controlResults, controls, storedEvidence),
    [controlResults, controls, storedEvidence],
  );
  const criticalGapCount = sortedGaps.filter((gap) => severityRank(gap.severity) >= 3).length;
  const hasEvidence = storedEvidence.length > 0;
  const hasProof = Boolean(proofReport);
  const proofScore = proofReport?.recovery_proof_score ?? 0;
  const evidenceConfidence = proofReport?.evidence_confidence ?? 0;
  const verdict = getRecoveryVerdict(proofScore, evidenceConfidence, criticalGapCount, hasProof);

  async function refreshEvidence() {
    const response = await getRecoveryEvidence(activeSessionId);
    setStoredEvidence(response.items || []);
  }

  async function handleImportEvidence() {
    setError(null);
    setNotice(null);
    setTicketExport(null);
    setLoading(true);
    try {
      const response = await importRecoveryToolOutput(activeSessionId, evidenceText, {
        source: importSource,
        format: importFormat,
      });
      setStoredEvidence(response.items || []);
      setEvidenceText("");
      setPasteOpen(false);
      setNotice(`Imported ${response.count || 0} evidence item(s). Run proof to update verdict.`);
    } catch (importError) {
      setError(messageFromError(importError));
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadDemo(label: string, items: RecoveryEvidenceItem[]) {
    setError(null);
    setNotice(null);
    setTicketExport(null);
    setRunning(true);
    try {
      const response = await importRecoveryEvidence(activeSessionId, items);
      setStoredEvidence(response.items || []);
      const report = await runRecoveryProof(activeSessionId);
      setProofReport(report);
      setActiveTab("overview");
      setNotice(`${label} loaded and proof run completed.`);
    } catch (demoError) {
      setError(messageFromError(demoError));
    } finally {
      setRunning(false);
    }
  }

  async function handleRunProof() {
    setError(null);
    setNotice(null);
    setTicketExport(null);
    setRunning(true);
    try {
      const report = await runRecoveryProof(activeSessionId);
      setProofReport(report);
      setActiveTab("overview");
      await refreshEvidence();
    } catch (runError) {
      setError(messageFromError(runError));
    } finally {
      setRunning(false);
    }
  }

  async function handleExportTickets(format: "markdown" | "jira_json") {
    setError(null);
    setNotice(null);
    try {
      const exported = await exportRecoveryTickets(activeSessionId, format);
      setTicketExport(exported);
      setNotice(`Exported tickets as ${exported.format || format}.`);
    } catch (exportError) {
      setError(messageFromError(exportError));
    }
  }

  async function handleCopyTicket(ticket: RemediationTicket) {
    await copyText(ticketToClipboardText(ticket), ticket.id || ticket.title || "ticket");
  }

  async function handleCopyFix(fix: TopFix) {
    const copyId = fix.ticket?.id || fix.gap?.id || fix.id;
    const content = fix.ticket ? ticketToClipboardText(fix.ticket) : topFixToClipboardText(fix);
    await copyText(content, copyId);
  }

  async function copyText(content: string, copiedId: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedTicketId(copiedId);
      window.setTimeout(() => setCopiedTicketId(null), 1600);
    } catch {
      setTicketExport({
        format: "text",
        content_type: "text/plain",
        content,
      });
      setActiveTab("advanced");
      setNotice("Clipboard was unavailable, so the text is shown in Advanced.");
    }
  }

  async function handleCopyClientSummary() {
    const content =
      proofReport?.client_summary ||
      verdict.subtitle ||
      "Import evidence and run Recovery Proof to generate a client-safe summary.";
    await copyText(content, "client-summary");
  }

  function openImportEvidence() {
    setActiveTab("evidence");
    setPasteOpen(true);
    window.setTimeout(() => pastePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function scrollToTopFixes() {
    topFixesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const emptyState = !hasEvidence && !hasProof;

  if (emptyState) {
    return (
      <div className="max-w-7xl text-zinc-100">
        <EmptyRecoveryState
          running={running}
          pasteOpen={pasteOpen}
          adapters={adapters}
          importSource={importSource}
          importFormat={importFormat}
          evidenceText={evidenceText}
          loading={loading}
          error={error}
          notice={notice}
          onSourceChange={setImportSource}
          onFormatChange={setImportFormat}
          onEvidenceTextChange={setEvidenceText}
          onImport={() => void handleImportEvidence()}
          onTogglePaste={setPasteOpen}
          onLoadDemoRecoveryProof={() => void handleLoadDemo("Demo recovery proof", [
            ...demoBackupEvidence,
            ...demoM365Evidence,
          ])}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-5 text-zinc-100">
      <RecoveryProofHeader
        verdict={verdict}
        evidenceCount={storedEvidence.length}
        proofScore={proofScore}
        evidenceConfidence={evidenceConfidence}
        criticalGapCount={criticalGapCount}
        ticketCount={sortedTickets.length}
        clientSummary={proofReport?.client_summary}
        running={running}
        canRun={hasEvidence || hasProof}
        canFix={topFixes.length > 0}
        onRunProof={() => void handleRunProof()}
        onFixTopGaps={scrollToTopFixes}
        onImportEvidence={openImportEvidence}
        onExportClientSummary={() => void handleCopyClientSummary()}
      />

      <RecoveryTabs activeTab={activeTab} onChange={setActiveTab} />

      {(error || notice) && (
        <StatusMessage tone={error ? "danger" : "success"} text={error || notice || ""} />
      )}

      {activeTab === "overview" && (
        <OverviewTab
          topFixesRef={topFixesRef}
          proofReport={proofReport}
          storedEvidence={storedEvidence}
          sortedGaps={sortedGaps}
          sortedTickets={sortedTickets}
          topFixes={topFixes}
          categoryHealth={categoryHealth}
          copiedTicketId={copiedTicketId}
          onCopyFix={(fix) => void handleCopyFix(fix)}
          onViewAllGaps={() => setActiveTab("tickets")}
        />
      )}

      {activeTab === "evidence" && (
        <EvidenceTab
          pastePanelRef={pastePanelRef}
          evidenceItems={storedEvidence}
          sourceCounts={sourceCounts}
          typeCounts={typeCounts}
          coverage={evidenceCoverage}
          adapters={adapters}
          importSource={importSource}
          importFormat={importFormat}
          evidenceText={evidenceText}
          pasteOpen={pasteOpen}
          loading={loading}
          running={running}
          onSourceChange={setImportSource}
          onFormatChange={setImportFormat}
          onEvidenceTextChange={setEvidenceText}
          onPasteOpenChange={setPasteOpen}
          onImport={() => void handleImportEvidence()}
          onRunProof={() => void handleRunProof()}
          onLoadBackup={() => void handleLoadDemo("Demo backup evidence", demoBackupEvidence)}
          onLoadM365={() => void handleLoadDemo("Demo M365 MFA evidence", demoM365Evidence)}
          onLoadWeak={() => void handleLoadDemo("Demo weak recovery evidence", demoWeakEvidence)}
        />
      )}

      {activeTab === "controls" && (
        <ControlsTab
          groupedControls={groupedControls}
          proofGaps={sortedGaps}
          categoryHealth={categoryHealth}
        />
      )}

      {activeTab === "tickets" && (
        <TicketsTab
          gaps={sortedGaps}
          ticketGroups={ticketGroups}
          copiedTicketId={copiedTicketId}
          onCopyTicket={(ticket) => void handleCopyTicket(ticket)}
          onExportMarkdown={() => void handleExportTickets("markdown")}
          onExportJira={() => void handleExportTickets("jira_json")}
        />
      )}

      {activeTab === "advanced" && (
        <AdvancedTab
          proofReport={proofReport}
          ticketExport={ticketExport}
          evidenceItems={storedEvidence}
        />
      )}
    </div>
  );
}

function EmptyRecoveryState({
  running,
  pasteOpen,
  adapters,
  importSource,
  importFormat,
  evidenceText,
  loading,
  error,
  notice,
  onSourceChange,
  onFormatChange,
  onEvidenceTextChange,
  onImport,
  onTogglePaste,
  onLoadDemoRecoveryProof,
}: {
  running?: boolean;
  pasteOpen: boolean;
  adapters: RecoveryImportAdaptersResponse["adapters"];
  importSource: string;
  importFormat: string;
  evidenceText: string;
  loading?: boolean;
  error?: string | null;
  notice?: string | null;
  onSourceChange: (source: string) => void;
  onFormatChange: (format: string) => void;
  onEvidenceTextChange: (text: string) => void;
  onImport: () => void;
  onTogglePaste: (open: boolean) => void;
  onLoadDemoRecoveryProof: () => void;
}) {
  return (
    <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">Recovery Proof</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Choose this path when the client already has recovery evidence. Import proof, run a verdict, then turn weak areas into MSP-ready remediation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button className={BUTTON_CLASS} type="button" variant="primary" onClick={() => onTogglePaste(true)}>
            Import evidence
          </Button>
          <Button className={BUTTON_CLASS} type="button" disabled={running} onClick={onLoadDemoRecoveryProof}>
            {running ? "Loading demo" : "Load demo"}
          </Button>
        </div>
      </div>

      <ol className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/[0.08] pt-4 text-sm md:grid-cols-3">
        <li className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">01</span>
          <div className="mt-1 font-semibold text-slate-100">Import evidence</div>
          <p className="mt-1 leading-5 text-slate-500">Backup, M365, Wazuh, Prowler, DefectDojo, JSON, CSV, or YAML.</p>
        </li>
        <li className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">02</span>
          <div className="mt-1 font-semibold text-slate-100">Run proof</div>
          <p className="mt-1 leading-5 text-slate-500">Map evidence to recovery controls and calculate defensibility.</p>
        </li>
        <li className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">03</span>
          <div className="mt-1 font-semibold text-slate-100">Create tickets</div>
          <p className="mt-1 leading-5 text-slate-500">Prioritize missing proof and export concrete MSP remediation.</p>
        </li>
      </ol>

      {pasteOpen ? (
        <EvidencePastePanel
          open={pasteOpen}
          adapters={adapters}
          importSource={importSource}
          importFormat={importFormat}
          evidenceText={evidenceText}
          loading={loading}
          running={running}
          compact
          onOpenChange={onTogglePaste}
          onSourceChange={onSourceChange}
          onFormatChange={onFormatChange}
          onEvidenceTextChange={onEvidenceTextChange}
          onImport={onImport}
        />
      ) : null}

      {error ? <StatusMessage tone="danger" text={error} /> : null}
      {notice ? <StatusMessage tone="success" text={notice} /> : null}
    </section>
  );
}

function RecoveryProofHeader({
  verdict,
  evidenceCount,
  proofScore,
  evidenceConfidence,
  criticalGapCount,
  ticketCount,
  clientSummary,
  running,
  canRun,
  canFix,
  onRunProof,
  onFixTopGaps,
  onImportEvidence,
  onExportClientSummary,
}: {
  verdict: ReturnType<typeof getRecoveryVerdict>;
  evidenceCount: number;
  proofScore: number;
  evidenceConfidence: number;
  criticalGapCount: number;
  ticketCount: number;
  clientSummary?: string;
  running?: boolean;
  canRun: boolean;
  canFix: boolean;
  onRunProof: () => void;
  onFixTopGaps: () => void;
  onImportEvidence: () => void;
  onExportClientSummary: () => void;
}) {
  return (
    <section className={cn(PANEL_CLASS, "px-4 py-4 sm:px-5")}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Recovery Proof</h2>
            <Badge className="rounded-md backdrop-blur-0" variant={verdict.variant}>
              {verdict.badge}
            </Badge>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {clientSummary || verdict.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button className={BUTTON_CLASS} type="button" variant="primary" disabled={!canRun || running} onClick={onRunProof}>
            {running ? "Running proof" : "Run proof"}
          </Button>
          <Button className={BUTTON_CLASS} type="button" onClick={onImportEvidence}>
            Import evidence
          </Button>
          <Button className={BUTTON_CLASS} type="button" disabled={!canFix} onClick={onFixTopGaps}>
            Top gaps
          </Button>
          <Button className={BUTTON_CLASS} type="button" onClick={onExportClientSummary}>
            Copy summary
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <RecoveryMetric label="Verdict" value={verdict.title} tone={variantToTone(verdict.variant)} />
        <RecoveryMetric label="Evidence" value={String(evidenceCount)} tone={evidenceCount ? "info" : "neutral"} />
        <RecoveryMetric label="Proof score" value={`${proofScore}/100`} tone={scoreTone(proofScore)} />
        <RecoveryMetric label="Confidence" value={`${evidenceConfidence}/100`} tone={scoreTone(evidenceConfidence)} />
        <RecoveryMetric label="Gaps / tickets" value={`${criticalGapCount} / ${ticketCount}`} tone={criticalGapCount ? "danger" : ticketCount ? "warning" : "success"} />
      </div>
    </section>
  );
}

function RecoveryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div className={cn("rounded-md border bg-black/[0.08] px-3 py-3", metricBorderClass(tone))}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-base font-semibold text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function RecoveryTabs({ activeTab, onChange }: { activeTab: RecoveryTab; onChange: (tab: RecoveryTab) => void }) {
  const tabs: Array<{ id: RecoveryTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence" },
    { id: "controls", label: "Controls" },
    { id: "tickets", label: "Tickets" },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="flex flex-wrap gap-4 border-b border-white/[0.08]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 border-transparent px-0 pb-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-200",
            activeTab === tab.id && "border-cyan-300/70 text-white",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({
  proofReport,
  storedEvidence,
  sortedGaps,
  sortedTickets,
  topFixes,
  categoryHealth,
  copiedTicketId,
  onCopyFix,
  onViewAllGaps,
  topFixesRef,
}: {
  proofReport: RecoveryProofReport | null;
  storedEvidence: RecoveryEvidenceItem[];
  sortedGaps: ProofGap[];
  sortedTickets: RemediationTicket[];
  topFixes: TopFix[];
  categoryHealth: Array<{ label: string; score: number; controls: number }>;
  copiedTicketId?: string | null;
  onCopyFix: (fix: TopFix) => void;
  onViewAllGaps: () => void;
  topFixesRef: RefObject<HTMLElement>;
}) {
  return (
    <div className="space-y-5">
      <CompactPipeline
        evidenceCount={storedEvidence.length}
        provenCount={proofReport?.proven_controls?.length || 0}
        gapCount={sortedGaps.length}
        ticketCount={sortedTickets.length}
        reportReady={Boolean(proofReport)}
      />
      <TopFixesPanel
        topFixesRef={topFixesRef}
        fixes={topFixes}
        copiedTicketId={copiedTicketId}
        onCopyFix={onCopyFix}
        onViewAllGaps={onViewAllGaps}
      />
      <CategoryHealthGrid categories={categoryHealth} />
    </div>
  );
}

function CompactPipeline({
  evidenceCount,
  provenCount,
  gapCount,
  ticketCount,
  reportReady,
}: {
  evidenceCount: number;
  provenCount: number;
  gapCount: number;
  ticketCount: number;
  reportReady: boolean;
}) {
  const items = [
    { label: "Evidence", value: evidenceCount },
    { label: "Proven", value: provenCount },
    { label: "Gaps", value: gapCount },
    { label: "Tickets", value: ticketCount },
    { label: "Report", value: reportReady ? "ready" : "pending" },
  ];

  return (
    <section className={cn(PANEL_CLASS, "px-4 py-3")}>
      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-white">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TopFixesPanel({
  fixes,
  copiedTicketId,
  onCopyFix,
  onViewAllGaps,
  topFixesRef,
}: {
  fixes: TopFix[];
  copiedTicketId?: string | null;
  onCopyFix: (fix: TopFix) => void;
  onViewAllGaps: () => void;
  topFixesRef: RefObject<HTMLElement>;
}) {
  return (
    <section ref={topFixesRef} className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Fix these first</h3>
          <p className="mt-1 text-sm text-slate-400">Top proof gaps and tickets that block strong recovery assurance.</p>
        </div>
        <Button className={BUTTON_CLASS} type="button" onClick={onViewAllGaps}>
          View all gaps
        </Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {fixes.length ? (
          fixes.map((fix, index) => {
            const copyId = fix.ticket?.id || fix.gap?.id || fix.id;
            return (
              <article key={fix.id} className={cn(CARD_CLASS, "px-4 py-4")}>
                <div className="flex items-center justify-between gap-2">
                  <Badge className="rounded-md backdrop-blur-0" variant={priorityVariant(fix.priority)}>
                    {fix.priority || "Medium"}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                </div>
                <h4 className="mt-3 text-sm font-semibold leading-5 text-white">{fix.title}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-400">{fix.why}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Evidence: {fix.evidenceNeeded.slice(0, 2).join(", ") || "Evidence record"}
                </p>
                <button
                  type="button"
                  onClick={() => onCopyFix(fix)}
                  className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
                >
                  {copiedTicketId === copyId ? "Copied" : "Copy ticket"}
                </button>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.018] px-4 py-5 text-sm text-slate-500 lg:col-span-3">
            Run proof to generate prioritized remediation.
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryHealthGrid({ categories }: { categories: Array<{ label: string; score: number; controls: number }> }) {
  return (
    <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
      <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Category health</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const status = category.score >= 80 ? "Strong" : category.score >= 50 ? "Needs proof" : "Weak";
          return (
            <article key={category.label} className={cn(CARD_CLASS, "px-4 py-4")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{category.label}</h4>
                  <p className="mt-1 text-xs text-slate-500">{category.controls} controls</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-white">{category.score}</div>
                  <Badge className="mt-1 rounded-md backdrop-blur-0" variant={statusVariantFromScore(category.score)}>
                    {status}
                  </Badge>
                </div>
              </div>
              <ProgressBar value={category.score} tone={scoreTone(category.score)} compact />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceTab({
  pastePanelRef,
  evidenceItems,
  sourceCounts,
  typeCounts,
  coverage,
  adapters,
  importSource,
  importFormat,
  evidenceText,
  pasteOpen,
  loading,
  running,
  onSourceChange,
  onFormatChange,
  onEvidenceTextChange,
  onPasteOpenChange,
  onImport,
  onRunProof,
  onLoadBackup,
  onLoadM365,
  onLoadWeak,
}: {
  pastePanelRef: RefObject<HTMLElement>;
  evidenceItems: RecoveryEvidenceItem[];
  sourceCounts: Array<{ key: string; count: number }>;
  typeCounts: Array<{ key: string; count: number }>;
  coverage: ReturnType<typeof summarizeEvidenceCoverage>;
  adapters: RecoveryImportAdaptersResponse["adapters"];
  importSource: string;
  importFormat: string;
  evidenceText: string;
  pasteOpen: boolean;
  loading?: boolean;
  running?: boolean;
  onSourceChange: (source: string) => void;
  onFormatChange: (format: string) => void;
  onEvidenceTextChange: (text: string) => void;
  onPasteOpenChange: (open: boolean) => void;
  onImport: () => void;
  onRunProof: () => void;
  onLoadBackup: () => void;
  onLoadM365: () => void;
  onLoadWeak: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceStat label="Evidence-backed controls" value={`${coverage.backedControls}/${coverage.totalControls}`} />
          <EvidenceStat label="Controls missing evidence" value={String(coverage.missingControls)} />
          <EvidenceStat label="Evidence items" value={String(evidenceItems.length)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <EvidenceCountGroup title="Sources" items={sourceCounts} empty="No sources yet." />
          <EvidenceCountGroup title="Evidence types" items={typeCounts} empty="No evidence types yet." />
        </div>
      </section>

      <section ref={pastePanelRef} className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Evidence intake</h3>
            <p className="mt-1 text-sm text-slate-400">Paste evidence or load a safe demo source.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className={BUTTON_CLASS} type="button" disabled={running} onClick={onLoadBackup}>Demo backup</Button>
            <Button className={BUTTON_CLASS} type="button" disabled={running} onClick={onLoadM365}>Demo M365 MFA</Button>
            <Button className={BUTTON_CLASS} type="button" disabled={running} onClick={onLoadWeak}>Weak demo</Button>
            <Button className={BUTTON_CLASS} type="button" disabled={running} onClick={onRunProof}>
              {running ? "Running proof" : "Run proof"}
            </Button>
          </div>
        </div>
        <EvidencePastePanel
          open={pasteOpen}
          adapters={adapters}
          importSource={importSource}
          importFormat={importFormat}
          evidenceText={evidenceText}
          loading={loading}
          running={running}
          onOpenChange={onPasteOpenChange}
          onSourceChange={onSourceChange}
          onFormatChange={onFormatChange}
          onEvidenceTextChange={onEvidenceTextChange}
          onImport={onImport}
        />
      </section>

      <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Stored evidence</h3>
        <div className="mt-4 space-y-2">
          {evidenceItems.length ? (
            evidenceItems.map((item) => <StoredEvidenceItem key={item.id || `${item.title}-${item.source}`} item={item} />)
          ) : (
            <div className="text-sm text-slate-500">No evidence imported yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(CARD_CLASS, "px-4 py-4")}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function EvidencePastePanel({
  open,
  adapters,
  importSource,
  importFormat,
  evidenceText,
  loading,
  running,
  compact,
  onOpenChange,
  onSourceChange,
  onFormatChange,
  onEvidenceTextChange,
  onImport,
}: {
  open: boolean;
  adapters: RecoveryImportAdaptersResponse["adapters"];
  importSource: string;
  importFormat: string;
  evidenceText: string;
  loading?: boolean;
  running?: boolean;
  compact?: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceChange: (source: string) => void;
  onFormatChange: (format: string) => void;
  onEvidenceTextChange: (text: string) => void;
  onImport: () => void;
}) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className={cn("mt-4 rounded-lg border border-white/[0.07] bg-black/[0.08] px-4 py-3", compact && "max-w-4xl")}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
        Paste evidence JSON/CSV/YAML
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adapter</span>
          <select
            value={importSource}
            onChange={(event) => onSourceChange(event.target.value)}
            className={cn(FIELD_CLASS, "mt-2 h-10 w-full px-3 text-sm")}
          >
            {(adapters?.length ? adapters : fallbackAdapters).map((adapter) => (
              <option key={adapter.id} value={adapter.id}>{adapter.name || adapter.id}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Format</span>
          <select
            value={importFormat}
            onChange={(event) => onFormatChange(event.target.value)}
            className={cn(FIELD_CLASS, "mt-2 h-10 w-full px-3 text-sm")}
          >
            <option value="auto">Auto</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="yaml">YAML</option>
          </select>
        </label>
      </div>
      <textarea
        value={evidenceText}
        onChange={(event) => onEvidenceTextChange(event.target.value)}
        spellCheck={false}
        className={cn(FIELD_CLASS, "mt-4 min-h-[120px] w-full resize-y px-4 py-3 font-mono text-xs leading-6 placeholder:text-slate-600")}
        placeholder='title: Restore test report&#10;type: restore_test_report&#10;summary: Restore completed and validated&#10;related_control_ids: restore_test_proven'
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className={BUTTON_CLASS} type="button" variant="primary" disabled={loading || running || !evidenceText.trim()} onClick={onImport}>
          Import evidence
        </Button>
      </div>
    </details>
  );
}

function StoredEvidenceItem({ item }: { item: RecoveryEvidenceItem }) {
  return (
    <details className="rounded-lg border border-white/[0.06] bg-black/[0.08] px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-white">
        {item.title || item.id || "Evidence item"}
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className="rounded-md backdrop-blur-0" variant="info">{item.type || "other"}</Badge>
        <Badge className="rounded-md backdrop-blur-0" variant="neutral">{item.source || "generic"}</Badge>
        <Badge className="rounded-md backdrop-blur-0" variant={confidenceVariant(item.confidence)}>{item.confidence || "medium"}</Badge>
      </div>
      {item.summary ? <p className="mt-3 text-sm leading-6 text-slate-400">{item.summary}</p> : null}
      {item.related_control_ids?.length ? (
        <p className="mt-2 text-xs text-slate-500">Controls: {item.related_control_ids.join(", ")}</p>
      ) : null}
    </details>
  );
}

function ControlsTab({
  groupedControls,
  proofGaps,
  categoryHealth,
}: {
  groupedControls: Array<{ category: string; controls: RecoveryControlResult[] }>;
  proofGaps: ProofGap[];
  categoryHealth: Array<{ label: string; score: number; controls: number }>;
}) {
  return (
    <div className="space-y-5">
      <CategoryHealthGrid categories={categoryHealth} />
      <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Control coverage matrix</h3>
        <div className="mt-5 space-y-5">
          {groupedControls.map((group) => (
            <div key={group.category}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{group.category}</h4>
                <Badge className="rounded-md backdrop-blur-0" variant="neutral">{group.controls.length} controls</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {group.controls.map((control) => (
                  <CompactControlCard
                    key={control.control_id || control.id || control.title}
                    control={control}
                    gapCount={proofGaps.filter((gap) => gap.control_id === control.control_id).length}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompactControlCard({ control, gapCount }: { control: RecoveryControlResult; gapCount: number }) {
  const status = String(control.status || "unknown");
  const evidenceCount = control.supporting_evidence?.length || 0;
  const confidence = Number(control.evidence_confidence ?? 0);
  const remediationTemplate = control.remediation_template || {};
  const remediation =
    typeof remediationTemplate.description === "string"
      ? remediationTemplate.description
      : typeof remediationTemplate.title === "string"
        ? remediationTemplate.title
        : "";

  return (
    <details className={cn("rounded-lg border px-3 py-3", statusSurfaceClass(status))}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge className="rounded-md backdrop-blur-0" variant={statusVariant(status)}>{status.replace(/_/g, " ")}</Badge>
            <h5 className="mt-2 text-sm font-semibold leading-5 text-white">{control.title || control.control_id}</h5>
          </div>
          <span className="shrink-0 text-xs text-slate-500">Details</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
          <span>Confidence {confidence}/100</span>
          <span>{evidenceCount} evidence</span>
          <span>{gapCount} gaps</span>
        </div>
        <ProgressBar value={confidence} tone={statusTone(status)} compact />
      </summary>
      <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-400">
        {control.missing_evidence_types?.length ? (
          <p><span className="text-slate-500">Missing evidence:</span> {control.missing_evidence_types.join(", ")}</p>
        ) : null}
        {control.supporting_evidence?.length ? (
          <p><span className="text-slate-500">Supporting evidence:</span> {control.supporting_evidence.map((item) => item.title || item.id).join(", ")}</p>
        ) : null}
        {remediation ? <p><span className="text-slate-500">Remediation:</span> {remediation}</p> : null}
        {control.technical_risk ? <p><span className="text-slate-500">Technical risk:</span> {control.technical_risk}</p> : null}
      </div>
    </details>
  );
}

function TicketsTab({
  gaps,
  ticketGroups,
  copiedTicketId,
  onCopyTicket,
  onExportMarkdown,
  onExportJira,
}: {
  gaps: ProofGap[];
  ticketGroups: Array<{ label: string; tickets: RemediationTicket[]; tone: StatusTone }>;
  copiedTicketId?: string | null;
  onCopyTicket: (ticket: RemediationTicket) => void;
  onExportMarkdown: () => void;
  onExportJira: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">MSP ticket queue</h3>
            <p className="mt-1 text-sm text-slate-400">Prioritized work items for MSP or IT owners.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className={BUTTON_CLASS} type="button" onClick={onExportMarkdown}>Export Markdown</Button>
            <Button className={BUTTON_CLASS} type="button" onClick={onExportJira}>Export Jira JSON</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {ticketGroups.map((group) => (
            <div key={group.label} className="rounded-lg border border-white/[0.07] bg-black/[0.08] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">{group.label}</h4>
                <Badge className="rounded-md backdrop-blur-0" variant={priorityLaneVariant(group.tone)}>{group.tickets.length}</Badge>
              </div>
              <div className="space-y-3">
                {group.tickets.length ? (
                  group.tickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id || ticket.title}
                      ticket={ticket}
                      copied={copiedTicketId === (ticket.id || ticket.title || "ticket")}
                      onCopy={() => onCopyTicket(ticket)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-4 text-xs leading-5 text-slate-500">
                    No tickets in this lane.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">All proof gaps</h3>
        <div className="mt-4 space-y-2">
          {gaps.length ? (
            gaps.map((gap) => (
              <details key={gap.id || gap.control_id} className="rounded-lg border border-white/[0.06] bg-black/[0.08] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  {gap.control_title || gap.control_id}
                </summary>
                <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                  <Badge className="rounded-md backdrop-blur-0" variant={priorityVariant(gap.severity)}>{gap.severity || "Medium"}</Badge>
                  <p>{gap.client_friendly_risk || gap.description}</p>
                  {gap.missing_evidence_types?.length ? <p className="text-slate-500">Evidence needed: {gap.missing_evidence_types.join(", ")}</p> : null}
                </div>
              </details>
            ))
          ) : (
            <div className="text-sm text-slate-500">No proof gaps generated.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function TicketCard({ ticket, copied, onCopy }: { ticket: RemediationTicket; copied?: boolean; onCopy: () => void }) {
  return (
    <article className={cn(CARD_CLASS, "px-3 py-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-md backdrop-blur-0" variant={priorityVariant(ticket.priority)}>{ticket.priority || "Medium"}</Badge>
        <Badge className="rounded-md backdrop-blur-0" variant="neutral">{ticket.suggested_owner || "MSP / IT"}</Badge>
      </div>
      <h4 className="mt-3 text-sm font-semibold leading-5 text-white">{ticket.title}</h4>
      {ticket.affected_controls?.length ? (
        <p className="mt-2 text-xs text-slate-500">Control: {ticket.affected_controls.slice(0, 2).join(", ")}</p>
      ) : null}
      {ticket.evidence_needed?.length ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">Evidence: {ticket.evidence_needed.slice(0, 2).join(", ")}</p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-slate-400">{ticket.client_friendly_explanation || ticket.description}</p>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
      >
        {copied ? "Copied" : "Copy ticket"}
      </button>
    </article>
  );
}

function AdvancedTab({
  proofReport,
  ticketExport,
  evidenceItems,
}: {
  proofReport?: RecoveryProofReport | null;
  ticketExport?: RecoveryTicketExportResponse | null;
  evidenceItems: RecoveryEvidenceItem[];
}) {
  const rawPayload = {
    recovery_proof: proofReport,
    ticket_export: ticketExport,
    evidence_items: evidenceItems,
  };

  return (
    <section className={cn(PANEL_CLASS, "px-5 py-5 sm:px-6")}>
      <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Advanced</h3>
      {proofReport?.technical_summary ? (
        <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/[0.08] px-4 py-3 text-sm leading-6 text-slate-300">
          {proofReport.technical_summary}
        </div>
      ) : null}
      <details className="mt-4 rounded-lg border border-white/[0.07] bg-black/[0.08] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Raw response JSON</summary>
        <textarea
          readOnly
          value={JSON.stringify(rawPayload, null, 2)}
          className={cn(FIELD_CLASS, "mt-4 min-h-[300px] w-full resize-y px-4 py-3 font-mono text-xs leading-6 text-slate-300")}
        />
      </details>
    </section>
  );
}

function EvidenceCountGroup({ title, items, empty }: { title: string; items: Array<{ key: string; count: number }>; empty: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h4>
      <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {items.length ? (
          items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-300">{item.key}</span>
              <span className="text-slate-500">{item.count}</span>
            </div>
          ))
        ) : (
          <div className="py-2 text-sm text-slate-500">{empty}</div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, tone, compact }: { value: number; tone: StatusTone; compact?: boolean }) {
  return (
    <div className={cn("mt-2 overflow-hidden rounded-sm bg-white/[0.08]", compact ? "h-1.5" : "h-2")}>
      <div
        className={cn("h-full rounded-sm transition-all duration-700", toneBgClass(tone))}
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  );
}

function StatusMessage({ tone, text }: { tone: "success" | "danger"; text: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-6",
        tone === "success"
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
          : "border-red-400/20 bg-red-400/10 text-red-100",
      )}
    >
      {text}
    </div>
  );
}

function getRecoveryVerdict(
  recoveryProofScore: number,
  evidenceConfidence: number,
  criticalGaps: number,
  hasProof: boolean,
) {
  if (!hasProof) {
    return {
      title: "Recovery proof has not been run.",
      subtitle: "Import evidence and run proof to see whether recovery can be defended with evidence.",
      badge: "Awaiting proof",
      variant: "neutral" as BadgeVariant,
    };
  }
  if (recoveryProofScore >= 80 && evidenceConfidence >= 70 && criticalGaps <= 0) {
    return {
      title: "Recovery is defensible.",
      subtitle: "Recovery capability is backed by evidence and no critical proof gaps are open.",
      badge: "Defensible",
      variant: "success" as BadgeVariant,
    };
  }
  if (recoveryProofScore >= 50) {
    return {
      title: "Recovery is partially defensible.",
      subtitle: "Some recovery capability is supported by evidence, but key proof gaps remain before this can be shown as strong assurance.",
      badge: "Partial",
      variant: "warning" as BadgeVariant,
    };
  }
  return {
    title: "Recovery is not yet defensible.",
    subtitle: "Current evidence is not enough to prove recovery readiness. Start with the top gaps and collect missing proof.",
    badge: "Not defensible",
    variant: "danger" as BadgeVariant,
  };
}

function getTopFixes(gaps: ProofGap[], tickets: RemediationTicket[], limit = 3): TopFix[] {
  const fixesFromTickets = tickets.map((ticket) => {
    const relatedGap = gaps.find((gap) => ticket.affected_controls?.includes(gap.control_id || ""));
    return {
      id: ticket.id || ticket.title || cryptoSafeId(ticket.title || "ticket"),
      title: ticket.title || relatedGap?.recommended_action || "Recovery proof remediation",
      priority: ticket.priority || relatedGap?.severity,
      why: ticket.client_friendly_explanation || relatedGap?.client_friendly_risk || ticket.description || "This blocks stronger recovery assurance.",
      evidenceNeeded: ticket.evidence_needed || relatedGap?.missing_evidence_types || [],
      ticket,
      gap: relatedGap,
    } satisfies TopFix;
  });

  if (fixesFromTickets.length) return fixesFromTickets.slice(0, limit);

  return gaps.slice(0, limit).map((gap) => ({
    id: gap.id || gap.control_id || cryptoSafeId(gap.control_title || "gap"),
    title: gap.recommended_action || gap.control_title || "Collect missing recovery proof",
    priority: gap.severity,
    why: gap.client_friendly_risk || gap.description || "This blocks stronger recovery assurance.",
    evidenceNeeded: gap.missing_evidence_types || [],
    gap,
  }));
}

function summarizeEvidenceCoverage(
  controlResults: RecoveryControlResult[],
  controls: RecoveryControl[],
  evidenceItems: RecoveryEvidenceItem[],
) {
  const totalControls = controlResults.length || controls.length || 10;
  const backedControls = controlResults.length
    ? controlResults.filter((control) => (control.supporting_evidence || []).length > 0).length
    : 0;
  const missingControls = Math.max(0, totalControls - backedControls);
  return {
    backedControls,
    missingControls,
    totalControls,
    evidenceItems: evidenceItems.length,
    coveragePercent: totalControls ? Math.round((backedControls / totalControls) * 100) : 0,
  };
}

function controlsToResults(controls: RecoveryControl[]): RecoveryControlResult[] {
  return controls.map((control) => ({
    ...control,
    control_id: control.id,
    status: "unknown",
    status_score: 0,
    evidence_confidence: 0,
    supporting_evidence: [],
  }));
}

function getControlStatusScore(control: RecoveryControlResult): number {
  if (typeof control.status_score === "number") return control.status_score;
  const status = String(control.status || "unknown");
  if (status === "proven") return 100;
  if (status === "partially_proven") return 50;
  return 0;
}

function groupControlsByCategory(controls: RecoveryControlResult[]) {
  const groups = new Map<string, RecoveryControlResult[]>(
    CONTROL_CATEGORY_ORDER.map((category) => [category, []]),
  );
  for (const control of controls) {
    const label = categoryLabel(control);
    groups.set(label, [...(groups.get(label) || []), control]);
  }
  return Array.from(groups.entries())
    .filter(([, groupControls]) => groupControls.length > 0)
    .map(([category, groupControls]) => ({ category, controls: groupControls }));
}

function buildCategoryHealth(controls: RecoveryControlResult[]) {
  const categoryDefinitions = [
    { label: "Backup survivability", ids: ["backup_exists_for_critical_systems", "backup_isolation_or_immutability_proven", "backup_admin_separation_proven"] },
    { label: "Restore confidence", ids: ["restore_test_proven"] },
    { label: "Admin protection", ids: ["admin_mfa_proven", "backup_admin_separation_proven"] },
    { label: "Detection coverage", ids: ["endpoint_detection_or_logging_present"] },
    { label: "IR readiness", ids: ["incident_response_playbook_exists"] },
    { label: "Asset criticality", ids: ["critical_assets_identified", "recovery_priority_list_exists"] },
    { label: "External exposure", ids: ["external_exposure_reviewed"] },
  ];
  return categoryDefinitions.map((definition) => {
    const matched = controls.filter((control) => definition.ids.includes(control.control_id || control.id || ""));
    const score = matched.length
      ? Math.round(matched.reduce((total, control) => total + getControlStatusScore(control), 0) / matched.length)
      : 0;
    return { label: definition.label, score, controls: matched.length };
  });
}

function countEvidenceBySource(items: RecoveryEvidenceItem[]) {
  return countBy(items, (item) => item.source || "generic");
}

function countEvidenceByType(items: RecoveryEvidenceItem[]) {
  return countBy(items, (item) => item.type || "other");
}

function sortGapsByPriority(gaps: ProofGap[]) {
  return [...gaps].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function sortTicketsByPriority(tickets: RemediationTicket[]) {
  return [...tickets].sort((a, b) => severityRank(b.priority) - severityRank(a.priority));
}

function groupTicketsByPriority(tickets: RemediationTicket[]) {
  return [
    { label: "Immediate", tone: "danger" as StatusTone, tickets: tickets.filter((ticket) => severityRank(ticket.priority) >= 4) },
    { label: "High", tone: "warning" as StatusTone, tickets: tickets.filter((ticket) => severityRank(ticket.priority) === 3) },
    { label: "Medium", tone: "info" as StatusTone, tickets: tickets.filter((ticket) => severityRank(ticket.priority) === 2) },
    { label: "Low", tone: "success" as StatusTone, tickets: tickets.filter((ticket) => severityRank(ticket.priority) <= 1) },
  ];
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function categoryLabel(control: RecoveryControlResult): string {
  const category = String(control.category || "").toLowerCase();
  const id = String(control.control_id || control.id || "");
  if (CONTROL_CATEGORY_LABELS[category]) return CONTROL_CATEGORY_LABELS[category];
  if (category.includes("scope") || id.includes("asset")) return "Assets";
  if (category.includes("identity") || category.includes("privilege") || id.includes("mfa") || id.includes("admin")) return "Identity";
  if (category.includes("backup") || id.includes("backup")) return "Backup";
  if (category.includes("detection") || id.includes("logging") || id.includes("detection")) return "Detection";
  if (category.includes("response") || id.includes("incident")) return "Incident Response";
  if (category.includes("exposure") || id.includes("exposure")) return "Exposure";
  if (category.includes("planning") || category.includes("validation") || id.includes("priority") || id.includes("restore")) return "Recovery Planning";
  return "Recovery Planning";
}

function severityRank(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "critical" || normalized === "immediate" || normalized === "highest") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
}

function ticketToClipboardText(ticket: RemediationTicket): string {
  return [
    ticket.title || "Recovery Proof remediation ticket",
    "",
    `Priority: ${ticket.priority || "Medium"}`,
    `Owner: ${ticket.suggested_owner || "MSP / IT owner"}`,
    `Affected controls: ${(ticket.affected_controls || []).join(", ") || "-"}`,
    "",
    ticket.description || "",
    "",
    "Evidence needed:",
    ...(ticket.evidence_needed || []).map((item) => `- ${item}`),
    "",
    "Client explanation:",
    ticket.client_friendly_explanation || "-",
    "",
    "Technical notes:",
    ticket.technical_notes || "-",
  ].join("\n");
}

function topFixToClipboardText(fix: TopFix): string {
  return [
    fix.title,
    "",
    `Priority: ${fix.priority || "Medium"}`,
    "",
    fix.why,
    "",
    "Evidence needed:",
    ...(fix.evidenceNeeded.length ? fix.evidenceNeeded : ["Evidence record"]).map((item) => `- ${item}`),
  ].join("\n");
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected Recovery Proof error.";
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

function scoreTone(score: number): StatusTone {
  if (score >= 80) return "success";
  if (score >= 55) return "info";
  if (score >= 35) return "warning";
  return score > 0 ? "danger" : "neutral";
}

function statusTone(status?: string): StatusTone {
  if (status === "proven") return "success";
  if (status === "partially_proven") return "warning";
  if (status === "not_proven") return "danger";
  return "neutral";
}

function statusVariant(status?: string): BadgeVariant {
  if (status === "proven") return "success";
  if (status === "partially_proven") return "warning";
  if (status === "not_proven") return "danger";
  return "neutral";
}

function statusVariantFromScore(score: number): BadgeVariant {
  if (score >= 80) return "success";
  if (score >= 55) return "info";
  if (score >= 35) return "warning";
  if (score > 0) return "danger";
  return "neutral";
}

function confidenceVariant(confidence?: string): BadgeVariant {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "info";
  if (confidence === "low") return "warning";
  return "neutral";
}

function priorityVariant(priority?: string): BadgeVariant {
  const rank = severityRank(priority);
  if (rank >= 4) return "danger";
  if (rank === 3) return "orange";
  if (rank === 2) return "warning";
  if (rank === 1) return "success";
  return "neutral";
}

function priorityLaneVariant(tone: StatusTone): BadgeVariant {
  if (tone === "danger") return "danger";
  if (tone === "warning") return "warning";
  if (tone === "success") return "success";
  return "neutral";
}

function variantToTone(variant: BadgeVariant): StatusTone {
  if (variant === "success") return "success";
  if (variant === "info") return "info";
  if (variant === "warning" || variant === "orange") return "warning";
  if (variant === "danger") return "danger";
  return "neutral";
}

function metricBorderClass(tone: StatusTone) {
  if (tone === "success") return "border-emerald-300/[0.16]";
  if (tone === "info") return "border-cyan-300/[0.16]";
  if (tone === "warning") return "border-amber-300/[0.16]";
  if (tone === "danger") return "border-red-300/[0.16]";
  return "border-white/[0.08]";
}

function toneBgClass(tone: StatusTone) {
  if (tone === "success") return "bg-emerald-300";
  if (tone === "info") return "bg-cyan-300";
  if (tone === "warning") return "bg-amber-300";
  if (tone === "danger") return "bg-red-300";
  return "bg-slate-500";
}

function statusSurfaceClass(status: string) {
  if (status === "proven") return "border-emerald-300/[0.14] bg-emerald-300/[0.035]";
  if (status === "partially_proven") return "border-amber-300/[0.14] bg-amber-300/[0.035]";
  if (status === "not_proven") return "border-red-300/[0.14] bg-red-300/[0.035]";
  return "border-white/[0.07] bg-white/[0.018]";
}

function cryptoSafeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}
