'use client';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthContext';
import { ThumbnailBlurProvider } from './ThumbnailBlurProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <ThumbnailBlurProvider>
          {children}
        </ThumbnailBlurProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
