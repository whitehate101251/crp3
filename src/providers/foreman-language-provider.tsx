"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Language } from "@/lib/translations/foreman";

type LanguageContextType = {
  language: Language;
  switchLanguage: (lang: Language) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("foreman-language");
    if (saved === "en" || saved === "hi") {
      setLanguage(saved);
    }
  }, []);

  const switchLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("foreman-language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useForcemanLanguage() {
  const context = useContext(LanguageContext);
  
  // Return default context if not provided (for SSG/build time)
  if (!context) {
    return {
      language: "en" as Language,
      switchLanguage: () => {},
    };
  }
  
  return context;
}
