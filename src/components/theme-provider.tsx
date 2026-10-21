"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ComponentProps, useEffect } from "react";

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}

const MAP = { LIGHT: "light", DARK: "dark", SYSTEM: "system" } as const;

/** Menyelaraskan tema browser dengan preferensi yang tersimpan di database (UserPreference). */
export function ThemeSync({ theme }: { theme: keyof typeof MAP }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(MAP[theme]);
  }, [theme, setTheme]);
  return null;
}
