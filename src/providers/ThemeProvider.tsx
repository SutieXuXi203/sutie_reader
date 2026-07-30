'use client';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, type User } from './AuthContext';
import { ThumbnailBlurProvider } from './ThumbnailBlurProvider';

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <ThumbnailBlurProvider>
          {children}
        </ThumbnailBlurProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
