import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { DomainScore, ReportResponse, RiskLevel } from "../types/api";
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
import { EmptyState } from "./ui";
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

type SectionInfoKey = "prioritySteps" | "criticalFindings" | "domainRiskMap";

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const simulatorBump = 24;

const reportCopy = {
  et: {
    introLabel: "Valmisoleku raport",
    title: "Raport",
    subtitle: "Selge ülevaade sinu valmisolekust, prioriteetidest ja tõenditest.",
    score: "Skoor",
    risk: "Risk",
    completion: "Täidetud",
    confidence: "Usaldus",
    backendOwned: "Backendi arvutus",
    backendRisk: "Backendi riskitase",
    answered: "Vastatud",
    separateSignal: "Eraldi signaal",
    officialScore: "Ametlik skoor",
    topRisk: "Peamine risk",
    priorityAction: "Prioriteetne tegevus",
    criticalFindings: "Kriitilised leiud",
    criticalFindingsDescription: "Olulised riskid, mis vajavad enne järgmist sammu tähelepanu.",
    prioritySteps: "Prioriteetsed sammud",
    priorityStepsDescription: "Kõige mõistlikum tegevusjärjekord raporti põhjal.",
    items: "kirjet",
    noFindings: "Kompaktseid leide pole veel. Värskenda backendi raportit.",
    noSteps: "Prioriseeritud samme pole veel.",
    domainRiskMap: "Domeenide valmisolek",
    domainRiskDescription: "Backendi domeeniskoorid madalamast kõrgemani.",
    domains: "domeeni",
    noRiskLabel: "Riskimärgis puudub",
    coverage: "Kaetus",
    criticalNegatives: "kriitilist negatiivset",
    whatIf: "Mis-kui simulaator",
    whatIfDescription: "Kohalik stsenaariumitööriist. Ametlik skoor jääb backendile.",
    unofficialPreview: "Mitteametlik eelvaade",
    reset: "Lähtesta",
    base: "Algne",
    simulated: "Simuleeritud",
    simulatorUnavailable: "Simulaator ilmub siis, kui backendi raportis on domeeniskoorid.",
    advisoryPreview: "Nõuandev eelvaade",
    simulatedScore: "simuleeritud skoor",
    vsOfficial: "vs ametlik",
    simulationNote: "Simulation only - official score remains backend-owned.",
    detailedNarrative: "Detailne narratiiv",
    howScoringWorks: "Kuidas skoor töötab",
    howScoringWorksDescription: "Versioneeritud küsimused, backendi reeglid ja skoori põhjendus.",
    expanded: "Avatud",
    collapsed: "Vaikimisi suletud",
    sourcesUsed: "Kasutatud allikad",
    reference: "Viide",
    openSource: "Ava allikas",
    immediatePriority: "Kohe prioriteet",
    queuedAction: "Järjekorras tegevus",
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
    priorityStepsDescription: "The most useful action order based on the report.",
    items: "items",
    noFindings: "No compact findings available yet. Refresh the backend report.",
    noSteps: "No prioritized next steps available yet.",
    domainRiskMap: "Domain readiness",
    domainRiskDescription: "Backend domain scores, ordered from lowest to highest.",
    domains: "domains",
    noRiskLabel: "No risk label",
    coverage: "Coverage",
    criticalNegatives: "critical negatives",
    whatIf: "What-if simulator",
    whatIfDescription: "Local scenario tool. The official score remains backend-owned.",
    unofficialPreview: "Unofficial preview",
    reset: "Reset",
    base: "Base",
    simulated: "Simulated",
    simulatorUnavailable: "Simulator becomes available once domain scores exist in the backend report.",
    advisoryPreview: "Advisory preview",
    simulatedScore: "simulated score",
    vsOfficial: "vs official",
    simulationNote: "Simulation only - official score remains backend-owned.",
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
    priorityStepsDescription: "Самый полезный порядок действий по результатам отчёта.",
    items: "шт.",
    noFindings: "Компактных findings пока нет. Обнови backend отчёт.",
    noSteps: "Приоритетных шагов пока нет.",
    domainRiskMap: "Готовность по доменам",
    domainRiskDescription: "Backend score доменов от самого низкого к самому высокому.",
    domains: "доменов",
    noRiskLabel: "Нет метки риска",
    coverage: "Покрытие",
    criticalNegatives: "критических negative",
    whatIf: "Симулятор what-if",
    whatIfDescription: "Локальный сценарий. Официальный score остаётся в backend.",
    unofficialPreview: "Неофициальный preview",
    reset: "Сброс",
    base: "База",
    simulated: "Симуляция",
    simulatorUnavailable: "Симулятор появится, когда в backend отчёте есть доменные score.",
    advisoryPreview: "Сценарный preview",
    simulatedScore: "симулируемый score",
    vsOfficial: "к офиц.",
    simulationNote: "Simulation only - official score remains backend-owned.",
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

function advisoryRiskLevel(score: number): RiskLevel {
  if (score >= 85) return "Low";
  if (score >= 65) return "Medium";
  if (score >= 40) return "High";
  return "Critical";
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

function ReportDisclosure({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className="rounded-[30px] border border-white/[0.08] bg-white/[0.025] px-5 py-4 backdrop-blur-2xl sm:px-6">
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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </h3>
          {infoKey ? <SectionInfoDialog section={infoKey} title={title} language={language} /> : null}
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {meta}
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
        what: "Секция собирает самые важные next steps из backend-отчёта и показывает их как практический список, а не как длинный технический текст.",
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
        what: "This section turns backend recommendations into a practical sequence instead of leaving the user with a long technical report.",
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
      what: "See sektsioon muudab backendi soovitused praktiliseks tööjärjekorraks, mitte ainult pikaks tehniliseks raportiks.",
      why: "See aitab liikuda hindamisest tegutsemiseni: kõige suurema mõjuga sammud on kohe nähtavad.",
      how: "Kasuta seda backlog'ina: määra omanik, vii punkt tegevusplaani, kogu tõendid ja värskenda raport pärast parandusi.",
      tip: "Kaitsmisel saad öelda, et raport ei anna ainult skoori, vaid muudab riski prioriseeritud parandusplaaniks.",
    };
  }
  if (section === "criticalFindings") {
    return {
      short: "Peamised nõrgad kohad, mis mõjutavad lunavara valmisolekut kõige rohkem.",
      what: "Siin on kõige olulisemad leiud: mõjutatud valdkond, riskitase, mõju ja soovitatud parandus.",
      why: "Leiud selgitavad skoori. Ilma nendeta oleks number raskesti usaldatav ja keeruline kasutada.",
      how: "Alusta critical/high leidudest, kontrolli tõendeid ja seo iga leid konkreetse tegevusega tegevusplaanis.",
      tip: "See sektsioon vastab hästi küsimusele: miks süsteem soovitab just neid parandusi?",
    };
  }
  return {
    short: "Domeenipõhine valmisoleku kaart: kus kaitse on tugevam ja kus on puudujäägid.",
    what: "Iga rida näitab backendi skoori ühes valdkonnas, näiteks backup, ligipääs, monitooring või incident response.",
    why: "Domeenivaade selgitab üldskoori ja näitab, milline valdkond valmisolekut alla tõmbab.",
    how: "Vaata esmalt madalamaid skoore, siis võrdle neid leidude ja prioriteetsete sammudega.",
    tip: "Demos näitab see, et risk ei tule 'LLM-i maagiast', vaid läbipaistvatest domeenisignaalidest.",
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
  canGenerate,
  loading,
  onGenerate,
  language = "et",
}: {
  report?: ReportResponse | null;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  language?: UiLanguage;
}) {
  if (loading && !report) {
    return <ReportLoadingSkeleton />;
  }

  if (!report) {
    return (
      <EmptyState
        title={t(language, "noReportLoaded")}
        description={t(language, "noReportDescription")}
        icon={<FileText className="h-5 w-5" />}
        action={
          <Button
            type="button"
            variant="primary"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
          >
            <RefreshCw className="h-4 w-4" />
            {t(language, "generateReport")}
          </Button>
        }
      />
    );
  }

  return (
    <ReportCockpit
      report={report}
      canGenerate={canGenerate}
      loading={loading}
      onGenerate={onGenerate}
      language={language}
    />
  );
}

function ReportCockpit({
  report,
  canGenerate,
  loading,
  onGenerate,
  language,
}: {
  report: ReportResponse;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  language: UiLanguage;
}) {
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [simulatorAdjustments, setSimulatorAdjustments] = useState<Record<string, number>>({});

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
  const sources = normalizeReportSources(report);
  const summaryText =
    language === "et" && report.summary
      ? report.summary
      : localizedSummary(language, report.overall_score, report.risk_level, completionRate);
  const narrativeText =
    language === "et" && report.llm_report_text ? report.llm_report_text : report.llm_report_text || null;
  const methodology = report.methodology;
  const scoringPrinciples = methodology?.scoring_principles?.length
    ? methodology.scoring_principles
    : [
        "Questions are versioned.",
        "Answers are saved as Yes / Partial / No / Unsure.",
        "Backend maps saved answers to predefined scoring rules.",
        "AI can explain questions, but it does not invent points.",
        "Each scored item has rationale and source mappings.",
        "Evidence increases confidence and supports validation.",
        "This is a readiness self-assessment, not a full audit.",
      ];
  const scoreExplanationDomains = report.score_explanation?.domains || [];

  const sortedDomains = useMemo(
    () => [...domainEntries].sort((a, b) => Number(a[1]?.score ?? 0) - Number(b[1]?.score ?? 0)),
    [domainEntries],
  );
  const simulatorDomains = useMemo(
    () => sortedDomains.slice(0, Math.min(4, sortedDomains.length)),
    [sortedDomains],
  );

  useEffect(() => {
    setSimulatorAdjustments(Object.fromEntries(simulatorDomains.map(([domain]) => [domain, 0])));
    setNarrativeOpen(false);
    setScoringOpen(false);
    setSourcesOpen(false);
    setScenarioOpen(false);
  }, [report, simulatorDomains]);

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
          title: item.title || localizeKnownText(language, report.next_steps?.[index] || "Next step"),
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

  const officialScore = roundNumber(report.overall_score ?? 0);
  const officialRisk = earlyPreview
    ? `${valueLabel(language, "preliminary")} (${riskLabel(language, report.risk_level)})`
    : riskLabel(language, report.risk_level);
  const simulatedDomainScores = domainEntries.map(([domain, detail]) => {
    const baseScore = roundNumber(Number(detail?.score ?? 0));
    return {
      domain,
      score: clamp(baseScore + (simulatorAdjustments[domain] || 0)),
    };
  });
  const simulatedScore = simulatedDomainScores.length
    ? roundNumber(
        simulatedDomainScores.reduce((total, item) => total + item.score, 0) /
          simulatedDomainScores.length,
      )
    : officialScore;
  const simulatedRisk = advisoryRiskLevel(simulatedScore);
  const simulatorDelta = simulatedScore - officialScore;
  const topFinding = criticalFindings[0];
  const topPriorityStep = prioritySteps[0];
  const metricItems: MetricItem[] = [
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
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
            className="rounded-full border-white/10 bg-white/[0.06] px-5 text-slate-100 shadow-none hover:bg-white/[0.1]"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t(language, "refreshReport")}
          </Button>
        </div>

        <section className="report-panel rounded-[34px] px-6 pb-7 pt-4 sm:px-8 sm:pt-5 lg:px-10 lg:pb-9 lg:pt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="max-w-3xl">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {r(language, "title")}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                {summaryText || r(language, "subtitle")}
              </p>
            </div>

            <div className="rounded-[30px] border border-white/[0.08] bg-black/[0.18] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {r(language, "officialScore")}
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl font-semibold leading-none tracking-[-0.07em] text-white">
                  {officialScore}
                </span>
                <span className="pb-2 text-base font-medium text-slate-500">/100</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={cn("report-bar-fill h-full rounded-full bg-gradient-to-r", toneAccent(riskToneValue))}
                  style={{ width: `${clamp(officialScore)}%` }}
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
            title={r(language, "prioritySteps")}
            description={r(language, "priorityStepsDescription")}
            infoKey="prioritySteps"
            language={language}
          />

          <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
            {prioritySteps.length ? (
              prioritySteps.map((step, index) => (
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
                {r(language, "noSteps")}
              </div>
            )}
          </div>
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <SectionHeader
            title={r(language, "criticalFindings")}
            description={r(language, "criticalFindingsDescription")}
            infoKey="criticalFindings"
            language={language}
            meta={
              <Badge variant={criticalFindings.length ? badgeVariantForTone(riskToneValue) : "neutral"}>
                {criticalFindings.length || 0} {r(language, "items")}
              </Badge>
            }
          />

          <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
            {criticalFindings.length ? (
              criticalFindings.map((finding) => (
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
                {r(language, "noFindings")}
              </div>
            )}
          </div>
        </section>

        <section className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
          <SectionHeader
            title={r(language, "domainRiskMap")}
            description={r(language, "domainRiskDescription")}
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
            title={r(language, "howScoringWorks")}
            description={scoringOpen ? r(language, "expanded") : r(language, "howScoringWorksDescription")}
            open={scoringOpen}
            onOpenChange={setScoringOpen}
          >
            <div className="space-y-5 text-sm leading-7 text-slate-400">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Method</div>
                  <div className="mt-2 text-[15px] font-semibold text-white">
                    {methodology?.methodology_name || "Ransomware Readiness Assessment"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    v{methodology?.methodology_version || report.score_explanation?.methodology_version || "n/a"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Questions</div>
                  <div className="mt-2 text-[15px] font-semibold text-white">
                    {methodology?.questions_version || "Versioned"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Scoring</div>
                  <div className="mt-2 text-[15px] font-semibold text-white">
                    {methodology?.scoring_version || report.score_status || "Deterministic"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Scale</div>
                  <div className="mt-2 text-[15px] font-semibold text-white">
                    {methodology?.score_scale?.min ?? 0}-{methodology?.score_scale?.max ?? 100}
                  </div>
                </div>
              </div>

              <ul className="space-y-2">
                {scoringPrinciples.map((item) => (
                  <li key={item} className="rounded-[18px] border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-slate-300">
                    {item}
                  </li>
                ))}
              </ul>

              {scoreExplanationDomains.length ? (
                <div className="space-y-3">
                  {scoreExplanationDomains.slice(0, 3).map((domain) => {
                    const highlighted = [...(domain.questions || [])]
                      .sort((a, b) => (b.points_lost || 0) - (a.points_lost || 0))
                      .slice(0, 2);
                    return (
                      <div key={domain.domain} className="rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[15px] font-semibold text-white">
                            {domainLabel(language, domain.domain)}
                          </div>
                          <Badge variant="neutral">
                            {domain.earned_points}/{domain.max_points} pts
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {highlighted.map((item) => (
                            <div key={item.question_id} className="rounded-[18px] border border-white/[0.07] bg-black/20 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                <span>{item.question_id}</span>
                                <span>
                                  {item.points_awarded}/{item.max_points} pts
                                </span>
                              </div>
                              {item.rationale ? (
                                <p className="mt-2 text-sm leading-6 text-slate-300">{item.rationale}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {methodology?.important_note ? (
                <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-slate-400">
                  {methodology.important_note}
                </div>
              ) : null}
            </div>
          </ReportDisclosure>

          <ReportDisclosure
            title={r(language, "whatIf")}
            description={scenarioOpen ? r(language, "expanded") : r(language, "whatIfDescription")}
            open={scenarioOpen}
            onOpenChange={setScenarioOpen}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-2.5">
                {simulatorDomains.length ? (
                  simulatorDomains.map(([domain, detail]) => {
                    const baseScore = clamp(roundNumber(Number(detail?.score ?? 0)));
                    const simulatedValue = clamp(baseScore + (simulatorAdjustments[domain] || 0));
                    return (
                      <div key={domain} className="rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-semibold tracking-normal text-white">
                              {domainLabel(language, domain)}
                            </div>
                            <div className="mt-1 text-[13px] text-slate-500">
                              {r(language, "base")} {baseScore} {"->"} {r(language, "simulated")} {simulatedValue}
                            </div>
                          </div>
                          <Badge variant={badgeVariantForTone(riskTone(advisoryRiskLevel(simulatedValue)))}>
                            +{simulatorAdjustments[domain] || 0}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <ScoreBar value={simulatedValue} tone={riskTone(advisoryRiskLevel(simulatedValue))} />
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={simulatorBump}
                          step={2}
                          value={simulatorAdjustments[domain] || 0}
                          onChange={(event) =>
                            setSimulatorAdjustments((current) => ({
                              ...current,
                              [domain]: Number(event.target.value),
                            }))
                          }
                          className="mt-3 w-full accent-sky-300"
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                    {r(language, "simulatorUnavailable")}
                  </div>
                )}
              </div>

              <div className="rounded-[26px] border border-white/[0.08] bg-black/[0.16] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-slate-500">
                    {r(language, "advisoryPreview")}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setSimulatorAdjustments((current) =>
                        Object.fromEntries(Object.keys(current).map((domain) => [domain, 0])),
                      )
                    }
                    className="h-8 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-slate-200 hover:bg-white/[0.08]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {r(language, "reset")}
                  </Button>
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <div className="text-5xl font-semibold tracking-[-0.06em] text-white">{simulatedScore}</div>
                  <div className="pb-1 text-sm text-slate-500">{r(language, "simulatedScore")}</div>
                </div>
                <div className="mt-4">
                  <ScoreBar value={simulatedScore} tone={riskTone(simulatedRisk)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={badgeVariantForTone(riskTone(simulatedRisk))}>
                    {riskLabel(language, simulatedRisk)}
                  </Badge>
                  <Badge variant={simulatorDelta > 0 ? "success" : "neutral"}>
                    {simulatorDelta >= 0 ? "+" : ""}
                    {simulatorDelta} {r(language, "vsOfficial")}
                  </Badge>
                  <Badge variant="warning">{r(language, "unofficialPreview")}</Badge>
                </div>
                <p className="mt-4 text-[14px] leading-6 text-slate-500">
                  {r(language, "simulationNote")} {officialScore}/100.
                </p>
              </div>
            </div>
          </ReportDisclosure>

          {narrativeText || report.external_exposure_self_check?.items?.length ? (
            <ReportDisclosure
              title={r(language, "detailedNarrative")}
              description={narrativeOpen ? r(language, "expanded") : r(language, "collapsed")}
              open={narrativeOpen}
              onOpenChange={setNarrativeOpen}
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
        </div>
      </div>
    </div>
  );
}
