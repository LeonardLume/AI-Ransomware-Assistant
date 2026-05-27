import type { UiLanguage } from "../utils/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export type ArtifactTitleInfoKind = "report" | "actionPlan" | "evidenceBinder" | "skills";

export default function ArtifactTitleInfo({
  kind,
  language,
}: {
  kind: ArtifactTitleInfoKind;
  language: UiLanguage;
}) {
  const info = artifactInfoContent(language, kind);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
          aria-label={infoAria(language)}
        >
          i
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-[min(92vw,31rem)] rounded-[30px] border-white/[0.10] bg-[#111417]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
        overlayClassName="bg-black/60 backdrop-blur-md"
      >
        <DialogTitle className="pr-10 text-2xl font-semibold tracking-[-0.04em] text-white">
          {info.title}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-slate-400">
          {info.short}
        </DialogDescription>

        <div className="mt-5 space-y-3">
          <InfoPanel label={whatLabel(language)} text={info.what} />
          <InfoPanel label={howLabel(language)} text={info.how} />
          <InfoPanel label={checkLabel(language)} text={info.check} />
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

function artifactInfoContent(language: UiLanguage, kind: ArtifactTitleInfoKind) {
  if (language === "ru") {
    const content = {
      report: {
        title: "Raport",
        short: "Главный отчёт по готовности к ransomware: score, risk и объяснение результата.",
        what: "Здесь собраны официальный score, уровень риска, процент заполнения, сильные и слабые домены, critical findings, priority actions и объяснение scoring. Это основной executive-view для быстрого понимания состояния.",
        how: "Score и risk рассчитывает backend по versioned questions и scoring_rules. LLM может помогать с readable summary и explanations, но не меняет ответы, веса, баллы или итоговый score. Если ответы неполные, report помечается как preliminary/partial.",
        check: "Сначала смотри completion и confidence, затем lowest domain scores, critical findings и priority steps. Если нужно доказать результат, переходи в Evidence Binder; если нужно понять capability behind recommendation, переходи в Oskused.",
      },
      actionPlan: {
        title: "Tegevusplaan",
        short: "Практический backlog улучшений, собранный из рисков отчёта.",
        what: "Здесь findings и слабые домены превращаются в конкретные remediation tasks: что сделать, кому назначить, какой effort, приоритет, срок и какие evidence понадобятся для проверки.",
        how: "Backend сохраняет score, risk, домены и matched skills как каркас, а LLM формулирует финальные action items для пользователя. Поэтому план остаётся привязанным к report data и scoring signals, но текст советов пишет LLM.",
        check: "Используй вкладку как рабочий backlog: начни с critical/high, назначь owner, определи deadline и evidence. После выполнения возвращайся к вопросам assessment и обновляй report, чтобы score отражал изменения.",
      },
      evidenceBinder: {
        title: "Tõendite kaust",
        short: "Папка доказательств: что показать, чтобы подтвердить ответы и readiness.",
        what: "Здесь перечислены документы, screenshots, tickets, policy excerpts, restore-test results, patch reports, access reviews, log examples и другие artefacts, которые подтверждают ответы assessment.",
        how: "Evidence Binder не меняет score сам по себе. Он связывает report/action plan с проверяемыми материалами, чтобы пользователь мог доказать, что control реально существует, протестирован и поддерживается.",
        check: "Собирай evidence по доменам. Хороший evidence должен иметь дату, владельца, систему в scope и результат проверки. Если evidence нет, это сигнал, что ответ может быть слабее или confidence ниже.",
      },
      skills: {
        title: "Oskused",
        short: "Reference layer: defensive skills/playbooks, связанные с рисками отчёта.",
        what: "Oskused показывают, какие defensive capabilities стоят за рекомендациями: backup recovery, MFA/access control, patch management, admin rights review, incident response, detection и другие практики.",
        how: "Backend подбирает skills из локальных markdown playbooks в папке skills/ и связывает их с доменами, NIST CSF mappings, tags и action/evidence logic. Это показывает происхождение рекомендаций, а не просто декоративные карточки.",
        check: "Открывай links в proof/source block: local skill file показывает исходный playbook, NIST/CISA/CIS links подтверждают framework context. Используй эту вкладку, когда нужно объяснить why/how за конкретным action item.",
      },
    };
    return content[kind];
  }

  if (language === "en") {
    const content = {
      report: {
        title: "Report",
        short: "The main ransomware readiness view: score, risk, and result explanation.",
        what: "This tab brings together the official score, risk level, completion, strongest and weakest domains, critical findings, priority actions, and scoring explanation. It is the executive overview of the assessment.",
        how: "The backend calculates score and risk from versioned questions and scoring_rules. The LLM may help with readable summaries and explanations, but it does not change answers, weights, points, or the official score. Incomplete answers make the report partial/preliminary.",
        check: "Start with completion and confidence, then review the lowest domain scores, critical findings, and priority steps. Use Evidence Binder to prove the result and Oskused to understand the defensive capability behind a recommendation.",
      },
      actionPlan: {
        title: "Action Plan",
        short: "A practical remediation backlog generated from report risks.",
        what: "Findings and weak domains are converted into concrete remediation tasks: what to do, who should own it, expected effort, priority, deadline, and evidence needed for verification.",
        how: "The backend keeps score, risk, domains, and matched skills as the structure, while the LLM writes the final action-item advice for the user. The plan stays grounded in report data and scoring signals, but the recommendation text is LLM-written.",
        check: "Use it as a working backlog: start with critical/high items, assign owners, set deadlines, and collect evidence. After remediation, update assessment answers and refresh the report so score reflects the change.",
      },
      evidenceBinder: {
        title: "Evidence Binder",
        short: "A proof checklist: what to show to support answers and readiness.",
        what: "This tab lists documents, screenshots, tickets, policy excerpts, restore-test results, patch reports, access reviews, log examples, and other artefacts that support assessment answers.",
        how: "Evidence Binder does not change score by itself. It connects the report and action plan to verifiable materials so a user can prove that a control exists, has been tested, and is maintained.",
        check: "Collect evidence by domain. Good evidence has a date, owner, scoped system, and test/review result. Missing evidence is a signal that the answer may be weaker or confidence may be lower.",
      },
      skills: {
        title: "Skills",
        short: "A reference layer: defensive skills and playbooks linked to report risks.",
        what: "Oskused shows the defensive capabilities behind recommendations: backup recovery, MFA/access control, patch management, admin rights review, incident response, detection, and related practices.",
        how: "The backend matches skills from local markdown playbooks in the skills/ folder and connects them to domains, NIST CSF mappings, tags, action items, and evidence logic. This shows recommendation provenance, not just decorative UI cards.",
        check: "Open the proof/source links: the local skill file shows the source playbook, while NIST/CISA/CIS links show framework context. Use this tab when you need to explain the why/how behind an action item.",
      },
    };
    return content[kind];
  }

  const content = {
    report: {
      title: "Raport",
      short: "Peamine lunavara valmisoleku vaade: skoor, risk ja tulemuse selgitus.",
      what: "Siin on koos ametlik skoor, riskitase, täitmise protsent, tugevamad ja nõrgemad domeenid, kriitilised leiud, prioriteetsed sammud ja scoring'u selgitus. See on hindamise juhtivaate kokkuvõte.",
      how: "Skoori ja riski arvutab backend versioonitud küsimuste ja scoring_rules reeglite põhjal. LLM võib aidata kokkuvõtte ja selgitustega, kuid ei muuda vastuseid, kaale, punkte ega ametlikku tulemust. Puudulikud vastused muudavad raporti osaliseks/esialgseks.",
      check: "Alusta completion'i ja confidence'i vaatamisest, seejärel kontrolli madalaimaid domeene, kriitilisi leide ja prioriteetseid samme. Tõendamiseks kasuta Tõendite kausta; soovituste tausta mõistmiseks kasuta Oskused vaadet.",
    },
    actionPlan: {
      title: "Tegevusplaan",
      short: "Praktiline paranduste backlog, mis tekib raporti riskidest.",
      what: "Leiud ja nõrgad domeenid muudetakse konkreetseteks tegevusteks: mida teha, kes võiks vastutada, milline on pingutus, prioriteet, tähtaeg ja milliseid tõendeid on vaja kontrollimiseks.",
      how: "Backend hoiab skoori, riski, domeenid ja sobitatud oskused struktuurina, LLM aga sõnastab kasutajale lõplikud tegevussoovitused. Plaan jääb seotud raporti andmete ja scoring-signaalidega, kuid soovituste tekst on LLM-i kirjutatud.",
      check: "Kasuta seda tööjärjekorrana: alusta critical/high tegevustest, määra omanik, pane tähtaeg ja kogu tõendid. Pärast parandusi uuenda assessment'i vastuseid ja värskenda raportit, et skoor muutust näitaks.",
    },
    evidenceBinder: {
      title: "Tõendite kaust",
      short: "Tõendite kontrollnimekiri: mida näidata, et vastuseid ja valmisolekut kinnitada.",
      what: "Siin on dokumendid, kuvatõmmised, tööpiletid, poliitikakatked, taastamistesti tulemused, patch report'id, ligipääsude ülevaatused, logide näited ja muud artefaktid, mis toetavad assessment'i vastuseid.",
      how: "Tõendite kaust ei muuda skoori otse. See seob raporti ja tegevusplaani kontrollitavate materjalidega, et kasutaja saaks näidata, et kontrollmeede on olemas, testitud ja hooldatud.",
      check: "Kogu tõendeid domeenide kaupa. Hea tõend sisaldab kuupäeva, omanikku, skoopi kuuluvat süsteemi ja testi või ülevaatuse tulemust. Tõendi puudumine on signaal, et vastus võib olla nõrgem või confidence madalam.",
    },
    skills: {
      title: "Oskused",
      short: "Tugikiht: raporti riskidega seotud kaitseoskused ja playbook'id.",
      what: "Oskused näitavad, millised kaitsevõimed seisavad soovituste taga: backup recovery, MFA ja ligipääsukontroll, patch management, admin rights review, incident response, detection ja seotud praktikad.",
      how: "Backend sobitab oskused lokaalse skills/ kausta markdown playbook'idest ning seob need domeenide, NIST CSF mapping'ute, tag'ide, tegevuste ja tõendite loogikaga. See näitab soovituste päritolu, mitte ainult dekoratiivseid UI-kaarte.",
      check: "Ava proof/source lingid: kohalik skill-fail näitab algset playbook'i ning NIST/CISA/CIS lingid näitavad framework-konteksti. Kasuta seda vaadet, kui pead selgitama konkreetse action item'i why/how poolt.",
    },
  };
  return content[kind];
}

function infoAria(language: UiLanguage): string {
  if (language === "en") return "Show tab explanation";
  if (language === "ru") return "Показать объяснение вкладки";
  return "Näita vaate selgitust";
}

function whatLabel(language: UiLanguage): string {
  if (language === "en") return "What it is";
  if (language === "ru") return "Что это";
  return "Mis see on";
}

function howLabel(language: UiLanguage): string {
  if (language === "en") return "How it works";
  if (language === "ru") return "Как работает";
  return "Kuidas see töötab";
}

function checkLabel(language: UiLanguage): string {
  if (language === "en") return "What to check";
  if (language === "ru") return "Что смотреть";
  return "Mida vaadata";
}
