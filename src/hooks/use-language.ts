import { useState } from "react";
import type { Language } from "@/lib/translations/foreman";

const STORAGE_KEY = "foreman-language";

export function useLanguage(defaultLanguage: Language = "en") {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") {
      return defaultLanguage;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "hi") {
      return saved;
    }

    return defaultLanguage;
  });
  const mounted = typeof window !== "undefined";

  const switchLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return { language, switchLanguage, mounted };
}
