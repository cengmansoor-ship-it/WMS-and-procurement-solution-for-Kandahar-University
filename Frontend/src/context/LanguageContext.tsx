import React, { createContext, useContext, useState } from "react";

export type Lang = "ps" | "dr";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  pick: (ps: string, dr: string) => string;
  splitPick: (combined: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("kandahar_wms_lang") as Lang) || "ps";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem("kandahar_wms_lang", l);
    setLangState(l);
  };

  const pick = (ps: string, dr: string) => (lang === "ps" ? ps : dr);

  const splitPick = (combined: string) => {
    if (!combined.includes(" / ")) return combined;
    const parts = combined.split(" / ");
    return lang === "ps" ? (parts[0] || combined) : (parts[1] || combined);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, pick, splitPick }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
