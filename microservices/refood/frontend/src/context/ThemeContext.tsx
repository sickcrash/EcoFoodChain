import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";

export type ThemeContextType = {
  /** true se il tema è dark */
  isDarkMode: boolean;
  /** forza il valore di isDarkMode */
  setDarkMode: (value: boolean) => void;
  /** toggla tra light/dark */
  toggleTheme: () => void;
  /** schema OS corrente ("light" | "dark" | null) solo informativo */
  scheme: ColorSchemeName;
};

/**
 * NOTA IMPORTANTE:
 * Usiamo un valore di default completo, così `useContext(ThemeContext)`
 * restituisce SEMPRE `ThemeContextType` (non `ThemeContextType | undefined`).
 * In questo modo spariscono gli errori TS2339 nei tuoi file esistenti
 * senza doverli toccare.
 */
export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  setDarkMode: () => {},
  toggleTheme: () => {},
  scheme: "light",
});

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const initialScheme = Appearance?.getColorScheme?.() ?? "light";
  const [scheme, setScheme] = useState<ColorSchemeName>(initialScheme);
  const [isDarkMode, setDarkMode] = useState<boolean>(initialScheme === "dark");

  // opzionale: tieni sincronizzato con il tema di sistema (senza sovrascrivere i toggle manuali)
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme);
      // se vuoi che il sistema prevalga sempre, scommenta la riga sotto:
      // setDarkMode(colorScheme === "dark");
    });
    return () => sub.remove();
  }, []);

  const toggleTheme = () => setDarkMode((v) => !v);

  const value = useMemo<ThemeContextType>(
    () => ({
      isDarkMode,
      setDarkMode,
      toggleTheme,
      scheme,
    }),
    [isDarkMode, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/** Hook comodo (facoltativo). Nei tuoi file puoi continuare a usare useContext(ThemeContext). */
export const useThemeContext = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  return ctx;
};
