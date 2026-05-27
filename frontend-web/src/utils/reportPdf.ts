import type { ActionItem, EvidenceItem, ReportResponse } from "../types/api";
import {
  domainLabel,
  localizedDomainRisk,
  localizedFinding,
  localizedSummary,
  localizeKnownText,
  riskLabel,
  valueLabel,
  type UiLanguage,
} from "./i18n";

type PdfCopy = {
  title: string;
  subtitle: string;
  generated: string;
  score: string;
  risk: string;
  completion: string;
  confidence: string;
  status: string;
  summary: string;
  keyRisks: string;
  priorityPlan: string;
  evidence: string;
  methodology: string;
  action: string;
  owner: string;
  deadline: string;
  evidenceNeeded: string;
  truncated: string;
};

type PdfDocument = import("jspdf").jsPDF;

const copyByLanguage: Record<UiLanguage, PdfCopy> = {
  et: {
    title: "Ransomware Readiness Report",
    subtitle: "IT-osakonnale mõeldud lühiraport",
    generated: "Koostatud",
    score: "Tulemus",
    risk: "Riskitase",
    completion: "Täidetud",
    confidence: "Usaldusväärsus",
    status: "Staatus",
    summary: "Kokkuvõte",
    keyRisks: "Peamised riskid",
    priorityPlan: "Prioriteetne tegevusplaan",
    evidence: "IT tõendid, mida koguda",
    methodology: "Metoodika",
    action: "Tegevus",
    owner: "Omanik",
    deadline: "Tähtaeg",
    evidenceNeeded: "Tõend",
    truncated: "Raport on hoitud kuni 3 lehekülje piires; detailsemad kirjed jäävad rakenduse vaatesse.",
  },
  en: {
    title: "Ransomware Readiness Report",
    subtitle: "Concise handoff for the IT team",
    generated: "Generated",
    score: "Score",
    risk: "Risk level",
    completion: "Completion",
    confidence: "Confidence",
    status: "Status",
    summary: "Executive summary",
    keyRisks: "Key risks",
    priorityPlan: "Priority remediation plan",
    evidence: "IT evidence to collect",
    methodology: "Methodology",
    action: "Action",
    owner: "Owner",
    deadline: "Deadline",
    evidenceNeeded: "Evidence",
    truncated: "The PDF is capped at 3 pages; remaining details stay in the application view.",
  },
  ru: {
    title: "Ransomware Readiness Report",
    subtitle: "Краткий отчёт для IT-отдела",
    generated: "Составлено",
    score: "Score",
    risk: "Уровень риска",
    completion: "Заполнено",
    confidence: "Уверенность",
    status: "Статус",
    summary: "Краткое резюме",
    keyRisks: "Ключевые риски",
    priorityPlan: "Приоритетный план",
    evidence: "Доказательства для IT",
    methodology: "Методология",
    action: "Действие",
    owner: "Владелец",
    deadline: "Срок",
    evidenceNeeded: "Доказательство",
    truncated: "PDF ограничен 3 страницами; остальные детали остаются в приложении.",
  },
};

const MAX_PAGES = 3;
const MARGIN_X = 42;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 46;
const LINE_HEIGHT = 12;

export async function generateReadinessReportPdf(report: ReportResponse, language: UiLanguage = "et") {
  const { jsPDF } = await import("jspdf");
  const copy = copyByLanguage[language];
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;
  let y = MARGIN_TOP;
  let truncated = false;

  const canFit = (height: number) => {
    if (y + height <= pageHeight - MARGIN_BOTTOM) return true;
    if (doc.getNumberOfPages() >= MAX_PAGES) {
      truncated = true;
      return false;
    }
    doc.addPage();
    y = MARGIN_TOP;
    return true;
  };

  const text = (value: string, x: number, fontSize = 9, style: "normal" | "bold" = "normal", width = contentWidth) => {
    const lines = doc.splitTextToSize(cleanText(value), width);
    const height = lines.length * LINE_HEIGHT + 2;
    if (!canFit(height)) return false;
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(36, 45, 57);
    doc.text(lines, x, y);
    y += height;
    return true;
  };

  const heading = (value: string) => {
    if (!canFit(22)) return false;
    y += y === MARGIN_TOP ? 0 : 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(value, MARGIN_X, y);
    y += 18;
    return true;
  };

  const bullet = (value: string, indent = 10) => {
    const lines = doc.splitTextToSize(cleanText(value), contentWidth - indent - 8);
    const height = lines.length * LINE_HEIGHT + 3;
    if (!canFit(height)) return false;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(36, 45, 57);
    doc.text("-", MARGIN_X + indent, y);
    doc.text(lines, MARGIN_X + indent + 10, y);
    y += height;
    return true;
  };

  drawHeader(doc, copy, report, language, contentWidth);
  y = 126;

  heading(copy.summary);
  text(report.summary || localizedSummary(language, report.overall_score, report.risk_level, report.completion_rate), MARGIN_X, 9.5);

  const findingRows = buildFindingRows(report, language).slice(0, 4);
  if (findingRows.length && heading(copy.keyRisks)) {
    findingRows.forEach((item, index) => {
      text(`${index + 1}. ${item.title}`, MARGIN_X, 9.2, "bold");
      bullet(`${copy.risk}: ${item.severity || "-"} | ${domainLabel(language, item.domain)}`);
      if (item.summary) bullet(item.summary);
      if (item.action) bullet(`${copy.action}: ${item.action}`);
      y += 2;
    });
  }

  const actions = buildActionRows(report.action_plan || [], language).slice(0, 6);
  if (actions.length && heading(copy.priorityPlan)) {
    actions.forEach((item, index) => {
      text(`${index + 1}. ${item.title}`, MARGIN_X, 9.2, "bold");
      bullet(
        [
          item.priority ? `${copy.risk}: ${item.priority}` : null,
          item.domain ? domainLabel(language, item.domain) : null,
          item.owner ? `${copy.owner}: ${item.owner}` : null,
          item.deadline ? `${copy.deadline}: ${item.deadline}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      );
      if (item.evidence) bullet(`${copy.evidenceNeeded}: ${item.evidence}`);
    });
  }

  const evidence = buildEvidenceRows(report.evidence_checklist || [], language).slice(0, 6);
  if (evidence.length && heading(copy.evidence)) {
    evidence.forEach((item) => {
      text(item.title, MARGIN_X, 9.2, "bold");
      item.items.slice(0, 2).forEach((entry) => bullet(entry));
    });
  }

  if (heading(copy.methodology)) {
    const methodology = report.methodology;
    bullet(
      [
        methodology?.methodology_name || "Ransomware Readiness Assessment",
        methodology?.methodology_version ? `v${methodology.methodology_version}` : null,
        methodology?.questions_version ? `questions ${methodology.questions_version}` : null,
        methodology?.scoring_version ? `scoring ${methodology.scoring_version}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      0,
    );
    bullet("Official score and risk are calculated from assessment answers and scoring rules; remediation actions are LLM-written from the report risks.", 0);
  }

  if (truncated && canFit(18)) {
    y += 4;
    text(copy.truncated, MARGIN_X, 8.5, "bold");
  }

  addFooters(doc, copy);
  doc.save(`ransomware-readiness-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawHeader(
  doc: PdfDocument,
  copy: PdfCopy,
  report: ReportResponse,
  language: UiLanguage,
  contentWidth: number,
) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 96, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(copy.title, MARGIN_X, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`${copy.subtitle} | ${copy.generated}: ${new Date().toLocaleDateString()}`, MARGIN_X, 58);

  const score = `${Math.round(Number(report.overall_score ?? 0))}/100`;
  const completion = `${Math.round(Number(report.completion_rate ?? 0))}%`;
  const columns = [
    [copy.score, score],
    [copy.risk, riskLabel(language, report.risk_level)],
    [copy.completion, completion],
    [copy.status, valueLabel(language, report.score_status || (report.is_complete ? "final" : "preliminary"))],
  ];
  const colWidth = contentWidth / columns.length;
  columns.forEach(([label, value], index) => {
    const x = MARGIN_X + index * colWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(label.toUpperCase(), x, 82);
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(cleanText(value), x, 94);
  });
}

function addFooters(doc: PdfDocument, copy: PdfCopy) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(copy.title, MARGIN_X, doc.internal.pageSize.getHeight() - 24);
    doc.text(`${page}/${pageCount}`, doc.internal.pageSize.getWidth() - MARGIN_X, doc.internal.pageSize.getHeight() - 24, {
      align: "right",
    });
  }
}

function buildFindingRows(report: ReportResponse, language: UiLanguage) {
  if (report.findings?.length) {
    return report.findings.map((finding) => {
      const localized = localizedFinding(language, finding);
      return {
        title: cleanText(localized.title || domainLabel(language, localized.domain)),
        severity: riskLabel(language, localized.severity),
        domain: localized.domain,
        summary: cleanText(localized.business_impact || localized.verification || localized.evidence || ""),
        action: cleanText(localized.recommended_fix || ""),
      };
    });
  }

  return (report.top_risks || []).map((risk) => ({
    title: cleanText(domainLabel(language, risk.domain || risk.title)),
    severity: riskLabel(language, risk.risk_level),
    domain: risk.domain,
    summary: cleanText(localizedDomainRisk(language, risk.domain, risk.risk)),
    action: cleanText(risk.recommended_actions?.[0] ? localizeKnownText(language, risk.recommended_actions[0]) : ""),
  }));
}

function buildActionRows(items: ActionItem[], language: UiLanguage) {
  return items.map((item) => ({
    title: cleanText(localizeKnownText(language, item.title || "Remediation action")),
    priority: item.priority ? riskLabel(language, item.priority) : "",
    domain: item.domain,
    owner: cleanText(valueLabel(language, item.owner || item.owner_suggestion || "")),
    deadline: cleanText(item.deadline || ""),
    evidence: cleanText((item.evidence_required || []).slice(0, 2).join("; ")),
  }));
}

function buildEvidenceRows(items: EvidenceItem[], language: UiLanguage) {
  return items.map((item) => ({
    title: cleanText(item.title || domainLabel(language, item.domain)),
    items: [...(item.items || []), ...(item.evidence_examples || [])]
      .map((entry) => cleanText(localizeKnownText(language, entry)))
      .filter(Boolean),
  }));
}

function cleanText(value?: string | number | null): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[•·]/g, "-")
    .trim();
}
