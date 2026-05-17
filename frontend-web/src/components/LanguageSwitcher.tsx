import { languageOptions, type UiLanguage } from "../utils/i18n";
import { cn } from "./ui-helpers";

export default function LanguageSwitcher({
  language,
  onChange,
}: {
  language: UiLanguage;
  onChange: (language: UiLanguage) => void;
}) {
  return (
    <div
      className="inline-grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-xl transition-all duration-300 ease-out hover:border-white/20"
      aria-label="Language"
    >
      {languageOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-out",
            option.id === language
              ? "bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)]"
              : "text-slate-400 hover:bg-white/10 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
