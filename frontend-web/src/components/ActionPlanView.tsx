import { Info } from "lucide-react";
import type { ActionItem, ReportResponse } from "../types/api";
import {
  domainLabel,
  effortLabel,
  localizeKnownText,
  riskLabel,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";
import ArtifactTitleInfo from "./ArtifactTitleInfo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

type PhaseKey = "48h" | "14d" | "30d";
type ActionFamily = "backup" | "logging" | "incident" | "access" | "patching" | "awareness" | "generic";
type ActionGuidance = {
  steps: string[];
  verification: string[];
  expectedResult: string;
};

export default function ActionPlanView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const items = report?.action_plan || [];

  if (!items.length) {
    return (
      <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.055),transparent_32%)]" />
        <div className="relative space-y-6">
          <section className="report-panel rounded-[34px] px-6 py-10 text-center sm:px-8">
            <div className="inline-flex items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "actionPlan")}
              </h2>
              <ArtifactTitleInfo kind="actionPlan" language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "actionPlanDescription")}
            </p>
          </section>
          <EmptyState
            title={t(language, "noActionPlanTitle")}
            description={t(language, "noActionPlanDescription")}
          />
        </div>
      </div>
    );
  }

  const grouped = groupItems(items);

  return (
    <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.055),transparent_32%)]" />

      <div className="relative space-y-7">
        <section className="report-panel relative rounded-[34px] px-6 py-10 sm:px-8 lg:min-h-[250px] lg:px-10 lg:py-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center lg:min-h-[170px]">
            <div className="inline-flex items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "actionPlan")}
              </h2>
              <ArtifactTitleInfo kind="actionPlan" language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "actionPlanDescription")}
            </p>
          </div>

          <div className="mx-auto mt-7 w-full max-w-[168px] rounded-[24px] border border-white/[0.08] bg-black/[0.18] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:absolute lg:right-5 lg:top-5 lg:mt-0">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Actions
              </div>
              <div className="mt-0.5 text-3xl font-semibold leading-none tracking-[-0.06em] text-white">
                {items.length}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {Object.entries(grouped).map(([phase, phaseItems]) => (
            <section key={phase} className="report-panel rounded-[32px] px-5 py-6 sm:px-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                    {phaseLabel(language, phase as PhaseKey)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {phaseDescription(language, phase as PhaseKey)}
                  </p>
                </div>
              </div>

              <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
                {phaseItems.map((item, index) => (
                  <article
                    key={`${item.title}-${phase}-${index}`}
                    className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <h4 className="text-lg font-semibold leading-7 tracking-[-0.03em] text-white">
                          {localizeKnownText(language, item.title) || actionItemLabel(language)}
                        </h4>
                        <ActionInfoDialog item={item} language={language} />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {item.domain ? domainLabel(language, item.domain) : actionItemLabel(language)}
                        {" - "}
                        {riskLabel(language, item.priority || t(language, "priority"))}
                      </p>
                      {item.evidence_required?.length ? (
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {item.evidence_required.map((entry) => localizeKnownText(language, entry)).join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-3 lg:grid-cols-1">
                      <MetaLine
                        label={t(language, "owner")}
                        value={valueLabel(language, item.owner || item.owner_suggestion)}
                      />
                      <MetaLine
                        label={t(language, "effort")}
                        value={effortLabel(language, item.effort)}
                      />
                      <MetaLine
                        label={t(language, "deadline")}
                        value={valueLabel(language, item.deadline)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionInfoDialog({
  item,
  language,
}: {
  item: ActionItem;
  language: UiLanguage;
}) {
  const title = localizeKnownText(language, item.title) || actionItemLabel(language);
  const domain = item.domain ? domainLabel(language, item.domain) : actionItemLabel(language);
  const evidenceItems = item.evidence_required || [];
  const guidance = buildActionGuidance(item, language);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
          aria-label={infoLabel(language)}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[88vh] w-[min(92vw,36rem)] overflow-y-auto rounded-[30px] border-white/[0.10] bg-[#111417]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
        overlayClassName="bg-black/60 backdrop-blur-md"
      >
        <DialogTitle className="pr-10 text-2xl font-semibold tracking-[-0.04em] text-white">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-slate-400">
          {actionHint(language)}
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {whatToDoLabel(language)}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {title}
            </p>
          </div>

          <GuidanceBlock title={stepsLabel(language)} items={guidance.steps} />
          <GuidanceBlock title={verifyLabel(language)} items={guidance.verification} />
          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {expectedResultLabel(language)}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {guidance.expectedResult}
            </p>
          </div>

          {evidenceItems.length ? (
            <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {evidenceLabel(language)}
              </div>
              <ul className="mt-3 space-y-2">
                {evidenceItems.map((evidence) => (
                  <li key={evidence} className="text-sm leading-6 text-slate-300">
                    {localizeKnownText(language, evidence)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2 text-sm text-slate-300">
            <InfoMetaLine label={domainLabelText(language)} value={domain} />
            <InfoMetaLine label={t(language, "priority")} value={riskLabel(language, item.priority || t(language, "priority"))} />
            <InfoMetaLine label={t(language, "owner")} value={valueLabel(language, item.owner || item.owner_suggestion)} />
            <InfoMetaLine label={t(language, "effort")} value={effortLabel(language, item.effort)} />
            <InfoMetaLine label={t(language, "deadline")} value={valueLabel(language, item.deadline)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuidanceBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </div>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-300">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-black/[0.18] text-[11px] font-semibold text-slate-500">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InfoMetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/[0.16] px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-300">{value}</span>
    </div>
  );
}

function MetaLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/[0.12] px-3 py-2">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </span>
      <span className="min-w-0 truncate text-slate-300">{value}</span>
    </div>
  );
}

function groupItems(items: ActionItem[]) {
  const groups: Record<PhaseKey, ActionItem[]> = {
    "48h": [],
    "14d": [],
    "30d": [],
  };
  items.forEach((item, index) => {
    if (index < Math.ceil(items.length / 3)) {
      groups["48h"].push(item);
    } else if (index < Math.ceil((items.length / 3) * 2)) {
      groups["14d"].push(item);
    } else {
      groups["30d"].push(item);
    }
  });
  return groups;
}

function buildActionGuidance(item: ActionItem, language: UiLanguage): ActionGuidance {
  const normalized = `${item.domain || ""} ${item.title || ""} ${item.based_on_skill || ""}`.toLowerCase();
  const family = actionFamily(normalized);
  if (language === "ru") return guidanceRu(family);
  if (language === "en") return guidanceEn(family);
  return guidanceEt(family);
}

function actionFamily(text: string): ActionFamily {
  if (/(backup|restore|recover|varund|taast|snapshot|immutable)/.test(text)) return "backup";
  if (/(log|alert|monitor|detect|siem|edr|xdr|tuvast|jälg|jalg)/.test(text)) return "logging";
  if (/(incident|response|playbook|tabletop|exercise|harjut|plaan|plan)/.test(text)) return "incident";
  if (/(mfa|identity|access|admin|privileg|konto|user|kasutaja|ligipääs|ligipaas)/.test(text)) return "access";
  if (/(patch|vulnerab|update|uuend|haavatav|cve)/.test(text)) return "patching";
  if (/(training|awareness|phishing|koolit|teadlik)/.test(text)) return "awareness";
  return "generic";
}

function guidanceEt(family: ActionFamily): ActionGuidance {
  const commonVerification = [
    "Lisa tõend: link, screenshot, logiväljavõte, ticket või dokumendi versioon.",
    "Palu omanikul kinnitada, et tegevus on tehtud ja vähendab raportis kirjeldatud riski.",
  ];
  if (family === "backup") {
    return {
      steps: [
        "Leia kriitilised süsteemid ja kontrolli, millal nende viimane varukoopia tegelikult valmis sai.",
        "Tee taastamise proov väikese andmekogumiga, mitte ainult backup job'i staatuse kontroll.",
        "Kinnita, et vähemalt üks koopia on eraldatud või muutmiskindel.",
      ],
      verification: ["Kirjuta üles taastamise aeg, kasutatud andmekogu ja tulemus.", ...commonVerification],
      expectedResult: "Meeskond teab, millised andmed taastuvad, kui kiiresti taastamine käib ja kus on muutmiskindel koopia.",
    };
  }
  if (family === "logging") {
    return {
      steps: [
        "Vali logiallikad, mis aitavad lunavara uurida: endpoint, identity, file changes ja backup events.",
        "Kontrolli, kas logid jõuavad ühte kohta ning kas säilitusperiood katab uurimise vajaduse.",
        "Loo või uuenda alert-review protsess: kes vaatab, kui kiiresti ja kuhu eskaleeritakse.",
      ],
      verification: ["Ava näidisalert või logikirje ja kontrolli, et see sisaldab aega, hosti, kasutajat ja sündmust.", ...commonVerification],
      expectedResult: "Kui intsident juhtub, on uurimiseks vajalikud logid olemas ja keegi vastutab nende ülevaatamise eest.",
    };
  }
  if (family === "incident") {
    return {
      steps: [
        "Kirjuta lühike lunavara stsenaarium: avastamine, isoleerimine, suhtlus, taastamine ja otsustajad.",
        "Määra rollid: incident lead, IT, juhtkond, kommunikatsioon ja väline partner.",
        "Tee 60-90 minuti harjutus ning salvesta otsused ja paranduskohad.",
      ],
      verification: ["Kontrolli, et plaanis on kontaktid, eskalatsioon, esimese tunni tegevused ja taastamise otsused.", ...commonVerification],
      expectedResult: "Inimesed teavad enne kriisi, kes otsustab, mida isoleerida ja kuidas taastamist alustada.",
    };
  }
  if (family === "access") {
    return {
      steps: [
        "Vaata üle admin- ja kaugjuurdepääsu kontod ning eemalda kasutamata õigused.",
        "Lülita MFA sisse vähemalt admin-kontodele, VPN-ile ja pilveteenustele.",
        "Kontrolli, kas hädaolukorra ligipääs on dokumenteeritud ja kaitstud.",
      ],
      verification: ["Tee eksport või screenshot kontodest, rollidest ja MFA staatusest.", ...commonVerification],
      expectedResult: "Lunavara operaatoril on raskem liikuda edasi varastatud parooli või liigsete õigustega.",
    };
  }
  if (family === "patching") {
    return {
      steps: [
        "Koosta nimekiri internetist nähtavatest ja kriitilistest süsteemidest.",
        "Määra patchimise prioriteet: aktiivselt kasutatav haavatavus, kriitiline server, kaugjuurdepääs.",
        "Paika pane rütm, kes kontrollib CVE-sid ja millal parandused paigaldatakse.",
      ],
      verification: ["Lisa vulnerability scan'i väljavõte, patch ticket või uuenduse versioon.", ...commonVerification],
      expectedResult: "Kõige ohtlikumad augud ei jää kuudeks lahti ja patchimise omanik on selge.",
    };
  }
  if (family === "awareness") {
    return {
      steps: [
        "Vali üks realistlik lunavara alguspunkt: phishing, paroolileke või pahatahtlik manus.",
        "Selgita töötajatele, mida raporteerida ja millist kanalit kasutada.",
        "Tee lühike test või simulatsioon ning kogu tulemused järgmise paranduse jaoks.",
      ],
      verification: ["Näita koolituse materjali, osalejate nimekirja või raportikanali testimist.", ...commonVerification],
      expectedResult: "Töötajad tunnevad varajasi ohumärke ja oskavad neist kiiresti teada anda.",
    };
  }
  return {
    steps: [
      "Määra vastutaja ja täpsusta, milline süsteem, protsess või dokument on skoopis.",
      "Kirjelda tänane seis: mis on olemas, mis puudub ja milline otsus on vaja teha.",
      "Tee konkreetne muudatus või dokument, mida saab hiljem tõendina näidata.",
    ],
    verification: commonVerification,
    expectedResult: "Tegevus ei jää abstraktseks soovituseks, vaid muutub kontrollitavaks paranduseks koos omanikuga.",
  };
}

function guidanceEn(family: ActionFamily): ActionGuidance {
  const commonVerification = [
    "Attach evidence: a link, screenshot, log extract, ticket, or document version.",
    "Ask the owner to confirm that the action is complete and reduces the reported risk.",
  ];
  if (family === "backup") {
    return {
      steps: [
        "Identify critical systems and check when their last backup actually completed.",
        "Run a small restore test instead of only checking the backup job status.",
        "Confirm that at least one copy is isolated or immutable.",
      ],
      verification: ["Record restore time, dataset used, and result.", ...commonVerification],
      expectedResult: "The team knows what can be restored, how long it takes, and where the protected copy lives.",
    };
  }
  if (family === "logging") {
    return {
      steps: [
        "Select log sources needed for ransomware investigation: endpoint, identity, file changes, and backup events.",
        "Check whether logs arrive in one place and whether retention is long enough for investigation.",
        "Define who reviews alerts, how quickly, and where escalation goes.",
      ],
      verification: ["Open a sample alert or log entry and confirm time, host, user, and event are visible.", ...commonVerification],
      expectedResult: "During an incident, the team has usable logs and a clear review owner.",
    };
  }
  if (family === "incident") {
    return {
      steps: [
        "Write a short ransomware scenario covering detection, isolation, communication, recovery, and decision makers.",
        "Assign roles: incident lead, IT, management, communications, and external partner.",
        "Run a 60-90 minute tabletop and capture decisions plus gaps.",
      ],
      verification: ["Check that the plan includes contacts, escalation, first-hour actions, and recovery decisions.", ...commonVerification],
      expectedResult: "People know who decides, what to isolate, and how recovery starts before the crisis begins.",
    };
  }
  if (family === "access") {
    return {
      steps: [
        "Review admin and remote access accounts, then remove unused privileges.",
        "Enable MFA for admin accounts, VPN, and key cloud services.",
        "Confirm emergency access is documented and protected.",
      ],
      verification: ["Export or screenshot accounts, roles, and MFA status.", ...commonVerification],
      expectedResult: "A ransomware operator has less room to move with stolen passwords or excessive privileges.",
    };
  }
  if (family === "patching") {
    return {
      steps: [
        "List internet-facing and critical systems first.",
        "Prioritize active exploitation, critical servers, and remote access paths.",
        "Set who tracks CVEs and when fixes are deployed.",
      ],
      verification: ["Attach a vulnerability scan extract, patch ticket, or updated version record.", ...commonVerification],
      expectedResult: "The most dangerous gaps are not left open for months, and patch ownership is clear.",
    };
  }
  if (family === "awareness") {
    return {
      steps: [
        "Pick one realistic ransomware entry point: phishing, leaked password, or malicious attachment.",
        "Explain what employees should report and which channel to use.",
        "Run a short test or simulation and use the result for the next improvement.",
      ],
      verification: ["Show training material, participant list, or a tested reporting channel.", ...commonVerification],
      expectedResult: "Employees recognize early warning signs and report them quickly.",
    };
  }
  return {
    steps: [
      "Assign an owner and clarify which system, process, or document is in scope.",
      "Describe the current state: what exists, what is missing, and what decision is needed.",
      "Create a concrete change or document that can be shown as evidence later.",
    ],
    verification: commonVerification,
    expectedResult: "The action becomes a verifiable improvement with an owner, not an abstract recommendation.",
  };
}

function guidanceRu(family: ActionFamily): ActionGuidance {
  const commonVerification = [
    "Приложи доказательство: ссылку, screenshot, log extract, ticket или версию документа.",
    "Попроси владельца подтвердить, что действие выполнено и снижает риск из отчёта.",
  ];
  if (family === "backup") {
    return {
      steps: [
        "Определи критичные системы и проверь, когда их последний backup реально завершился.",
        "Сделай маленький restore-test, а не только проверку статуса backup job.",
        "Подтверди, что хотя бы одна копия изолирована или immutable.",
      ],
      verification: ["Запиши время восстановления, тестовый набор данных и результат.", ...commonVerification],
      expectedResult: "Команда понимает, что можно восстановить, сколько это занимает и где лежит защищённая копия.",
    };
  }
  if (family === "logging") {
    return {
      steps: [
        "Выбери log sources для расследования ransomware: endpoint, identity, file changes и backup events.",
        "Проверь, что логи попадают в одно место и retention достаточно длинный.",
        "Опиши, кто смотрит alerts, как быстро и куда эскалирует.",
      ],
      verification: ["Открой пример alert или log entry и проверь время, host, user и событие.", ...commonVerification],
      expectedResult: "При инциденте у команды есть полезные логи и понятный владелец review-процесса.",
    };
  }
  if (family === "incident") {
    return {
      steps: [
        "Опиши короткий ransomware-сценарий: обнаружение, изоляция, коммуникация, восстановление и decision makers.",
        "Назначь роли: incident lead, IT, management, communications и внешний партнёр.",
        "Проведи 60-90 минут tabletop и зафиксируй решения и gaps.",
      ],
      verification: ["Проверь, что в плане есть контакты, escalation, действия первого часа и решения по recovery.", ...commonVerification],
      expectedResult: "Люди заранее знают, кто принимает решения, что изолировать и как начинать восстановление.",
    };
  }
  if (family === "access") {
    return {
      steps: [
        "Проверь admin и remote access accounts, затем убери неиспользуемые права.",
        "Включи MFA минимум для admin accounts, VPN и ключевых cloud services.",
        "Проверь, что emergency access документирован и защищён.",
      ],
      verification: ["Сделай export или screenshot accounts, roles и MFA status.", ...commonVerification],
      expectedResult: "Оператору ransomware сложнее двигаться дальше через украденный пароль или лишние привилегии.",
    };
  }
  if (family === "patching") {
    return {
      steps: [
        "Сначала составь список internet-facing и критичных систем.",
        "Приоритизируй active exploitation, critical servers и remote access paths.",
        "Назначь, кто отслеживает CVE и когда ставятся исправления.",
      ],
      verification: ["Приложи vulnerability scan extract, patch ticket или запись об обновлённой версии.", ...commonVerification],
      expectedResult: "Самые опасные уязвимости не остаются открытыми месяцами, а владелец patching понятен.",
    };
  }
  if (family === "awareness") {
    return {
      steps: [
        "Выбери реалистичную точку входа ransomware: phishing, leaked password или malicious attachment.",
        "Объясни сотрудникам, что репортить и через какой канал.",
        "Проведи короткий test/simulation и используй результат для следующего улучшения.",
      ],
      verification: ["Покажи training material, список участников или проверенный reporting channel.", ...commonVerification],
      expectedResult: "Сотрудники распознают ранние признаки атаки и быстро сообщают о них.",
    };
  }
  return {
    steps: [
      "Назначь владельца и уточни, какая система, процесс или документ входит в scope.",
      "Опиши текущий статус: что уже есть, чего не хватает и какое решение нужно принять.",
      "Сделай конкретное изменение или документ, который потом можно показать как evidence.",
    ],
    verification: commonVerification,
    expectedResult: "Действие превращается из абстрактной рекомендации в проверяемое улучшение с владельцем.",
  };
}

function phaseLabel(language: UiLanguage, phase: PhaseKey): string {
  if (phase === "48h") return t(language, "next48Hours");
  if (phase === "14d") return t(language, "next14Days");
  return t(language, "next30Days");
}

function phaseDescription(language: UiLanguage, phase: PhaseKey): string {
  if (language === "ru") {
    if (phase === "48h") return "Самые срочные действия для снижения риска.";
    if (phase === "14d") return "Улучшения, которые стабилизируют базовую защиту.";
    return "Плановые задачи для закрепления результата.";
  }
  if (language === "en") {
    if (phase === "48h") return "Urgent actions that reduce immediate risk.";
    if (phase === "14d") return "Improvements that stabilize the defensive baseline.";
    return "Planned work that keeps the improvements durable.";
  }
  if (phase === "48h") return "Kiired tegevused vahetu riski vähendamiseks.";
  if (phase === "14d") return "Parandused, mis stabiliseerivad kaitse baastaseme.";
  return "Plaanilised sammud tulemuse kinnistamiseks.";
}

function actionItemLabel(language: UiLanguage): string {
  if (language === "en") return "Action item";
  if (language === "ru") return "Action item";
  return "Tegevus";
}

function infoLabel(language: UiLanguage): string {
  if (language === "en") return "Show action details";
  if (language === "ru") return "Показать детали действия";
  return "Näita tegevuse detaile";
}

function actionHint(language: UiLanguage): string {
  if (language === "en") return "Use this as a practical checklist for the selected action.";
  if (language === "ru") return "Используй это как практический чеклист для выбранного действия.";
  return "Kasuta seda praktilise kontrollnimekirjana valitud tegevuse jaoks.";
}

function stepsLabel(language: UiLanguage): string {
  if (language === "en") return "Recommended steps";
  if (language === "ru") return "Рекомендуемые шаги";
  return "Soovitatud sammud";
}

function verifyLabel(language: UiLanguage): string {
  if (language === "en") return "How to verify";
  if (language === "ru") return "Как проверить";
  return "Kuidas kontrollida";
}

function expectedResultLabel(language: UiLanguage): string {
  if (language === "en") return "Expected result";
  if (language === "ru") return "Ожидаемый результат";
  return "Oodatav tulemus";
}

function whatToDoLabel(language: UiLanguage): string {
  if (language === "en") return "What to do";
  if (language === "ru") return "Что сделать";
  return "Mida teha";
}

function evidenceLabel(language: UiLanguage): string {
  if (language === "en") return "Evidence to prepare";
  if (language === "ru") return "Что подготовить";
  return "Mida ette valmistada";
}

function domainLabelText(language: UiLanguage): string {
  if (language === "en") return "Domain";
  if (language === "ru") return "Домен";
  return "Domeen";
}
