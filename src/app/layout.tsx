import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/providers/ThemeProvider";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { UploadProgressProvider } from "@/providers/UploadProgressProvider";
import { SiteNav } from "@/components/SiteNav";
import { GooeyToastProvider } from "@/components/GooeyToastProvider";
import "./globals.css";
import "goey-toast/styles.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    icon: "/logo.png",
    apple: "/logo.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body
        className={`${sfPro.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>
          <UploadProgressProvider>
            <SmoothScrollProvider>
              <SiteNav />
              {children}
              <GooeyToastProvider />
            </SmoothScrollProvider>
          </UploadProgressProvider>
        </Providers>
      </body>
    </html>
  );
}
