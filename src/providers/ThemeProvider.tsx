'use client';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthContext';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}
