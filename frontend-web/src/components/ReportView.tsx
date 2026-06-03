import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  Download,
  ExternalLink,
  FileSearch,
  Info,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { ArtifactId, DomainScore, ReportResponse, RiskLevel, SessionPath } from "../types/api";
import {
  isEarlyPreview,
  riskToneForCompletion,
  scoreConfidenceLabel,
} from "../utils/assessmentUi";
import {
  domainLabel,
  localizedDomainRisk,
  localizedExposureQuestion,
  localizedFinding,
  localizedSummary,
  localizeKnownText,
  riskLabel,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { generateReadinessReportPdf } from "../utils/reportPdf";
import ArtifactTitleInfo from "./ArtifactTitleInfo";
import IncompleteReportBadge from "./IncompleteReportBadge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
import { cn, riskTone, type Tone } from "./ui-helpers";

type FindingLike = {
  id: string;
  title: string;
  severity?: RiskLevel;
  domain?: string;
  summary?: string;
  action?: string;
};

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type ReportSource = {
  name: string;
  url?: string;
  usedFor?: string;
};

type PriorityStep = {
  id: string;
  title: string;
  meta: string;
  tone: Tone;
};

type MetricItem = {
  label: string;
  value: string;
  detail?: string;
};

type DemoProfileId = "weak_sme" | "better_sme";
type DemoProfileLoader = (profileId: DemoProfileId) => void;
type SectionInfoKey = "prioritySteps" | "criticalFindings" | "domainRiskMap";

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const reportCopy = {
  et: {
    introLabel: "Valmisoleku raport",
    title: "Raport",
    subtitle: "Selge ülevaade sinu valmisolekust, prioriteetidest ja tõenditest.",
    score: "Tulemus",
    risk: "Riskitase",
    completion: "Täidetud",
    confidence: "Usaldus",
    backendOwned: "Taustsüsteemi arvutus",
    backendRisk: "Taustsüsteemi riskitase",
    answered: "Vastatud",
    separateSignal: "Eraldi signaal",
    officialScore: "Ametlik tulemus",
    topRisk: "Peamine risk",
    priorityAction: "Prioriteetne tegevus",
    criticalFindings: "Kriitilised leiud",
    criticalFindingsDescription: "Olulised riskid, mis vajavad enne järgmist sammu tähelepanu.",
    prioritySteps: "Prioriteetsed sammud",
    priorityStepsDescription: "LLM-i sõnastatud tegevusjärjekord raporti riskide põhjal.",
    items: "kirjet",
    noFindings: "Kompaktseid leide pole veel. Värskenda taustsüsteemi raportit.",
    noSteps: "Prioriseeritud samme pole veel.",
    domainRiskMap: "Domeenide valmisolek",
    domainRiskDescription: "Taustsüsteemi domeenitulemused madalamast kõrgemani.",
    domains: "domeeni",
    noRiskLabel: "Riskimärgis puudub",
    coverage: "Kaetus",
    criticalNegatives: "kriitilist negatiivset",
    detailedNarrative: "Detailne narratiiv",
    howScoringWorks: "Kuidas tulemus arvutatakse",
    howScoringWorksDescription: "Versioonitud küsimused, taustsüsteemi reeglid ja tulemuse põhjendus.",
    expanded: "Avatud",
    collapsed: "Vaikimisi suletud",
    sourcesUsed: "Kasutatud allikad",
    reference: "Viide",
    openSource: "Ava allikas",
    immediatePriority: "Kohe prioriteet",
    queuedAction: "Järjekorras tegevus",
    method: "Meetod",
    questions: "Küsimused",
    scoring: "Arvutus",
    scale: "Skaala",
    versioned: "Versioonitud",
    deterministic: "Deterministlik",
    pointsShort: "p",
    downloadPdf: "PDF",
    pdfBlockedReason: "PDF on saadaval, kui kõik küsimused on vastatud.",
  },
  en: {
    introLabel: "Readiness report",
    title: "Report",
    subtitle: "A calm view of readiness, priorities, and supporting evidence.",
    score: "Score",
    risk: "Risk",
    completion: "Completion",
    confidence: "Confidence",
    backendOwned: "Backend-owned",
    backendRisk: "Backend risk",
    answered: "Answered",
    separateSignal: "Separate signal",
    officialScore: "Official score",
    topRisk: "Top risk",
    priorityAction: "Priority action",
    criticalFindings: "Critical findings",
    criticalFindingsDescription: "The main risks to address before the next step.",
    prioritySteps: "Priority next steps",
    priorityStepsDescription: "LLM-written action order based on report risks.",
    items: "items",
    noFindings: "No compact findings available yet. Refresh the backend report.",
    noSteps: "No prioritized next steps available yet.",
    domainRiskMap: "Domain readiness",
    domainRiskDescription: "Backend domain scores, ordered from lowest to highest.",
    domains: "domains",
    noRiskLabel: "No risk label",
    coverage: "Coverage",
    criticalNegatives: "critical negatives",
    detailedNarrative: "Detailed narrative",
    howScoringWorks: "How scoring works",
    howScoringWorksDescription: "Versioned questions, backend rules, and score rationale.",
    expanded: "Expanded",
    collapsed: "Collapsed by default",
    sourcesUsed: "Sources used",
    reference: "Reference",
    openSource: "Open source",
    immediatePriority: "Immediate priority",
    queuedAction: "Queued action",
    method: "Method",
    questions: "Questions",
    scoring: "Scoring",
    scale: "Scale",
    versioned: "Versioned",
    deterministic: "Deterministic",
    pointsShort: "pts",
    downloadPdf: "PDF",
    pdfBlockedReason: "PDF is available after all questions are answered.",
  },
  ru: {
    introLabel: "Отчёт готовности",
    title: "Raport",
    subtitle: "Спокойный обзор готовности, приоритетов и подтверждающих данных.",
    score: "Score",
    risk: "Риск",
    completion: "Готово",
    confidence: "Доверие",
    backendOwned: "Расчёт backend",
    backendRisk: "Риск backend",
    answered: "Отвечено",
    separateSignal: "Отдельный сигнал",
    officialScore: "Официальный score",
    topRisk: "Главный риск",
    priorityAction: "Приоритетное действие",
    criticalFindings: "Критические находки",
    criticalFindingsDescription: "Главные риски, которые стоит закрыть перед следующим шагом.",
    prioritySteps: "Приоритетные шаги",
    priorityStepsDescription: "Порядок действий, сформулированный LLM на основе рисков отчёта.",
    items: "шт.",
    noFindings: "Компактных findings пока нет. Обнови backend отчёт.",
    noSteps: "Приоритетных шагов пока нет.",
    domainRiskMap: "Готовность по доменам",
    domainRiskDescription: "Backend score доменов от самого низкого к самому высокому.",
    domains: "доменов",
    noRiskLabel: "Нет метки риска",
    coverage: "Покрытие",
    criticalNegatives: "критических negative",
    detailedNarrative: "Детальный нарратив",
    howScoringWorks: "Как работает score",
    howScoringWorksDescription: "Версионные questions, backend rules и score rationale.",
    expanded: "Открыто",
    collapsed: "Скрыто по умолчанию",
    sourcesUsed: "Использованные источники",
    reference: "Источник",
    openSource: "Открыть",
    immediatePriority: "Срочный приоритет",
    queuedAction: "В очереди",
    method: "Метод",
    questions: "Вопросы",
    scoring: "Расчёт",
    scale: "Шкала",
    versioned: "Версионировано",
    deterministic: "Детерминированно",
    pointsShort: "б.",
    downloadPdf: "PDF",
    pdfBlockedReason: "PDF доступен после ответа на все вопросы.",
  },
} as const;

function r(language: UiLanguage, key: keyof typeof reportCopy.en): string {
  return reportCopy[language]?.[key] || reportCopy.en[key];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function toneAccent(tone: Tone): string {
  if (tone === "success") return "from-emerald-400 via-emerald-200 to-white";
  if (tone === "warning") return "from-amber-300 via-yellow-100 to-white";
  if (tone === "orange") return "from-orange-400 via-amber-200 to-white";
  if (tone === "danger") return "from-rose-400 via-orange-200 to-white";
  if (tone === "info") return "from-sky-400 via-cyan-200 to-white";
  return "from-slate-300 via-slate-100 to-white";
}

function toneTrack(tone: Tone): string {
  if (tone === "success") return "bg-emerald-300";
  if (tone === "warning") return "bg-amber-300";
  if (tone === "orange") return "bg-orange-300";
  if (tone === "danger") return "bg-rose-300";
  if (tone === "info") return "bg-sky-300";
  return "bg-slate-300";
}

function badgeVariantForTone(tone: Tone): BadgeVariant {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "orange") return "orange";
  if (tone === "danger") return "danger";
  if (tone === "info") return "info";
  return "neutral";
}

function normalizeReportSources(report?: ReportResponse | null): ReportSource[] {
  if (!Array.isArray(report?.sources)) {
    return [];
  }

  return report.sources
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name || "").trim(),
      url: typeof item.url === "string" ? item.url : undefined,
      usedFor: typeof item.used_for === "string" ? item.used_for : undefined,
    }))
    .filter((item) => item.name);
}

function ReportActionButton({
  children,
  disabled,
  disabledReason,
  align = "right",
  tooltipPlacement = "top",
  className,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  align?: "left" | "center" | "right";
  tooltipPlacement?: "top" | "bottom";
  className?: string;
  onClick: () => void;
}) {
  const blocked = Boolean(disabledReason);
  const tooltipPosition =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "left"
        ? "left-0"
        : "right-0";

  return (
    <span className="group relative inline-flex">
      <Button
        type="button"
        disabled={disabled || blocked}
        onClick={blocked ? undefined : onClick}
        className={className}
      >
        {children}
      </Button>
      {disabledReason ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-30 w-72 rounded-2xl border border-amber-300/20 bg-slate-950/95 px-4 py-3 text-left text-xs font-medium leading-5 text-amber-50 opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl transition group-hover:opacity-100 group-focus-within:opacity-100",
            tooltipPosition,
            tooltipPlacement === "bottom" ? "top-full mt-3" : "bottom-full mb-3",
          )}
        >
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}

function ReportDemoProfiles({
  onLoadDemo,
  align = "left",
}: {
  onLoadDemo?: DemoProfileLoader;
  align?: "left" | "center";
}) {
  if (!onLoadDemo) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", align === "center" && "justify-center")}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Demo profiles
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onLoadDemo("weak_sme")}
        className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 shadow-none hover:bg-white/[0.08] hover:text-white"
      >
        <ShieldAlert className="h-4 w-4" />
        Weak SME
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onLoadDemo("better_sme")}
        className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 shadow-none hover:bg-white/[0.08] hover:text-white"
      >
        <ShieldCheck className="h-4 w-4" />
        Better SME
      </Button>
    </div>
  );
}

function ReportDisclosure({
  title,
  description,
  open,
  onOpenChange,
  children,
  surface = "panel",
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  surface?: "panel" | "plain";
}) {
  const sectionClassName =
    surface === "plain"
      ? "border-y border-white/[0.08] bg-transparent px-0 py-4"
      : "rounded-[30px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 backdrop-blur-2xl sm:px-6";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className={sectionClassName}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-5 text-left"
          >
            <div className="min-w-0">
              <h4 className="text-base font-semibold tracking-[-0.02em] text-white">
                {title}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-transform duration-300",
                open && "rotate-180",
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function SectionHeader({
  title,
  description,
  meta,
  infoKey,
  language,
}: {
  title: string;
  description: string;
  meta?: ReactNode;
  infoKey?: SectionInfoKey;
  language: UiLanguage;
}) {
  return (
    <div className="min-w-0">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </h3>
          {infoKey ? <SectionInfoDialog section={infoKey} title={title} language={language} /> : null}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </div>
  );
}

function SectionInfoDialog({
  section,
  title,
  language,
}: {
  section: SectionInfoKey;
  title: string;
  language: UiLanguage;
}) {
  const info = sectionInfoContent(language, section);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
          aria-label={sectionInfoAria(language)}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-[min(92vw,31rem)] rounded-[30px] border-white/[0.10] bg-[#111417]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
        overlayClassName="bg-black/60 backdrop-blur-md"
      >
        <DialogTitle className="pr-10 text-2xl font-semibold tracking-[-0.04em] text-white">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-slate-400">
          {info.short}
        </DialogDescription>

        <div className="mt-5 space-y-3">
          <InfoPanel label={whatLabel(language)} text={info.what} />
          <InfoPanel label={whyLabel(language)} text={info.why} />
          <InfoPanel label={howLabel(language)} text={info.how} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoPanel({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function sectionInfoContent(language: UiLanguage, section: SectionInfoKey) {
  if (language === "ru") {
    if (section === "prioritySteps") {
      return {
        short: "Это короткий порядок действий: что стоит делать первым, чтобы быстрее снизить риск.",
        what: "Секция собирает LLM-сформулированные remediation steps и показывает их как практический список, а не как длинный технический текст.",
        why: "Она нужна, чтобы пользователь не терялся в score и findings: сначала закрываются действия с самым большим влиянием на ransomware readiness.",
        how: "Используй это как рабочий backlog: назначь владельца, перенеси пункты в action plan, подготовь evidence и обнови отчёт после выполнения.",
        tip: "На защите можно сказать: report не просто оценивает риск, а сразу превращает его в приоритетный план улучшений.",
      };
    }
    if (section === "criticalFindings") {
      return {
        short: "Это главные слабые места, которые сильнее всего ухудшают готовность к ransomware.",
        what: "Здесь показаны наиболее серьёзные findings: проблемная область, уровень риска, бизнес-влияние и рекомендуемая правка.",
        why: "Findings объясняют, почему score получился именно таким. Без них цифра была бы непонятной и мало полезной.",
        how: "Начни с critical/high findings, проверь есть ли evidence, затем свяжи каждую находку с конкретным действием в Tegevusplaan.",
        tip: "Эта секция хорошо отвечает на вопрос комиссии: 'почему система советует именно эти улучшения?'",
      };
    }
    return {
      short: "Это карта готовности по доменам: где защита сильнее, а где есть пробелы.",
      what: "Каждая строка показывает backend score для отдельной области: backup, access, monitoring, incident response и другие домены.",
      why: "Доменная разбивка помогает увидеть не только общий score, но и конкретную область, которая тянет готовность вниз.",
      how: "Смотри сначала на самые низкие score, затем сопоставляй их с findings и priority steps. Так проще выбрать, куда вкладывать время.",
      tip: "Для демонстрации удобно показать: общий риск объясняется не магией LLM, а прозрачными доменными показателями.",
    };
  }

  if (language === "en") {
    if (section === "prioritySteps") {
      return {
        short: "A short action order showing what to do first to reduce risk fastest.",
        what: "This section turns LLM-written remediation advice into a short practical sequence instead of leaving the user with a long technical report.",
        why: "It helps the user move from assessment to execution: the highest-impact actions are made visible immediately.",
        how: "Use it as a working backlog: assign an owner, move items into the action plan, prepare evidence, and refresh the report after changes.",
        tip: "For the defense, explain that the report does not only score risk; it converts risk into a prioritized improvement plan.",
      };
    }
    if (section === "criticalFindings") {
      return {
        short: "The main weaknesses that most affect ransomware readiness.",
        what: "This section shows the most serious findings: affected area, risk level, impact, and suggested fix.",
        why: "Findings explain the score. Without them, the numeric score would be hard to trust or act on.",
        how: "Start with critical and high findings, check whether evidence exists, then connect each finding to a concrete action in the action plan.",
        tip: "This section answers a key review question: why does the system recommend these improvements?",
      };
    }
    return {
      short: "A domain-by-domain readiness map showing strong and weak areas.",
      what: "Each row shows a backend score for one area such as backup, access, monitoring, or incident response.",
      why: "The domain view explains the overall score and reveals which area pulls readiness down.",
      how: "Start with the lowest scores, then compare them with findings and priority steps to decide where to invest time.",
      tip: "In a demo, this shows that risk is not magic from the LLM; it is grounded in transparent domain signals.",
    };
  }

  if (section === "prioritySteps") {
    return {
      short: "Lühike tegevusjärjekord: mida teha esimesena, et riski kõige kiiremini vähendada.",
      what: "See sektsioon muudab LLM-i sõnastatud parandussammud praktiliseks tööjärjekorraks, mitte ainult pikaks tehniliseks raportiks.",
      why: "See aitab liikuda hindamisest tegutsemiseni: kõige suurema mõjuga sammud on kohe nähtavad.",
      how: "Kasuta seda tööjärjekorrana: määra omanik, vii punkt tegevusplaani, kogu tõendid ja värskenda raport pärast parandusi.",
      tip: "Kaitsmisel saad öelda, et raport ei anna ainult skoori, vaid muudab riski prioriseeritud parandusplaaniks.",
    };
  }
  if (section === "criticalFindings") {
    return {
      short: "Peamised nõrgad kohad, mis mõjutavad lunavara valmisolekut kõige rohkem.",
      what: "Siin on kõige olulisemad leiud: mõjutatud valdkond, riskitase, mõju ja soovitatud parandus.",
      why: "Leiud selgitavad skoori. Ilma nendeta oleks number raskesti usaldatav ja keeruline kasutada.",
      how: "Alusta kriitilistest ja kõrge riskiga leidudest, kontrolli tõendeid ja seo iga leid konkreetse tegevusega tegevusplaanis.",
      tip: "See sektsioon vastab hästi küsimusele: miks süsteem soovitab just neid parandusi?",
    };
  }
  return {
    short: "Domeenipõhine valmisoleku kaart: kus kaitse on tugevam ja kus on puudujäägid.",
    what: "Iga rida näitab taustsüsteemi tulemust ühes valdkonnas, näiteks varukoopiad, ligipääs, seire või intsidentidele reageerimine.",
    why: "Domeenivaade selgitab üldtulemust ja näitab, milline valdkond valmisolekut alla tõmbab.",
    how: "Vaata esmalt madalamaid skoore, siis võrdle neid leidude ja prioriteetsete sammudega.",
    tip: "Demol näitab see, et risk ei tule 'LLM-i maagiast', vaid läbipaistvatest valdkonnapõhistest näitajatest.",
  };
}

function sectionInfoAria(language: UiLanguage): string {
  if (language === "en") return "Show section explanation";
  if (language === "ru") return "Показать объяснение секции";
  return "Näita sektsiooni selgitust";
}

function whatLabel(language: UiLanguage): string {
  if (language === "en") return "What it is";
  if (language === "ru") return "Что это";
  return "Mis see on";
}

function whyLabel(language: UiLanguage): string {
  if (language === "en") return "Why it is here";
  if (language === "ru") return "Зачем это здесь";
  return "Miks see siin on";
}

function howLabel(language: UiLanguage): string {
  if (language === "en") return "How to use it";
  if (language === "ru") return "Как использовать";
  return "Kuidas kasutada";
}

function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid gap-4 rounded-[26px] border border-white/[0.08] bg-black/[0.16] px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {item.label}
          </div>
          <div className="mt-2 truncate text-2xl font-semibold tracking-[-0.04em] text-white">
            {item.value}
          </div>
          {item.detail ? (
            <div className="mt-1 truncate text-xs text-slate-500">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ value, tone }: { value: number; tone: Tone }) {
  const safeValue = clamp(value);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className={cn("report-bar-fill h-full rounded-full", toneTrack(tone))}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function ReportLoadingSkeleton() {
  return (
    <div className="report-scene overflow-hidden rounded-[38px] border border-white/[0.08] p-5 sm:p-7">
      <section className="report-panel rounded-[34px] px-6 py-8 sm:px-8">
        <div className="space-y-5">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-12 w-72 rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-[28px]" />
          <Skeleton className="h-24 w-full rounded-[28px]" />
        </div>
      </section>
    </div>
  );
}

export default function ReportView({
  report,
  sessionPath = "questionnaire",
  canGenerate,
  loading,
  onGenerate,
  onLoadDemo,
  onOpenArtifact,
  language = "et",
}: {
  report?: ReportResponse | null;
  sessionPath?: SessionPath;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  onLoadDemo?: DemoProfileLoader;
  onOpenArtifact?: (artifact: ArtifactId) => void;
  language?: UiLanguage;
}) {
  if (loading && !report) {
    return <ReportLoadingSkeleton />;
  }

  if (!report) {
    const recoveryReport = sessionPath === "recovery-proof";
    return (
      <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.055),transparent_32%)]" />
        <section className="report-panel relative flex min-h-[250px] flex-col items-center justify-center rounded-[34px] px-6 py-12 text-center sm:px-8">
          <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
            {recoveryReport ? "No evidence report yet" : t(language, "noReportLoaded")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            {recoveryReport
              ? "Run Recovery Proof or refresh the report after importing recovery evidence."
              : t(language, "noReportDescription")}
          </p>
          <ReportActionButton
            disabled={!canGenerate || loading}
            onClick={onGenerate}
            align="center"
            className="mt-7 rounded-full border-sky-500/20 bg-sky-600 px-6 text-white shadow-[0_16px_40px_rgba(2,132,199,0.22)] hover:bg-sky-500"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t(language, "generateReport")}
          </ReportActionButton>
          <div className="mt-5">
            <ReportDemoProfiles onLoadDemo={onLoadDemo} align="center" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <ReportCockpit
      report={report}
      sessionPath={sessionPath}
      canGenerate={canGenerate}
      loading={loading}
      onGenerate={onGenerate}
      onLoadDemo={onLoadDemo}
      onOpenArtifact={onOpenArtifact}
      language={language}
    />
  );
}

function ReportCockpit({
  report,
  sessionPath,
  canGenerate,
  loading,
  onGenerate,
  onLoadDemo,
  onOpenArtifact,
  language,
}: {
  report: ReportResponse;
  sessionPath: SessionPath;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  onLoadDemo?: DemoProfileLoader;
  onOpenArtifact?: (artifact: ArtifactId) => void;
  language: UiLanguage;
}) {
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const domainEntries: Array<[string, DomainScore]> = useMemo(() => {
    const details = Object.entries(report.domain_details || {});
    if (details.length) {
      return details;
    }
    return Object.entries(report.domain_scores || {}).map(([domain, domainScore]) => [
      domain,
      { title: domain, score: domainScore },
    ]);
  }, [report.domain_details, report.domain_scores]);

  const completionRate = roundNumber(report.completion_rate ?? 0);
  const earlyPreview = isEarlyPreview(completionRate);
  const riskToneValue = riskToneForCompletion(report.risk_level, completionRate);
  const fallbackConfidence = scoreConfidenceLabel(completionRate).replace("Confidence ", "");
  const confidenceValue = report.overall_confidence || fallbackConfidence;
  const recoveryProof = report.recovery_proof;
  const proofGaps = recoveryProof?.proof_gaps || report.proof_gaps || [];
  const remediationTickets =
    recoveryProof?.remediation_tickets || report.remediation_tickets || [];
  const evidenceItemsCount =
    recoveryProof?.evidence_items_count || report.evidence_checklist?.length || 0;
  const isRecoveryReport = sessionPath === "recovery-proof";
  const hasRecoveryProof = isRecoveryReport;
  const recoveryProofScore = roundNumber(
    report.recovery_proof_score ?? recoveryProof?.recovery_proof_score ?? 0,
  );
  const evidenceConfidence = roundNumber(
    report.evidence_confidence ?? recoveryProof?.evidence_confidence ?? 0,
  );
  const sources = normalizeReportSources(report);
  const summaryText = isRecoveryReport
    ? recoveryProof?.client_summary || ""
    : language === "et" && report.summary
      ? report.summary
      : localizedSummary(language, report.overall_score, report.risk_level, completionRate);
  const narrativeText =
    language === "et" && report.llm_report_text ? report.llm_report_text : report.llm_report_text || null;
  const methodology = report.methodology;
  const scoreExplanationDomains = report.score_explanation?.domains || [];

  const sortedDomains = useMemo(
    () => [...domainEntries].sort((a, b) => Number(a[1]?.score ?? 0) - Number(b[1]?.score ?? 0)),
    [domainEntries],
  );

  useEffect(() => {
    setNarrativeOpen(false);
    setScoringOpen(false);
    setSourcesOpen(false);
  }, [report]);

  const criticalFindings: FindingLike[] = report.findings?.length
    ? [...report.findings]
        .map((rawFinding) => {
          const finding = localizedFinding(language, rawFinding);
          return {
            id: finding.id || finding.title || `${finding.domain || "finding"}-${finding.severity || "unknown"}`,
            title: finding.title || domainLabel(language, finding.domain),
            severity: finding.severity,
            domain: finding.domain,
            summary: finding.business_impact || finding.verification || finding.evidence,
            action: finding.recommended_fix,
          };
        })
        .sort(
          (a, b) =>
            (severityRank[String(b.severity || "").toLowerCase()] || 0) -
            (severityRank[String(a.severity || "").toLowerCase()] || 0),
        )
        .slice(0, 4)
    : (report.top_risks || []).slice(0, 4).map((risk, index) => ({
        id: `${risk.domain || risk.title || "risk"}-${index}`,
        title: domainLabel(language, risk.domain || risk.title),
        severity: risk.risk_level,
        domain: risk.domain,
        summary: localizedDomainRisk(language, risk.domain, risk.risk),
        action: risk.recommended_actions?.[0]
          ? localizeKnownText(language, risk.recommended_actions[0])
          : undefined,
      }));

  const prioritySteps: PriorityStep[] =
    report.action_plan?.length
      ? report.action_plan.slice(0, 4).map((item, index) => ({
          id: `${item.title || "action"}-${index}`,
          title: localizeKnownText(language, item.title || report.next_steps?.[index] || "Next step"),
          meta: [
            item.domain ? domainLabel(language, item.domain) : null,
            item.owner ? `${t(language, "owner")}: ${valueLabel(language, item.owner)}` : null,
          ]
            .filter(Boolean)
            .join(" - "),
          tone: riskTone(item.priority),
        }))
      : (report.next_steps || []).slice(0, 4).map((step, index) => ({
          id: `${step}-${index}`,
          title: localizeKnownText(language, step),
          meta: index === 0 ? r(language, "immediatePriority") : r(language, "queuedAction"),
          tone: index === 0 ? riskTone(report.risk_level) : "neutral",
        }));

  const recoveryProofFindings: FindingLike[] = proofGaps.slice(0, 4).map((gap, index) => ({
    id: gap.id || gap.control_id || `proof-gap-${index}`,
    title: gap.control_title || gap.description || "Missing recovery proof",
    severity: gap.severity,
    domain: gap.control_id,
    summary: gap.client_friendly_risk || gap.technical_risk || gap.description,
    action: gap.recommended_action,
  }));

  const recoveryProofSteps: PriorityStep[] = remediationTickets.slice(0, 4).map((ticket, index) => ({
    id: ticket.id || ticket.title || `msp-ticket-${index}`,
    title: ticket.title || "Create remediation ticket",
    meta: [
      ticket.suggested_owner ? `${t(language, "owner")}: ${valueLabel(language, ticket.suggested_owner)}` : null,
      ticket.evidence_needed?.length ? `${ticket.evidence_needed.length} evidence items needed` : null,
    ]
      .filter(Boolean)
      .join(" - "),
    tone: riskTone(ticket.priority),
  }));

  const visibleFindings = isRecoveryReport ? recoveryProofFindings : criticalFindings;
  const visiblePrioritySteps = isRecoveryReport ? recoveryProofSteps : prioritySteps;
  const officialScore = roundNumber(report.overall_score ?? 0);
  const primaryScore = isRecoveryReport ? recoveryProofScore : officialScore;
  const reportTitle = isRecoveryReport ? "Recovery Proof report" : r(language, "title");
  const reportSubtitle = isRecoveryReport
    ? "Proof-based recovery view built from imported evidence, missing assurance, and MSP remediation work."
    : r(language, "subtitle");
  const primaryScoreLabel = isRecoveryReport ? "Recovery proof score" : r(language, "officialScore");
  const officialRisk = earlyPreview
    ? `${valueLabel(language, "preliminary")} (${riskLabel(language, report.risk_level)})`
    : riskLabel(language, report.risk_level);
  const topFinding = visibleFindings[0];
  const topPriorityStep = visiblePrioritySteps[0];
  const metricItems: MetricItem[] = isRecoveryReport
    ? [
        {
          label: "Recovery Proof Score",
          value: `${recoveryProofScore}/100`,
          detail: "Proven recovery capability",
        },
        {
          label: "Evidence Confidence",
          value: `${evidenceConfidence}/100`,
          detail: `${evidenceItemsCount} imported evidence items`,
        },
        {
          label: "Proof Gaps",
          value: String(proofGaps.length),
          detail: "Missing defensible evidence",
        },
        {
          label: "MSP Tickets",
          value: String(remediationTickets.length),
          detail: "Actionable remediation work",
        },
      ]
    : [
        {
          label: r(language, "score"),
          value: `${officialScore}/100`,
          detail: r(language, "backendOwned"),
        },
        {
          label: r(language, "risk"),
          value: officialRisk,
          detail: r(language, "backendRisk"),
        },
        {
          label: r(language, "completion"),
          value: `${completionRate}%`,
          detail: `${r(language, "answered")} ${report.answered_questions ?? 0}/${report.total_questions ?? 0}`,
        },
        {
          label: r(language, "confidence"),
          value: valueLabel(language, confidenceValue),
          detail: r(language, "separateSignal"),
        },
      ];

  return (
    <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.055),transparent_32%)]" />

      <div className="relative space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ReportActionButton
              disabled={loading}
              align="left"
              tooltipPlacement="bottom"
              onClick={() => void generateReadinessReportPdf(report, language)}
              className="rounded-full border-white/10 bg-white/[0.06] px-5 text-slate-100 shadow-none hover:bg-white/[0.1]"
            >
              <Download className="h-4 w-4" />
              {r(language, "downloadPdf")}
            </ReportActionButton>
            <ReportDemoProfiles onLoadDemo={onLoadDemo} />
          </div>
          <ReportActionButton
            disabled={!canGenerate || loading}
            onClick={onGenerate}
            align="right"
            className="rounded-full border-white/10 bg-white/[0.06] px-5 text-slate-100 shadow-none hover:bg-white/[0.1]"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t(language, "refreshReport")}
          </ReportActionButton>
        </div>

        <section className="report-hero px-2 pb-7 pt-4 sm:px-3 sm:pt-5 lg:px-4 lg:pb-9 lg:pt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                  {reportTitle}
                </h2>
                <ArtifactTitleInfo kind="report" language={language} />
              </div>
              {!hasRecoveryProof ? (
              <div className="mt-3">
                <IncompleteReportBadge report={report} language={language} />
              </div>
              ) : null}
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                {summaryText || reportSubtitle}
              </p>
            </div>

            <div className="rounded-[30px] border border-white/[0.08] bg-black/[0.18] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {primaryScoreLabel}
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl font-semibold leading-none tracking-[-0.07em] text-white">
                  {primaryScore}
                </span>
                <span className="pb-2 text-base font-medium text-slate-500">/100</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={cn("report-bar-fill h-full rounded-full bg-gradient-to-r", toneAccent(riskToneValue))}
                  style={{ width: `${clamp(primaryScore)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-7">
            <MetricStrip items={metricItems} />
          </div>

          {topFinding || topPriorityStep ? (
            <div className="mt-7 grid gap-4 border-t border-white/[0.06] pt-6 lg:grid-cols-2">
              {topFinding ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {r(language, "topRisk")}
                  </div>
                  <p className="mt-1 text-base font-semibold leading-7 text-white">{topFinding.title}</p>
                  {topFinding.domain ? (
                    <p className="mt-1 text-sm text-slate-500">{domainLabel(language, topFinding.domain)}</p>
                  ) : null}
                </div>
              ) : null}

              {topPriorityStep ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {r(language, "priorityAction")}
                  </div>
                  <p className="mt-1 text-base font-semibold leading-7 text-white">{topPriorityStep.title}</p>
                  {topPriorityStep.meta ? (
                    <p className="mt-1 text-sm text-slate-500">{topPriorityStep.meta}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <SectionHeader
            title={hasRecoveryProof ? "MSP next steps" : r(language, "prioritySteps")}
            description={
              hasRecoveryProof
                ? "Remediation work generated from missing recovery proof."
                : r(language, "priorityStepsDescription")
            }
            infoKey="prioritySteps"
            language={language}
          />

          <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
            {visiblePrioritySteps.length ? (
              visiblePrioritySteps.map((step, index) => (
                <article key={step.id} className="flex gap-4 px-4 py-4 sm:px-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold leading-7 tracking-[-0.02em] text-white">
                        {step.title}
                      </h4>
                      <Badge variant={badgeVariantForTone(step.tone)}>
                        {index === 0 ? r(language, "immediatePriority") : r(language, "queuedAction")}
                      </Badge>
                    </div>
                    {step.meta ? (
                      <p className="mt-1 text-sm leading-6 text-slate-400">{step.meta}</p>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-5 text-sm leading-6 text-slate-500">
                {hasRecoveryProof ? "No MSP tickets have been generated yet." : r(language, "noSteps")}
              </div>
            )}
          </div>
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <SectionHeader
            title={hasRecoveryProof ? "Proof gaps" : r(language, "criticalFindings")}
            description={
              hasRecoveryProof
                ? "Missing evidence that prevents a stronger recovery verdict."
                : r(language, "criticalFindingsDescription")
            }
            infoKey="criticalFindings"
            language={language}
            meta={
              <Badge variant={visibleFindings.length ? badgeVariantForTone(riskToneValue) : "neutral"}>
                {visibleFindings.length || 0} {r(language, "items")}
              </Badge>
            }
          />

          <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
            {visibleFindings.length ? (
              visibleFindings.map((finding) => (
                <article key={finding.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForTone(riskTone(finding.severity))}>
                      {riskLabel(language, finding.severity || "High")}
                    </Badge>
                    {finding.domain ? (
                      <Badge variant="neutral">{domainLabel(language, finding.domain)}</Badge>
                    ) : null}
                  </div>
                  <h4 className="mt-3 text-lg font-semibold leading-7 tracking-[-0.03em] text-white">
                    {finding.title}
                  </h4>
                  {finding.summary ? (
                    <p className="mt-2 text-sm leading-6 text-slate-400">{finding.summary}</p>
                  ) : null}
                  {finding.action ? (
                    <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-300">
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                      <span>{finding.action}</span>
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="px-5 py-5 text-sm leading-6 text-slate-500">
                {hasRecoveryProof ? "No proof gaps found in the current evidence." : r(language, "noFindings")}
              </div>
            )}
          </div>
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <SectionHeader
            title={hasRecoveryProof ? "Legacy readiness domains" : r(language, "domainRiskMap")}
            description={
              hasRecoveryProof
                ? "Questionnaire domain scores kept only as supporting traceability."
                : r(language, "domainRiskDescription")
            }
            infoKey="domainRiskMap"
            language={language}
            meta={
              <Badge variant="neutral">
                {domainEntries.length} {r(language, "domains")}
              </Badge>
            }
          />

          <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
            {sortedDomains.map(([domain, detail]) => {
              const score = clamp(roundNumber(Number(detail?.score ?? 0)));
              const domainTone = riskToneForCompletion(detail?.risk_level, completionRate);
              return (
                <article key={domain} className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(220px,0.75fr)_1fr_88px] lg:items-center">
                  <div className="min-w-0">
                    <h4 className="truncate text-base font-semibold tracking-[-0.02em] text-white">
                      {domainLabel(language, domain)}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      {detail?.risk_level ? riskLabel(language, detail.risk_level) : r(language, "noRiskLabel")}
                    </p>
                  </div>
                  <div>
                    <ScoreBar value={score} tone={domainTone} />
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {detail?.answered_questions !== undefined && detail?.total_questions !== undefined ? (
                        <span>
                          {r(language, "coverage")} {detail.answered_questions}/{detail.total_questions}
                        </span>
                      ) : null}
                      {detail?.critical_negative_answers?.length ? (
                        <span>{detail.critical_negative_answers.length} {r(language, "criticalNegatives")}</span>
                      ) : null}
                      {report.domain_confidence?.[domain] ? (
                        <span>{valueLabel(language, report.domain_confidence[domain])}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="text-2xl font-semibold tracking-[-0.05em] text-white">{score}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">/100</div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="space-y-3">
          <ReportDisclosure
            title={hasRecoveryProof ? "Legacy scoring details" : r(language, "howScoringWorks")}
            description={
              scoringOpen
                ? r(language, "expanded")
                : hasRecoveryProof
                  ? "Questionnaire scoring is kept for traceability and does not drive the evidence report."
                  : r(language, "howScoringWorksDescription")
            }
            open={scoringOpen}
            onOpenChange={setScoringOpen}
            surface="plain"
          >
            <div className="space-y-6 text-sm leading-7 text-slate-400">
              <div className="grid gap-5 border-b border-white/[0.08] pb-5 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{r(language, "method")}</div>
                  <div className="mt-2 text-[15px] font-semibold leading-6 text-white">
                    {methodology?.methodology_name || "Ransomware Readiness Assessment"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    v{methodology?.methodology_version || report.score_explanation?.methodology_version || "n/a"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{r(language, "questions")}</div>
                  <div className="mt-2 text-[15px] font-semibold leading-6 text-white">
                    {methodology?.questions_version || r(language, "versioned")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{r(language, "scoring")}</div>
                  <div className="mt-2 text-[15px] font-semibold leading-6 text-white">
                    {methodology?.scoring_version || report.score_status || r(language, "deterministic")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{r(language, "scale")}</div>
                  <div className="mt-2 text-[15px] font-semibold leading-6 text-white">
                    {methodology?.score_scale?.min ?? 0}-{methodology?.score_scale?.max ?? 100}
                  </div>
                </div>
              </div>

              {scoreExplanationDomains.length ? (
                <div className="divide-y divide-white/[0.07]">
                  {scoreExplanationDomains.slice(0, 3).map((domain) => {
                    const highlighted = [...(domain.questions || [])]
                      .sort((a, b) => (b.points_lost || 0) - (a.points_lost || 0))
                      .slice(0, 2);
                    return (
                      <div key={domain.domain} className="py-5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[15px] font-semibold text-white">
                            {domainLabel(language, domain.domain)}
                          </div>
                          <Badge variant="neutral">
                            {domain.earned_points}/{domain.max_points} {r(language, "pointsShort")}
                          </Badge>
                        </div>
                        <div className="mt-4 space-y-4 border-l border-white/[0.08] pl-4">
                          {highlighted.map((item) => (
                            <div key={item.question_id} className="grid gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr_auto] sm:items-start">
                              <div className="text-xs text-slate-500">
                                <span>{item.question_id}</span>
                              </div>
                              {item.rationale ? (
                                <p className="text-sm leading-6 text-slate-300">{item.rationale}</p>
                              ) : (
                                <span className="text-sm text-slate-500">-</span>
                              )}
                              <div className="text-xs text-slate-500 sm:text-right">
                                <span>
                                  {item.points_awarded}/{item.max_points} {r(language, "pointsShort")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {methodology?.important_note ? (
                <div className="border-l border-sky-300/30 pl-4 text-slate-400">
                  {methodology.important_note}
                </div>
              ) : null}
            </div>
          </ReportDisclosure>

          {narrativeText || report.external_exposure_self_check?.items?.length ? (
            <ReportDisclosure
              title={r(language, "detailedNarrative")}
            description={narrativeOpen ? r(language, "expanded") : r(language, "collapsed")}
            open={narrativeOpen}
            onOpenChange={setNarrativeOpen}
            surface="plain"
          >
              <div className="space-y-5 text-sm leading-7 text-slate-400">
                <p className="max-w-3xl">{summaryText}</p>
                {narrativeText ? (
                  <div className="rounded-[24px] border border-white/[0.07] bg-black/[0.14] px-5 py-4 text-slate-300">
                    {narrativeText}
                  </div>
                ) : null}
                {report.external_exposure_self_check?.items?.length ? (
                  <div className="rounded-[24px] border border-white/[0.07] bg-black/[0.14] px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                        {t(language, "externalExposure")}
                      </h5>
                      <Badge variant="neutral">{t(language, "advisoryOnly")}</Badge>
                      <Badge variant="success">{t(language, "noScanning")}</Badge>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {report.external_exposure_self_check.items.slice(0, 6).map((item) => (
                        <li
                          key={item.id}
                          className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-slate-400"
                        >
                          {localizedExposureQuestion(language, item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </ReportDisclosure>
          ) : null}

          {sources.length ? (
            <ReportDisclosure
              title={r(language, "sourcesUsed")}
            description={sourcesOpen ? r(language, "expanded") : r(language, "collapsed")}
            open={sourcesOpen}
            onOpenChange={setSourcesOpen}
            surface="plain"
          >
              <div className="divide-y divide-white/[0.06] rounded-[24px] border border-white/[0.07] bg-black/[0.14]">
                {sources.map((source) => (
                  <article
                    key={`${source.name}-${source.url || ""}`}
                    className="px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{r(language, "reference")}</Badge>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky-200 transition-colors hover:text-white"
                        >
                          {r(language, "openSource")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                    <h5 className="mt-3 text-[15px] font-semibold text-white">{source.name}</h5>
                    {source.usedFor ? (
                      <p className="mt-2 text-sm leading-6 text-slate-400">{source.usedFor}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </ReportDisclosure>
          ) : null}

          {onOpenArtifact ? (
            <SupportingViews language={language} onOpenArtifact={onOpenArtifact} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SupportingViews({
  language,
  onOpenArtifact,
}: {
  language: UiLanguage;
  onOpenArtifact: (artifact: ArtifactId) => void;
}) {
  const copy = supportingViewsCopy(language);
  const views: Array<{
    artifact: ArtifactId;
    title: string;
    description: string;
    icon: ReactNode;
  }> = [
    {
      artifact: "evidence-binder",
      title: t(language, "evidenceBinder"),
      description: copy.evidence,
      icon: <FileSearch className="h-4 w-4" />,
    },
    {
      artifact: "skills",
      title: t(language, "skills"),
      description: copy.skills,
      icon: <BookOpenCheck className="h-4 w-4" />,
    },
    {
      artifact: "technical-json",
      title: t(language, "technical"),
      description: copy.technical,
      icon: <Settings2 className="h-4 w-4" />,
    },
  ];

  return (
    <section className="border-t border-white/[0.08] pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.02em] text-white">
            {copy.title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            {copy.description}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {views.map((view) => (
          <button
            key={view.artifact}
            type="button"
            onClick={() => onOpenArtifact(view.artifact)}
            className="group rounded-[24px] border border-white/[0.07] bg-white/[0.025] px-4 py-4 text-left transition-colors hover:border-cyan-300/25 hover:bg-white/[0.045]"
          >
            <div className="flex items-center gap-2 text-cyan-200">
              {view.icon}
              <span className="text-sm font-semibold text-white">{view.title}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{view.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function supportingViewsCopy(language: UiLanguage) {
  if (language === "en") {
    return {
      title: "Supporting views",
      description: "Less important report tools are kept here so the main workflow stays focused.",
      evidence: "Checklist and source trace for audit-ready evidence.",
      skills: "Defensive playbooks and matched guidance behind the action plan.",
      technical: "Raw session state, backend trace, and integration debug data.",
    };
  }
  if (language === "ru") {
    return {
      title: "Дополнительные виды",
      description: "Вспомогательные разделы спрятаны здесь, чтобы основной поток не был перегружен.",
      evidence: "Checklist и trace доказательств для аудита.",
      skills: "Защитные playbooks и guidance за action plan.",
      technical: "Сырой session state, backend trace и debug для интеграций.",
    };
  }
  return {
    title: "Lisavaated",
    description: "Vähem olulised raportitööriistad on siin, et põhitöövoog jääks selgeks.",
    evidence: "Auditivalmiduse tõendite checklist ja allikajälg.",
    skills: "Kaitsejuhendid ja tegevusplaani taustal olev guidance.",
    technical: "Toores sessiooni olek, backend trace ja integratsiooni debug.",
  };
}
