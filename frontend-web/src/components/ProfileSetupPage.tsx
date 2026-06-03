import { Apple, ArrowLeft, Check, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export type ProfileSetupValues = {
  organizationName: string;
  industry: string;
  organizationSize: string;
  assessmentOwner: string;
};

const defaultProfile: ProfileSetupValues = {
  organizationName: "",
  industry: "",
  organizationSize: "",
  assessmentOwner: "",
};

export default function ProfileSetupPage({
  initialProfile,
  onBack,
  onSave,
}: {
  initialProfile?: ProfileSetupValues | null;
  onBack: () => void;
  onSave: (profile: ProfileSetupValues) => void;
}) {
  const [profile, setProfile] = useState<ProfileSetupValues>(initialProfile || defaultProfile);
  const canSave =
    profile.organizationName.trim() &&
    profile.industry.trim() &&
    profile.organizationSize.trim() &&
    profile.assessmentOwner.trim();

  function updateProfile(field: keyof ProfileSetupValues, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      organizationName: profile.organizationName.trim(),
      industry: profile.industry.trim(),
      organizationSize: profile.organizationSize.trim(),
      assessmentOwner: profile.assessmentOwner.trim(),
    });
  }

  return (
    <div className="triage-landing min-h-screen bg-[hsl(var(--triage-background))] text-[hsl(var(--triage-foreground))]">
      <nav className="border-b border-[hsl(var(--triage-border))] px-6">
        <div className="mx-auto flex h-[56px] max-w-[1040px] items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--triage-muted-foreground))] transition-colors hover:text-[hsl(var(--triage-foreground))]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing
          </button>
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--triage-foreground))]">
            <ShieldCheck className="h-4 w-4" />
            Profile
          </div>
        </div>
      </nav>

      <main className="px-6 py-16">
        <div className="mx-auto grid max-w-[1040px] gap-10 lg:grid-cols-[0.82fr_1fr]">
          <section>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
              Workspace setup
            </p>
            <h1 className="mt-5 max-w-[420px] text-[clamp(2.1rem,4vw,3.25rem)] font-[500] leading-[1.05] tracking-[-0.045em]">
              Create the assessment profile
            </h1>
            <p className="mt-5 max-w-[430px] text-[15px] leading-7 text-[hsl(var(--triage-muted-foreground))]">
              This profile is used to label sessions, reports and client-ready recommendations before the questionnaire or Recovery Proof path starts.
            </p>
          </section>

          <div className="min-w-0">
            <form
              onSubmit={submitProfile}
              className="border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] p-5 sm:p-6"
            >
              <div className="grid gap-5">
                <ProfileField
                  label="Organization name"
                  value={profile.organizationName}
                  placeholder="Example: Northwind Services"
                  onChange={(value) => updateProfile("organizationName", value)}
                />
                <ProfileField
                  label="Industry"
                  value={profile.industry}
                  placeholder="Example: Healthcare, finance, manufacturing"
                  onChange={(value) => updateProfile("industry", value)}
                />
                <ProfileField
                  label="Organization size"
                  value={profile.organizationSize}
                  placeholder="Example: 50-250 employees"
                  onChange={(value) => updateProfile("organizationSize", value)}
                />
                <ProfileField
                  label="Assessment owner"
                  value={profile.assessmentOwner}
                  placeholder="Example: Elena Petrova, IT manager"
                  onChange={(value) => updateProfile("assessmentOwner", value)}
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-[hsl(var(--triage-border))] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] leading-5 text-[hsl(var(--triage-muted-foreground))]">
                  Required before profile-specific workspace options are shown.
                </p>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="inline-flex h-11 items-center justify-center gap-2 bg-[hsl(var(--triage-foreground))] px-5 text-[13px] font-medium text-[hsl(var(--triage-background))] transition-colors hover:bg-[hsl(var(--triage-foreground))]/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Save profile
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </form>

            <AuthEntryPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthEntryPanel() {
  return (
    <section className="mx-auto mt-10 max-w-[448px] border-t border-[hsl(var(--triage-border))] pt-6">
      <div className="grid gap-3">
        <AuthButton label="Войти через email" icon={<Mail className="h-4 w-4" />} />
        <AuthButton label="Войти через Google" icon={<GoogleMark />} />
        <AuthButton label="Войти через Apple" icon={<Apple className="h-4 w-4 fill-current" />} />
      </div>

      <p className="mt-6 text-center text-[14px] text-[hsl(var(--triage-muted-foreground))]">
        Нет аккаунта?{" "}
        <button
          type="button"
          className="font-semibold text-[hsl(var(--triage-foreground))] transition-colors hover:text-[hsl(var(--triage-foreground))]/80"
        >
          Зарегистрироваться
        </button>
      </p>

      <p className="mt-10 text-center text-[12px] leading-5 text-[hsl(var(--triage-muted-foreground))]">
        Продолжая, вы соглашаетесь с{" "}
        <a className="font-semibold text-[hsl(var(--triage-foreground))] underline underline-offset-2" href="#">
          Условия использования
        </a>{" "}
        и{" "}
        <a className="font-semibold text-[hsl(var(--triage-foreground))] underline underline-offset-2" href="#">
          Политика конфиденциальности
        </a>
      </p>
    </section>
  );
}

function AuthButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[hsl(var(--triage-border))] bg-transparent px-5 text-[14px] font-semibold text-[hsl(var(--triage-foreground))] transition-colors hover:border-[hsl(var(--triage-foreground))]/55 hover:bg-[hsl(var(--triage-card))]"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleMark() {
  return (
    <span className="text-[18px] font-bold leading-none text-[#4285f4]" aria-hidden="true">
      G
    </span>
  );
}

function ProfileField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--triage-muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-background))] px-3 text-[14px] text-[hsl(var(--triage-foreground))] outline-none transition-colors placeholder:text-[hsl(var(--triage-muted-foreground))]/55 focus:border-[hsl(var(--triage-foreground))]/55"
      />
    </label>
  );
}
