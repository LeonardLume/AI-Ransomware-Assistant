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
        short: "Главный отчёт по готовности к ransomware.",
        what: "Здесь собраны score, уровень риска, краткое резюме, главные findings, приоритетные шаги и готовность по доменам.",
        how: "Score и risk рассчитывает backend по правилам. LLM помогает объяснять результат, но не придумывает баллы. Эту вкладку удобно показывать первой.",
      },
      actionPlan: {
        title: "Tegevusplaan",
        short: "Практический план улучшений после отчёта.",
        what: "Здесь backend превращает findings и risks в задачи: что сделать, кто владелец, какой effort и deadline.",
        how: "Сначала открой Raport, затем используй эту вкладку как backlog. Кнопки i у задач объясняют конкретные шаги и evidence.",
      },
      evidenceBinder: {
        title: "Tõendite kaust",
        short: "Список доказательств, которые подтверждают готовность.",
        what: "Здесь собраны документы, screenshots, tickets, log examples и другие материалы, которые стоит подготовить для проверки.",
        how: "Вкладка не считает score. Она помогает доказать, что action plan реально выполнен и что ответы в assessment можно подтвердить.",
      },
      skills: {
        title: "Oskused",
        short: "Защитные skills/playbooks, связанные с отчётом.",
        what: "Это reference layer: навыки и практики, которые помогают объяснять рекомендации, evidence и action plan.",
        how: "Skills не считают numeric score. Они показывают, какие defensive capabilities связаны с найденными рисками.",
      },
    };
    return content[kind];
  }

  if (language === "en") {
    const content = {
      report: {
        title: "Report",
        short: "The main ransomware readiness report.",
        what: "It brings together score, risk level, summary, key findings, priority steps, and domain readiness.",
        how: "The backend calculates score and risk using rules. The LLM helps explain the result, but does not invent points. This is the best first tab to show.",
      },
      actionPlan: {
        title: "Action Plan",
        short: "A practical improvement plan generated from the report.",
        what: "Backend findings and risks are turned into tasks with owner, effort, deadline, and evidence expectations.",
        how: "Open the report first, then use this as a backlog. The i buttons on actions explain concrete steps and evidence.",
      },
      evidenceBinder: {
        title: "Evidence Binder",
        short: "A checklist of proof that supports readiness.",
        what: "It lists documents, screenshots, tickets, log examples, and other materials that should be prepared for review.",
        how: "This tab does not calculate score. It helps prove that the action plan is real and assessment answers can be validated.",
      },
      skills: {
        title: "Skills",
        short: "Defensive skills and playbooks linked to the report.",
        what: "This is a reference layer: practices that support explanations, evidence, and the action plan.",
        how: "Skills do not calculate numeric score. They show which defensive capabilities connect to the reported risks.",
      },
    };
    return content[kind];
  }

  const content = {
    report: {
      title: "Raport",
      short: "Peamine lunavara valmisoleku raport.",
      what: "Siin on koos skoor, riskitase, kokkuvõte, olulisemad leiud, prioriteetsed sammud ja domeenide valmisolek.",
      how: "Tulemuse ja riski arvutab taustsüsteem reeglitega. LLM aitab tulemust selgitada, kuid ei mõtle punkte välja. Seda vaadet on mõistlik näidata esimesena.",
    },
    actionPlan: {
      title: "Tegevusplaan",
      short: "Praktiline parandusplaan raporti põhjal.",
      what: "Taustsüsteemi leiud ja riskid muutuvad tegevusteks: mida teha, kes vastutab, kui suur on pingutus ja mis on tähtaeg.",
      how: "Ava esmalt raport, seejärel kasuta seda tööjärjekorrana. Tegevuste juures olevad i-nupud selgitavad konkreetseid samme ja tõendeid.",
    },
    evidenceBinder: {
      title: "Tõendite kaust",
      short: "Tõendite nimekiri, mis toetab valmisolekut.",
      what: "Siin on dokumendid, kuvatõmmised, tööpiletid, logide näited ja muud materjalid, mida tasub kontrolliks ette valmistada.",
      how: "See vaade ei arvuta tulemust. See aitab näidata, et tegevusplaan on päriselt tehtud ja hindamise vastuseid saab kinnitada.",
    },
    skills: {
      title: "Oskused",
      short: "Raportiga seotud kaitseoskused ja juhendid.",
      what: "See on tugikiht: praktikad, mis toetavad selgitusi, tõendeid ja tegevusplaani.",
      how: "Oskused ei arvuta numbrilist tulemust. Need näitavad, millised kaitsevõimed on raporti riskidega seotud.",
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
