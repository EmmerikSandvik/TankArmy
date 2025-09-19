'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"         // setter class på <html>
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange // smooth bytte
    >
      {children}
    </NextThemesProvider>
  )
}
