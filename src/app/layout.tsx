import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers/ThemeProvider";
import { GooeyToastProvider } from "@/components/GooeyToastProvider";
import "./globals.css";
import "goey-toast/styles.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

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
        className={`${inter.className} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <GooeyToastProvider />
        </Providers>
      </body>
    </html>
  );
}
