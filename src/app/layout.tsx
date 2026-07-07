import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/providers/ThemeProvider";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { SiteNav } from "@/components/SiteNav";
import { GooeyToastProvider } from "@/components/GooeyToastProvider";
import "./globals.css";
import "goey-toast/styles.css";

const sfPro = localFont({
  src: [
    {
      path: "../../public/fonts/SFPRODISPLAYREGULAR.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYMEDIUM.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYBOLD.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sf-pro",
});

export const metadata: Metadata = {
  title: "Sutie Xù Xì ",
  description: "Nơi lưu giữ những bản dịch thuật của Sutie Xù Xì.",
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
        className={`${sfPro.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>
          <SmoothScrollProvider>
            <SiteNav />
            {children}
            <GooeyToastProvider />
          </SmoothScrollProvider>
        </Providers>
      </body>
    </html>
  );
}
