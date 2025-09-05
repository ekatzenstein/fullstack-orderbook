"use client";

import { ThemeProvider } from "next-themes";
import * as React from "react";

type ThemeProviderClientProps = {
  children: React.ReactNode;
};

export function ThemeProviderClient({ children }: ThemeProviderClientProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
