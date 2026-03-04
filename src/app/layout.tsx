import type { Metadata } from "next";
import { Providers } from "@/providers/ThemeProvider";
import { DevToolsProtection } from "@/components/DevToolsProtection";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sutie Xù Xì | Kho lưu trữ bản dịch thuật",
  description: "Nơi lưu giữ những bản dịch thuật tâm huyết của Sutie Xù Xì.",
  icons: {
    icon: "/icon_meta.png",
    apple: "/icon_meta.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-white dark:bg-[#0e0505] text-red-950 dark:text-red-50"
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
