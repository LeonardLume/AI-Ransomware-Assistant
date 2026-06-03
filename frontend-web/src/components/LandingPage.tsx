import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CircleUser,
  Database,
  FileText,
  Gauge,
  History,
  Menu,
  Plug,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ProfileSetupValues } from "./ProfileSetupPage";

const LandingLogo3D = lazy(() => import("./LandingLogo3D"));

const diagonalPattern =
  "repeating-linear-gradient(-45deg, rgba(88, 88, 94, 0.42) 0px, rgba(88, 88, 94, 0.42) 1px, transparent 1px, transparent 7px)";

const featureCards = [
  {
    title: "Natural interview",
    desc: "Users can answer directly or ask what a question means. The assistant keeps the conversation moving without turning it into a form.",
    graphic: "flow",
  },
  {
    title: "Backend score",
    desc: "The official score is calculated from saved Yes, Partial, No and Unsure answers using deterministic backend rules.",
    graphic: "bars",
  },
  {
    title: "Action plan",
    desc: "The report turns weak areas into prioritized fixes, evidence requests and management-ready next steps.",
    graphic: "chart",
  },
];

const assessmentRows = [
  { id: "BCK-01", title: "Restore tests verified", tone: "bg-[hsl(var(--triage-warning))]" },
  { id: "IAM-02", title: "MFA covers critical accounts", tone: "bg-[hsl(var(--triage-success))]" },
  { id: "IR-04", title: "Incident response plan exists", tone: "bg-[hsl(var(--triage-destructive))]" },
  { id: "PAT-03", title: "Critical patches are tracked", tone: "bg-[hsl(var(--triage-primary))]" },
  { id: "MON-01", title: "Ransomware logs retained", tone: "bg-[hsl(var(--triage-warning))]" },
  { id: "ADM-02", title: "Privileged accounts reviewed", tone: "bg-[hsl(var(--triage-success))]" },
  { id: "TRN-01", title: "Staff know how to report suspicious mail", tone: "bg-[hsl(var(--triage-primary))]" },
];

type LandingTopNavId = "products" | "solutions" | "developer" | "company" | "pricing" | "news";
type ProductExampleId = "chat" | "proof" | "questionnaire";

type LandingTopNavItem = {
  id: LandingTopNavId;
  label: string;
  dropdown?: boolean;
  active?: boolean;
};

const landingTopNavItems: LandingTopNavItem[] = [
  { id: "products", label: "Products", dropdown: true, active: true },
  { id: "solutions", label: "Solutions", dropdown: true, active: true },
  { id: "developer", label: "Developer", dropdown: true },
  { id: "company", label: "Company", dropdown: true },
  { id: "pricing", label: "Pricing" },
  { id: "news", label: "News" },
];

const productExamples: Array<{
  id: ProductExampleId;
  label: string;
  title: string;
  description: string;
  prompt: string;
  liveText: string;
  metric: string;
  cards: Array<{ title: string; value: string; text: string }>;
}> = [
  {
    id: "chat",
    label: "Chat",
    title: "Evidence assistant",
    description: "Ask about gaps, recovery proof, answers, or report wording.",
    prompt: "Are our backups defensible?",
    liveText:
      "Your backup evidence is partial: coverage is documented, but the latest restore test and immutable repository proof are still missing.",
    metric: "Live reasoning",
    cards: [
      {
        title: "Recovery Proof",
        value: "70/100",
        text: "Backup evidence imported. Proof gaps converted into MSP tickets.",
      },
      {
        title: "Questionnaire",
        value: "33%",
        text: "Backup domain active. Current question and answer trail stay visible.",
      },
    ],
  },
  {
    id: "proof",
    label: "Recovery Proof",
    title: "Recovery verdict",
    description: "Import backup and security evidence, then turn weak proof into tickets.",
    prompt: "Run Recovery Proof",
    liveText:
      "Recovery is partially defensible. Score 70/100. Critical gaps: restore test evidence and backup admin separation.",
    metric: "70/100 proof score",
    cards: [
      {
        title: "Proof gaps",
        value: "6",
        text: "Missing restore test, isolation, admin separation, and evidence freshness.",
      },
      {
        title: "MSP tickets",
        value: "6",
        text: "Prioritized remediation with owner, evidence needed, and client-safe wording.",
      },
    ],
  },
  {
    id: "questionnaire",
    label: "Questionnaire",
    title: "Guided assessment",
    description: "Legacy interview path with domains, current question, and completion progress.",
    prompt: "Continue questionnaire",
    liveText:
      "Backup domain, question 4 of 12: Have restore tests been completed in the last 6 months? Suggested answer: Partial.",
    metric: "33% complete",
    cards: [
      {
        title: "Current domain",
        value: "Backup",
        text: "The interview keeps domain progress and answered controls visible.",
      },
      {
        title: "Current question",
        value: "4/12",
        text: "Answers stay traceable, including Yes, Partial, No, and Unsure.",
      },
    ],
  },
];

const simpleNavOverlays: Record<
  Exclude<LandingTopNavId, "products" | "pricing" | "news">,
  Array<{ label: string; href?: string }>
> = {
  solutions: [
    { label: "For MSP readiness reviews", href: "/solutions/msp-readiness-reviews" },
    { label: "For client recovery proof", href: "/solutions/client-recovery-proof" },
    { label: "For executive reporting", href: "/solutions/executive-reporting" },
  ],
  developer: [
    { label: "API imports" },
    { label: "Evidence adapters" },
    { label: "Ticket export schema" },
  ],
  company: [
    { label: "Methodology" },
    { label: "Security posture" },
    { label: "Contact" },
  ],
};

type LandingMenuId =
  | "profile"
  | "sessions"
  | "evidence"
  | "reports"
  | "integrations"
  | "settings"
  | "help";

type LandingMenuItem = {
  id: LandingMenuId;
  label: string;
  eyebrow: string;
  description: string;
  details: string[];
  icon: LucideIcon;
};

const landingMenuItems: LandingMenuItem[] = [
  {
    id: "profile",
    label: "Profile",
    eyebrow: "Account",
    description: "Manage the organization profile used in reports and client-ready summaries.",
    details: ["Organization name", "Industry and size", "Assessment owner"],
    icon: CircleUser,
  },
  {
    id: "sessions",
    label: "Sessions",
    eyebrow: "History",
    description: "Open questionnaire or recovery-proof sessions without mixing different assessment paths.",
    details: ["Questionnaire sessions", "Recovery Proof sessions", "Recent report drafts"],
    icon: History,
  },
  {
    id: "evidence",
    label: "Evidence",
    eyebrow: "Proof",
    description: "Import backup, M365, Wazuh, Prowler or manual evidence before running Recovery Proof.",
    details: ["Backup reports", "Security tool exports", "Manual JSON, CSV or YAML"],
    icon: Database,
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "Output",
    description: "Review readiness reports, recovery verdicts and action plans prepared for stakeholders.",
    details: ["Executive summary", "Domain scores", "MSP remediation tickets"],
    icon: FileText,
  },
  {
    id: "integrations",
    label: "Integrations",
    eyebrow: "Sources",
    description: "Connect evidence sources and export remediation into the tools the MSP already uses.",
    details: ["M365 / ScubaGear", "Prowler and Wazuh", "Jira-ready ticket export"],
    icon: Plug,
  },
  {
    id: "settings",
    label: "Settings",
    eyebrow: "Preferences",
    description: "Tune language, assessment defaults and report behavior for the workspace.",
    details: ["Language", "Default assessment path", "Report visibility"],
    icon: Settings,
  },
  {
    id: "help",
    label: "Help",
    eyebrow: "Support",
    description: "Find methodology notes and practical guidance for answering assessment questions.",
    details: ["Question explanations", "Scoring methodology", "Evidence examples"],
    icon: CircleHelp,
  },
];

function LandingSideMenu({
  open,
  activeId,
  items,
  profileCreated,
  profile,
  onSelect,
  onClose,
  onCreateProfile,
}: {
  open: boolean;
  activeId: LandingMenuId;
  items: LandingMenuItem[];
  profileCreated: boolean;
  profile?: ProfileSetupValues | null;
  onSelect: (id: LandingMenuId) => void;
  onClose: () => void;
  onCreateProfile: () => void;
}) {
  const activeItem = items.find((item) => item.id === activeId) || items[0];
  const ActiveIcon = activeItem.icon;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80]"
    >
      <button
        type="button"
        aria-label="Close landing menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Landing menu"
        className="absolute left-0 top-0 flex h-full w-[min(92vw,440px)] flex-col border-r border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-background))] shadow-2xl"
      >
        <div className="flex h-14 items-center justify-between border-b border-[hsl(var(--triage-border))] px-5">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--triage-foreground))]">
            <ShieldCheck className="h-4 w-4" />
            Menu
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-[hsl(var(--triage-border))] text-[hsl(var(--triage-muted-foreground))] transition-colors hover:border-[hsl(var(--triage-foreground))]/45 hover:text-[hsl(var(--triage-foreground))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
          <div className="border-b border-[hsl(var(--triage-border))] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
              AI Ransomware Assistant
            </p>
          </div>

          <div className="grid min-h-0 grid-cols-[156px_minmax(0,1fr)]">
            <nav className="overflow-y-auto border-r border-[hsl(var(--triage-border))] p-2">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`flex w-full items-center gap-2 border-l-2 px-3 py-2.5 text-left text-[13px] transition-colors ${
                      active
                        ? "border-[hsl(var(--triage-primary))] bg-[hsl(var(--triage-accent))] text-[hsl(var(--triage-foreground))]"
                        : "border-transparent text-[hsl(var(--triage-muted-foreground))] hover:bg-[hsl(var(--triage-card))] hover:text-[hsl(var(--triage-foreground))]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <section className="min-w-0 overflow-y-auto p-5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                <ActiveIcon className="h-4 w-4" />
                {activeItem.eyebrow}
              </div>
              <h2 className="mt-4 text-[24px] font-[500] leading-tight tracking-[-0.03em] text-[hsl(var(--triage-foreground))]">
                {activeItem.label}
              </h2>
              {activeItem.id === "profile" && !profileCreated ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={onCreateProfile}
                    className="inline-flex h-10 items-center gap-2 bg-[hsl(var(--triage-foreground))] px-4 text-[13px] font-medium text-[hsl(var(--triage-background))] transition-colors hover:bg-[hsl(var(--triage-foreground))]/90"
                  >
                    Create profile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-[13px] leading-6 text-[hsl(var(--triage-muted-foreground))]">
                    {activeItem.id === "profile" && profile
                      ? `${profile.organizationName} profile is ready for assessment sessions.`
                      : activeItem.description}
                  </p>
                  <div className="mt-6 border-y border-[hsl(var(--triage-border))]">
                    {(activeItem.id === "profile" && profile
                      ? [
                          `Industry: ${profile.industry}`,
                          `Size: ${profile.organizationSize}`,
                          `Owner: ${profile.assessmentOwner}`,
                        ]
                      : activeItem.details
                    ).map((detail) => (
                      <div
                        key={detail}
                        className="flex items-center justify-between gap-3 border-b border-[hsl(var(--triage-border))] py-3 last:border-b-0"
                      >
                        <span className="text-[13px] text-[hsl(var(--triage-foreground))]/84">
                          {detail}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--triage-muted-foreground))]" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LandingTopNav() {
  const [openNavId, setOpenNavId] = useState<LandingTopNavId | null>(null);
  const [activeExampleId, setActiveExampleId] = useState<ProductExampleId>("chat");
  const closeTimerRef = useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenNavId(null);
      closeTimerRef.current = null;
    }, 180);
  }

  function toggleDropdown(item: LandingTopNavItem) {
    clearCloseTimer();
    if (!item.dropdown) {
      setOpenNavId(null);
      return;
    }
    setOpenNavId((current) => (current === item.id ? null : item.id));
  }

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <div
      className="relative hidden min-w-0 items-center justify-center gap-7 lg:flex"
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
    >
      {landingTopNavItems.map((item) => {
        const open = openNavId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-expanded={item.dropdown ? open : undefined}
            onMouseEnter={() => {
              clearCloseTimer();
              if (item.dropdown) setOpenNavId(item.id);
            }}
            onFocus={() => {
              clearCloseTimer();
              if (item.dropdown) setOpenNavId(item.id);
            }}
            onClick={() => toggleDropdown(item)}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap text-[14px] font-medium transition-colors hover:text-[hsl(var(--triage-foreground))] ${
              item.active || open
                ? "text-[hsl(var(--triage-foreground))]"
                : "text-[hsl(var(--triage-muted-foreground))]"
            }`}
          >
            {item.label}
            {item.dropdown ? (
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              />
            ) : null}
          </button>
        );
      })}

      {openNavId === "products" ? (
        <ProductsOverlay
          activeExampleId={activeExampleId}
          onExampleChange={setActiveExampleId}
        />
      ) : null}

      {openNavId && openNavId !== "products" && openNavId !== "pricing" && openNavId !== "news" ? (
        <SimpleNavOverlay navId={openNavId} />
      ) : null}
    </div>
  );
}

function ProductsOverlay({
  activeExampleId,
  onExampleChange,
}: {
  activeExampleId: ProductExampleId;
  onExampleChange: (id: ProductExampleId) => void;
}) {
  const activeExample = productExamples.find((example) => example.id === activeExampleId) || productExamples[0];
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    setTypedText("");
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedText(activeExample.liveText.slice(0, index));
      if (index >= activeExample.liveText.length) {
        window.clearInterval(interval);
      }
    }, 24);
    return () => window.clearInterval(interval);
  }, [activeExample]);

  return (
    <div className="absolute left-1/2 top-full z-[70] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 pt-3">
      <div className="grid min-h-[330px] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-lg border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] shadow-2xl">
        <div className="border-r border-[hsl(var(--triage-border))] p-4">
          {productExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              onMouseEnter={() => onExampleChange(example.id)}
              onClick={() => onExampleChange(example.id)}
              className={`block w-full px-3 py-3 text-left transition-colors ${
                activeExampleId === example.id
                  ? "bg-[hsl(var(--triage-accent))] text-[hsl(var(--triage-foreground))]"
                  : "text-[hsl(var(--triage-muted-foreground))] hover:bg-[hsl(var(--triage-background))] hover:text-[hsl(var(--triage-foreground))]"
              }`}
            >
              <span className="block text-[14px] font-semibold">{example.label}</span>
              <span className="mt-1 block text-[12px] leading-4 text-[hsl(var(--triage-muted-foreground))]">
                {example.description}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-0 overflow-hidden bg-[hsl(var(--triage-background))]/55 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                {activeExample.metric}
              </div>
              <h3 className="mt-1 text-[18px] font-semibold text-[hsl(var(--triage-foreground))]">
                {activeExample.title}
              </h3>
            </div>
            <div className="rounded-full border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] px-4 py-2 text-[12px] font-semibold text-[hsl(var(--triage-foreground))]">
              {activeExample.prompt}
            </div>
          </div>

          <div className="space-y-3">
            <div className="max-w-[72%] rounded-2xl rounded-bl-md border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))]/88 px-4 py-3 text-[12px] leading-5 text-[hsl(var(--triage-foreground))]/78">
              {typedText}
              <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-[hsl(var(--triage-foreground))]" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {activeExample.cards.map((card) => (
              <MiniProductExample
                key={`${activeExample.id}-${card.title}`}
                title={card.title}
                value={card.value}
                text={card.text}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniProductExample({ title, value, text }: { title: string; value: string; text: string }) {
  return (
    <div className="border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-[hsl(var(--triage-foreground))]">{title}</span>
        <span className="text-[12px] text-[hsl(var(--triage-muted-foreground))]">{value}</span>
      </div>
      <p className="mt-2 text-[12px] leading-4 text-[hsl(var(--triage-muted-foreground))]">{text}</p>
    </div>
  );
}

function SimpleNavOverlay({ navId }: { navId: Exclude<LandingTopNavId, "products" | "pricing" | "news"> }) {
  return (
    <div className="absolute left-1/2 top-full z-[70] w-[320px] -translate-x-1/2 pt-3">
      <div className="rounded-lg border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] p-3 shadow-2xl">
        {simpleNavOverlays[navId].map((item) =>
          item.href ? (
            <a
              key={item.label}
              href={item.href}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-[hsl(var(--triage-muted-foreground))] transition-colors hover:bg-[hsl(var(--triage-accent))] hover:text-[hsl(var(--triage-foreground))]"
            >
              {item.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-[hsl(var(--triage-muted-foreground))] transition-colors hover:bg-[hsl(var(--triage-accent))] hover:text-[hsl(var(--triage-foreground))]"
            >
              {item.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export default function LandingPage({
  onBack,
  onCreateProfile,
  onStartAssessment,
  profileCreated,
  profile,
}: {
  onBack: () => void;
  onCreateProfile: () => void;
  onStartAssessment: () => void;
  profileCreated: boolean;
  profile?: ProfileSetupValues | null;
}) {
  const [cubeZoom, setCubeZoom] = useState(() =>
    typeof window === "undefined" || window.innerWidth < 1024 ? 270 : 360,
  );
  const [landingMenuOpen, setLandingMenuOpen] = useState(false);
  const [activeLandingMenuId, setActiveLandingMenuId] = useState<LandingMenuId>("profile");

  useEffect(() => {
    const handleResize = () => {
      setCubeZoom(window.innerWidth < 1024 ? 270 : 360);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!landingMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLandingMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [landingMenuOpen]);

  return (
    <div className="triage-landing min-h-screen overflow-x-hidden bg-[hsl(var(--triage-background))] text-[hsl(var(--triage-foreground))]">
      <nav className="sticky top-0 z-50 w-full border-b border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-background))]/96 px-3 sm:px-4 backdrop-blur">
        <div className="grid h-[56px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-[hsl(var(--triage-muted-foreground))] transition-colors hover:text-[hsl(var(--triage-foreground))]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </button>
            <button
              type="button"
              aria-label="Open landing menu"
              aria-expanded={landingMenuOpen}
              onClick={() => setLandingMenuOpen(true)}
              className="flex h-9 items-center gap-2 border border-[hsl(var(--triage-border))] px-3 text-[13px] font-medium text-[hsl(var(--triage-foreground))] transition-colors hover:border-[hsl(var(--triage-foreground))]/45"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </div>
          <LandingTopNav />
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="h-8 px-3 text-[13px] text-[hsl(var(--triage-muted-foreground))] transition-colors hover:text-[hsl(var(--triage-foreground))]"
            >
              Methodology
            </button>
            <button
              type="button"
              onClick={onStartAssessment}
              className="h-8 border border-[hsl(var(--triage-foreground))]/40 px-3 text-[13px] text-[hsl(var(--triage-foreground))] transition-colors hover:border-[hsl(var(--triage-foreground))] hover:bg-[hsl(var(--triage-foreground))] hover:text-[hsl(var(--triage-background))]"
            >
              Start
            </button>
          </div>
        </div>
      </nav>

      <LandingSideMenu
        open={landingMenuOpen}
        activeId={activeLandingMenuId}
        items={landingMenuItems}
        profileCreated={profileCreated}
        profile={profile}
        onSelect={setActiveLandingMenuId}
        onClose={() => setLandingMenuOpen(false)}
        onCreateProfile={onCreateProfile}
      />

      <section className="relative z-10 overflow-hidden px-6 pb-0 pt-16">
        <div className="relative mx-auto max-w-[1200px]">
          <div className="relative flex pb-16 pt-[52px]">
            <div className="relative z-[3] max-w-[560px] flex-1">
              <div className="mb-5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                <ShieldCheck className="h-4 w-4" />
                AI-assisted readiness assessment
              </div>
              <h1 className="max-w-[560px] text-[clamp(2.1rem,4.3vw,3.45rem)] font-[500] leading-[1.06] tracking-[-0.045em] text-[hsl(var(--triage-foreground))]">
                Ransomware readiness for teams that need clear answers
              </h1>
              <p className="mt-6 max-w-[430px] text-base leading-relaxed text-[hsl(var(--triage-muted-foreground))]">
                Answer a short guided interview. The assistant explains confusing controls, while the backend calculates a transparent readiness score.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onStartAssessment}
                  className="group inline-flex items-center gap-2 bg-[hsl(var(--triage-foreground))] px-6 py-3 text-[14px] font-medium text-[hsl(var(--triage-background))] transition-colors duration-200 hover:bg-[hsl(var(--triage-foreground))]/90"
                >
                  Start assessment
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 border border-[hsl(var(--triage-foreground))]/35 px-6 py-3 text-[14px] font-medium text-[hsl(var(--triage-foreground))] transition-colors hover:bg-[hsl(var(--triage-foreground))] hover:text-[hsl(var(--triage-background))]"
                >
                  View report sample
                </button>
              </div>
            </div>

            <div className="pointer-events-none relative z-[1] hidden flex-1 md:block">
              <div
                className="absolute right-0 top-1/2"
                style={{
                  width: 840,
                  height: 840,
                  transform: "translate(140px, calc(-50% - 80px))",
                }}
              >
                <Suspense fallback={null}>
                  <LandingLogo3D size={840} zoom={cubeZoom} />
                </Suspense>
              </div>
            </div>
          </div>

          <div className="relative overflow-visible">
            <div className="relative z-10 overflow-hidden rounded-t-xl border border-b-0 border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))]">
              <div className="flex min-h-[420px]">
                <div className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-[hsl(var(--triage-border))] p-3">
                  <div className="mb-2 flex h-8 items-center gap-2 px-2">
                    <div className="h-4 w-4 bg-[hsl(var(--triage-primary))]/30" />
                    <div className="h-2 w-20 rounded-full bg-[hsl(var(--triage-foreground))]/15" />
                  </div>
                  <div className="h-px bg-[hsl(var(--triage-border))]" />
                  {["Interview", "Score", "Risks", "Actions"].map((item, index) => (
                    <div
                      key={item}
                      className={`flex h-7 items-center gap-2 px-2 ${index === 0 ? "bg-[hsl(var(--triage-accent))]" : ""}`}
                    >
                      <div className="h-3 w-3 bg-[hsl(var(--triage-muted-foreground))]/15" />
                      <span className="text-[11px] text-[hsl(var(--triage-muted-foreground))]">
                        {item}
                      </span>
                    </div>
                  ))}
                  <div className="my-1 h-px bg-[hsl(var(--triage-border))]" />
                  {["Backups", "Identity", "Response"].map((item) => (
                    <div key={item} className="flex h-7 items-center gap-2 px-2">
                      <div className="h-2 w-2 rounded-full bg-[hsl(var(--triage-primary))]/35" />
                      <span className="text-[11px] text-[hsl(var(--triage-muted-foreground))]/80">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex h-10 items-center gap-3 border-b border-[hsl(var(--triage-border))] px-4">
                    <div className="h-2 w-16 rounded-full bg-[hsl(var(--triage-foreground))]/15" />
                    <div className="h-2 w-10 rounded-full bg-[hsl(var(--triage-muted-foreground))]/12" />
                    <div className="h-2 w-20 rounded-full bg-[hsl(var(--triage-muted-foreground))]/12" />
                    <div className="ml-auto text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--triage-muted-foreground))]">
                      75 / 100
                    </div>
                  </div>
                  <div className="flex-1">
                    {assessmentRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="relative flex h-9 items-center gap-3 border-b border-[hsl(var(--triage-border))] px-4"
                      >
                        {index === 2 ? (
                          <div
                            className="absolute inset-0 opacity-50"
                            style={{ backgroundImage: diagonalPattern }}
                          />
                        ) : null}
                        <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-[hsl(var(--triage-border))]">
                          <div className={`h-1.5 w-1.5 ${row.tone}`} />
                        </div>
                        <span className="relative shrink-0 font-mono text-[11px] text-[hsl(var(--triage-muted-foreground))]">
                          {row.id}
                        </span>
                        <span className="relative truncate text-[12px] text-[hsl(var(--triage-foreground))]/72">
                          {row.title}
                        </span>
                        <div className="relative ml-auto flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${row.tone}`} />
                          <div className="h-5 w-5 rounded-full bg-[hsl(var(--triage-muted-foreground))]/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden w-[280px] shrink-0 flex-col border-l border-[hsl(var(--triage-border))] lg:flex">
                  <div className="flex h-10 items-center justify-between border-b border-[hsl(var(--triage-border))] px-4">
                    <div className="h-2 w-24 rounded-full bg-[hsl(var(--triage-foreground))]/15" />
                    <Gauge className="h-4 w-4 text-[hsl(var(--triage-muted-foreground))]" />
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                        Current question
                      </div>
                      <p className="mt-2 text-[13px] leading-5 text-[hsl(var(--triage-foreground))]/86">
                        Have restore tests been completed in the last 6 months?
                      </p>
                    </div>
                    <div className="h-px bg-[hsl(var(--triage-border))]" />
                    {["Yes", "Partial", "No", "Unsure"].map((answer, index) => (
                      <div key={answer} className="flex items-center justify-between">
                        <span className="text-[11px] text-[hsl(var(--triage-muted-foreground))]">
                          {answer}
                        </span>
                        <div
                          className={`h-2.5 w-2.5 ${
                            index === 0
                              ? "bg-[hsl(var(--triage-success))]"
                              : index === 1
                                ? "bg-[hsl(var(--triage-warning))]"
                                : index === 2
                                  ? "bg-[hsl(var(--triage-destructive))]"
                                  : "bg-[hsl(var(--triage-muted-foreground))]/30"
                          }`}
                        />
                      </div>
                    ))}
                    <div className="h-px bg-[hsl(var(--triage-border))]" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--triage-foreground))]/82">
                        <CheckCircle2 className="h-4 w-4 text-[hsl(var(--triage-success))]" />
                        AI explains. Backend scores.
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[hsl(var(--triage-foreground))]/82">
                        <FileText className="h-4 w-4 text-[hsl(var(--triage-primary))]" />
                        Report stays traceable.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(var(--triage-background))] to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full border-t border-[hsl(var(--triage-border))]" />

      <section className="relative z-10 overflow-hidden px-6 py-24">
        <div className="relative mx-auto max-w-[1200px]">
          <p className="mb-4 text-[13px] uppercase tracking-[0.15em] text-[hsl(var(--triage-muted-foreground))]">
            Built for assessment clarity
          </p>
          <h2 className="max-w-[560px] text-[clamp(1.8rem,3vw,2.5rem)] font-[500] leading-[1.15] tracking-[-0.03em] text-[hsl(var(--triage-foreground))]">
            Less guesswork.
            <br />
            More traceable decisions.
          </h2>

          <div className="mt-16 border border-[hsl(var(--triage-border))]">
            <div className="grid grid-cols-1 md:grid-cols-3">
              {featureCards.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`${index < 2 ? "border-[hsl(var(--triage-border))] md:border-r" : ""} ${index > 0 ? "border-t border-[hsl(var(--triage-border))] md:border-t-0" : ""} p-8`}
                >
                  <div className="mb-6 flex h-32 items-center justify-center rounded-lg border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))]/30">
                    <div className="w-full space-y-2 px-6">
                      {feature.graphic === "bars" ? (
                        <>
                          {[
                            ["w-full", "bg-[hsl(var(--triage-success))]"],
                            ["w-3/4", "bg-[hsl(var(--triage-warning))]"],
                            ["w-1/2", "bg-[hsl(var(--triage-primary))]"],
                            ["w-1/4", "bg-[hsl(var(--triage-destructive))]"],
                          ].map(([width, color]) => (
                            <div key={width} className={`h-2 rounded-full ${width} ${color}`} />
                          ))}
                        </>
                      ) : null}
                      {feature.graphic === "flow" ? (
                        <div className="flex items-center justify-between px-2">
                          {[
                            "bg-[hsl(var(--triage-primary))]",
                            "bg-[hsl(var(--triage-warning))]",
                            "bg-[hsl(var(--triage-success))]",
                          ].map((color, itemIndex) => (
                            <div key={color} className="flex flex-col items-center gap-2">
                              <div className={`h-8 w-8 rounded-full ${color}`} />
                              <div className="h-1 w-8 rounded-full bg-[hsl(var(--triage-muted-foreground))]/10" />
                              {itemIndex < 2 ? null : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {feature.graphic === "chart" ? (
                        <div className="flex h-16 items-end gap-1.5 px-2">
                          {[40, 65, 45, 80, 55, 70, 90].map((height, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="relative flex-1 overflow-hidden rounded-t border border-[hsl(var(--triage-border))]"
                              style={{ height: `${height}%` }}
                            >
                              <div
                                className="absolute inset-0 opacity-60"
                                style={{ backgroundImage: diagonalPattern }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="mb-2 text-[15px] font-medium text-[hsl(var(--triage-foreground))]">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-[1.6] text-[hsl(var(--triage-muted-foreground))]">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full border-t border-[hsl(var(--triage-border))]" />

      <section className="relative z-10 overflow-hidden px-6 py-24">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: diagonalPattern }} />
        <div className="relative mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[760px] border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-background))] p-10">
            <blockquote className="text-[20px] font-[400] leading-[1.5] tracking-[-0.01em] text-[hsl(var(--triage-foreground))]/86">
              "The official score is generated by backend rules. AI can explain the question, but it cannot invent points or change the result."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center bg-[hsl(var(--triage-primary))]/25 text-[11px] font-bold text-[hsl(var(--triage-foreground))]">
                RR
              </div>
              <div>
                <span className="text-[13px] font-medium text-[hsl(var(--triage-foreground))]">
                  Ransomware Readiness Methodology
                </span>
                <span className="ml-2 text-[13px] text-[hsl(var(--triage-muted-foreground))]">
                  versioned, source-mapped, testable
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full border-t border-[hsl(var(--triage-border))]" />

      <section className="relative z-10 overflow-hidden px-6 pb-40 pt-32">
        <div className="relative mx-auto max-w-[1200px] text-center">
          <h2 className="mx-auto max-w-[620px] text-[clamp(2rem,4vw,3.2rem)] font-[500] leading-[1.1] tracking-[-0.035em] text-[hsl(var(--triage-foreground))]">
            Know what will break before ransomware does.
          </h2>
          <p className="mx-auto mt-5 max-w-[460px] text-[15px] text-[hsl(var(--triage-muted-foreground))]">
            Start the interview, answer honestly, then review score, risks and the action plan.
          </p>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={onStartAssessment}
              className="group inline-flex items-center gap-2.5 border border-[hsl(var(--triage-foreground))]/40 px-8 py-3.5 text-[15px] font-medium text-[hsl(var(--triage-foreground))] transition-colors duration-200 hover:border-[hsl(var(--triage-foreground))] hover:bg-[hsl(var(--triage-foreground))] hover:text-[hsl(var(--triage-background))]"
            >
              Start assessment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[hsl(var(--triage-border))]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--triage-foreground))]">
            <ShieldCheck className="h-4 w-4" />
            AI Ransomware Assistant
          </div>
          <span className="text-[12px] text-[hsl(var(--triage-muted-foreground))]">
            {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
